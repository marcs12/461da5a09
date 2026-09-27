import { describe, expect, it } from 'vitest';
import { addDays, diff, iso, parse } from './dates';

describe('dates', () => {
  it('runs in Vancouver time so the UTC trap is real', () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('America/Vancouver');
    // The trap: a bare ISO date parses as UTC midnight, the previous evening here.
    expect(new Date('2026-10-16').getDate()).toBe(15);
  });

  it('parses and formats day strings in local time', () => {
    expect(parse('2026-10-16').getDate()).toBe(16);
    expect(iso(parse('2026-10-16'))).toBe('2026-10-16');
    expect(iso(new Date(2026, 9, 16, 23, 59))).toBe('2026-10-16');
  });

  it('adds days across month, year and DST boundaries', () => {
    expect(addDays('2026-09-28', 89)).toBe('2026-12-26');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    // DST ends Nov 1, 2026 in Vancouver.
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02');
    expect(diff('2026-11-02', '2026-10-31')).toBe(2);
    expect(diff('2027-03-15', '2027-03-13')).toBe(2);
  });
});
