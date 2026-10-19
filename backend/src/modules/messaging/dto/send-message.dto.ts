import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { trim } from '../../../common/transforms';

export class SendMessageDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}
