import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { trim } from '../../../common/transforms';
import { NigerianState } from '../../../common/validators/nigerian-state.validator';
import { Username } from '../../../common/validators/username.validator';

export class UpdateProfileDto {
  @IsOptional()
  @Username()
  username?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  fullName?: string;

  // Send an empty string to clear the bio.
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  bio?: string;

  @IsOptional()
  @NigerianState()
  state?: string;
}
