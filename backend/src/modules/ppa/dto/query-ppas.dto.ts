import { ApiPropertyOptional } from '@nestjs/swagger';
import { PpaSector } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/page-query.dto';
import { trimToUndefined } from '../../../common/transforms';
import { NigerianState } from '../../../common/validators/nigerian-state.validator';

export class QueryPpasDto extends PageQueryDto {
  // Search by PPA name.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(60)
  q?: string;

  @IsOptional()
  @NigerianState()
  state?: string;

  @ApiPropertyOptional({ enum: PpaSector })
  @IsOptional()
  @IsEnum(PpaSector)
  sector?: PpaSector;
}

// For the "which PPA?" field when writing a review. Unlike the list, it also
// finds PPAs that have no reviews yet.
export class SuggestPpasDto {
  @Transform(trimToUndefined)
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  q: string;

  @IsOptional()
  @NigerianState()
  state?: string;
}
