import { Module } from '@nestjs/common';
import { CrawlerService } from './crawler.service';
import { AllnovelService } from './allnovel.service';
import { WuxiaworldService } from './wuxiaworld.service';

@Module({
  providers: [CrawlerService, AllnovelService, WuxiaworldService],
  exports: [CrawlerService, AllnovelService, WuxiaworldService],
})
export class CrawlerModule {}
