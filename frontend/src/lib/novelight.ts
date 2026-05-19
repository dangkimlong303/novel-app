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
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Ch-Ua': '"Chromium";v="120", "Not(A:Brand";v="24", "Google Chrome";v="120"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"macOS"',
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
  const text = html
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

  const contentUrl = `${BASE_URL}/book/ajax/read-chapter/${chapterId}`;
  const contentRes = await fetch(contentUrl, { headers: headers(chapterUrl) });
  if (!contentRes.ok) throw new Error(`Content API ${contentRes.status}`);
  const contentData = (await contentRes.json()) as { content: string };

  const content = cleanContent(contentData.content);
  if (!content) throw new Error(`No content for chapter ${chapterNumber}`);

  return { title, content };
}
