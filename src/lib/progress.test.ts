import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import type { GActivity, GDay, GLap } from './garmin';
import { START } from './program';
import { emptyData, type Data } from './schema';
import { BASE_10K, GOAL_10K, body, efforts, engine, longestStreak, milestones, riegel, slope, speed, streak } from './progress';

const day = (n: number) => addDays(START, n);
const run = (id: string, date: string, over: Partial<GActivity> = {}): GActivity =>
  ({ id, _u: 1, date, start: `${date}T06:30:00`, type: 'running', distM: 5000, durS: 1800, avgHR: 140, speed: 2.78, ...over });
const km = (sec: number, n = 1): GLap[] => Array.from({ length: n }, () => ({ distM: 1000, durS: sec }));

function data(acts: GActivity[] = [], days: GDay[] = []): Data {
  const d = emptyData();
  d.cols = {
    garminActs: Object.fromEntries(acts.map(a => [a.id, a])),
    garminDays: Object.fromEntries(days.map(x => [x.id, x])),
    garminSync: { status: { id: 'status', _u: 1, at: 1, ok: true, activities: acts.length, runsWithLaps: 0, days: days.length, changed: 0, errors: [], shapes: {} } as never },
  };
  return d;
}

describe('body', () => {
  it('fits a slope in lb per day', () => {
    expect(slope([{ date: day(0), y: 238 }, { date: day(7), y: 235 }, { date: day(14), y: 232 }])).toBeCloseTo(-3 / 7);
  });
  it('measures the 7-day average against the start and the goal', () => {
    const d = data();
    d.days[day(-1)] = { weight: 238 } as never;
    for (let i = 0; i <= 27; i++) d.days[day(i)] = { weight: 238 - i * 0.3 } as never;
    const b = body(d, day(27));
    expect(b.start).toBe(238);
    expect(b.lost).toBeCloseTo(238 - (238 - 24 * 0.3), 5);
    expect(b.pct).toBeCloseTo(b.lost / 73, 5);
    expect(b.perWeek).toBeCloseTo(-2.1, 1);
    expect(b.checkpoints[0].reached).toBe(false);
  });
  it('treats a gain as no progress, not negative progress', () => {
    const d = data();
    d.days[day(0)] = { weight: 238 } as never;
    d.days[day(1)] = { weight: 241 } as never;
    expect(body(d, day(1)).pct).toBe(0);
  });
});

describe('speed', () => {
  it("predicts a 10K with Riegel's formula", () => {
    expect(riegel(30 * 60, 5)).toBeCloseTo(30 * 60 * 2 ** 1.06);
    expect(riegel(3600, 10)).toBe(3600);
  });
  it('finds 3, 5 and 10 km efforts in laps and predicts from the best', () => {
    const d = data([
      run('a', day(10), { distM: 6000, laps: [{ distM: 1000, durS: 420 }, ...km(360, 5)] }),
      run('b', day(30), { distM: 10000, durS: 3540, laps: km(354, 10) }),
    ]);
    const e = efforts(d);
    expect(e.filter(x => x.date === day(10)).map(x => x.km)).toEqual([3, 5]);
    expect(e.find(x => x.date === day(10) && x.km === 5)!.sec).toBe(1800);
    const s = speed(d, day(31));
    expect(s.best10k!.sec).toBe(3540);
    expect(s.est).toBeLessThan(3600);
    expect(s.pct).toBeCloseTo((BASE_10K - s.est!) / (BASE_10K - GOAL_10K));
    expect(s.series).toHaveLength(2);
  });
  it('uses the minutes typed on a time trial day', () => {
    const d = data();
    d.days['2026-12-20'] = { min: 30.5 } as never;
    expect(efforts(d)).toEqual([expect.objectContaining({ date: '2026-12-20', km: 5, sec: 1830, from: 'typed' })]);
  });
  it('forgets efforts older than six weeks for the estimate', () => {
    const d = data([run('a', day(0), { laps: km(330, 5) })]);
    expect(speed(d, day(10)).est).toBeDefined();
    expect(speed(d, day(60)).est).toBeUndefined();
  });
});

describe('engine', () => {
  it('compares the first and latest weeks of resting heart rate', () => {
    const days: GDay[] = Array.from({ length: 28 }, (_, i) => ({ id: day(i), _u: 1, rhr: i < 14 ? 64 : 60 }));
    const e = engine(data([], days), day(27));
    expect(e.rhr).toEqual({ first: 64, last: 60 });
    expect(e.rhrWeekly.length).toBeGreaterThanOrEqual(4);
  });
});

describe('streaks', () => {
  const hit = new Set([day(0), day(1), day(2), day(4), day(5)]);
  const ok = (ds: string) => hit.has(ds);
  it('counts back from today, or from yesterday if today is still open', () => {
    expect(streak(ok, day(5))).toBe(2);
    expect(streak(ok, day(6))).toBe(2);
    expect(streak(ok, day(7))).toBe(0);
  });
  it('finds the longest run of days', () => {
    expect(longestStreak(ok, day(10))).toEqual({ n: 3, end: day(2) });
  });
});

describe('milestones', () => {
  it('dates the first weigh-in average under each mark and shows progress toward the rest', () => {
    const d = data();
    for (let i = 0; i <= 40; i++) d.days[day(i)] = { weight: 238 - i * 0.5 } as never;
    const m = Object.fromEntries(milestones(d, day(40)).map(x => [x.id, x]));
    expect(m['lost-10'].at).toBeDefined();
    expect(m['lost-20'].at).toBeUndefined();
    expect(m['lost-20'].progress).toBeGreaterThan(0.8);
    expect(m['under-200'].at).toBeUndefined();
  });
  it('unlocks distance milestones from watch runs', () => {
    const d = data([run('a', day(5), { distM: 10010 }), run('b', day(6), { distM: 5000 })]);
    const m = Object.fromEntries(milestones(d, day(10)).map(x => [x.id, x]));
    expect(m['run-10k'].at).toBe(day(5));
    expect(m['total-100'].progress).toBeCloseTo(0.15, 2);
  });
});
