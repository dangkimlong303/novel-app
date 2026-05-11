import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ChaptersModule } from './chapters/chapters.module';

@Module({
  imports: [PrismaModule, ChaptersModule],
})
export class AppModule {}
