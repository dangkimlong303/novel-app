import { Module } from '@nestjs/common';
import { CrawlerService } from './crawler.service';
import { AllnovelService } from './allnovel.service';

@Module({
  providers: [CrawlerService, AllnovelService],
  exports: [CrawlerService, AllnovelService],
})
export class CrawlerModule {}
