import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const sort = searchParams.get('sort') === 'desc' ? 'desc' : 'asc';
  const search = searchParams.get('search')?.trim() || '';

  // Build where clause for search
  const where: Prisma.ChapterWhereInput = {};
  if (search) {
    const asNumber = parseInt(search, 10);
    if (!isNaN(asNumber)) {
      // Search by chapter number (exact match)
      where.chapter_number = asNumber;
    } else {
      // Search by title (case-insensitive contains)
      where.title = { contains: search, mode: 'insensitive' };
    }
  }

  const [data, total] = await Promise.all([
    prisma.chapter.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { chapter_number: sort },
      select: { id: true, chapter_number: true, title: true, created_at: true },
    }),
    prisma.chapter.count({ where }),
  ]);

  return NextResponse.json({
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
