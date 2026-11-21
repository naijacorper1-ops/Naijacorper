import { ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentType, OpportunityStatus, OpportunityType, WorkMode } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/page-query.dto';
import { trimToUndefined } from '../../../common/transforms';
import { NigerianState } from '../../../common/validators/nigerian-state.validator';

export class QueryOpportunitiesDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: OpportunityType })
  @IsOptional()
  @IsEnum(OpportunityType)
  type?: OpportunityType;

  // Only opportunities set in this state. Use mode=REMOTE to find remote ones.
  @IsOptional()
  @NigerianState()
  state?: string;

  @ApiPropertyOptional({ enum: WorkMode })
  @IsOptional()
  @IsEnum(WorkMode)
  mode?: WorkMode;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  // Search in the title, organization and description.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(60)
  q?: string;
}

export class QueryMyOpportunitiesDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: OpportunityStatus })
  @IsOptional()
  @IsEnum(OpportunityStatus)
  status?: OpportunityStatus;
}

export class UpdateOpportunityStatusDto {
  // Close an open opportunity, or open a closed one again.
  @ApiPropertyOptional({ enum: ['OPEN', 'CLOSED'] })
  @IsIn(['OPEN', 'CLOSED'])
  status: 'OPEN' | 'CLOSED';
}
