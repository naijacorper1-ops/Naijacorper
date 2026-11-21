import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IntensityLevel, PpaSector, RatingLevel } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { trim, trimToUndefined } from '../../../common/transforms';
import { NigerianState } from '../../../common/validators/nigerian-state.validator';

// Send either ppaId (the PPA already exists, find it with GET /ppas/suggest)
// or name and state (the PPA is created if nobody has reviewed it yet).
export class SubmitPpaReviewDto {
  @IsOptional()
  @IsUUID()
  ppaId?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @NigerianState()
  state?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(80)
  lga?: string;

  @ApiPropertyOptional({ enum: PpaSector })
  @IsOptional()
  @IsEnum(PpaSector)
  sector?: PpaSector;

  @IsInt()
  @Min(1)
  @Max(5)
  overallRating: number;

  @ApiProperty({ enum: RatingLevel })
  @IsEnum(RatingLevel)
  environment: RatingLevel;

  @ApiProperty({ enum: IntensityLevel })
  @IsEnum(IntensityLevel)
  learning: IntensityLevel;

  @ApiProperty({ enum: IntensityLevel })
  @IsEnum(IntensityLevel)
  workload: IntensityLevel;

  @ApiProperty({ enum: RatingLevel })
  @IsEnum(RatingLevel)
  staffRelationship: RatingLevel;

  @Transform(trim)
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  content: string;

  // Defaults to true. The author is only shown to other users when this is false.
  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;
}
