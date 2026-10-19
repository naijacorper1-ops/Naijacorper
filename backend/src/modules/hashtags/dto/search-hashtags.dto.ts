import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { trim } from '../../../common/transforms';

export class SearchHashtagsDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(51)
  q: string;
}
