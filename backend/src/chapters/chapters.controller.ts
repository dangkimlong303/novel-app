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
  BadRequestException,
} from '@nestjs/common';
import { ChaptersService } from './chapters.service';
import { CrawlChaptersDto, CrawlSource } from './dto/crawl-chapters.dto';

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

  // @Post('crawl')
  // startCrawl(@Body() dto: CrawlChaptersDto) {
  //   return this.chaptersService.startCrawl(dto);
  // }

  /**
   * Shortcut for crawling from allnovel.org backup source.
   * Equivalent to POST /chapters/crawl with `source: "allnovel"` in body.
   */
  @Post('crawl/allnovel')
  startAllnovelCrawl(@Body() dto: CrawlChaptersDto) {
    return this.chaptersService.startCrawl({ ...dto, source: 'allnovel' });
  }

  @Sse('crawl/stream')
  crawlStream(@Query('crawlId') crawlId: string) {
    return this.chaptersService.getCrawlStream(crawlId);
  }

  @Post('sync')
  sync(@Query('source') source?: string) {
    const validSources: CrawlSource[] = ['novelight', 'allnovel', 'wuxiaworld'];
    if (source && !validSources.includes(source as CrawlSource)) {
      throw new BadRequestException(
        `Invalid source: ${source}. Must be one of: ${validSources.join(', ')}.`,
      );
    }
    return this.chaptersService.startSync(source as CrawlSource | undefined);
  }

  @Get(':number')
  findByNumber(@Param('number', ParseIntPipe) number: number) {
    return this.chaptersService.findByNumber(number);
  }
}
