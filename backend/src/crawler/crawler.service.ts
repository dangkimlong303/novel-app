import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';

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

  private async createBrowser(): Promise<Browser> {
    // Use 'shell' headless mode — harder for sites to detect than default headless
    // Falls back to headed mode if shell is not available
    return chromium.launch({
      headless: false,
      args: ['--window-position=-2400,-2400'], // Move window off-screen
    });
  }

  /**
   * Navigate to book page and click "Chapters" tab.
   */
  private async navigateToChapterList(page: Page): Promise<void> {
    await page.goto('https://novelight.net/book/shadow-slave-novel', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForTimeout(5000);
    this.logger.log('Book page loaded');

    // Click the "Chapters" tab
    this.logger.log('Clicking "Chapters" tab...');
    await page.locator('a, button, [role="tab"]', { hasText: 'Chapters' }).first().click();
    await page.waitForTimeout(3000);
    this.logger.log('Chapters tab active');
  }

  /**
   * Build chapter index for a given chapter number.
   *
   * Page structure:
   * - "Chapters" tab must be clicked first
   * - Range is controlled by <select id="select-pagination-chapter">
   *   with options like value="60" text="1 - 42", value="1" text="2943 - 2992"
   * - Chapter links are <a class="chapter" href="/book/chapter/ID">
   *   containing text like "NUM chapter - TITLE"
   */
  private async buildIndexForChapter(page: Page, chapterNumber: number): Promise<void> {
    await this.navigateToChapterList(page);

    // Find which <select> option contains our chapter number
    const optionValue = await page.evaluate((targetNum: number) => {
      const sel = document.querySelector('#select-pagination-chapter') as HTMLSelectElement;
      if (!sel) return null;
      for (const opt of Array.from(sel.options)) {
        const text = opt.textContent?.trim() ?? '';
        const match = text.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
        if (match) {
          const start = parseInt(match[1], 10);
          const end = parseInt(match[2], 10);
          if (targetNum >= start && targetNum <= end) {
            return { value: opt.value, text };
          }
        }
      }
      return null;
    }, chapterNumber);

    if (!optionValue) {
      throw new Error(`Could not find range option for chapter ${chapterNumber}`);
    }

    this.logger.log(`Selecting range "${optionValue.text}" (value=${optionValue.value})`);

    // Remember current first chapter to detect when DOM updates
    const firstChapterBefore = await page.evaluate(() => {
      const first = document.querySelector('a.chapter');
      return first?.textContent?.trim().substring(0, 20) ?? '';
    });

    // Select the range
    await page.selectOption('#select-pagination-chapter', optionValue.value);

    // Wait for the chapter list to update
    try {
      await page.waitForFunction(
        (oldText: string) => {
          const first = document.querySelector('a.chapter');
          const newText = first?.textContent?.trim().substring(0, 20) ?? '';
          return newText !== oldText && newText.length > 0;
        },
        firstChapterBefore,
        { timeout: 10000 },
      );
      this.logger.log('Chapter list updated');
    } catch {
      // Fallback: manually dispatch change event
      this.logger.log('Dispatching change event manually...');
      await page.evaluate(() => {
        const sel = document.querySelector('#select-pagination-chapter') as HTMLSelectElement;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await page.waitForTimeout(5000);
    }

    // Extract chapter links
    await this.extractChapterLinks(page);
  }

  /**
   * Extract chapter_number → URL from visible chapter links.
   * Links: <a class="chapter" href="/book/chapter/ID"> with text "NUM chapter - TITLE"
   */
  private async extractChapterLinks(page: Page): Promise<void> {
    const links = await page.evaluate(() => {
      const results: Array<{ num: number; href: string }> = [];
      document.querySelectorAll('a.chapter').forEach((link) => {
        const href = link.getAttribute('href');
        const text = link.textContent?.trim() ?? '';
        const match = text.match(/^(\d+)\s+chapter/);
        if (href && match) {
          results.push({
            num: parseInt(match[1], 10),
            href: href.startsWith('http') ? href : `https://novelight.net${href}`,
          });
        }
      });
      return results;
    });

    for (const { num, href } of links) {
      this.chapterIndex.set(num, href);
    }

    this.logger.log(`Index: ${links.length} links extracted, ${this.chapterIndex.size} total cached`);
  }

  async crawlChapter(chapterNumber: number): Promise<{ title: string; content: string }> {
    const browser = await this.createBrowser();
    try {
      const context = await browser.newContext({
        userAgent: this.getRandomUserAgent(),
        viewport: { width: 1920, height: 1080 },
      });
      const page = await context.newPage();

      // Step 1: Find chapter URL (build index if not cached)
      if (!this.chapterIndex.has(chapterNumber)) {
        this.logger.log(`Building index for chapter ${chapterNumber}...`);
        await this.buildIndexForChapter(page, chapterNumber);
      }

      const chapterUrl = this.chapterIndex.get(chapterNumber);
      if (!chapterUrl) {
        throw new Error(`Could not find URL for chapter ${chapterNumber}`);
      }

      // Step 2: Navigate to chapter page
      this.logger.log(`Crawling: ${chapterUrl}`);
      await page.goto(chapterUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(5000);

      // Step 3: Extract title — only the chapter name part
      // CHAPTER_TITLE format: "NUM chapter - Title Name"
      // We want just "Title Name"
      const title = await page.evaluate((chapNum: number) => {
        const raw = (window as any).CHAPTER_TITLE
          ?? document.querySelector('h1')?.textContent?.trim()
          ?? document.title;

        // Try to extract just the title after "NUM chapter - "
        const match = raw.match(/\d+\s+chapter\s*[-–—]\s*(.+)/i);
        if (match) return match[1].trim();

        // Fallback: remove book name prefix like "Shadow Slave (Novel) - "
        const cleaned = raw.replace(/^.*?\)\s*[-–—]\s*/, '').trim();
        return cleaned || `Chapter ${chapNum}`;
      }, chapterNumber);
      this.logger.log(`Title: ${title}`);

      // Step 4: Wait for chapter content to load
      // The content container is div.chapter-text (may also have extra class like "tfyslo")
      // Content is loaded dynamically — wait up to 30s
      try {
        await page.waitForFunction(
          () => {
            const el = document.querySelector('.chapter-text, [class*="chapter-text"]');
            return el && (el.textContent?.trim().length ?? 0) > 100;
          },
          { timeout: 30000 },
        );
        this.logger.log('.chapter-text found with content');
      } catch {
        this.logger.warn('.chapter-text content not loaded within 30s');
      }

      // Extract content — try <p> tags first, fall back to full textContent
      let paragraphs = await page.locator('.chapter-text p, [class*="chapter-text"] p').allTextContents();
      if (paragraphs.length === 0) {
        // No <p> tags — get raw text and split by newlines
        const rawText = await page.evaluate(() => {
          const el = document.querySelector('.chapter-text, [class*="chapter-text"]');
          return el?.textContent ?? '';
        });
        this.logger.log(`No <p> tags, using raw text (${rawText.length} chars)`);
        paragraphs = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      }

      // Clean content: remove ads, scripts, watermarks
      const cleaned = paragraphs
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
        .filter((p) => {
          // Remove JS/ad artifacts
          if (/^window\.\w+/.test(p)) return false;
          if (/^Ya\.Context/.test(p)) return false;
          if (/^var\s+\w+/.test(p)) return false;
          if (/^\}\s*\)/.test(p)) return false;
          if (/^["']blockId["']/.test(p)) return false;
          if (/^["']renderTo["']/.test(p)) return false;
          if (/pubfuturetag/.test(p)) return false;
          if (/AdvManager/.test(p)) return false;
          if (/yandex_rtb/.test(p)) return false;
          return true;
        })
        .map((p) => {
          // Remove inline watermarks like ~Nоvеl𝕚ght~ or similar site names
          return p
            .replace(/~[^~]{2,20}~/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
        })
        .filter((p) => p.length > 0);

      this.logger.log(`Found ${cleaned.length} content blocks (after cleaning)`);

      const content = cleaned.join('\n\n');

      if (!content) {
        throw new Error(`No content found for chapter ${chapterNumber}`);
      }

      this.logger.log(`Content: ${content.length} chars`);
      return { title: title?.trim() ?? `Chapter ${chapterNumber}`, content };
    } finally {
      await browser.close();
    }
  }

  async getLatestChapterNumber(): Promise<number> {
    const browser = await this.createBrowser();
    try {
      const context = await browser.newContext({
        userAgent: this.getRandomUserAgent(),
        viewport: { width: 1920, height: 1080 },
      });
      const page = await context.newPage();

      await this.navigateToChapterList(page);

      const latestNumber = await page.evaluate(() => {
        let max = 0;
        document.querySelectorAll('a.chapter').forEach((link) => {
          const text = link.textContent?.trim() ?? '';
          const match = text.match(/^(\d+)\s+chapter/);
          if (match) {
            max = Math.max(max, parseInt(match[1], 10));
          }
        });
        return max;
      });

      if (latestNumber === 0) {
        throw new Error('Could not detect latest chapter number from site');
      }

      this.logger.log(`Latest chapter on site: ${latestNumber}`);
      return latestNumber;
    } finally {
      await browser.close();
    }
  }
}
