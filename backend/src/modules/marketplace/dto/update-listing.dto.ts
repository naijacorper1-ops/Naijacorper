import { OmitType, PartialType } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString, MaxLength, ValidateIf } from 'class-validator';
import { CreateListingDto } from './create-listing.dto';

export class UpdateListingDto extends PartialType(OmitType(CreateListingDto, ['imageUrls'] as const)) {
  // Photos the listing already has may be sent back unchanged (older listings
  // can hold photos from before uploads were restricted). Any photo that is
  // new must come from our upload endpoint; MarketplaceService checks that.
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(600, { each: true })
  imageUrls?: string[];
}
