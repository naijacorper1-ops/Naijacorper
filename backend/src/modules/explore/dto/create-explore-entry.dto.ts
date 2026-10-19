import { ApiProperty } from '@nestjs/swagger';
import { ExploreCategory } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { trim } from '../../../common/transforms';
import { NigerianState } from '../../../common/validators/nigerian-state.validator';

export class CreateExploreEntryDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: ExploreCategory })
  @IsEnum(ExploreCategory)
  category: ExploreCategory;

  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  description: string;

  // Defaults to the submitter's own state if omitted
  @IsOptional()
  @NigerianState()
  state?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}
