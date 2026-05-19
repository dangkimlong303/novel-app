/**
 * HTTP-based crawler for allnovel.org.
 * No Cloudflare, works from cloud IPs (Vercel).
 *
 * URL pattern: https://allnovel.org/shadow-slave/chapter-{N}.html
 */

const BASE_URL = 'https://allnovel.org';
const BOOK_SLUG = 'shadow-slave';

interface CrawlResult {
  title: string;
  content: string;
}

/**
 * Fetch a specific chapter by number.
 * Throws with message containing "404" if chapter does not exist.
 */
export async function crawlChapter(chapterNumber: number): Promise<CrawlResult> {
  const url = `${BASE_URL}/${BOOK_SLUG}/chapter-${chapterNumber}.html`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (res.status === 404) {
    throw new Error(`Chapter ${chapterNumber} not found (404)`);
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for chapter ${chapterNumber}`);
  }

  const html = await res.text();

  const contentMatch = html.match(/id="chapter-content"[^>]*>([\s\S]*?)<\/div>/);
  if (!contentMatch) {
    throw new Error(`No #chapter-content for chapter ${chapterNumber}`);
  }

  const text = contentMatch[1]
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ');

  const paragraphs = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (paragraphs.length === 0) {
    throw new Error(`Empty content for chapter ${chapterNumber}`);
  }

  const titleLine = paragraphs[0];
  const titleMatch = titleLine.match(/Chapter\s+\d+[:.\-\s]+(.+)/i);
  const title = titleMatch ? titleMatch[1].trim() : titleLine;

  const content = paragraphs.slice(1).join('\n\n');
  if (!content) {
    throw new Error(`No body content for chapter ${chapterNumber}`);
  }

  return { title, content };
}
