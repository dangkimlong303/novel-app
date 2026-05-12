import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ number: string }> },
) {
  const { number } = await params;
  const chapterNumber = parseInt(number, 10);

  if (isNaN(chapterNumber)) {
    return NextResponse.json({ message: 'Invalid chapter number' }, { status: 400 });
  }

  const chapter = await prisma.chapter.findUnique({
    where: { chapter_number: chapterNumber },
  });

  if (!chapter) {
    return NextResponse.json({ message: `Chapter ${chapterNumber} not found` }, { status: 404 });
  }

  const [prev, next] = await Promise.all([
    prisma.chapter.findFirst({
      where: { chapter_number: { lt: chapterNumber } },
      orderBy: { chapter_number: 'desc' },
      select: { chapter_number: true },
    }),
    prisma.chapter.findFirst({
      where: { chapter_number: { gt: chapterNumber } },
      orderBy: { chapter_number: 'asc' },
      select: { chapter_number: true },
    }),
  ]);

  return NextResponse.json({
    ...chapter,
    prev: prev?.chapter_number ?? null,
    next: next?.chapter_number ?? null,
  });
}
