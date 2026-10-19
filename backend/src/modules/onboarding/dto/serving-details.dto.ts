import { Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { trim, trimToUndefined } from '../../../common/transforms';
import { NigerianState } from '../../../common/validators/nigerian-state.validator';
import { SERVING_INTERESTS } from '../constants/interests';

export class ServingDetailsDto {
  @NigerianState()
  state: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lga: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  batch: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  stream: string;

  // Optional: PRD says "where relevant and appropriate"
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(120)
  ppa?: string;

  @IsArray()
  @ArrayUnique()
  @IsIn(SERVING_INTERESTS, { each: true })
  interests: string[];
}
