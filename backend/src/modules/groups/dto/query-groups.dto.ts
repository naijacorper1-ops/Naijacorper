import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/page-query.dto';
import { trimToUndefined } from '../../../common/transforms';
import { NigerianState } from '../../../common/validators/nigerian-state.validator';

export class QueryGroupsDto extends PageQueryDto {
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(60)
  q?: string;

  @IsOptional()
  @NigerianState()
  state?: string;
}
