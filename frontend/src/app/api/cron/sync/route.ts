import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { crawlChapter } from '@/lib/allnovel';

const MAX_CHAPTERS_PER_RUN = 2;

export async function GET(request: NextRequest) {
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

    const crawled: Array<{ chapter_number: number; title?: string; status: string; error?: string }> = [];
    let stoppedReason: 'limit' | 'no-more' | 'error' = 'limit';

    // Probe chapters starting from latestInDb+1 until 404 or hit MAX
    for (let n = latestInDb + 1; n <= latestInDb + MAX_CHAPTERS_PER_RUN; n++) {
      try {
        const { title, content } = await crawlChapter(n);
        await prisma.chapter.create({ data: { chapter_number: n, title, content } });
        crawled.push({ chapter_number: n, title, status: 'success' });
      } catch (error) {
        const msg = (error as Error).message;
        if (msg.includes('404')) {
          stoppedReason = 'no-more';
          break;
        }
        crawled.push({ chapter_number: n, status: 'error', error: msg });
        stoppedReason = 'error';
        break;
      }
    }

    return NextResponse.json({
      checked: true,
      latestInDb,
      crawled,
      stoppedReason,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
