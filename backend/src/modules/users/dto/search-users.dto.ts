import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { trim } from '../../../common/transforms';

export class SearchUsersDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  q: string;
}
