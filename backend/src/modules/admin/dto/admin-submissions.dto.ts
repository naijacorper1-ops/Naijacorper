import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventCategory, EventStatus, OpportunityStatus, OpportunityType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/page-query.dto';
import { trimToUndefined } from '../../../common/transforms';

export class QueryAdminOpportunitiesDto extends PageQueryDto {
  // Use status=PENDING for the approval queue (oldest first). Any other value,
  // or none, lists newest first.
  @ApiPropertyOptional({ enum: OpportunityStatus })
  @IsOptional()
  @IsEnum(OpportunityStatus)
  status?: OpportunityStatus;

  @ApiPropertyOptional({ enum: OpportunityType })
  @IsOptional()
  @IsEnum(OpportunityType)
  type?: OpportunityType;

  @IsOptional()
  @IsUUID()
  postedById?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(80)
  q?: string;
}

export class QueryAdminEventsDto extends PageQueryDto {
  // Use status=PENDING for the approval queue (oldest first). Any other value,
  // or none, lists newest first.
  @ApiPropertyOptional({ enum: EventStatus })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({ enum: EventCategory })
  @IsOptional()
  @IsEnum(EventCategory)
  category?: EventCategory;

  @IsOptional()
  @IsUUID()
  createdById?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(80)
  q?: string;
}

export class QueryAdminPpaReviewsDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  ppaId?: string;

  @IsOptional()
  @IsUUID()
  authorId?: string;

  // Search in the review text.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(80)
  q?: string;
}

export class SubmissionDecisionDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsIn(['APPROVE', 'REJECT'])
  decision: 'APPROVE' | 'REJECT';

  // Required when rejecting. It is shown to the person who submitted it.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(500)
  reason?: string;
}
