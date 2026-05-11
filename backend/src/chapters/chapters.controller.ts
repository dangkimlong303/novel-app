import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Sse,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ChaptersService } from './chapters.service';
import { CrawlChaptersDto } from './dto/crawl-chapters.dto';

@Controller('chapters')
export class ChaptersController {
  constructor(private readonly chaptersService: ChaptersService) {}

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.chaptersService.findAll(page, limit);
  }

  @Post('crawl')
  startCrawl(@Body() dto: CrawlChaptersDto) {
    return this.chaptersService.startCrawl(dto);
  }

  @Sse('crawl/stream')
  crawlStream(@Query('crawlId') crawlId: string) {
    return this.chaptersService.getCrawlStream(crawlId);
  }

  @Post('sync')
  sync() {
    return this.chaptersService.startSync();
  }

  @Get(':number')
  findByNumber(@Param('number', ParseIntPipe) number: number) {
    return this.chaptersService.findByNumber(number);
  }
}
