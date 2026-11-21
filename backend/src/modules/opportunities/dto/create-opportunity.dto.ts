import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentType, OpportunityType, WorkMode } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { trim, trimToUndefined } from '../../../common/transforms';
import { IsHttpsUrl } from '../../../common/validators/https-url.validator';
import { NigerianState } from '../../../common/validators/nigerian-state.validator';

export class CreateOpportunityDto {
  @ApiProperty({ enum: OpportunityType })
  @IsEnum(OpportunityType)
  type: OpportunityType;

  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title: string;

  // The company, school or programme behind it.
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  organization: string;

  @Transform(trim)
  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  description: string;

  @ApiPropertyOptional({ enum: WorkMode, default: WorkMode.ONSITE })
  @IsOptional()
  @IsEnum(WorkMode)
  mode?: WorkMode;

  // Leave out for remote or nationwide opportunities.
  @IsOptional()
  @NigerianState()
  state?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(80)
  country?: string;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  // Whole naira. For jobs and internships this is per month unless the note says otherwise.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  compensationMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  compensationMax?: number;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(200)
  compensationNote?: string;

  // For example "6 months".
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(80)
  duration?: string;

  // A date (2026-12-31, counted to the end of that day in Nigerian time) or a
  // full date and time.
  @IsOptional()
  @IsISO8601({ strict: true })
  deadline?: string;

  @IsOptional()
  @IsHttpsUrl()
  applyUrl?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() || undefined : value,
  )
  @IsEmail()
  @MaxLength(254)
  applyEmail?: string;
}
