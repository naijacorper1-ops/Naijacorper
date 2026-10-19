import { ApiProperty } from '@nestjs/swagger';
import { ReportTargetType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { trim } from '../../../common/transforms';

export class CreateReportDto {
  @ApiProperty({ enum: ReportTargetType })
  @IsEnum(ReportTargetType)
  targetType: ReportTargetType;

  @IsString()
  @MaxLength(64)
  targetId: string;

  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
