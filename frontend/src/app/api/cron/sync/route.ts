import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getLatestChapterNumber, crawlChapter } from '@/lib/novelight';

const MAX_CHAPTERS_PER_RUN = 2;

export async function GET(request: NextRequest) {
  // Authorize: Vercel cron sends Authorization: Bearer ${CRON_SECRET}
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const latestRow = await prisma.chapter.findFirst({
      orderBy: { chapter_number: 'desc' },
      select: { chapter_number: true },
    });
    const latestInDb = latestRow?.chapter_number ?? 0;

    const latestOnSite = await getLatestChapterNumber();

    if (latestOnSite <= latestInDb) {
      return NextResponse.json({
        checked: true,
        latestOnSite,
        latestInDb,
        crawled: [],
        remaining: 0,
      });
    }

    const totalMissing = latestOnSite - latestInDb;
    const batchEnd = Math.min(latestInDb + MAX_CHAPTERS_PER_RUN, latestOnSite);
    const toFetch: number[] = [];
    for (let n = latestInDb + 1; n <= batchEnd; n++) toFetch.push(n);

    const crawled: Array<{ chapter_number: number; title?: string; status: string; error?: string }> = [];

    for (const num of toFetch) {
      try {
        const { title, content } = await crawlChapter(num);
        await prisma.chapter.create({ data: { chapter_number: num, title, content } });
        crawled.push({ chapter_number: num, title, status: 'success' });
      } catch (error) {
        crawled.push({ chapter_number: num, status: 'error', error: (error as Error).message });
      }
    }

    return NextResponse.json({
      checked: true,
      latestOnSite,
      latestInDb,
      crawled,
      remaining: totalMissing - crawled.filter((c) => c.status === 'success').length,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
