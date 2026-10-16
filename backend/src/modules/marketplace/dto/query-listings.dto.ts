import { ApiPropertyOptional } from '@nestjs/swagger';
import { ListingCategory } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class QueryListingsDto {
  @ApiPropertyOptional({ enum: ListingCategory })
  @IsOptional()
  @IsEnum(ListingCategory)
  category?: ListingCategory;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  cursor?: string;
}
