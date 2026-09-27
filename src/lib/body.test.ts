import { describe, expect, it } from 'vitest';
import { emptyData, type Data, type DayLog } from './schema';
import { circuitSegments, circuitsThisWeek, mealsWithProtein, sunRunDays, waistDue, weekTraining, weeklyWeight, withMeals } from './body';
import { isComplete } from './minday';

const withDays = (days: Record<string, DayLog>, extra: Partial<Data> = {}): Data => ({ ...emptyData(), days, ...extra });

describe('protein at meals', () => {
  it('reads old counts and new per-meal ticks', () => {
    expect(mealsWithProtein({ proMeals: 3 })).toBe(3);
    expect(mealsWithProtein({ meals: { b: true, d: true } })).toBe(2);
    expect(mealsWithProtein({})).toBe(0);
  });
  it('turns a 3-meal count into ticks when one meal changes', () => {
    expect(withMeals({ proMeals: 3 }, { l: false })).toEqual({ meals: { b: true, l: false, d: true }, proMeals: 2 });
    expect(withMeals({}, { b: true, l: true, d: true })).toMatchObject({ proMeals: 3 });
    expect(withMeals({ meals: { b: true } }, { b: false })).toEqual({ meals: undefined, proMeals: undefined });
  });
  it('ticks the minimum day at three meals', () => {
    const full = { career: true, walkMin: 20, lightsOut: true, checkedIn: true };
    expect(isComplete(withDays({ '2026-10-01': { ...full, meals: { b: true, l: true, d: true } } }), '2026-10-01')).toBe(true);
    expect(isComplete(withDays({ '2026-10-01': { ...full, meals: { b: true, l: true } } }), '2026-10-01')).toBe(false);
  });
});

describe('this week’s training', () => {
  it('counts program-week sessions and walk days (Sun–Sat)', () => {
    // Week 1: Sun Sep 27 – Sat Oct 3. Tue is rest; Mon/Wed/Sat are the complex; Thu run; Fri complex; Sun long run.
    const d = withDays({
      '2026-09-27': { done: true }, '2026-09-28': { done: true, walk: true }, '2026-09-29': { done: true }, '2026-09-30': { walkMin: 25 },
    });
    expect(weekTraining(d, '2026-10-01')).toMatchObject({ week: 1, planned: 6, done: 2, walks: 3 });
    expect(weekTraining(d, '2026-09-20')).toBeNull();
  });
});

describe('weekly weight', () => {
  it('averages each program week and compares', () => {
    const d = withDays({
      '2026-09-28': { weight: 214 }, '2026-09-30': { weight: 213 }, '2026-10-02': { weight: 212 },
      '2026-10-05': { weight: 212 }, '2026-10-07': { weight: 211 },
    });
    const w = weeklyWeight(d, '2026-10-07')!;
    expect(w.avg).toBe(211.5);
    expect(w.prev).toBe(213);
    expect(w.change).toBe(-1.5);
    expect(w.count).toBe(2);
  });
});

describe('waist and circuit', () => {
  it('asks for the waist on the 1st–3rd until it’s logged', () => {
    const d = emptyData();
    expect(waistDue(d, '2026-10-01')).toBe(true);
    expect(waistDue(d, '2026-10-04')).toBe(false);
    const logged: Data = { ...d, cols: { waist: { w: { id: 'w', _u: 1, date: '2026-10-01', value: 40, unit: 'in' } as never } } };
    expect(waistDue(logged, '2026-10-02')).toBe(false);
    expect(waistDue(logged, '2026-11-01')).toBe(true);
  });
  it('builds 3 rounds with rest between, about 16 minutes', () => {
    const s = circuitSegments();
    expect(s.filter(x => x.tone === 'work')).toHaveLength(3);
    expect(s.at(-1)!.label).toBe('Round 3');
    expect(s.reduce((a, x) => a + x.sec, 0)).toBe(16 * 60);
  });
  it('counts circuits Monday to Sunday', () => {
    expect(circuitsThisWeek(withDays({ '2026-10-19': { circuit: true }, '2026-10-21': { circuit: true }, '2026-10-26': { circuit: true } }), '2026-10-22')).toBe(2);
  });
  it('counts down to the Sun Run', () => {
    expect(sunRunDays('2026-09-27')).toBe(203);
  });
});
