import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { trimToUndefined } from '../../../common/transforms';
import { IsCloudinaryUrl } from '../../../common/validators/cloudinary-url.validator';

export class CreatePollDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  @Transform(({ value }) => (Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v.trim() : v)) : value))
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(80, { each: true })
  options: string[];

  // How long voting stays open. Defaults to 24 hours, at most 7 days.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  durationHours?: number;
}

export class CreatePostDto {
  // Content is optional because a plain repost or a photo-only post has none.
  // PostsService checks that there is content, media, a repost target or a poll.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(2000)
  content?: string;

  // Only files uploaded through POST /uploads/post-media are accepted.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsCloudinaryUrl('posts', { each: true })
  mediaUrls?: string[];

  @IsOptional()
  @IsUUID()
  repostOfId?: string;

  // Post inside a group instead of the main feed. You must be a member.
  @IsOptional()
  @IsUUID()
  groupId?: string;

  // The post's content is the question. Needs content.
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePollDto)
  poll?: CreatePollDto;
}
