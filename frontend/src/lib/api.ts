// Reading API uses Next.js API routes (relative URL)
// Crawl/admin API uses the NestJS backend (local only)
const API_BASE = '/api';
const BACKEND_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

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

export async function fetchChapters(
  page: number,
  limit: number,
  sort: 'asc' | 'desc',
  search: string,
): Promise<PaginatedResponse> {
  var params = new URLSearchParams({ page: String(page), limit: String(limit), sort: sort });
  if (search) params.set('search', search);
  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, 10000);
  var res;
  try {
    res = await fetch(API_BASE + '/chapters?' + params.toString(), { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error('Failed to fetch chapters');
  return res.json();
}

export async function fetchChapter(number: number): Promise<ChapterDetail> {
  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, 10000);
  var res;
  try {
    res = await fetch(API_BASE + '/chapters/' + number, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error('Failed to fetch chapter ' + number);
  return res.json();
}

export async function startCrawl(input: string): Promise<CrawlResponse> {
  const body: { chapters?: number[]; range?: string } = {};

  if (input.includes('-') || input.includes(',')) {
    body.range = input;
  } else {
    body.chapters = [Number(input)];
  }

  const res = await fetch(`${BACKEND_BASE}/chapters/crawl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to start crawl');
  return res.json();
}

export async function startSync(): Promise<CrawlResponse> {
  const res = await fetch(`${BACKEND_BASE}/chapters/sync`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to start sync');
  return res.json();
}

export function subscribeToCrawl(
  crawlId: string,
  onProgress: (event: CrawlEvent) => void,
  onDone: (summary: CrawlDone) => void,
  onError?: () => void,
): () => void {
  const source = new EventSource(`${BACKEND_BASE}/chapters/crawl/stream?crawlId=${crawlId}`);

  source.addEventListener('progress', (e: MessageEvent) => {
    onProgress(JSON.parse(e.data));
  });

  source.addEventListener('done', (e: MessageEvent) => {
    onDone(JSON.parse(e.data));
    source.close();
  });

  source.onerror = () => {
    source.close();
    onError?.();
  };

  return () => source.close();
}
