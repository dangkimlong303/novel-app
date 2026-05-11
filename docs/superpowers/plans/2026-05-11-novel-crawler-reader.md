# Novel Crawler & Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack web app to crawl novel chapters from novelight.net and read them with a comfortable reader UI.

**Architecture:** NestJS monorepo backend with Prisma ORM and Playwright crawler, Next.js 14 App Router frontend with Tailwind CSS. PostgreSQL via Docker. Real-time crawl progress via Server-Sent Events.

**Tech Stack:** NestJS 10, Prisma 5, Playwright, Next.js 14 (App Router), Tailwind CSS, PostgreSQL 16, SSE

---

## File Structure

```
novel-app/
├── docker-compose.yml
├── backend/
│   ├── package.json          (scaffolded by NestJS CLI, then modified)
│   ├── tsconfig.json
│   ├── nest-cli.json
│   ├── .env
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── main.ts           (entry point — port 3001, CORS, compression, validation)
│   │   ├── app.module.ts     (root module)
│   │   ├── prisma/
│   │   │   ├── prisma.service.ts
│   │   │   └── prisma.module.ts
│   │   ├── chapters/
│   │   │   ├── chapters.module.ts
│   │   │   ├── chapters.controller.ts
│   │   │   ├── chapters.service.ts
│   │   │   └── dto/
│   │   │       └── crawl-chapters.dto.ts
│   │   └── crawler/
│   │       ├── crawler.module.ts
│   │       └── crawler.service.ts
│   └── src/chapters/
│       └── chapters.service.spec.ts
└── frontend/
    ├── package.json          (scaffolded by create-next-app)
    ├── next.config.ts
    ├── tailwind.config.ts
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx
    │   │   ├── globals.css
    │   │   ├── chapters/
    │   │   │   └── [number]/
    │   │   │       └── page.tsx
    │   │   └── admin/
    │   │       └── page.tsx
    │   ├── components/
    │   │   ├── ChapterList.tsx
    │   │   ├── Reader.tsx
    │   │   ├── ReaderSettings.tsx
    │   │   ├── CrawlPanel.tsx
    │   │   └── Toast.tsx
    │   └── lib/
    │       └── api.ts
    └── postcss.config.mjs
```

---

## Task 1: Infrastructure & Project Scaffolding

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/` (via NestJS CLI)
- Create: `backend/.env`
- Create: `backend/prisma/schema.prisma`
- Create: `frontend/` (via create-next-app)

- [ ] **Step 1: Create docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: novel_app
      POSTGRES_USER: novel_user
      POSTGRES_PASSWORD: novel_pass
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

- [ ] **Step 2: Start PostgreSQL**

Run: `docker compose up -d`
Expected: PostgreSQL container running on port 5432.

- [ ] **Step 3: Scaffold NestJS backend**

Run from project root:
```bash
npx @nestjs/cli new backend --package-manager npm --skip-git --strict
```
Expected: `backend/` directory with NestJS boilerplate.

- [ ] **Step 4: Install backend dependencies**

Run from `backend/`:
```bash
npm install @prisma/client compression class-validator class-transformer
npm install -D prisma @types/compression
```

- [ ] **Step 5: Initialize Prisma and create schema**

Run from `backend/`:
```bash
npx prisma init --datasource-provider postgresql
```

Then replace `backend/prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Chapter {
  id             Int      @id @default(autoincrement())
  chapter_number Int      @unique
  title          String
  content        String   @db.Text
  created_at     DateTime @default(now())
  updated_at     DateTime @updatedAt
}
```

Set `backend/.env`:
```
DATABASE_URL=postgresql://novel_user:novel_pass@localhost:5432/novel_app
```

- [ ] **Step 6: Run Prisma migration**

Run from `backend/`:
```bash
npx prisma migrate dev --name init
```
Expected: Migration created and applied. `@prisma/client` generated.

- [ ] **Step 7: Scaffold Next.js frontend**

Run from project root:
```bash
npx create-next-app@latest frontend --typescript --tailwind --app --src-dir --no-eslint --import-alias "@/*" --use-npm
```
Expected: `frontend/` directory with Next.js + Tailwind boilerplate.

- [ ] **Step 8: Commit**

```bash
git add docker-compose.yml backend/ frontend/
git commit -m "feat: scaffold infrastructure — Docker, NestJS backend, Next.js frontend, Prisma schema"
```

---

## Task 2: Prisma Service & Module

**Files:**
- Create: `backend/src/prisma/prisma.service.ts`
- Create: `backend/src/prisma/prisma.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Create PrismaService**

