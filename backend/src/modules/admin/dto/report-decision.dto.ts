import { ApiProperty } from '@nestjs/swagger';
import { ReportStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

export class ReportDecisionDto {
  @ApiProperty({ enum: [ReportStatus.REVIEWED, ReportStatus.DISMISSED] })
  @IsIn([ReportStatus.REVIEWED, ReportStatus.DISMISSED])
  status: ReportStatus;
}
