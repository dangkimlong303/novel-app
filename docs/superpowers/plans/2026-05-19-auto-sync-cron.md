# Auto-Sync Cron Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Vercel daily cron job that auto-crawls new Shadow Slave chapters from novelight.net and saves to Supabase, with a 2-chapter-per-run limit to stay under Vercel's 10s timeout.

**Architecture:** Self-contained `/api/cron/sync` route in Next.js. Pure HTTP crawler (no Playwright, no NestJS). Reuses existing Prisma client.

**Tech Stack:** Next.js 16 (App Router), Prisma, Vercel Cron Jobs

---

## File Structure

```
frontend/
├── vercel.json                              # New — cron schedule
└── src/
    ├── lib/
    │   └── novelight.ts                     # New — HTTP crawler module
    └── app/
        └── api/
            └── cron/
                └── sync/
                    └── route.ts             # New — cron endpoint
```

---

## Task 1: Novelight HTTP Crawler Module

**Files:**
- Create: `frontend/src/lib/novelight.ts`

- [ ] **Step 1: Create the crawler module**

Create `frontend/src/lib/novelight.ts`:

```typescript
/**
 * HTTP-based crawler for novelight.net.
 * Ported from backend/src/crawler/crawler.service.ts (HTTP methods only).
 * No browser/Playwright needed — works in Vercel serverless.
 */

const BASE_URL = 'https://novelight.net';
const BOOK_ID = '95';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function headers(referer?: string) {
  return {
    'User-Agent': randomUserAgent(),
    'Referer': referer || `${BASE_URL}/book/shadow-slave-novel`,
    'X-Requested-With': 'XMLHttpRequest',
  };
}

interface ChapterLink {
  num: number;
  url: string;
}

function parseChapterLinks(html: string): ChapterLink[] {
  const results: ChapterLink[] = [];
  const regex = /href="\/book\/chapter\/(\d+)"[\s\S]*?(\d+)\s+chapter\s*-\s*<span>([^<]+)<\/span>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    results.push({
      num: parseInt(match[2], 10),
      url: `${BASE_URL}/book/chapter/${match[1]}`,
    });
  }
  return results;
}

async function fetchPaginationPage(pageNum: number): Promise<ChapterLink[]> {
  const url = `${BASE_URL}/book/ajax/chapter-pagination?book_id=${BOOK_ID}&page=${pageNum}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`Pagination API ${res.status}`);
  const data = (await res.json()) as { html: string };
  return parseChapterLinks(data.html);
}

export async function getLatestChapterNumber(): Promise<number> {
  const links = await fetchPaginationPage(1);
  if (links.length === 0) throw new Error('No chapters found on novelight');
  return Math.max(...links.map((l) => l.num));
}

export async function findChapterUrl(chapterNumber: number): Promise<string | null> {
  // Page 1 contains newest, page N contains oldest.
  // Try estimated page first, then nearby pages.
  const latest = await getLatestChapterNumber();
  const chaptersPerPage = 50;
  const totalPages = Math.ceil(latest / chaptersPerPage);
  const estimated = Math.max(1, Math.min(totalPages, totalPages - Math.floor((chapterNumber - 1) / chaptersPerPage)));

  const pagesToTry = [estimated];
  for (let offset = 1; offset <= 2; offset++) {
    if (estimated + offset <= totalPages) pagesToTry.push(estimated + offset);
    if (estimated - offset >= 1) pagesToTry.push(estimated - offset);
  }

  for (const pageNum of pagesToTry) {
    const links = await fetchPaginationPage(pageNum);
    const match = links.find((l) => l.num === chapterNumber);
    if (match) return match.url;
  }
  return null;
}

interface CrawlResult {
  title: string;
  content: string;
}

function cleanContent(html: string): string {
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');

  const cleaned = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((p) => {
      if (/^window\.\w+/.test(p)) return false;
      if (/^Ya\.Context/.test(p)) return false;
      if (/^var\s+\w+/.test(p)) return false;
      if (/^\}\s*\)/.test(p)) return false;
      if (/^["']\w+["']\s*:/.test(p)) return false;
      if (/pubfuturetag/.test(p)) return false;
      if (/AdvManager/.test(p)) return false;
      if (/yandex_rtb/.test(p)) return false;
      if (/\.push\s*\(\s*\{/.test(p)) return false;
      if (/^\}\s*$/.test(p)) return false;
      if (/^\)\s*$/.test(p)) return false;
      return true;
    })
    .map((p) =>
      p
        .replace(/~[^~]{2,30}~/g, '')
        .replace(/[✪★☆⭐🌟][^✪★☆⭐🌟]{2,40}[✪★☆⭐🌟](\s*\([^)]*\))?/g, '')
        .replace(/\(Official version\)/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim(),
    )
    .filter((p) => p.length > 0);

  return cleaned.join('\n\n');
}

