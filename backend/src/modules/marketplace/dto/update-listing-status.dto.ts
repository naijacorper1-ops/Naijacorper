import { ApiProperty } from '@nestjs/swagger';
import { ListingStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateListingStatusDto {
  @ApiProperty({ enum: ListingStatus })
  @IsEnum(ListingStatus)
  status: ListingStatus;
}
