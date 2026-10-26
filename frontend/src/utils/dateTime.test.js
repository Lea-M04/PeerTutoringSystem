import { describe, expect, it } from 'vitest';
import { formatLocalDateTime, localDateTimeToUtcIso, utcIsoToLocalDateTime } from './dateTime.js';

describe('explicit local and UTC date-time conversion', () => {
  it('round-trips local wall times through winter and summer offsets', () => {
    const zone = 'Europe/Paris';

    const winter = localDateTimeToUtcIso('2030-01-15T21:00', zone);
    const summer = localDateTimeToUtcIso('2030-07-15T21:00', zone);

    expect(winter).toBe('2030-01-15T20:00:00.000Z');
    expect(summer).toBe('2030-07-15T19:00:00.000Z');
    expect(utcIsoToLocalDateTime(winter, zone)).toBe('2030-01-15T21:00');
    expect(utcIsoToLocalDateTime(summer, zone)).toBe('2030-07-15T21:00');
    expect(formatLocalDateTime(summer, zone)).toContain('9:00 PM');
  });

  it('rejects a local time skipped by the spring daylight-saving change', () => {
    expect(() => localDateTimeToUtcIso('2030-03-31T02:30', 'Europe/Paris'))
      .toThrow(/does not exist because the clock moves forward/i);
  });

  it('chooses the earlier occurrence of a repeated local time consistently', () => {
    const zone = 'Europe/Paris';
    const instant = localDateTimeToUtcIso('2030-10-27T02:30', zone);

    expect(instant).toBe('2030-10-27T00:30:00.000Z');
    expect(utcIsoToLocalDateTime(instant, zone)).toBe('2030-10-27T02:30');
  });

  it('converts post-transition Paris wall times on 25 October 2026 exactly once', () => {
    const zone = 'Europe/Paris';
    const start = localDateTimeToUtcIso('2026-10-25T14:04', zone);
    const end = localDateTimeToUtcIso('2026-10-25T15:00', zone);

    expect(start).toBe('2026-10-25T13:04:00.000Z');
    expect(end).toBe('2026-10-25T14:00:00.000Z');
    expect(utcIsoToLocalDateTime(start, zone)).toBe('2026-10-25T14:04');
    expect(utcIsoToLocalDateTime(end, zone)).toBe('2026-10-25T15:00');
  });
});