export async function crawlChapter(chapterNumber: number): Promise<CrawlResult> {
  const chapterUrl = await findChapterUrl(chapterNumber);
  if (!chapterUrl) {
    throw new Error(`Chapter ${chapterNumber} not found on novelight`);
  }
  const chapterId = chapterUrl.match(/\/book\/chapter\/(\d+)/)?.[1];
  if (!chapterId) throw new Error(`Invalid chapter URL: ${chapterUrl}`);

  // Fetch HTML page for title
  const pageRes = await fetch(chapterUrl, { headers: { 'User-Agent': randomUserAgent() } });
  if (!pageRes.ok) throw new Error(`Chapter page ${pageRes.status}`);
  const pageHtml = await pageRes.text();

  let title = `Chapter ${chapterNumber}`;
  const titleMatch = pageHtml.match(/CHAPTER_TITLE\s*=\s*["'](.+?)["']/);
  if (titleMatch) {
    const raw = titleMatch[1];
    const nameMatch = raw.match(/\d+\s+chapter\s*[-–—]\s*(.+)/i);
    title = nameMatch ? nameMatch[1].trim() : raw;
  }

  // Fetch content via AJAX
  const contentUrl = `${BASE_URL}/book/ajax/read-chapter/${chapterId}`;
  const contentRes = await fetch(contentUrl, { headers: headers(chapterUrl) });
  if (!contentRes.ok) throw new Error(`Content API ${contentRes.status}`);
  const contentData = (await contentRes.json()) as { content: string };

  const content = cleanContent(contentData.content);
  if (!content) throw new Error(`No content for chapter ${chapterNumber}`);

  return { title, content };
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kimlongdang/MyProject/personal/novel-app
git add frontend/src/lib/novelight.ts
git commit -m "feat: add novelight HTTP crawler module for Vercel runtime"
```

---

## Task 2: Cron Endpoint

**Files:**
- Create: `frontend/src/app/api/cron/sync/route.ts`

- [ ] **Step 1: Create the cron endpoint**

Create `frontend/src/app/api/cron/sync/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLatestChapterNumber, crawlChapter } from '@/lib/novelight';

const MAX_CHAPTERS_PER_RUN = 2;

export async function GET(request: NextRequest) {
  // Authorize: Vercel cron sends Authorization: Bearer ${CRON_SECRET}
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const latestRow = await prisma.chapter.findFirst({
      orderBy: { chapter_number: 'desc' },
      select: { chapter_number: true },
    });
    const latestInDb = latestRow?.chapter_number ?? 0;

    const latestOnSite = await getLatestChapterNumber();

    if (latestOnSite <= latestInDb) {
      return NextResponse.json({
        checked: true,
        latestOnSite,
        latestInDb,
        crawled: [],
        remaining: 0,
      });
    }

    const totalMissing = latestOnSite - latestInDb;
    const batchEnd = Math.min(latestInDb + MAX_CHAPTERS_PER_RUN, latestOnSite);
    const toFetch: number[] = [];
    for (let n = latestInDb + 1; n <= batchEnd; n++) toFetch.push(n);

    const crawled: Array<{ chapter_number: number; title?: string; status: string; error?: string }> = [];

    for (const num of toFetch) {
      try {
        const { title, content } = await crawlChapter(num);
        await prisma.chapter.create({ data: { chapter_number: num, title, content } });
        crawled.push({ chapter_number: num, title, status: 'success' });
      } catch (error) {
        crawled.push({ chapter_number: num, status: 'error', error: (error as Error).message });
      }
    }

    return NextResponse.json({
      checked: true,
      latestOnSite,
      latestInDb,
      crawled,
      remaining: totalMissing - crawled.filter((c) => c.status === 'success').length,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/api/cron/sync/route.ts
git commit -m "feat: add /api/cron/sync endpoint with CRON_SECRET auth"
```

---

## Task 3: Vercel Cron Schedule

**Files:**
- Create: `frontend/vercel.json`

- [ ] **Step 1: Create vercel.json**

Create `frontend/vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync",
      "schedule": "0 1 * * *"
    }
  ]
}
```

Schedule: `0 1 * * *` = 1AM UTC = 8AM Vietnam (UTC+7).

- [ ] **Step 2: Commit**

```bash
git add frontend/vercel.json
git commit -m "feat: add Vercel cron schedule — daily 8AM Vietnam for auto-sync"
```

---

## Task 4: Local Test + Deploy

- [ ] **Step 1: Build verification**

```bash
cd /Users/kimlongdang/MyProject/personal/novel-app/frontend
npm run build
```

Expected: Build succeeds. `/api/cron/sync` listed in routes.

- [ ] **Step 2: Local manual test**

Start dev server: `npm run dev`

In another terminal:
```bash
# Without auth — should return 401
curl -i 'http://localhost:3000/api/cron/sync'

# With auth (use any test secret locally, set in frontend/.env)
echo 'CRON_SECRET=test-secret' >> frontend/.env
# Restart dev server, then:
curl -H 'Authorization: Bearer test-secret' 'http://localhost:3000/api/cron/sync'
```

Expected without auth: `{"error":"Unauthorized"}` HTTP 401.
Expected with auth: `{ "checked": true, ... }` with crawled list.

- [ ] **Step 3: Push to GitHub**

```bash
cd /Users/kimlongdang/MyProject/personal/novel-app
git push origin feat/novel-crawler-reader feat/novel-crawler-reader:main
```

- [ ] **Step 4: Set CRON_SECRET on Vercel**

Manual step in Vercel dashboard:
1. Open project Settings → Environment Variables
2. Add `CRON_SECRET` = any random string (e.g. generate with `openssl rand -hex 32`)
3. Apply to Production environment
4. Trigger redeploy (Deployments tab → Redeploy)

- [ ] **Step 5: Verify cron is registered**

Vercel dashboard → Project → Cron Jobs tab.
Should see one cron: path `/api/cron/sync`, schedule `0 1 * * *`, next run at 1AM UTC tomorrow.

- [ ] **Step 6: Manually trigger to test**

From Cron Jobs tab, click "Run" on the cron — it runs immediately with the correct auth. Check logs.

Or via curl with the production secret:
```bash
curl -H "Authorization: Bearer ${CRON_SECRET}" 'https://novel-app-weld.vercel.app/api/cron/sync'
```

Expected: JSON response with `checked: true`. Check Supabase to verify any new chapters appeared.
