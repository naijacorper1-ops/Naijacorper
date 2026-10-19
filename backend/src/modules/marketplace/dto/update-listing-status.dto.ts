import { ApiProperty } from '@nestjs/swagger';
import { ListingStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

// Sellers can mark a listing available or sold. REMOVED can only be set by
// an admin.
export class UpdateListingStatusDto {
  @ApiProperty({ enum: [ListingStatus.AVAILABLE, ListingStatus.SOLD] })
  @IsIn([ListingStatus.AVAILABLE, ListingStatus.SOLD])
  status: ListingStatus;
}
