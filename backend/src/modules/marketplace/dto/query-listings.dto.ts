import { ApiPropertyOptional } from '@nestjs/swagger';
import { ListingCategory, ListingStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/page-query.dto';
import { trimToUndefined } from '../../../common/transforms';
import { NigerianState } from '../../../common/validators/nigerian-state.validator';

export class QueryListingsDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ListingCategory })
  @IsOptional()
  @IsEnum(ListingCategory)
  category?: ListingCategory;

  @IsOptional()
  @NigerianState()
  state?: string;

  // Search words in the title and description, for example "bed" or "iphone".
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(60)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  maxPrice?: number;
}

// For "my listings", which can also show sold and removed ones.
export class QueryMyListingsDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ListingStatus })
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;
}
