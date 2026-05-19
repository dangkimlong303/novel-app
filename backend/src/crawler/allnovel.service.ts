import { Injectable, Logger } from '@nestjs/common';

/**
 * Crawler for allnovel.org — backup source for chapters missing from novelight.net.
 *
 * Pros: no Cloudflare, simple HTTP, predictable URL pattern.
 * URL pattern: https://allnovel.org/shadow-slave/chapter-{number}.html
 */
@Injectable()
export class AllnovelService {
  private readonly logger = new Logger(AllnovelService.name);

  private readonly BASE_URL = 'https://allnovel.org';
  private readonly BOOK_SLUG = 'shadow-slave';

  async crawlChapter(chapterNumber: number): Promise<{ title: string; content: string }> {
    const url = `${this.BASE_URL}/${this.BOOK_SLUG}/chapter-${chapterNumber}.html`;
    this.logger.log(`[Allnovel] Fetching: ${url}`);

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      throw new Error(`[Allnovel] HTTP ${res.status} for chapter ${chapterNumber}`);
    }

    const html = await res.text();

    // Extract content from #chapter-content div
    const contentMatch = html.match(/id="chapter-content"[^>]*>([\s\S]*?)<\/div>/);
    if (!contentMatch) {
      throw new Error(`[Allnovel] No #chapter-content found for chapter ${chapterNumber}`);
    }

    const contentHtml = contentMatch[1];

    // Convert HTML to text
    let text = contentHtml
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
      throw new Error(`[Allnovel] Empty content for chapter ${chapterNumber}`);
    }

    // First paragraph is the title "Chapter NNN: Title Name" or "Chapter NNN Title Name"
    // Extract just the title part
    const titleLine = paragraphs[0];
    const titleMatch = titleLine.match(/Chapter\s+\d+[:.\-\s]+(.+)/i);
    const title = titleMatch ? titleMatch[1].trim() : titleLine;

    // Content is everything after the title line
    const content = paragraphs.slice(1).join('\n\n');

    if (!content) {
      throw new Error(`[Allnovel] No body content for chapter ${chapterNumber}`);
    }

    this.logger.log(`[Allnovel] Chapter ${chapterNumber}: "${title}" — ${paragraphs.length - 1} paragraphs, ${content.length} chars`);
    return { title, content };
  }
}
