import { Injectable, Logger } from '@nestjs/common';

/**
 * Crawler for wuxiaworld.eu — backup source, useful for chapters that
 * allnovel.org skips in its numbering (e.g. chapter 3121).
 *
 * It's a Next.js app: chapter data lives in the `__NEXT_DATA__` JSON blob,
 * under the query whose `state.data` is an object with an `index` field.
 * URL pattern: https://wuxiaworld.eu/chapter/shadow-slave-{number}
 *
 * A non-existent chapter still returns HTTP 200 but without chapter data,
 * so existence is detected by the presence of that data object.
 */
@Injectable()
export class WuxiaworldService {
  private readonly logger = new Logger(WuxiaworldService.name);

  private readonly BASE_URL = 'https://wuxiaworld.eu';
  private readonly BOOK_SLUG = 'shadow-slave';
  private readonly USER_AGENT =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  /**
   * Fetch a chapter's raw data object from the Next.js payload.
   * Returns null when the chapter does not exist (page renders without chapter data).
   */
  private async fetchChapterData(chapterNumber: number): Promise<{
    index: number;
    title: string;
    text: string;
    nextChap: number | null;
    prevChap: number | null;
  } | null> {
    const url = `${this.BASE_URL}/chapter/${this.BOOK_SLUG}-${chapterNumber}`;
    const res = await fetch(url, { headers: { 'User-Agent': this.USER_AGENT } });
    if (!res.ok) {
      throw new Error(`[Wuxiaworld] HTTP ${res.status} for chapter ${chapterNumber}`);
    }

    const html = await res.text();
    const match = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
    );
    if (!match) {
      throw new Error(`[Wuxiaworld] No __NEXT_DATA__ found for chapter ${chapterNumber}`);
    }

    let payload: any;
    try {
      payload = JSON.parse(match[1]);
    } catch (e) {
      throw new Error(`[Wuxiaworld] Failed to parse __NEXT_DATA__ for chapter ${chapterNumber}`);
    }

    const queries: any[] = payload?.props?.pageProps?.dehydratedState?.queries ?? [];
    for (const q of queries) {
      const data = q?.state?.data;
      if (data && typeof data === 'object' && !Array.isArray(data) && 'index' in data && 'text' in data) {
        return data;
      }
    }
    return null;
  }

  /**
   * Get the latest chapter number.
   * Exponential + binary search to bound the highest existing chapter,
   * then walk `nextChap` forward to the definitive tail (null = end).
   */
  async getLatestChapterNumber(): Promise<number> {
    this.logger.log('[Wuxiaworld] Detecting latest chapter...');

    const exists = async (n: number) => (await this.fetchChapterData(n)) !== null;

    // Exponential upper bound
    let lo = 1;
    let hi = 2;
    while (await exists(hi)) {
      lo = hi;
      hi *= 2;
      if (hi > 100000) break;
    }

    // Binary search for the largest existing chapter in (lo, hi)
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (await exists(mid)) lo = mid;
      else hi = mid;
    }

    // Walk nextChap forward from the boundary to reach the true tail
    let latest = lo;
    for (;;) {
      const data = await this.fetchChapterData(latest);
      const next = data?.nextChap;
      if (typeof next === 'number' && next > latest) latest = next;
      else break;
    }

    this.logger.log(`[Wuxiaworld] Latest chapter: ${latest}`);
    return latest;
  }

  async crawlChapter(chapterNumber: number): Promise<{ title: string; content: string }> {
    this.logger.log(`[Wuxiaworld] Fetching: ${this.BASE_URL}/chapter/${this.BOOK_SLUG}-${chapterNumber}`);

    const data = await this.fetchChapterData(chapterNumber);
    if (!data) {
      throw new Error(`[Wuxiaworld] Chapter ${chapterNumber} not found`);
    }
    if (data.index !== chapterNumber) {
      throw new Error(`[Wuxiaworld] Index mismatch: got ${data.index}, expected ${chapterNumber}`);
    }

    // Store the name only, matching the other sources (strip "Chapter NNN " prefix).
    const rawTitle = data.title || `Chapter ${chapterNumber}`;
    const titleMatch = rawTitle.match(/Chapter\s+\d+[:.\-\s]+(.+)/i);
    const title = (titleMatch ? titleMatch[1] : rawTitle).trim();

    // `text` is clean plain text with paragraphs separated by single newlines.
    const content = String(data.text)
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .join('\n\n');

    if (!content) {
      throw new Error(`[Wuxiaworld] Empty content for chapter ${chapterNumber}`);
    }

    const paragraphs = content.split('\n\n').length;
    this.logger.log(`[Wuxiaworld] Chapter ${chapterNumber}: "${title}" — ${paragraphs} paragraphs, ${content.length} chars`);
    return { title, content };
  }
}
