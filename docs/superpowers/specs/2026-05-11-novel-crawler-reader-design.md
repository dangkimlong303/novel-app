# Novel Crawler & Reader — Design Spec

## Overview

Full-stack web app to crawl and read chapters from `https://novelight.net/book/shadow-slave-novel`. Monorepo with NestJS backend, Next.js frontend, PostgreSQL database, and Playwright crawler.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS (TypeScript) |
| ORM | Prisma |
| Database | PostgreSQL 16 (via Docker) |
| Crawler | Playwright (headless Chromium) |
| Frontend | Next.js 14+ (App Router) + Tailwind CSS |
| Real-time | Server-Sent Events (SSE) |

## Project Structure

```
novel-app/
├── docker-compose.yml
├── backend/
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── main.ts
│   │   ├── chapters/
│   │   │   ├── chapters.module.ts
│   │   │   ├── chapters.controller.ts
│   │   │   ├── chapters.service.ts
│   │   │   └── dto/
│   │   │       └── crawl-chapters.dto.ts
│   │   └── crawler/
│   │       ├── crawler.module.ts
│   │       └── crawler.service.ts
│   └── prisma/
│       └── schema.prisma
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx
    │   │   ├── chapters/[number]/page.tsx
    │   │   └── admin/page.tsx
    │   ├── components/
    │   │   ├── ChapterList.tsx
    │   │   ├── Reader.tsx
    │   │   ├── ReaderSettings.tsx
    │   │   ├── CrawlPanel.tsx
    │   │   └── Toast.tsx
    │   └── lib/
    │       └── api.ts
    └── tailwind.config.ts
```

## Database Schema

```prisma
model Chapter {
  id             Int      @id @default(autoincrement())
  chapter_number Int      @unique
  title          String
  content        String   @db.Text
  created_at     DateTime @default(now())
  updated_at     DateTime @updatedAt

}
```

- `chapter_number` has a unique constraint — last line of defense against duplicates.
- `content` stores clean plain text (paragraphs separated by `\n\n`).

## API Endpoints

### GET /chapters?page=1&limit=20

Returns paginated chapter list sorted by `chapter_number` ASC.

Response:
```json
{
  "data": [{ "id": 1, "chapter_number": 1, "title": "Chapter 1: ...", "created_at": "..." }],
  "total": 1900,
  "page": 1,
  "limit": 20,
  "totalPages": 95
}
```

Note: `content` is excluded from list responses to keep payload small.

### GET /chapters/:number

Returns full chapter by `chapter_number`, including `content`.

Response includes `prev` and `next` chapter numbers (or `null`) for navigation.

```json
{
  "id": 1,
  "chapter_number": 1,
  "title": "Chapter 1: ...",
  "content": "Full text...",
  "prev": null,
  "next": 2
}
```

### POST /chapters/crawl

Accepts either an array or a range string. Starts crawling and returns immediately with a `crawlId`.

```json
// Option A: array
{ "chapters": [1, 2, 3] }

// Option B: range
{ "range": "100-110" }
```

Response:
```json
{ "crawlId": "uuid", "total": 11, "message": "Crawl started" }
```

### GET /chapters/crawl/stream?crawlId=uuid

SSE endpoint. Client connects after POST to receive real-time events:

```
event: progress
data: { "chapter_number": 100, "status": "skipped", "message": "Chapter already exists" }

event: progress
data: { "chapter_number": 101, "status": "success", "title": "Chapter 101: ..." }

event: progress
data: { "chapter_number": 102, "status": "error", "message": "Failed to load page" }

event: done
data: { "total": 11, "crawled": 8, "skipped": 2, "errors": 1 }
```

### POST /chapters/sync

Triggers `autoSyncLatest()`. Returns the same `crawlId` pattern — progress available via SSE.

## Crawler Service

### crawlByChapter(numbers: number[], crawlId: string)

For each chapter number:

1. **Check DB** — if `chapter_number` exists, emit SSE `skipped` event, continue.
2. **Navigate** — Playwright goes to `https://novelight.net/book/shadow-slave-novel/chapter-{N}`.
3. **Extract** — Get `title` from the page heading. Get `content` by collecting all `<p>` tags within the chapter content container, extracting `.textContent`, joining with `\n\n`.
4. **Clean** — Strip any residual HTML, ads, scripts. Only keep clean paragraph text.
5. **Save** — Insert into DB via Prisma.
6. **Emit** — SSE `success` event.
7. **Delay** — Random 2-5 second pause before next chapter.

### autoSyncLatest()

1. Query DB for `MAX(chapter_number)`.
2. Navigate to the novel's main page on novelight.net.
3. Extract the latest available chapter number from the chapter list.
4. If latest > max in DB, call `crawlByChapter()` for the missing range.

### Anti-Scraping Measures

- **User-Agent**: Rotate between 3-5 realistic Chrome user-agent strings.
- **Delay**: Random 2-5 seconds between page loads.
- **Headless**: Playwright in headless mode with stealth settings.
- **Viewport**: Set realistic viewport size (1920x1080).

## Frontend

### Home Page (/)

- Displays chapter list in a clean table/list format.
- Columns: chapter number, title.
- Pagination: 20 chapters per page, page controls at bottom.
- Click a chapter to navigate to `/chapters/[number]`.

### Reader Page (/chapters/[number])

- **Layout**: Centered content column (max-width 720px), generous padding.
- **Header**: Chapter title.
- **Content**: Rendered paragraphs with comfortable line-height (1.8).
- **Navigation**: "Previous Chapter" / "Next Chapter" buttons at top and bottom.
- **Settings panel** (toggleable):
  - Font size: slider or buttons (14px - 24px, default 18px).
  - Background color: 3 presets — White, Sepia, Dark.
  - Settings persist in `localStorage`.

### Admin Page (/admin)

- **Crawl Panel**:
  - Text input for chapter numbers. Accepts: `1,2,3` or `100-110` or `1-50,55,60-70`.
  - "Crawl" button starts the process.
  - "Sync Latest" button triggers auto-sync.
- **Progress Display**:
  - Real-time toast notifications via SSE connection.
  - Each chapter shows status: skipped (yellow), success (green), error (red).
  - Summary shown when crawl completes.

### State Management

- No external state library needed — React state + `fetch` is sufficient.
- Reader settings stored in `localStorage`.
- API client in `lib/api.ts` wraps all backend calls.

## Infrastructure

### docker-compose.yml

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

### Backend Config

- NestJS compression middleware enabled (gzip) for fast text delivery.
- CORS configured to allow frontend origin.
- Environment variables via `.env`:
  ```
  DATABASE_URL=postgresql://novel_user:novel_pass@localhost:5432/novel_app
  ```

### Development Workflow

1. `docker compose up -d` — start PostgreSQL.
2. `cd backend && npm run dev` — start NestJS.
3. `cd frontend && npm run dev` — start Next.js.

## Error Handling

- Crawler: individual chapter failures don't stop the batch. Errors are emitted via SSE and logged.
- API: standard NestJS exception filters. 404 for missing chapters, 400 for invalid input.
- Frontend: toast notifications for errors. Graceful fallback if SSE connection drops.

## Scope Boundaries

**In scope:**
- Crawl and store chapters from Shadow Slave on novelight.net.
- Read chapters with basic customization.
- Admin panel for manual crawl and sync.

**Out of scope:**
- User authentication / accounts.
- Multiple novel support.
- Bookmarking / reading progress tracking.
- Full-text search.
- Scheduled auto-sync (cron).
