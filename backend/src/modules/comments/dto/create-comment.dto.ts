import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { trim } from '../../../common/transforms';

export class CreateCommentDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content: string;

  // Reply to an existing comment. Replies go one level deep: a reply to a
  // reply is attached to the same top-level comment.
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
