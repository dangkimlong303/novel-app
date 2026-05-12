import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  const [data, total] = await Promise.all([
    prisma.chapter.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { chapter_number: 'asc' },
      select: { id: true, chapter_number: true, title: true, created_at: true },
    }),
    prisma.chapter.count(),
  ]);

  return NextResponse.json({
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
