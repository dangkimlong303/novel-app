# Auto-Sync Cron — Design Spec

## Overview

Add a daily cron job on Vercel that auto-crawls new chapters from novelight.net and saves to Supabase. No backend (NestJS) needed — the cron endpoint lives in Next.js and uses Prisma directly.

## Constraints

- **Vercel Free plan:** cron runs **once per day** only.
- **Vercel function timeout:** **10 seconds** (free tier).
- **Latency:** Vercel ↔ Supabase ~2-3s per DB call.

## Solution

Single Next.js API route `GET /api/cron/sync` that:
1. Reads max chapter number from DB
2. Fetches latest chapter number from novelight (HTTP, ~1s)
3. Crawls **up to 2 chapters** (limit to stay under 10s timeout)
4. Returns JSON summary

If site has more than 2 missing chapters, the next day's cron picks up the rest. For a novel that releases ~5-10 chapters/week, this catches up quickly.

## Endpoint

**`GET /api/cron/sync`**

Returns:
```json
{
  "checked": true,
  "latestOnSite": 2995,
  "latestInDb": 2993,
  "crawled": [
    { "chapter_number": 2994, "title": "...", "status": "success" },
    { "chapter_number": 2995, "title": "...", "status": "success" }
  ],
  "remaining": 0
}
```

If no new chapters:
```json
{ "checked": true, "latestOnSite": 2993, "latestInDb": 2993, "crawled": [], "remaining": 0 }
```

If error:
```json
{ "error": "Could not fetch latest from novelight" }
```

## Logic

```typescript
const MAX_CHAPTERS_PER_RUN = 2;

GET /api/cron/sync:
  1. authorize (check CRON_SECRET header)
  2. latestInDb = SELECT MAX(chapter_number) FROM Chapter
  3. latestOnSite = fetch novelight pagination page 1, extract max chapter number
  4. if latestOnSite <= latestInDb: return { crawled: [], remaining: 0 }
  5. toFetch = chapters [latestInDb+1, ..., min(latestInDb+2, latestOnSite)]
  6. for each chapter in toFetch (sequential):
       - find URL from novelight pagination
       - fetch chapter content via /book/ajax/read-chapter/{id}
       - INSERT to Supabase
  7. return summary
```

## Vercel Cron Configuration

In `vercel.json` (project root or frontend folder):

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

Schedule `0 1 * * *` = 1AM UTC = 8AM Vietnam (UTC+7).

## Security

Vercel cron requests include a `Authorization: Bearer ${CRON_SECRET}` header. Set `CRON_SECRET` env var in Vercel dashboard. The endpoint rejects requests without valid secret.

## Files to Create/Modify

| File | Action |
|------|--------|
| `frontend/src/app/api/cron/sync/route.ts` | New — cron endpoint |
| `frontend/src/lib/novelight.ts` | New — novelight HTTP crawler helpers (extracted from backend) |
| `frontend/vercel.json` | New — cron schedule config |
| Vercel env vars | Add `CRON_SECRET` (any random string) |

## Out of Scope

- Hourly/more frequent cron (requires Pro plan)
- Crawling more than 2 chapters per run (timeout risk)
- Notifications when new chapters arrive
- Backend (NestJS) changes — backend stays local-only for manual crawls

## Why Extract Crawler to Frontend?

Current crawler is in `backend/src/crawler/crawler.service.ts` (NestJS service). Vercel runs the Next.js app from `frontend/`, so it can't import backend code. We extract just the HTTP-based crawl logic (no Playwright, no NestJS) into a plain TypeScript module in `frontend/src/lib/novelight.ts`.

Local backend remains unchanged — useful for batch/manual crawls.
