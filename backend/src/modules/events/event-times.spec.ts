import { BadRequestException } from '@nestjs/common';
import { assertValidTimes } from './event-times';

const at = (iso: string) => new Date(iso);

describe('assertValidTimes', () => {
  it('accepts an event that ends after it starts', () => {
    expect(() => assertValidTimes(at('2026-12-05T13:00:00Z'), at('2026-12-05T16:00:00Z'))).not.toThrow();
  });

  it('rejects an end before the start, or equal to it', () => {
    expect(() => assertValidTimes(at('2026-12-05T13:00:00Z'), at('2026-12-05T12:00:00Z'))).toThrow(
      BadRequestException,
    );
    expect(() => assertValidTimes(at('2026-12-05T13:00:00Z'), at('2026-12-05T13:00:00Z'))).toThrow(
      BadRequestException,
    );
  });

  it('accepts exactly 30 days and rejects more', () => {
    expect(() => assertValidTimes(at('2026-12-01T00:00:00Z'), at('2026-12-31T00:00:00Z'))).not.toThrow();
    expect(() => assertValidTimes(at('2026-12-01T00:00:00Z'), at('2026-12-31T00:00:01Z'))).toThrow(
      BadRequestException,
    );
  });

  it('rejects invalid dates', () => {
    expect(() => assertValidTimes(new Date('nope'), at('2026-12-05T13:00:00Z'))).toThrow(BadRequestException);
  });
});
