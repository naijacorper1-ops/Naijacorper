import { ApiProperty } from '@nestjs/swagger';
import { ReportTargetType } from '@prisma/client';
import { IsEnum, IsString, MaxLength } from 'class-validator';

export class CreateReportDto {
  @ApiProperty({ enum: ReportTargetType })
  @IsEnum(ReportTargetType)
  targetType: ReportTargetType;

  @IsString()
  targetId: string;

  @IsString()
  @MaxLength(500)
  reason: string;
}
