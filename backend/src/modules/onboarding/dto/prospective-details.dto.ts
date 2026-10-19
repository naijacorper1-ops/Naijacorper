import { ApiProperty } from '@nestjs/swagger';
import { NyscStage } from '@prisma/client';
import { ArrayUnique, IsArray, IsIn, IsOptional } from 'class-validator';
import { NigerianState } from '../../../common/validators/nigerian-state.validator';
import { PROSPECTIVE_INTERESTS } from '../constants/interests';

export class ProspectiveDetailsDto {
  @ApiProperty({ enum: NyscStage })
  @IsIn(Object.values(NyscStage))
  nyscStage: NyscStage;

  // Optional: PRD allows "I don't know yet" for expected state
  @IsOptional()
  @NigerianState()
  state?: string;

  @IsArray()
  @ArrayUnique()
  @IsIn(PROSPECTIVE_INTERESTS, { each: true })
  interests: string[];
}
