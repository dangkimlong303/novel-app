import { Injectable, Logger } from '@nestjs/common';
// import { chromium, Browser, Page } from 'playwright'; // TEMPORARY: disabled — using HTTP-based crawling instead

const BASE_URL = 'https://novelight.net';
const BOOK_ID = '95'; // Shadow Slave book ID on novelight.net

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  // Cache: chapter_number → chapter page URL
  private chapterIndex = new Map<number, string>();

  private readonly userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ];

  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  getRandomDelay(): number {
    return Math.floor(Math.random() * 3000) + 2000;
  }

  // ============================================================
  // HTTP-based crawling (no browser needed)
  // Uses internal AJAX APIs discovered from the site:
  //   - GET /book/ajax/chapter-pagination?book_id=95&page=N → chapter list HTML
  //   - GET /book/ajax/read-chapter/{chapterId} → { class, content } JSON
  // ============================================================

  private httpHeaders() {
    return {
      'User-Agent': this.getRandomUserAgent(),
      'Referer': `${BASE_URL}/book/shadow-slave-novel`,
      'X-Requested-With': 'XMLHttpRequest',
    };
  }

  /**
   * Build chapter index via HTTP API.
   * Fetches the chapter pagination page that contains our target chapter number.
   *
   * API: GET /book/ajax/chapter-pagination?book_id=95&page=N
   * Returns HTML with <a href="/book/chapter/ID"> links
   *
   * The site has 60 pages (page=1 is latest, page=60 is chapters 1-42).
   * We need to find which page contains our target chapter.
   * Strategy: fetch page=60 (oldest) first to get the range, then binary search if needed.
   * Simpler: just try pages from 60 down until we find our chapter.
   */
  private async buildIndexViaHttp(chapterNumber: number): Promise<void> {
    // Try each page from the oldest (60) to newest (1) to find the target chapter
    // Each page contains ~50 chapters. We can calculate approximately which page to try.
    // Page 60 = chapters 1-42, page 59 = chapters 43-92, etc.
    // But the exact mapping may vary, so we try a few pages.

    // Start with page 60 (oldest) for low chapter numbers, page 1 for high
    const startPage = chapterNumber <= 50 ? 60 : 1;
    const direction = chapterNumber <= 50 ? -1 : 1;

    for (let attempt = 0; attempt < 5; attempt++) {
      const pageNum = startPage + attempt * direction;
      if (pageNum < 1 || pageNum > 60) break;

      const url = `${BASE_URL}/book/ajax/chapter-pagination?book_id=${BOOK_ID}&page=${pageNum}`;
      this.logger.log(`[HTTP] Fetching chapter index: ${url}`);

      const res = await fetch(url, { headers: this.httpHeaders() });
      if (!res.ok) {
        this.logger.warn(`[HTTP] Pagination API returned ${res.status}`);
        continue;
      }

      const data = await res.json() as { html: string };
      const html = data.html;

      // Parse chapter links from HTML
      // Format: <a href="/book/chapter/ID" class="chapter">
      //           <div class="title">NUM chapter - <span>Title</span></div>
      const linkRegex = /href="\/book\/chapter\/(\d+)"[\s\S]*?(\d+)\s+chapter\s*-\s*<span>([^<]+)<\/span>/g;
      let match: RegExpExecArray | null;
      let foundTarget = false;

      while ((match = linkRegex.exec(html)) !== null) {
        const chapterId = match[1];
        const num = parseInt(match[2], 10);
        const chapterUrl = `${BASE_URL}/book/chapter/${chapterId}`;
        this.chapterIndex.set(num, chapterUrl);
        if (num === chapterNumber) foundTarget = true;
      }

      this.logger.log(`[HTTP] Page ${pageNum}: extracted links, total cached: ${this.chapterIndex.size}`);

      if (foundTarget) {
        this.logger.log(`[HTTP] Found chapter ${chapterNumber} in page ${pageNum}`);
        return;
      }
    }

    if (!this.chapterIndex.has(chapterNumber)) {
      throw new Error(`[HTTP] Could not find chapter ${chapterNumber} in pagination API`);
    }
  }

  /**
   * Crawl chapter content via HTTP API.
   *
   * API: GET /book/ajax/read-chapter/{chapterId}
   * Returns JSON: { class: string, content: string (HTML) }
   */
  async crawlChapterViaHttp(chapterNumber: number): Promise<{ title: string; content: string }> {
    // Step 1: Find chapter URL
    if (!this.chapterIndex.has(chapterNumber)) {
      this.logger.log(`[HTTP] Building index for chapter ${chapterNumber}...`);
      await this.buildIndexViaHttp(chapterNumber);
    }

    const chapterUrl = this.chapterIndex.get(chapterNumber);
    if (!chapterUrl) {
      throw new Error(`[HTTP] No URL found for chapter ${chapterNumber}`);
    }

    // Extract chapter ID from URL: /book/chapter/32989 → 32989
    const chapterIdMatch = chapterUrl.match(/\/book\/chapter\/(\d+)/);
    if (!chapterIdMatch) {
      throw new Error(`[HTTP] Invalid chapter URL: ${chapterUrl}`);
    }
    const chapterId = chapterIdMatch[1];

    // Step 2: Fetch chapter page to get title (from HTML meta/title)
    const pageUrl = `${BASE_URL}/book/chapter/${chapterId}`;
    this.logger.log(`[HTTP] Fetching chapter page: ${pageUrl}`);
    const pageRes = await fetch(pageUrl, { headers: { 'User-Agent': this.getRandomUserAgent() } });
    if (!pageRes.ok) {
      throw new Error(`[HTTP] Chapter page returned ${pageRes.status}`);
    }
    const pageHtml = await pageRes.text();

    // Extract title from CHAPTER_TITLE JS variable in the page
    const titleMatch = pageHtml.match(/CHAPTER_TITLE\s*=\s*["'](.+?)["']/);
    let title = `Chapter ${chapterNumber}`;
    if (titleMatch) {
      const rawTitle = titleMatch[1];
      const nameMatch = rawTitle.match(/\d+\s+chapter\s*[-–—]\s*(.+)/i);
      title = nameMatch ? nameMatch[1].trim() : rawTitle;
    }
    this.logger.log(`[HTTP] Title: ${title}`);

    // Step 3: Fetch chapter content via AJAX API
    const contentUrl = `${BASE_URL}/book/ajax/read-chapter/${chapterId}`;
    this.logger.log(`[HTTP] Fetching content: ${contentUrl}`);
    const contentRes = await fetch(contentUrl, {
      headers: {
        ...this.httpHeaders(),
        'Referer': pageUrl,
      },
    });
    if (!contentRes.ok) {
      throw new Error(`[HTTP] Content API returned ${contentRes.status}`);
    }

    const contentData = await contentRes.json() as { class: string; content: string };
    const contentHtml = contentData.content;
    this.logger.log(`[HTTP] Raw HTML length: ${contentHtml.length}`);

    // Step 4: Convert HTML to clean text
    // Replace <br>, </div>, </p> with newlines, then strip all tags
    let text = contentHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '')
      // Decode common HTML entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&nbsp;/g, ' ');

    // Split into paragraphs and clean
    const cleaned = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      // Remove JS/ad artifacts
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
      // Remove watermarks
      .map((p) =>
        p
          .replace(/~[^~]{2,30}~/g, '')
          .replace(/[✪★☆⭐🌟][^✪★☆⭐🌟]{2,40}[✪★☆⭐🌟](\s*\([^)]*\))?/g, '')
          .replace(/\(Official version\)/gi, '')
          .replace(/\s{2,}/g, ' ')
          .trim(),
      )
      .filter((p) => p.length > 0);

    this.logger.log(`[HTTP] Cleaned: ${cleaned.length} paragraphs`);

    const content = cleaned.join('\n\n');
    if (!content) {
      throw new Error(`[HTTP] No content extracted for chapter ${chapterNumber}`);
    }

    this.logger.log(`[HTTP] Content: ${content.length} chars`);
    return { title, content };
  }

  /**
   * Get latest chapter number via HTTP API.
   * Fetches page=1 (newest chapters) and extracts the highest chapter number.
   */
  async getLatestChapterNumberViaHttp(): Promise<number> {
    const url = `${BASE_URL}/book/ajax/chapter-pagination?book_id=${BOOK_ID}&page=1`;
    this.logger.log(`[HTTP] Fetching latest chapters: ${url}`);

    const res = await fetch(url, { headers: this.httpHeaders() });
    if (!res.ok) {
      throw new Error(`[HTTP] Pagination API returned ${res.status}`);
    }

    const data = await res.json() as { html: string };
    const matches = [...data.html.matchAll(/(\d+)\s+chapter\s*-/g)];
    const numbers = matches.map((m) => parseInt(m[1], 10));
    const latest = Math.max(...numbers);

    if (!latest || latest === -Infinity) {
      throw new Error('[HTTP] Could not detect latest chapter number');
    }

    this.logger.log(`[HTTP] Latest chapter: ${latest}`);
    return latest;
  }

  // ============================================================
  // TEMPORARY: Playwright-based crawling disabled — using HTTP instead.
  // Kept as backup. To re-enable:
  //   1. Uncomment the playwright import at the top
  //   2. Uncomment the methods below
  //   3. Change chapters.service.ts to call crawlChapter / getLatestChapterNumber
  // ============================================================

  /*
  private async createBrowser(): Promise<Browser> {
    return chromium.launch({
      headless: false,
      args: ['--window-position=-2400,-2400'],
    });
  }

  private async navigateToChapterList(page: Page): Promise<void> {
    await page.goto('https://novelight.net/book/shadow-slave-novel', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForTimeout(5000);
    this.logger.log('Clicking "Chapters" tab...');
    await page.locator('a, button, [role="tab"]', { hasText: 'Chapters' }).first().click();
    await page.waitForTimeout(3000);
  }

  async crawlChapter(chapterNumber: number): Promise<{ title: string; content: string }> {
    // ... Playwright-based crawling — see git history for full implementation
    throw new Error('Playwright crawling disabled — use crawlChapterViaHttp instead');
  }

  async getLatestChapterNumber(): Promise<number> {
    // ... Playwright-based — see git history for full implementation
    throw new Error('Playwright crawling disabled — use getLatestChapterNumberViaHttp instead');
  }
  */
}
