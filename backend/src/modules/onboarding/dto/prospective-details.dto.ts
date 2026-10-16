import { ApiProperty } from '@nestjs/swagger';
import { NyscStage } from '@prisma/client';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { PROSPECTIVE_INTERESTS } from '../constants/interests';

export class ProspectiveDetailsDto {
  @ApiProperty({ enum: NyscStage })
  @IsIn(Object.values(NyscStage))
  nyscStage: NyscStage;

  // Optional: PRD allows "I don't know yet" for expected state
  @IsOptional()
  @IsString()
  state?: string;

  @IsArray()
  @IsIn(PROSPECTIVE_INTERESTS, { each: true })
  interests: string[];
}
