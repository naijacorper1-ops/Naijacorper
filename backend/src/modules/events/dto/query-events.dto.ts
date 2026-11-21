import { ApiPropertyOptional } from '@nestjs/swagger';
import { EventCategory, EventFormat, EventStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../../common/dto/page-query.dto';
import { trimToUndefined } from '../../../common/transforms';
import { NigerianState } from '../../../common/validators/nigerian-state.validator';

export const EVENT_WHEN = ['upcoming', 'past', 'all'] as const;
export type EventWhen = (typeof EVENT_WHEN)[number];

export class QueryEventsDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: EventCategory })
  @IsOptional()
  @IsEnum(EventCategory)
  category?: EventCategory;

  @IsOptional()
  @NigerianState()
  state?: string;

  @ApiPropertyOptional({ enum: EventFormat })
  @IsOptional()
  @IsEnum(EventFormat)
  format?: EventFormat;

  // upcoming (default): not finished yet, soonest first.
  // past: already finished, most recent first.
  // all: both, most recent first.
  @ApiPropertyOptional({ enum: EVENT_WHEN, default: 'upcoming' })
  @IsOptional()
  @IsIn(EVENT_WHEN)
  when?: EventWhen;

  // Search in the title, description, organizer and venue.
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString()
  @MaxLength(60)
  q?: string;
}

export class QueryMyEventsDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: EventStatus })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}
