import { IsOptional, IsArray, IsNumber, IsString, Matches, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class CrawlChaptersDto {
  @ValidateIf((o) => !o.range)
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  chapters?: number[];

  @ValidateIf((o) => !o.chapters)
  @IsString()
  @Matches(/^\d+(-\d+)?(,\s*\d+(-\d+)?)*$/, { message: 'range must be like "1-50" or "1,2,3" or "1-5,10,20-25"' })
  range?: string;
}