Create `backend/src/prisma/prisma.service.ts`:

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 2: Create PrismaModule**

Create `backend/src/prisma/prisma.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 3: Register PrismaModule in AppModule**

Replace `backend/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule],
})
export class AppModule {}
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/prisma/ backend/src/app.module.ts
git commit -m "feat: add global PrismaService and PrismaModule"
```

---

## Task 3: Chapters Service — List & Get (TDD)

**Files:**
- Create: `backend/src/chapters/chapters.service.spec.ts`
- Create: `backend/src/chapters/chapters.service.ts`

- [ ] **Step 1: Write failing tests for findAll and findByNumber**

Create `backend/src/chapters/chapters.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ChaptersService } from './chapters.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ChaptersService', () => {
  let service: ChaptersService;
  let prisma: {
    chapter: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      chapter: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        ChaptersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ChaptersService);
  });

  describe('findAll', () => {
    it('should return paginated chapters without content', async () => {
      const chapters = [
        { id: 1, chapter_number: 1, title: 'Chapter 1', created_at: new Date() },
        { id: 2, chapter_number: 2, title: 'Chapter 2', created_at: new Date() },
      ];
      prisma.chapter.findMany.mockResolvedValue(chapters);
      prisma.chapter.count.mockResolvedValue(50);

      const result = await service.findAll(1, 20);

      expect(result).toEqual({
        data: chapters,
        total: 50,
        page: 1,
        limit: 20,
        totalPages: 3,
      });
      expect(prisma.chapter.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        orderBy: { chapter_number: 'asc' },
        select: { id: true, chapter_number: true, title: true, created_at: true },
      });
    });

    it('should calculate correct offset for page 3', async () => {
      prisma.chapter.findMany.mockResolvedValue([]);
      prisma.chapter.count.mockResolvedValue(0);

      await service.findAll(3, 20);

      expect(prisma.chapter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
    });
  });

  describe('findByNumber', () => {
    it('should return chapter with prev and next', async () => {
      prisma.chapter.findUnique.mockResolvedValue({
        id: 5, chapter_number: 5, title: 'Ch 5', content: 'Text', created_at: new Date(), updated_at: new Date(),
      });
      prisma.chapter.findFirst
        .mockResolvedValueOnce({ chapter_number: 4 })  // prev
        .mockResolvedValueOnce({ chapter_number: 6 });  // next

      const result = await service.findByNumber(5);

      expect(result.prev).toBe(4);
      expect(result.next).toBe(6);
      expect(result.chapter_number).toBe(5);
    });

    it('should return null for prev/next when at boundaries', async () => {
      prisma.chapter.findUnique.mockResolvedValue({
        id: 1, chapter_number: 1, title: 'Ch 1', content: 'Text', created_at: new Date(), updated_at: new Date(),
      });
      prisma.chapter.findFirst
        .mockResolvedValueOnce(null)   // no prev
        .mockResolvedValueOnce(null);  // no next

      const result = await service.findByNumber(1);

      expect(result.prev).toBeNull();
      expect(result.next).toBeNull();
    });

    it('should throw NotFoundException for missing chapter', async () => {
      prisma.chapter.findUnique.mockResolvedValue(null);

      await expect(service.findByNumber(999)).rejects.toThrow(NotFoundException);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest src/chapters/chapters.service.spec.ts --no-cache`
Expected: FAIL — `Cannot find module './chapters.service'`

- [ ] **Step 3: Implement ChaptersService**

Create `backend/src/chapters/chapters.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChaptersService {
  constructor(private prisma: PrismaService) {}

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
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest src/chapters/chapters.service.spec.ts --no-cache`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/chapters/chapters.service.ts backend/src/chapters/chapters.service.spec.ts
git commit -m "feat: add ChaptersService with findAll and findByNumber (TDD)"
```

---

## Task 4: Chapters Controller & Module (List & Get)

**Files:**
- Create: `backend/src/chapters/chapters.controller.ts`
- Create: `backend/src/chapters/chapters.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Create ChaptersController with list and get endpoints**

Create `backend/src/chapters/chapters.controller.ts`:

```typescript
import { Controller, Get, Param, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ChaptersService } from './chapters.service';

@Controller('chapters')
export class ChaptersController {
  constructor(private readonly chaptersService: ChaptersService) {}

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.chaptersService.findAll(page, limit);
  }

  @Get(':number')
  findByNumber(@Param('number', ParseIntPipe) number: number) {
    return this.chaptersService.findByNumber(number);
  }
}
```

- [ ] **Step 2: Create ChaptersModule**

Create `backend/src/chapters/chapters.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ChaptersController } from './chapters.controller';
import { ChaptersService } from './chapters.service';

@Module({
  controllers: [ChaptersController],
  providers: [ChaptersService],
  exports: [ChaptersService],
})
export class ChaptersModule {}
```

- [ ] **Step 3: Register ChaptersModule in AppModule**

Update `backend/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ChaptersModule } from './chapters/chapters.module';

@Module({
  imports: [PrismaModule, ChaptersModule],
})
export class AppModule {}
```

- [ ] **Step 4: Verify backend compiles**

Run: `cd backend && npx nest build`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/chapters/chapters.controller.ts backend/src/chapters/chapters.module.ts backend/src/app.module.ts
git commit -m "feat: add chapters controller with GET /chapters and GET /chapters/:number"
```

---

## Task 5: Crawler Service

**Files:**
- Create: `backend/src/crawler/crawler.service.ts`
- Create: `backend/src/crawler/crawler.module.ts`

- [ ] **Step 1: Install Playwright**

Run from `backend/`:
```bash
npm install playwright
npx playwright install chromium
```

- [ ] **Step 2: Create CrawlerService**

Create `backend/src/crawler/crawler.service.ts`:

```typescript
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
```

- [ ] **Step 3: Create CrawlerModule**

Create `backend/src/crawler/crawler.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { CrawlerService } from './crawler.service';

@Module({
  providers: [CrawlerService],
  exports: [CrawlerService],
})
export class CrawlerModule {}
```

- [ ] **Step 4: Register CrawlerModule in AppModule**

Update `backend/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ChaptersModule } from './chapters/chapters.module';
import { CrawlerModule } from './crawler/crawler.module';

@Module({
  imports: [PrismaModule, ChaptersModule, CrawlerModule],
})
export class AppModule {}
```

- [ ] **Step 5: Verify backend compiles**

Run: `cd backend && npx nest build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add backend/src/crawler/ backend/src/app.module.ts
git commit -m "feat: add CrawlerService with Playwright — crawl chapters + detect latest"
```

---

## Task 6: Crawl, SSE & Sync Endpoints

**Files:**
- Create: `backend/src/chapters/dto/crawl-chapters.dto.ts`
- Modify: `backend/src/chapters/chapters.service.ts`
- Modify: `backend/src/chapters/chapters.controller.ts`
- Modify: `backend/src/chapters/chapters.module.ts`

- [ ] **Step 1: Create CrawlChaptersDto**

Create `backend/src/chapters/dto/crawl-chapters.dto.ts`:

```typescript
import { IsOptional, IsArray, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CrawlChaptersDto {
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  chapters?: number[];

  @IsOptional()
  @IsString()
  range?: string;
}
```

- [ ] **Step 2: Add parseChapterInput, crawl, and sync methods to ChaptersService**

Add these imports and methods to `backend/src/chapters/chapters.service.ts`:

```typescript
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { CrawlerService } from '../crawler/crawler.service';
import { CrawlChaptersDto } from './dto/crawl-chapters.dto';

interface SseEvent {
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

  // --- existing findAll and findByNumber stay unchanged ---

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
```

**Important:** This replaces the entire `chapters.service.ts`. The `findAll` and `findByNumber` methods from Task 3 remain unchanged — add the new imports, fields, constructor params, and methods around them.

- [ ] **Step 3: Update ChaptersController with crawl, stream, and sync endpoints**

Replace `backend/src/chapters/chapters.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Sse,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ChaptersService } from './chapters.service';
import { CrawlChaptersDto } from './dto/crawl-chapters.dto';

@Controller('chapters')
export class ChaptersController {
  constructor(private readonly chaptersService: ChaptersService) {}

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.chaptersService.findAll(page, limit);
  }

  @Post('crawl')
  startCrawl(@Body() dto: CrawlChaptersDto) {
    return this.chaptersService.startCrawl(dto);
  }

  @Sse('crawl/stream')
  crawlStream(@Query('crawlId') crawlId: string) {
    return this.chaptersService.getCrawlStream(crawlId);
  }

  @Post('sync')
  sync() {
    return this.chaptersService.startSync();
  }

  @Get(':number')
  findByNumber(@Param('number', ParseIntPipe) number: number) {
    return this.chaptersService.findByNumber(number);
  }
}
```

**Note:** `crawl/stream` and `POST crawl`/`POST sync` routes are defined BEFORE `GET :number` to prevent the param route from matching `crawl` or `sync` as a number.

- [ ] **Step 4: Update ChaptersModule to import CrawlerModule**

Replace `backend/src/chapters/chapters.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ChaptersController } from './chapters.controller';
import { ChaptersService } from './chapters.service';
import { CrawlerModule } from '../crawler/crawler.module';

@Module({
  imports: [CrawlerModule],
  controllers: [ChaptersController],
  providers: [ChaptersService],
  exports: [ChaptersService],
})
export class ChaptersModule {}
```

- [ ] **Step 5: Update the unit tests to account for CrawlerService dependency**

Update `backend/src/chapters/chapters.service.spec.ts` — add CrawlerService mock to the `beforeEach`:

```typescript
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ChaptersService } from './chapters.service';
import { PrismaService } from '../prisma/prisma.service';
import { CrawlerService } from '../crawler/crawler.service';

describe('ChaptersService', () => {
  let service: ChaptersService;
  let prisma: {
    chapter: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      chapter: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        ChaptersService,
        { provide: PrismaService, useValue: prisma },
        { provide: CrawlerService, useValue: { crawlChapter: jest.fn(), getRandomDelay: () => 0 } },
      ],
    }).compile();

    service = module.get(ChaptersService);
  });

  describe('findAll', () => {
    it('should return paginated chapters without content', async () => {
      const chapters = [
        { id: 1, chapter_number: 1, title: 'Chapter 1', created_at: new Date() },
        { id: 2, chapter_number: 2, title: 'Chapter 2', created_at: new Date() },
      ];
      prisma.chapter.findMany.mockResolvedValue(chapters);
      prisma.chapter.count.mockResolvedValue(50);

      const result = await service.findAll(1, 20);

      expect(result).toEqual({
        data: chapters,
        total: 50,
        page: 1,
        limit: 20,
        totalPages: 3,
      });
      expect(prisma.chapter.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        orderBy: { chapter_number: 'asc' },
        select: { id: true, chapter_number: true, title: true, created_at: true },
      });
    });

    it('should calculate correct offset for page 3', async () => {
      prisma.chapter.findMany.mockResolvedValue([]);
      prisma.chapter.count.mockResolvedValue(0);

      await service.findAll(3, 20);

      expect(prisma.chapter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
    });
  });

  describe('findByNumber', () => {
    it('should return chapter with prev and next', async () => {
      prisma.chapter.findUnique.mockResolvedValue({
        id: 5, chapter_number: 5, title: 'Ch 5', content: 'Text', created_at: new Date(), updated_at: new Date(),
      });
      prisma.chapter.findFirst
        .mockResolvedValueOnce({ chapter_number: 4 })
        .mockResolvedValueOnce({ chapter_number: 6 });

      const result = await service.findByNumber(5);

      expect(result.prev).toBe(4);
      expect(result.next).toBe(6);
      expect(result.chapter_number).toBe(5);
    });

    it('should return null for prev/next at boundaries', async () => {
      prisma.chapter.findUnique.mockResolvedValue({
        id: 1, chapter_number: 1, title: 'Ch 1', content: 'Text', created_at: new Date(), updated_at: new Date(),
      });
      prisma.chapter.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await service.findByNumber(1);

      expect(result.prev).toBeNull();
      expect(result.next).toBeNull();
    });

    it('should throw NotFoundException for missing chapter', async () => {
      prisma.chapter.findUnique.mockResolvedValue(null);

      await expect(service.findByNumber(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('parseChapterInput', () => {
    it('should parse chapters array', () => {
      expect(service.parseChapterInput({ chapters: [1, 2, 3] })).toEqual([1, 2, 3]);
    });

    it('should parse range string', () => {
      expect(service.parseChapterInput({ range: '5-8' })).toEqual([5, 6, 7, 8]);
    });

    it('should parse mixed range string', () => {
      expect(service.parseChapterInput({ range: '1-3,7,10-12' })).toEqual([1, 2, 3, 7, 10, 11, 12]);
    });

    it('should return empty array for empty input', () => {
      expect(service.parseChapterInput({})).toEqual([]);
    });
  });
});
```

- [ ] **Step 6: Run tests**

Run: `cd backend && npx jest src/chapters/chapters.service.spec.ts --no-cache`
Expected: All 8 tests PASS.

- [ ] **Step 7: Verify backend compiles**

Run: `cd backend && npx nest build`
Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add backend/src/chapters/ backend/src/app.module.ts
git commit -m "feat: add crawl/SSE/sync endpoints with chapter input parsing"
```

---

## Task 7: Backend Configuration (main.ts)

**Files:**
- Modify: `backend/src/main.ts`

- [ ] **Step 1: Configure main.ts with CORS, compression, validation, and port 3001**

Replace `backend/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: 'http://localhost:3000' });
  app.use(compression());
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true }),
  );

  await app.listen(3001);
  console.log('Backend running on http://localhost:3001');
}
bootstrap();
```

**Note:** If the `compression` default import causes issues (depends on `esModuleInterop` setting), use `import * as compression from 'compression'` instead.

- [ ] **Step 2: Start backend and verify it runs**

Run: `cd backend && npm run start:dev`
Expected: App starts on port 3001 with no errors. `GET http://localhost:3001/chapters` returns `{"data":[],"total":0,"page":1,"limit":20,"totalPages":0}`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main.ts
git commit -m "feat: configure backend — CORS, compression, validation, port 3001"
```

---

## Task 8: Frontend API Client & Layout

**Files:**
- Create: `frontend/src/lib/api.ts`
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/src/app/globals.css`

