import { ApiPropertyOptional } from '@nestjs/swagger';
import { IntensityLevel, RatingLevel } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { trim } from '../../../common/transforms';

// The PPA itself cannot be changed. Delete the review and write a new one.
export class UpdatePpaReviewDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  overallRating?: number;

  @ApiPropertyOptional({ enum: RatingLevel })
  @IsOptional()
  @IsEnum(RatingLevel)
  environment?: RatingLevel;

  @ApiPropertyOptional({ enum: IntensityLevel })
  @IsOptional()
  @IsEnum(IntensityLevel)
  learning?: IntensityLevel;

  @ApiPropertyOptional({ enum: IntensityLevel })
  @IsOptional()
  @IsEnum(IntensityLevel)
  workload?: IntensityLevel;

  @ApiPropertyOptional({ enum: RatingLevel })
  @IsOptional()
  @IsEnum(RatingLevel)
  staffRelationship?: RatingLevel;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  content?: string;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;
}
