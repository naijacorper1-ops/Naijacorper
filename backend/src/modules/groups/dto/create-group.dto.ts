import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { trim, trimToUndefined } from '../../../common/transforms';
import { NigerianState } from '../../../common/validators/nigerian-state.validator';

export class CreateGroupDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  name: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(500)
  description?: string;

  // For groups about one state, for example "Lagos corpers".
  @IsOptional()
  @NigerianState()
  state?: string;
}
