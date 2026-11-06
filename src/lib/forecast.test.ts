import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { END, START } from './program';
import { emptyData, type Data } from './schema';
import { GOAL_WEIGHT } from './targets';
import { MAX_RATE, daysTo, forecastOn, weightModel, whenReach } from './forecast';
import { body } from './progress';

const day = (n: number) => addDays(START, n);
/** Marc's first 11 days: a fast water drop from 238, on top of a few Vietnam-week weigh-ins. */
function earlyDrop(): Data {
  const d = emptyData();
  for (let i = -9; i < 0; i++) d.days[day(i)] = { weight: 241 } as never;
  for (let i = 0; i <= 10; i++) d.days[day(i)] = { weight: 238 - i * 1.1 } as never;
  return d;
}

describe('weight forecast', () => {
  it('no longer extrapolates water weight: the old line said 114 lb on race day', () => {
    const d = earlyDrop();
    expect(body(d, day(10)).projected).toBeUndefined();
    const M = weightModel(d, day(10))!;
    expect(M.basis).toBe('plan');
    const F = forecastOn(d, M, END);
    expect(F.w).toBeGreaterThanOrEqual(GOAL_WEIGHT);
    expect(F.w).toBeLessThan(200);
  });

  it('measures the trend after the first 10 days, as a share of bodyweight', () => {
    const d = earlyDrop();
    for (let i = 11; i <= 35; i++) d.days[day(i)] = { weight: 227 - (i - 10) * 0.3 } as never; // ~2.1 lb a week
    const M = weightModel(d, day(35))!;
    expect(M.basis).toBe('trend');
    expect(M.perWeek).toBeCloseTo(-2.1, 0);
    const F = forecastOn(d, M, END);
    expect(F.w).toBeGreaterThan(GOAL_WEIGHT);
    expect(F.w).toBeLessThan(M.now);
    expect(F.low).toBeLessThanOrEqual(F.w);
    expect(F.high).toBeGreaterThanOrEqual(F.w);
    expect(body(d, day(35)).projected).toBeCloseTo(F.w, 5);
  });

  it('caps the pace at 1.5% of bodyweight a week and stops at the goal', () => {
    const d = emptyData();
    for (let i = 0; i <= 40; i++) d.days[day(i)] = { weight: 238 - i * 1.0 } as never;
    const M = weightModel(d, day(40))!;
    expect(M.rate).toBe(MAX_RATE);
    const F = forecastOn(d, M, END);
    expect(F.w).toBe(GOAL_WEIGHT);
    expect(F.goalOn).toBeDefined();
    expect(F.goalOn! < END).toBe(true);
  });

  it('answers when a weight will be reached, and refuses below the goal', () => {
    const d = earlyDrop();
    for (let i = 11; i <= 35; i++) d.days[day(i)] = { weight: 227 - (i - 10) * 0.3 } as never;
    const M = weightModel(d, day(35))!;
    const w = whenReach(M, 210)!;
    expect(w.early! <= w.date && w.date <= w.late!).toBe(true);
    expect(daysTo(M, 150)).toBeUndefined();
    expect(daysTo(M, M.now + 1)).toBe(0);
  });

  it('holds flat when the average is going up', () => {
    const d = emptyData();
    for (let i = 0; i <= 35; i++) d.days[day(i)] = { weight: 230 + i * 0.1 } as never;
    const M = weightModel(d, day(35))!;
    expect(M.gaining).toBe(true);
    expect(M.rate).toBe(0);
    expect(whenReach(M, 220)).toBeUndefined();
  });
});
