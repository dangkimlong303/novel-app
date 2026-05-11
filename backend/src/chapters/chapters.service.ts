import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { CrawlerService } from '../crawler/crawler.service';
import { CrawlChaptersDto } from './dto/crawl-chapters.dto';

export interface SseEvent {
  data: string | object;
  type?: string;
}

@Injectable()
export class ChaptersService {
  private readonly logger = new Logger(ChaptersService.name);
  private crawlStreams = new Map<string, Subject<SseEvent>>();

  constructor(
    private prisma: PrismaService,
    private crawlerService: CrawlerService,
  ) {}

  async findAll(page: number, limit: number) {
    const [data, total] = await Promise.all([
      this.prisma.chapter.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { chapter_number: 'asc' },
        select: { id: true, chapter_number: true, title: true, created_at: true },
      }),
      this.prisma.chapter.count(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByNumber(number: number) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { chapter_number: number },
    });
    if (!chapter) {
      throw new NotFoundException(`Chapter ${number} not found`);
    }

    const [prev, next] = await Promise.all([
      this.prisma.chapter.findFirst({
        where: { chapter_number: { lt: number } },
        orderBy: { chapter_number: 'desc' },
        select: { chapter_number: true },
      }),
      this.prisma.chapter.findFirst({
        where: { chapter_number: { gt: number } },
        orderBy: { chapter_number: 'asc' },
        select: { chapter_number: true },
      }),
    ]);

    return {
      ...chapter,
      prev: prev?.chapter_number ?? null,
      next: next?.chapter_number ?? null,
    };
  }

  parseChapterInput(dto: CrawlChaptersDto): number[] {
    if (dto.chapters) return dto.chapters;
    if (dto.range) {
      const numbers: number[] = [];
      for (const part of dto.range.split(',')) {
        const trimmed = part.trim();
        if (trimmed.includes('-')) {
          const [start, end] = trimmed.split('-').map(Number);
          for (let i = start; i <= end; i++) numbers.push(i);
        } else {
          numbers.push(Number(trimmed));
        }
      }
      return numbers;
    }
    return [];
  }

  async startCrawl(dto: CrawlChaptersDto) {
    const chapters = this.parseChapterInput(dto);
    const crawlId = crypto.randomUUID();
    const subject = new Subject<SseEvent>();
    this.crawlStreams.set(crawlId, subject);

    this.executeCrawl(crawlId, chapters, subject);

    return { crawlId, total: chapters.length, message: 'Crawl started' };
  }

  getCrawlStream(crawlId: string): Observable<SseEvent> {
    const subject = this.crawlStreams.get(crawlId);
    if (!subject) {
      throw new NotFoundException(`Crawl ${crawlId} not found`);
    }
    return subject.asObservable();
  }

  async startSync() {
    const crawlId = crypto.randomUUID();
    const subject = new Subject<SseEvent>();
    this.crawlStreams.set(crawlId, subject);

    this.executeSync(crawlId, subject);

    return { crawlId, message: 'Sync started' };
  }

  private async executeCrawl(crawlId: string, chapters: number[], subject: Subject<SseEvent>) {
    let crawled = 0;
    let skipped = 0;
    let errors = 0;

    for (const num of chapters) {
      const existing = await this.prisma.chapter.findUnique({
        where: { chapter_number: num },
      });

      if (existing) {
        skipped++;
        subject.next({
          type: 'progress',
          data: { chapter_number: num, status: 'skipped', message: 'Chapter already exists' },
        });
        continue;
      }

      try {
        const { title, content } = await this.crawlerService.crawlChapter(num);
        await this.prisma.chapter.create({
          data: { chapter_number: num, title, content },
        });
        crawled++;
        subject.next({
          type: 'progress',
          data: { chapter_number: num, status: 'success', title },
        });
      } catch (error) {
        errors++;
        this.logger.error(`Failed to crawl chapter ${num}: ${error.message}`);
        subject.next({
          type: 'progress',
          data: { chapter_number: num, status: 'error', message: error.message },
        });
      }

      const delay = this.crawlerService.getRandomDelay();
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    subject.next({
      type: 'done',
      data: { total: chapters.length, crawled, skipped, errors },
    });
    subject.complete();
    this.crawlStreams.delete(crawlId);
  }

  private async executeSync(crawlId: string, subject: Subject<SseEvent>) {
    try {
      const latest = await this.prisma.chapter.findFirst({
        orderBy: { chapter_number: 'desc' },
        select: { chapter_number: true },
      });
      const maxInDb = latest?.chapter_number ?? 0;

      const latestOnSite = await this.crawlerService.getLatestChapterNumber();

      if (latestOnSite > maxInDb) {
        const missing = Array.from(
          { length: latestOnSite - maxInDb },
          (_, i) => maxInDb + 1 + i,
        );
        await this.executeCrawl(crawlId, missing, subject);
      } else {
        subject.next({
          type: 'done',
          data: { total: 0, crawled: 0, skipped: 0, errors: 0, message: 'Already up to date' },
        });
        subject.complete();
        this.crawlStreams.delete(crawlId);
      }
    } catch (error) {
      this.logger.error(`Sync failed: ${error.message}`);
      subject.next({
        type: 'done',
        data: { total: 0, crawled: 0, skipped: 0, errors: 1, message: error.message },
      });
      subject.complete();
      this.crawlStreams.delete(crawlId);
    }
  }
}
