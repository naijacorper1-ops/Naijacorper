import { BadRequestException } from '@nestjs/common';

const DAY = 24 * 60 * 60 * 1000;
export const MAX_EVENT_LENGTH_DAYS = 30;

// The start must come before the end, and an event cannot run for months
// (that is a typo, or somebody advertising).
export function assertValidTimes(startsAt: Date, endsAt: Date) {
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new BadRequestException('startsAt and endsAt must be valid dates');
  }

  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new BadRequestException('endsAt must be after startsAt');
  }

  if (endsAt.getTime() - startsAt.getTime() > MAX_EVENT_LENGTH_DAYS * DAY) {
    throw new BadRequestException(`An event cannot last longer than ${MAX_EVENT_LENGTH_DAYS} days`);
  }
}
