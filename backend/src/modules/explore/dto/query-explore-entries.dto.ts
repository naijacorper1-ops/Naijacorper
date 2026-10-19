import { ApiPropertyOptional } from '@nestjs/swagger';
import { ExploreCategory } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/page-query.dto';
import { trimToUndefined } from '../../../common/transforms';
import { NigerianState } from '../../../common/validators/nigerian-state.validator';

export class QueryExploreEntriesDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ExploreCategory })
  @IsOptional()
  @IsEnum(ExploreCategory)
  category?: ExploreCategory;

  @IsOptional()
  @NigerianState()
  state?: string;

  // Search in the name and description.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(60)
  q?: string;
}
