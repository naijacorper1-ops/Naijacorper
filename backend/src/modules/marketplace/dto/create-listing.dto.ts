import { ApiProperty } from '@nestjs/swagger';
import { ListingCategory } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { trim } from '../../../common/transforms';
import { IsCloudinaryUrl } from '../../../common/validators/cloudinary-url.validator';
import { NigerianState } from '../../../common/validators/nigerian-state.validator';

export class CreateListingDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title: string;

  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description: string;

  // Whole naira. The upper limit keeps the number inside what the database
  // can store (before, a huge price caused a server error).
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  price: number;

  @ApiProperty({ enum: ListingCategory })
  @IsEnum(ListingCategory)
  category: ListingCategory;

  // Defaults to the seller's own state if omitted
  @IsOptional()
  @NigerianState()
  state?: string;

  // Photos must be uploaded through POST /uploads/listing-image first.
  // At least one is needed, except for the SERVICES category.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsCloudinaryUrl('listings', { each: true })
  imageUrls?: string[];
}
