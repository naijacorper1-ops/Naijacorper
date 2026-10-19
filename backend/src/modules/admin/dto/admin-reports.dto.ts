import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportStatus, ReportTargetType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/page-query.dto';
import { trimToUndefined } from '../../../common/transforms';

export const REPORT_ACTIONS = ['NONE', 'REMOVE_CONTENT', 'DEACTIVATE_USER'] as const;
export type ReportAction = (typeof REPORT_ACTIONS)[number];

export class QueryReportsDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'REVIEWED', 'DISMISSED', 'ALL'] })
  @IsOptional()
  @IsIn(['PENDING', 'REVIEWED', 'DISMISSED', 'ALL'])
  status?: 'PENDING' | 'REVIEWED' | 'DISMISSED' | 'ALL';

  @ApiPropertyOptional({ enum: ReportTargetType })
  @IsOptional()
  @IsEnum(ReportTargetType)
  targetType?: ReportTargetType;
}

export class ReportDecisionDto {
  @ApiProperty({ enum: [ReportStatus.REVIEWED, ReportStatus.DISMISSED] })
  @IsIn([ReportStatus.REVIEWED, ReportStatus.DISMISSED])
  status: ReportStatus;

  // What to do about it. NONE (default) only closes the report.
  // REMOVE_CONTENT deletes the reported post, comment or group, or removes
  // the listing. DEACTIVATE_USER deactivates the owner of the reported item.
  @ApiPropertyOptional({ enum: REPORT_ACTIONS })
  @IsOptional()
  @IsIn(REPORT_ACTIONS)
  action?: ReportAction;

  // Shown to the owner when content is removed, and kept in the audit log.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(500)
  note?: string;
}
