import { parseDeadline } from './opportunity-dates';

describe('parseDeadline', () => {
  it('counts a plain date to the end of that day in Nigerian time', () => {
    // 23:59:59.999 in UTC+1 is 22:59:59.999 UTC.
    expect(parseDeadline('2026-12-31').toISOString()).toBe('2026-12-31T22:59:59.999Z');
  });

  it('keeps a full date and time as it is', () => {
    expect(parseDeadline('2026-12-31T10:00:00+01:00').toISOString()).toBe('2026-12-31T09:00:00.000Z');
    expect(parseDeadline('2026-12-31T10:00:00Z').toISOString()).toBe('2026-12-31T10:00:00.000Z');
  });
});
