import { Module } from '@nestjs/common';
import { CrawlerService } from './crawler.service';
import { NovelfullService } from './novelfull.service';
import { AllnovelService } from './allnovel.service';

@Module({
  providers: [CrawlerService, NovelfullService, AllnovelService],
  exports: [CrawlerService, NovelfullService, AllnovelService],
})
export class CrawlerModule {}
