import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { SERVING_INTERESTS } from '../constants/interests';

export class ServingDetailsDto {
  @IsString()
  state: string;

  @IsString()
  lga: string;

  @IsString()
  batch: string;

  @IsString()
  stream: string;

  // Optional: PRD says "where relevant and appropriate"
  @IsOptional()
  @IsString()
  ppa?: string;

  @IsArray()
  @IsIn(SERVING_INTERESTS, { each: true })
  interests: string[];
}
