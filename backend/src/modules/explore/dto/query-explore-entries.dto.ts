import { ApiPropertyOptional } from '@nestjs/swagger';
import { ExploreCategory } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class QueryExploreEntriesDto {
  @ApiPropertyOptional({ enum: ExploreCategory })
  @IsOptional()
  @IsEnum(ExploreCategory)
  category?: ExploreCategory;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  cursor?: string;
}
