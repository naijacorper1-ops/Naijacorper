import { IsIn, IsOptional, IsString } from 'class-validator';

export type FeedScope = 'NATIONAL' | 'STATE' | 'FOLLOWING';

export class FeedQueryDto {
  @IsOptional()
  @IsIn(['NATIONAL', 'STATE', 'FOLLOWING'])
  scope?: FeedScope = 'NATIONAL';

  // Only used when scope is STATE. Falls back to the user's own
  // state if omitted.
  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  cursor?: string;
}
