import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from './schema';
import { buildStart, isTravelMode, mondayOf, phaseOn, phaseRanges, planDay, planEnd, sundayFrom, targetsKey, travelEnd } from './life';

const S: Settings = { ...DEFAULT_SETTINGS };

describe('life plan dates', () => {
  it('ends on day 90', () => {
    expect(planEnd(S)).toBe('2026-12-26');
  });

  it('finds Mondays and Sundays', () => {
    expect(mondayOf('2026-09-28')).toBe('2026-09-28');
    expect(mondayOf('2026-10-04')).toBe('2026-09-28');
    expect(sundayFrom('2026-10-23')).toBe('2026-10-25');
    expect(sundayFrom('2026-10-25')).toBe('2026-10-25');
  });

  it('counts plan days and clamps to the plan', () => {
    expect(planDay(S, '2026-09-27')).toEqual({ status: 'pre', daysUntil: 1 });
    expect(planDay(S, '2026-09-28')).toMatchObject({ status: 'in', day: 1, phase: 'sprint' });
    expect(planDay(S, '2026-12-26')).toMatchObject({ status: 'in', day: 90 });
    expect(planDay(S, '2026-12-27')).toEqual({ status: 'post' });
  });

  it('splits the phases around the trip (home Fri Oct 23)', () => {
    expect(phaseOn(S, '2026-10-15')).toBe('sprint');
    expect(phaseOn(S, '2026-10-16')).toBe('travel');
    expect(phaseOn(S, '2026-10-22')).toBe('travel');
    expect(phaseOn(S, '2026-10-23')).toBe('reentry');
    expect(phaseOn(S, '2026-10-25')).toBe('reentry');
    expect(phaseOn(S, '2026-10-26')).toBe('build');
    expect(travelEnd(S)).toBe('2026-10-25');
    expect(buildStart(S)).toBe('2026-10-26');
  });

  it('keeps travelling until a return date is set', () => {
    const open = { ...S, returnDate: null };
    expect(phaseOn(open, '2026-12-01')).toBe('travel');
    expect(buildStart(open)).toBeNull();
    expect(phaseRanges(open).map(p => p.id)).toEqual(['sprint', 'travel']);
  });

  it('picks weekly targets by phase and build week', () => {
    expect(targetsKey(planDay(S, '2026-10-01'))).toBe('sprint');
    expect(targetsKey(planDay(S, '2026-10-20'))).toBe('travel');
    expect(targetsKey(planDay(S, '2026-10-24'))).toBe('travel');
    expect(targetsKey(planDay(S, '2026-10-26'))).toBe('build1to4');
    expect(targetsKey(planDay(S, '2026-11-22'))).toBe('build1to4');
    expect(targetsKey(planDay(S, '2026-11-23'))).toBe('build5plus');
  });

  it('switches travel mode automatically, or by override', () => {
    expect(isTravelMode(S, '2026-10-15')).toBe(false);
    expect(isTravelMode(S, '2026-10-16')).toBe(true);
    expect(isTravelMode(S, '2026-10-25')).toBe(true);
    expect(isTravelMode(S, '2026-10-26')).toBe(false);
    expect(isTravelMode({ ...S, travelModeOverride: true }, '2026-10-01')).toBe(true);
    expect(isTravelMode({ ...S, travelModeOverride: false }, '2026-10-20')).toBe(false);
  });
});
