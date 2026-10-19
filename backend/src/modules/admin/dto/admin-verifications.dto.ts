import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VerificationStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/page-query.dto';
import { trimToUndefined } from '../../../common/transforms';

export class QueryVerificationsDto extends PageQueryDto {
  // PENDING is the review queue (oldest first). The others are history.
  @ApiPropertyOptional({ enum: ['PENDING', 'VERIFIED', 'REJECTED', 'ALL'] })
  @IsOptional()
  @IsIn(['PENDING', 'VERIFIED', 'REJECTED', 'ALL'])
  status?: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'ALL';
}

export class VerificationDecisionDto {
  @ApiProperty({ enum: [VerificationStatus.VERIFIED, VerificationStatus.REJECTED] })
  @IsIn([VerificationStatus.VERIFIED, VerificationStatus.REJECTED])
  decision: VerificationStatus;

  // Required when rejecting. The user sees it, so they know what to fix.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(500)
  reason?: string;
}
