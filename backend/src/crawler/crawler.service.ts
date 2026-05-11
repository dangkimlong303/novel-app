import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser } from 'playwright';

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

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
    return chromium.launch({ headless: true });
  }

  async crawlChapter(chapterNumber: number): Promise<{ title: string; content: string }> {
    const browser = await this.createBrowser();
    try {
      const context = await browser.newContext({
        userAgent: this.getRandomUserAgent(),
        viewport: { width: 1920, height: 1080 },
      });
      const page = await context.newPage();

      const url = `https://novelight.net/book/shadow-slave-novel/chapter-${chapterNumber}`;
      this.logger.log(`Crawling: ${url}`);

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      const title = await page
        .locator('.chapter-title, h1, .text-title')
        .first()
        .textContent()
        .then((t) => t?.trim() ?? `Chapter ${chapterNumber}`);

      const paragraphs = await page
        .locator('.chapter-container p, .reading-content p, .text-left p')
        .allTextContents();

      const content = paragraphs
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
        .join('\n\n');

      if (!content) {
        throw new Error(`No content found for chapter ${chapterNumber}`);
      }

      return { title, content };
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

      await page.goto('https://novelight.net/book/shadow-slave-novel', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      const latestNumber = await page.evaluate(() => {
        const links = document.querySelectorAll('a[href*="/chapter-"]');
        let max = 0;
        links.forEach((link) => {
          const match = link.getAttribute('href')?.match(/chapter-(\d+)/);
          if (match) max = Math.max(max, parseInt(match[1], 10));
        });
        return max;
      });

      this.logger.log(`Latest chapter on site: ${latestNumber}`);
      return latestNumber;
    } finally {
      await browser.close();
    }
  }
}
