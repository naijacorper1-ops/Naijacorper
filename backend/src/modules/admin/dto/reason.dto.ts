import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { trim, trimToUndefined } from '../../../common/transforms';

// A note the admin may add. Shown to the affected user where it makes
// sense (for example why a listing was removed) and saved in the audit log.
export class OptionalReasonDto {
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RequiredReasonDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
