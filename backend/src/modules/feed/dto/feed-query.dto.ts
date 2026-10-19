import { IsIn, IsOptional } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/page-query.dto';
import { NigerianState } from '../../../common/validators/nigerian-state.validator';

export type FeedScope = 'NATIONAL' | 'STATE' | 'FOLLOWING';

export class FeedQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(['NATIONAL', 'STATE', 'FOLLOWING'])
  scope?: FeedScope = 'NATIONAL';

  // Only used when scope is STATE. Falls back to the user's own state if
  // omitted. "lagos", "Lagos State" and "LAGOS" all mean the same state.
  @IsOptional()
  @NigerianState()
  state?: string;
}
