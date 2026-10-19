import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { trim } from '../../../common/transforms';
import { NigerianState } from '../../../common/validators/nigerian-state.validator';

// The name cannot be changed because the group's link is built from it.
export class UpdateGroupDto {
  // Send an empty string to clear the description.
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @NigerianState()
  state?: string;
}