- [ ] **Step 1: Create API client**

Create `frontend/src/lib/api.ts`:

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ChapterSummary {
  id: number;
  chapter_number: number;
  title: string;
  created_at: string;
}

export interface ChapterDetail extends ChapterSummary {
  content: string;
  prev: number | null;
  next: number | null;
}

export interface PaginatedResponse {
  data: ChapterSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CrawlResponse {
  crawlId: string;
  total?: number;
  message: string;
}

export interface CrawlEvent {
  chapter_number: number;
  status: 'success' | 'skipped' | 'error';
  title?: string;
  message?: string;
}

export interface CrawlDone {
  total: number;
  crawled: number;
  skipped: number;
  errors: number;
  message?: string;
}

export async function fetchChapters(page = 1, limit = 20): Promise<PaginatedResponse> {
  const res = await fetch(`${API_BASE}/chapters?page=${page}&limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch chapters');
  return res.json();
}

export async function fetchChapter(number: number): Promise<ChapterDetail> {
  const res = await fetch(`${API_BASE}/chapters/${number}`);
  if (!res.ok) throw new Error(`Failed to fetch chapter ${number}`);
  return res.json();
}

export async function startCrawl(input: string): Promise<CrawlResponse> {
  const body: { chapters?: number[]; range?: string } = {};

  if (input.includes('-') || input.includes(',')) {
    body.range = input;
  } else {
    body.chapters = [Number(input)];
  }

  const res = await fetch(`${API_BASE}/chapters/crawl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to start crawl');
  return res.json();
}

export async function startSync(): Promise<CrawlResponse> {
  const res = await fetch(`${API_BASE}/chapters/sync`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to start sync');
  return res.json();
}

export function subscribeToCrawl(
  crawlId: string,
  onProgress: (event: CrawlEvent) => void,
  onDone: (summary: CrawlDone) => void,
): () => void {
  const source = new EventSource(`${API_BASE}/chapters/crawl/stream?crawlId=${crawlId}`);

  source.addEventListener('progress', (e: MessageEvent) => {
    onProgress(JSON.parse(e.data));
  });

  source.addEventListener('done', (e: MessageEvent) => {
    onDone(JSON.parse(e.data));
    source.close();
  });

  source.onerror = () => {
    source.close();
  };

  return () => source.close();
}
```

- [ ] **Step 2: Update root layout**

Replace `frontend/src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Novel Reader',
  description: 'Read Shadow Slave chapters',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-6">
            <a href="/" className="font-bold text-lg">Novel Reader</a>
            <a href="/admin" className="text-sm text-gray-600 hover:text-gray-900">Admin</a>
          </div>
        </nav>
        <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Simplify globals.css**

Replace `frontend/src/app/globals.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Verify frontend compiles**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/app/layout.tsx frontend/src/app/globals.css
git commit -m "feat: add frontend API client, root layout, and clean globals.css"
```

---

## Task 9: Home Page — Chapter List

**Files:**
- Create: `frontend/src/components/ChapterList.tsx`
- Modify: `frontend/src/app/page.tsx`

- [ ] **Step 1: Create ChapterList component**

Create `frontend/src/components/ChapterList.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchChapters, PaginatedResponse } from '@/lib/api';

export default function ChapterList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPage = Number(searchParams.get('page') || '1');

  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchChapters(currentPage)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentPage]);

  if (loading) return <div className="text-center py-10 text-gray-500">Loading...</div>;
  if (!data || data.data.length === 0) {
    return <div className="text-center py-10 text-gray-500">No chapters found. Use the Admin panel to crawl chapters.</div>;
  }

  return (
    <div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b text-left text-sm text-gray-500">
            <th className="py-2 pr-4 w-20">#</th>
            <th className="py-2">Title</th>
          </tr>
        </thead>
        <tbody>
          {data.data.map((ch) => (
            <tr
              key={ch.id}
              className="border-b hover:bg-gray-100 cursor-pointer"
              onClick={() => router.push(`/chapters/${ch.chapter_number}`)}
            >
              <td className="py-3 pr-4 text-gray-500">{ch.chapter_number}</td>
              <td className="py-3">{ch.title}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-center items-center gap-4 mt-6">
        <button
          onClick={() => router.push(`/?page=${currentPage - 1}`)}
          disabled={currentPage <= 1}
          className="px-4 py-2 border rounded disabled:opacity-30 hover:bg-gray-100"
        >
          Previous
        </button>
        <span className="text-sm text-gray-600">
          Page {data.page} of {data.totalPages}
        </span>
        <button
          onClick={() => router.push(`/?page=${currentPage + 1}`)}
          disabled={currentPage >= data.totalPages}
          className="px-4 py-2 border rounded disabled:opacity-30 hover:bg-gray-100"
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update home page**

Replace `frontend/src/app/page.tsx`:

```tsx
import { Suspense } from 'react';
import ChapterList from '@/components/ChapterList';

export default function HomePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Shadow Slave — Chapters</h1>
      <Suspense fallback={<div className="text-center py-10 text-gray-500">Loading...</div>}>
        <ChapterList />
      </Suspense>
    </div>
  );
}
```

**Note:** `<Suspense>` wraps ChapterList because it uses `useSearchParams()`, which requires a Suspense boundary in Next.js App Router.

- [ ] **Step 3: Verify frontend compiles**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ChapterList.tsx frontend/src/app/page.tsx
git commit -m "feat: add home page with paginated chapter list"
```

---

## Task 10: Reader Page

**Files:**
- Create: `frontend/src/components/ReaderSettings.tsx`
- Create: `frontend/src/components/Reader.tsx`
- Create: `frontend/src/app/chapters/[number]/page.tsx`

- [ ] **Step 1: Create ReaderSettings component**

Create `frontend/src/components/ReaderSettings.tsx`:

```tsx
'use client';

export interface Settings {
  fontSize: number;
  theme: 'white' | 'sepia' | 'dark';
}

const themes = {
  white: { bg: 'bg-white', text: 'text-gray-900' },
  sepia: { bg: 'bg-amber-50', text: 'text-amber-900' },
  dark: { bg: 'bg-gray-900', text: 'text-gray-100' },
};

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
  open: boolean;
  onToggle: () => void;
}

export function getThemeClasses(theme: Settings['theme']) {
  return themes[theme];
}

export default function ReaderSettings({ settings, onChange, open, onToggle }: Props) {
  return (
    <div className="mb-4">
      <button
        onClick={onToggle}
        className="text-sm px-3 py-1 border rounded hover:bg-gray-100"
      >
        {open ? 'Hide Settings' : 'Settings'}
      </button>

      {open && (
        <div className="mt-3 p-4 border rounded-lg bg-white flex flex-wrap gap-6 items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Font Size:</span>
            <button
              onClick={() => onChange({ ...settings, fontSize: Math.max(14, settings.fontSize - 2) })}
              className="w-8 h-8 border rounded flex items-center justify-center hover:bg-gray-100"
            >
              -
            </button>
            <span className="text-sm w-8 text-center">{settings.fontSize}</span>
            <button
              onClick={() => onChange({ ...settings, fontSize: Math.min(24, settings.fontSize + 2) })}
              className="w-8 h-8 border rounded flex items-center justify-center hover:bg-gray-100"
            >
              +
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Theme:</span>
            {(['white', 'sepia', 'dark'] as const).map((t) => (
              <button
                key={t}
                onClick={() => onChange({ ...settings, theme: t })}
                className={`px-3 py-1 border rounded text-sm capitalize ${
                  settings.theme === t ? 'ring-2 ring-blue-500' : 'hover:bg-gray-100'
                } ${themes[t].bg} ${themes[t].text}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create Reader component**

Create `frontend/src/components/Reader.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchChapter, ChapterDetail } from '@/lib/api';
import ReaderSettings, { Settings, getThemeClasses } from './ReaderSettings';

const SETTINGS_KEY = 'readerSettings';
const DEFAULT_SETTINGS: Settings = { fontSize: 18, theme: 'white' };

function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function Reader({ chapterNumber }: { chapterNumber: number }) {
  const router = useRouter();
  const [chapter, setChapter] = useState<ChapterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchChapter(chapterNumber)
      .then(setChapter)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [chapterNumber]);

  const handleSettingsChange = (newSettings: Settings) => {
    setSettings(newSettings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
  };

  if (loading) return <div className="text-center py-10 text-gray-500">Loading...</div>;
  if (error) return <div className="text-center py-10 text-red-500">{error}</div>;
  if (!chapter) return null;

  const theme = getThemeClasses(settings.theme);
  const paragraphs = chapter.content.split('\n\n').filter((p) => p.trim());

  const NavButtons = () => (
    <div className="flex justify-between items-center py-4">
      <button
        onClick={() => chapter.prev && router.push(`/chapters/${chapter.prev}`)}
        disabled={!chapter.prev}
        className="px-4 py-2 border rounded disabled:opacity-30 hover:bg-gray-100"
      >
        Previous Chapter
      </button>
      <button
        onClick={() => chapter.next && router.push(`/chapters/${chapter.next}`)}
        disabled={!chapter.next}
        className="px-4 py-2 border rounded disabled:opacity-30 hover:bg-gray-100"
      >
        Next Chapter
      </button>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <ReaderSettings
        settings={settings}
        onChange={handleSettingsChange}
        open={settingsOpen}
        onToggle={() => setSettingsOpen(!settingsOpen)}
      />

      <NavButtons />

      <article
        className={`rounded-lg p-8 ${theme.bg} ${theme.text}`}
        style={{ fontSize: `${settings.fontSize}px`, lineHeight: 1.8 }}
      >
        <h1 className="text-2xl font-bold mb-8">{chapter.title}</h1>
        {paragraphs.map((p, i) => (
          <p key={i} className="mb-4">{p}</p>
        ))}
      </article>

      <NavButtons />
    </div>
  );
}
```

- [ ] **Step 3: Create reader page**

Create `frontend/src/app/chapters/[number]/page.tsx`:

```tsx
'use client';

import { useParams } from 'next/navigation';
import Reader from '@/components/Reader';

export default function ChapterPage() {
  const params = useParams();
  const chapterNumber = Number(params.number);

  if (isNaN(chapterNumber)) {
    return <div className="text-center py-10 text-red-500">Invalid chapter number</div>;
  }

  return <Reader chapterNumber={chapterNumber} />;
}
```

- [ ] **Step 4: Verify frontend compiles**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ReaderSettings.tsx frontend/src/components/Reader.tsx frontend/src/app/chapters/
git commit -m "feat: add reader page with settings (font size, theme) persisted in localStorage"
```

---

## Task 11: Admin Page — Crawl Panel with SSE

**Files:**
- Create: `frontend/src/components/Toast.tsx`
- Create: `frontend/src/components/CrawlPanel.tsx`
- Create: `frontend/src/app/admin/page.tsx`

- [ ] **Step 1: Create Toast component**

Create `frontend/src/components/Toast.tsx`:

```tsx
'use client';

import { CrawlEvent } from '@/lib/api';

const statusColors = {
  success: 'bg-green-100 text-green-800 border-green-300',
  skipped: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  error: 'bg-red-100 text-red-800 border-red-300',
};

export default function Toast({ event }: { event: CrawlEvent }) {
  const color = statusColors[event.status];
  const label =
    event.status === 'success'
      ? `Chapter ${event.chapter_number}: ${event.title}`
      : event.status === 'skipped'
        ? `Chapter ${event.chapter_number}: Skipped — ${event.message}`
        : `Chapter ${event.chapter_number}: Error — ${event.message}`;

  return (
    <div className={`px-3 py-2 border rounded text-sm ${color}`}>
      {label}
    </div>
  );
}
```

- [ ] **Step 2: Create CrawlPanel component**

Create `frontend/src/components/CrawlPanel.tsx`:

```tsx
'use client';

import { useState, useRef } from 'react';
import { startCrawl, startSync, subscribeToCrawl, CrawlEvent, CrawlDone } from '@/lib/api';
import Toast from './Toast';

export default function CrawlPanel() {
  const [input, setInput] = useState('');
  const [events, setEvents] = useState<CrawlEvent[]>([]);
  const [summary, setSummary] = useState<CrawlDone | null>(null);
  const [crawling, setCrawling] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  const handleProgress = (event: CrawlEvent) => {
    setEvents((prev) => [...prev, event]);
  };

  const handleDone = (done: CrawlDone) => {
    setSummary(done);
    setCrawling(false);
  };

  const handleCrawl = async () => {
    if (!input.trim() || crawling) return;
    setEvents([]);
    setSummary(null);
    setCrawling(true);

    try {
      const { crawlId } = await startCrawl(input.trim());
      unsubRef.current = subscribeToCrawl(crawlId, handleProgress, handleDone);
    } catch (e) {
      setCrawling(false);
      setEvents([{ chapter_number: 0, status: 'error', message: (e as Error).message }]);
    }
  };

  const handleSync = async () => {
    if (crawling) return;
    setEvents([]);
    setSummary(null);
    setCrawling(true);

    try {
      const { crawlId } = await startSync();
      unsubRef.current = subscribeToCrawl(crawlId, handleProgress, handleDone);
    } catch (e) {
      setCrawling(false);
      setEvents([{ chapter_number: 0, status: 'error', message: (e as Error).message }]);
    }
  };

  return (
    <div>
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. 1-50 or 1,2,3 or 100-110,115"
          className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={crawling}
        />
        <button
          onClick={handleCrawl}
          disabled={crawling || !input.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {crawling ? 'Crawling...' : 'Crawl'}
        </button>
        <button
          onClick={handleSync}
          disabled={crawling}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          Sync Latest
        </button>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {events.map((event, i) => (
          <Toast key={i} event={event} />
        ))}
      </div>

      {summary && (
        <div className="mt-4 p-4 bg-gray-100 rounded text-sm">
          <strong>Crawl Complete:</strong> {summary.crawled} crawled, {summary.skipped} skipped, {summary.errors} errors (total: {summary.total})
          {summary.message && <span className="ml-2 text-gray-600">— {summary.message}</span>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create admin page**

Create `frontend/src/app/admin/page.tsx`:

```tsx
import CrawlPanel from '@/components/CrawlPanel';

export default function AdminPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin — Crawl Manager</h1>
      <CrawlPanel />
    </div>
  );
}
```

- [ ] **Step 4: Verify frontend compiles**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Toast.tsx frontend/src/components/CrawlPanel.tsx frontend/src/app/admin/
git commit -m "feat: add admin page with crawl panel, real-time SSE progress, and sync"
```

---

## Task 12: End-to-End Smoke Test

- [ ] **Step 1: Ensure Docker PostgreSQL is running**

Run: `docker compose up -d`

- [ ] **Step 2: Start backend**

Run from `backend/`: `npm run start:dev`
Expected: `Backend running on http://localhost:3001`

- [ ] **Step 3: Start frontend**

Run from `frontend/`: `npm run dev`
Expected: Next.js dev server on http://localhost:3000

- [ ] **Step 4: Verify endpoints**

1. `curl http://localhost:3001/chapters` — should return `{"data":[],"total":0,...}`
2. Open `http://localhost:3000` — should show "No chapters found" message
3. Open `http://localhost:3000/admin` — should show crawl panel

- [ ] **Step 5: Test crawl flow (manual)**

1. In admin panel, enter `1-3` and click Crawl
2. Should see real-time progress toasts (success/error for each chapter)
3. After completion, go to home page — should see crawled chapters
4. Click a chapter — reader page should display content with settings

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete novel crawler & reader app"
```
