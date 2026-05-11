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
