import { ApiPropertyOptional } from '@nestjs/swagger';
import { VerificationDocumentType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { trimToUndefined } from '../../../common/transforms';

// Sent as multipart form fields next to the "file" field.
export class SubmitVerificationDto {
  @ApiPropertyOptional({ enum: VerificationDocumentType })
  @IsOptional()
  @IsEnum(VerificationDocumentType)
  documentType?: VerificationDocumentType;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(300)
  note?: string;
}
