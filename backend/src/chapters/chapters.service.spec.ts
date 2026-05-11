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
