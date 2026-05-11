import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ChaptersModule } from './chapters/chapters.module';
import { CrawlerModule } from './crawler/crawler.module';

@Module({
  imports: [PrismaModule, ChaptersModule, CrawlerModule],
})
export class AppModule {}
