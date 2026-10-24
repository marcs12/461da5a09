import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { START, programDay, sessionOf } from './program';
import { emptyData, type Data } from './schema';
import { arc, sessionCount, sessionStreak, upcoming, why } from './motivation';

const day = (n: number) => addDays(START, n);
const isRest = (n: number) => sessionOf(day(n))!.kind === 'rest';
function doneThrough(n: number, skip: number[] = []): Data {
  const d = emptyData();
  for (let i = 0; i <= n; i++) if (!isRest(i) && !skip.includes(i)) d.days[day(i)] = { done: true } as never;
  return d;
}

describe('streak and count', () => {
  it('counts sessions in a row, stepping over rest days', () => {
    const d = doneThrough(13);
    const sessions = Array.from({ length: 14 }, (_, i) => i).filter(i => !isRest(i)).length;
    expect(sessionStreak(d, day(13))).toBe(sessions);
    expect(sessionCount(d, day(13)).done).toBe(sessions);
  });
  it("doesn't break while today's session is still open", () => {
    const d = doneThrough(6);
    const next = Array.from({ length: 7 }, (_, i) => 7 + i).find(i => !isRest(i))!;
    expect(sessionStreak(d, day(next))).toBe(sessionStreak(d, day(6)));
  });
  it('restarts after a missed session', () => {
    const missed = Array.from({ length: 14 }, (_, i) => i).filter(i => !isRest(i))[3];
    const d = doneThrough(13, [missed]);
    const after = Array.from({ length: 14 }, (_, i) => i).filter(i => !isRest(i) && i > missed).length;
    expect(sessionStreak(d, day(13))).toBe(after);
  });
  it('knows the size of the whole plan', () => {
    expect(sessionCount(emptyData(), day(0)).total).toBeGreaterThan(100);
  });
});

describe('upcoming', () => {
  it('lists the next time trial and the Sun Run', () => {
    expect(upcoming('2026-12-22').map(u => u.title)).toEqual(['5K time trial', 'Sun Run']);
    expect(upcoming('2027-01-18')[0]).toMatchObject({ title: 'Sub-60 attempt', date: '2027-01-31', days: 13 });
    expect(upcoming('2027-04-10').map(u => u.title)).toEqual(['Sun Run']);
  });
});

describe('why', () => {
  it('has a reason for every session in the plan', () => {
    for (let i = 0; i < 175; i++) {
      const pd = programDay(day(i));
      if (pd.status !== 'in') continue;
      expect(why(pd.session, pd).length).toBeGreaterThan(20);
    }
  });
});

describe('arc', () => {
  it('before day 1, shows the whole distance to cover', () => {
    const a = arc(emptyData(), '2026-10-24');
    expect(a.status).toBe('pre');
    expect(a.day).toBe(0);
    expect(a.forecast).toMatch(/lighter and 16 minutes faster/);
  });
  it("waits two weeks before forecasting weight", () => {
    const d = emptyData();
    for (let i = -7; i <= 5; i++) d.days[day(i)] = { weight: 238 - Math.max(0, i) * 0.4 } as never;
    expect(arc(d, day(5)).forecast).toMatch(/Two weeks in/);
  });
});

describe('why, by session', () => {
  it('gives strength days the lifting reason and run/walk days the rebuild one', () => {
    const str = programDay(START);
    expect(str.status === 'in' && why(str.session, str)).toMatch(/Lifting/);
    const rw = programDay(day(1));
    expect(rw.status === 'in' && rw.session.tag).toBe('Run/walk');
    expect(rw.status === 'in' && why(rw.session, rw)).toMatch(/non-stop/);
  });
});
