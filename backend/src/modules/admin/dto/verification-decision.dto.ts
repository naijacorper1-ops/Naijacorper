import { ApiProperty } from '@nestjs/swagger';
import { VerificationStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

export class VerificationDecisionDto {
  @ApiProperty({ enum: [VerificationStatus.VERIFIED, VerificationStatus.REJECTED] })
  @IsIn([VerificationStatus.VERIFIED, VerificationStatus.REJECTED])
  decision: VerificationStatus;
}
