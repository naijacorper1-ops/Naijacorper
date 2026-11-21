import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { trimToUndefined } from '../../../common/transforms';

export class CancelEventDto {
  // Shown to everyone who said they are going.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(300)
  reason?: string;
}
