import { IsOptional, IsArray, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CrawlChaptersDto {
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  chapters?: number[];

  @IsOptional()
  @IsString()
  range?: string;
}
