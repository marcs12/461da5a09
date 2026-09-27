import { describe, expect, it } from 'vitest';
import { emptyData, type CheckIn, type Data } from './schema';
import { sleepHours, sleepNights, supportTrigger, weekMood } from './mind';

const ci = (date: string, mood: number, losingInterest = false): CheckIn => ({ id: date, _u: 1, date, mood, win: '', firstTaskTomorrow: '', losingInterest });
const withCheckIns = (xs: CheckIn[]): Data => ({ ...emptyData(), priv: { checkIns: Object.fromEntries(xs.map(c => [c.id, c])) } });
// Weeks: Sep 28 – Oct 4, Oct 5 – 11, Oct 12 – 18.
const lowWeek = (mon: number, n = 3, mood = 3) => Array.from({ length: n }, (_, i) => ci(`2026-10-${String(mon + i).padStart(2, '0')}`, mood));

describe('mood and sleep', () => {
  it('averages a Monday–Sunday week', () => {
    expect(weekMood(withCheckIns([ci('2026-10-05', 6), ci('2026-10-07', 8), ci('2026-10-12', 2)]), '2026-10-05')).toEqual({ avg: 7, n: 2 });
  });
  it('counts 7+ hour nights', () => {
    const d: Data = { ...emptyData(), days: { '2026-10-05': { sleep: 7 }, '2026-10-06': { sleep: 6.5 }, '2026-10-07': { sleep: 8 } } };
    expect(sleepNights(d, '2026-10-05')).toEqual({ n: 2, logged: 3 });
  });
  it('works out hours from bed and wake times', () => {
    expect(sleepHours('22:30', '05:00')).toBe(6.5);
    expect(sleepHours('00:15', '06:00')).toBe(5.75);
  });
});

describe('support trigger', () => {
  it('fires after two completed low weeks with 3+ check-ins each', () => {
    // Weeks of Oct 5 and Oct 12 both low; it's now the week of Oct 19.
    expect(supportTrigger(withCheckIns([...lowWeek(5), ...lowWeek(12)]), '2026-10-20')).toEqual({ fired: true, reason: 'mood' });
  });
  it('needs both weeks, and at least 3 check-ins in each', () => {
    expect(supportTrigger(withCheckIns([...lowWeek(12)]), '2026-10-20').fired).toBe(false);
    expect(supportTrigger(withCheckIns([...lowWeek(5, 2), ...lowWeek(12)]), '2026-10-20').fired).toBe(false);
    expect(supportTrigger(withCheckIns([...lowWeek(5, 3, 5), ...lowWeek(12)]), '2026-10-20').fired).toBe(false);
  });
  it('does not count the week in progress toward the mood rule', () => {
    expect(supportTrigger(withCheckIns([...lowWeek(12), ...lowWeek(19)]), '2026-10-22').fired).toBe(false);
  });
  it('fires on "losing interest" in any check-in this week', () => {
    expect(supportTrigger(withCheckIns([ci('2026-10-20', 7, true)]), '2026-10-22')).toEqual({ fired: true, reason: 'interest' });
    expect(supportTrigger(withCheckIns([ci('2026-10-13', 7, true)]), '2026-10-22').fired).toBe(false);
  });
});
