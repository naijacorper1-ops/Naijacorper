import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventCategory, EventFormat } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { trim, trimToUndefined } from '../../../common/transforms';
import { IsCloudinaryUrl } from '../../../common/validators/cloudinary-url.validator';
import { IsHttpsUrl } from '../../../common/validators/https-url.validator';
import { NigerianState } from '../../../common/validators/nigerian-state.validator';

export class CreateEventDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title: string;

  @Transform(trim)
  @IsString()
  @MinLength(10)
  @MaxLength(3000)
  description: string;

  @ApiProperty({ enum: EventCategory })
  @IsEnum(EventCategory)
  category: EventCategory;

  // Upload it with POST /uploads/event-cover first.
  @IsOptional()
  @IsCloudinaryUrl('events')
  coverImageUrl?: string;

  // Shown as "by ...". Defaults to the creator's full name.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(120)
  organizerName?: string;

  // Full date and time with the offset, for example 2026-12-05T14:00:00+01:00.
  @IsISO8601({ strict: true })
  startsAt: string;

  @IsISO8601({ strict: true })
  endsAt: string;

  @ApiPropertyOptional({ enum: EventFormat, default: EventFormat.PHYSICAL })
  @IsOptional()
  @IsEnum(EventFormat)
  format?: EventFormat;

  // Required for PHYSICAL and HYBRID events.
  @IsOptional()
  @NigerianState()
  state?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(80)
  lga?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(200)
  venue?: string;

  @IsOptional()
  @IsHttpsUrl()
  registrationUrl?: string;

  @IsOptional()
  @IsHttpsUrl()
  meetingUrl?: string;
}
