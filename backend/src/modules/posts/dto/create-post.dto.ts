import { IsArray, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreatePostDto {
  // Content is optional at the DTO level because a plain repost has
  // none. PostsService checks that content or repostOfId is present.
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  mediaUrls?: string[];

  @IsOptional()
  @IsString()
  repostOfId?: string;
}
