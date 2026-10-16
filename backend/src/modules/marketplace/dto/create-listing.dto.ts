import { ApiProperty } from '@nestjs/swagger';
import { ListingCategory } from '@prisma/client';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';

export class CreateListingDto {
  @IsString()
  @MaxLength(120)
  title: string;

  @IsString()
  @MaxLength(2000)
  description: string;

  @IsInt()
  @Min(0)
  price: number;

  @ApiProperty({ enum: ListingCategory })
  @IsEnum(ListingCategory)
  category: ListingCategory;

  // Defaults to the seller's own state if omitted
  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  imageUrls?: string[];
}
