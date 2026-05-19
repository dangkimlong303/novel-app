import { Injectable, Logger } from '@nestjs/common';
import { chromium } from 'playwright';

/**
 * Crawler for novelfull.net — uses Playwright because of Cloudflare protection.
 *
 * Used as fallback when chapters are missing from novelight.net.
 * URL pattern: https://novelfull.net/shadow-slave/chapter-{number}-{slug}.html
 *
 * Since we don't know the slug, we search for the chapter on the site.
 */
@Injectable()
export class NovelfullService {
  private readonly logger = new Logger(NovelfullService.name);

  private readonly userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ];

  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  /**
   * Crawl a chapter from novelfull.net by chapter number.
   *
   * Flow:
   * 1. Go to Shadow Slave chapter list page
   * 2. Search/navigate to find the chapter link
   * 3. Navigate to chapter page
   * 4. Wait for Cloudflare challenge to pass
   * 5. Extract title and content
   */
  async crawlChapter(chapterNumber: number): Promise<{ title: string; content: string }> {
    this.logger.log(`[Novelfull] Starting crawl for chapter ${chapterNumber}`);

    const browser = await chromium.launch({
      headless: false,
      args: ['--window-position=-2400,-2400'],
    });

    try {
      const context = await browser.newContext({
        userAgent: this.getRandomUserAgent(),
        viewport: { width: 1920, height: 1080 },
      });
      const page = await context.newPage();

      // Step 1: Search for the chapter on novelfull
      // URL pattern: /shadow-slave/chapter-{number}-{slug}.html
      // We can try the search page or chapter list
      const searchUrl = `https://novelfull.net/shadow-slave.html`;
      this.logger.log(`[Novelfull] Loading book page: ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Wait for Cloudflare challenge to pass (up to 30s)
      this.logger.log(`[Novelfull] Waiting for Cloudflare challenge...`);
      try {
        await page.waitForFunction(
          () => !document.title.includes('Just a moment'),
          { timeout: 30000 },
        );
      } catch {
        this.logger.warn(`[Novelfull] Cloudflare challenge may not have resolved`);
      }
      await page.waitForTimeout(3000);
      this.logger.log(`[Novelfull] Page title: ${await page.title()}`);

      // Step 2: Find the chapter link
      // novelfull has a chapter list. Find link containing "chapter-{number}"
      // The chapter list may be paginated, so we search for the link
      const chapterUrl = await this.findChapterUrl(page, chapterNumber);

      if (!chapterUrl) {
        throw new Error(`[Novelfull] Could not find chapter ${chapterNumber} URL`);
      }

      // Step 3: Navigate to chapter page
      this.logger.log(`[Novelfull] Navigating to: ${chapterUrl}`);
      await page.goto(chapterUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Wait for Cloudflare again
      try {
        await page.waitForFunction(
          () => !document.title.includes('Just a moment'),
          { timeout: 30000 },
        );
      } catch {
        this.logger.warn(`[Novelfull] Cloudflare challenge on chapter page`);
      }
      await page.waitForTimeout(3000);
      this.logger.log(`[Novelfull] Chapter page title: ${await page.title()}`);

      // Step 4: Extract title
      const title = await page.evaluate(function() {
        // Try multiple selectors for title
        var h1 = document.querySelector('.chapter-title, h2.chapter-title, .chr-title, h1');
        if (h1 && h1.textContent) return h1.textContent.trim();
        return document.title.split(' - ')[0].trim();
      });

      // Clean title: remove "Chapter XXXX" prefix, keep just the name
      var cleanTitle = title;
      var titleMatch = title.match(/chapter[\s-]*\d+[\s:.-]*(.*)/i);
      if (titleMatch && titleMatch[1]) {
        cleanTitle = titleMatch[1].trim();
      }
      this.logger.log(`[Novelfull] Title: ${cleanTitle}`);

      // Step 5: Extract content
      const rawParagraphs = await page.evaluate(function() {
        // novelfull uses #chapter-content or .chapter-c for content
        var el = document.querySelector('#chapter-content, #chapter-c, .chapter-c') as HTMLElement;
        if (!el) return [];

        // Remove ads, scripts
        el.querySelectorAll('script, style, noscript, ins, iframe, .ads, .adsbygoogle').forEach(function(s) { s.remove(); });

        return el.innerText
          .split('\n')
          .map(function(line) { return line.trim(); })
          .filter(function(line) { return line.length > 0; });
      });

      this.logger.log(`[Novelfull] Raw paragraphs: ${rawParagraphs.length}`);

      if (rawParagraphs.length === 0) {
        // Debug: log what selectors exist
        const debug = await page.evaluate(function() {
          return Array.from(document.querySelectorAll('[id*="chapter"], [class*="chapter"]')).map(function(el) {
            return { tag: el.tagName, id: el.id, class: el.className?.toString().substring(0, 60), textLen: el.textContent?.length || 0 };
          });
        });
        this.logger.log(`[Novelfull] Debug selectors: ${JSON.stringify(debug)}`);
        await page.screenshot({ path: '/tmp/novelfull-debug.png' });
        throw new Error(`[Novelfull] No content found for chapter ${chapterNumber}`);
      }

      // Clean content
      const cleaned = rawParagraphs
        .filter(function(p) {
          if (/^window\.\w+/.test(p)) return false;
          if (/pubfuturetag/.test(p)) return false;
          if (/AdvManager/.test(p)) return false;
          if (/^\}\s*$/.test(p)) return false;
          if (/^\)\s*$/.test(p)) return false;
          if (/advertisement/i.test(p)) return false;
          return true;
        })
        .map(function(p) {
          return p
            .replace(/~[^~]{2,30}~/g, '')
            .replace(/[✪★☆⭐🌟][^✪★☆⭐🌟]{2,40}[✪★☆⭐🌟](\s*\([^)]*\))?/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
        })
        .filter(function(p) { return p.length > 0; });

      const content = cleaned.join('\n\n');

      if (!content) {
        throw new Error(`[Novelfull] Empty content after cleaning for chapter ${chapterNumber}`);
      }

      this.logger.log(`[Novelfull] Content: ${cleaned.length} paragraphs, ${content.length} chars`);
      return { title: cleanTitle, content };
    } finally {
      await browser.close();
    }
  }

  /**
   * Find chapter URL on the book page.
   * novelfull has chapter list with pagination.
   */
  private async findChapterUrl(page: any, chapterNumber: number): Promise<string | null> {
    // Strategy 1: Look for a link matching "chapter-{number}" in href
    const pattern = `chapter-${chapterNumber}-`;
    this.logger.log(`[Novelfull] Searching for link pattern: ${pattern}`);

    // Check current page first
    var url = await page.evaluate(function(pat: string) {
      var links = document.querySelectorAll('a[href*="' + pat + '"]');
      if (links.length > 0) {
        var href = links[0].getAttribute('href') || '';
        return href.startsWith('http') ? href : 'https://novelfull.net' + href;
      }
      return null;
    }, pattern);

    if (url) {
      this.logger.log(`[Novelfull] Found chapter link on current page: ${url}`);
      return url;
    }

    // Strategy 2: Navigate to a later page in the chapter list
    // novelfull paginates chapters, try to find the right page
    // URL pattern: /shadow-slave.html?page={pageNum}
    const chaptersPerPage = 50;
    const estimatedPage = Math.ceil(chapterNumber / chaptersPerPage);

    for (var offset = 0; offset <= 2; offset++) {
      for (var dir of [0, 1, -1]) {
        var pageNum = estimatedPage + dir * offset;
        if (pageNum < 1) continue;
        if (offset === 0 && dir !== 0) continue;

        var listUrl = `https://novelfull.net/shadow-slave.html?page=${pageNum}`;
        this.logger.log(`[Novelfull] Checking chapter list page ${pageNum}: ${listUrl}`);
        await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for Cloudflare
        try {
          await page.waitForFunction(
            () => !document.title.includes('Just a moment'),
            { timeout: 15000 },
          );
        } catch {}
        await page.waitForTimeout(2000);

        url = await page.evaluate(function(pat: string) {
          var links = document.querySelectorAll('a[href*="' + pat + '"]');
          if (links.length > 0) {
            var href = links[0].getAttribute('href') || '';
            return href.startsWith('http') ? href : 'https://novelfull.net' + href;
          }
          return null;
        }, pattern);

        if (url) {
          this.logger.log(`[Novelfull] Found chapter link on page ${pageNum}: ${url}`);
          return url;
        }
      }
    }

    this.logger.error(`[Novelfull] Chapter ${chapterNumber} not found in chapter list`);
    return null;
  }
}
