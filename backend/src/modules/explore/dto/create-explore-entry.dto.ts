import { ApiProperty } from '@nestjs/swagger';
import { ExploreCategory } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateExploreEntryDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: ExploreCategory })
  @IsEnum(ExploreCategory)
  category: ExploreCategory;

  @IsString()
  @MaxLength(1000)
  description: string;

  // Defaults to the submitter's own state if omitted
  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}
