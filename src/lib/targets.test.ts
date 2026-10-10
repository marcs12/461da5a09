import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, emptyData, type Data } from './schema';
import { CHECKPOINTS, DEFAULT_START_WEIGHT, daysToRace, floorAfter, nextCheckpoint, startWeight, targetAfter, targetOn, targetsOn, tierOfWeek } from './targets';

const S = DEFAULT_SETTINGS;

describe('daily targets', () => {
  it('step calories down by tier', () => {
    expect(targetsOn(S, '2026-10-26')).toMatchObject({ cal: 1700, pro: 180, steps: 10000 });
    expect(targetsOn(S, '2026-12-20')).toMatchObject({ cal: 1700 });
    expect(targetsOn(S, '2026-12-21')).toMatchObject({ cal: 1600, pro: 180 });
    expect(targetsOn(S, '2027-02-15')).toMatchObject({ cal: 1500, pro: 170 });
    expect(targetsOn(S, '2027-04-11')).toMatchObject({ cal: 1500 });
    expect(targetsOn(S, '2027-04-12')).toMatchObject({ cal: 2300, pro: 150 });
  });
  it('keep the earlier targets until day 1', () => {
    expect(targetsOn({ ...S, calTarget: 2100 }, '2026-10-25')).toMatchObject({ cal: 2100, pro: S.proTarget });
  });
  it('are at maintenance on Dec 24 and 25 only', () => {
    expect(targetsOn(S, '2026-12-23').cal).toBe(1600);
    expect(targetsOn(S, '2026-12-24').cal).toBe(2700);
    expect(targetsOn(S, '2026-12-25').cal).toBe(2700);
    expect(targetsOn(S, '2026-12-26').cal).toBe(1600);
  });
  it('let an override win during the plan, but not on a maintenance day', () => {
    const o = { ...S, calOverride: 1700, proOverride: 190 };
    expect(targetsOn(o, '2027-01-05')).toMatchObject({ cal: 1700, pro: 190 });
    expect(targetsOn(o, '2026-12-25')).toMatchObject({ cal: 2700, pro: 190 });
    expect(targetsOn(o, '2026-10-20').cal).toBe(S.calTarget);
  });
  it('cover every week with a tier', () => {
    for (let w = 1; w <= 25; w++) expect(tierOfWeek(w)).toBeDefined();
  });
});

describe('weight targets', () => {
  it('hit each checkpoint from 238 lb', () => {
    expect(targetAfter(238, 0)).toBe(238);
    expect(targetAfter(238, 1)).toBeCloseTo(234.875);
    expect(targetAfter(238, 8)).toBe(213);
    expect(targetAfter(238, 9)).toBeCloseTo(210.625);
    expect(targetAfter(238, 16)).toBe(194);
    expect(targetAfter(238, 24)).toBe(174);
    expect(targetAfter(238, 25)).toBe(174);
    expect(floorAfter(238, 8)).toBe(217);
    expect(floorAfter(238, 24)).toBe(182);
  });
  it('only change the first stretch when the starting weight changes', () => {
    expect(targetAfter(242, 4)).toBeCloseTo(227.5);
    expect(targetAfter(242, 8)).toBe(213);
    expect(targetAfter(242, 12)).toBe(targetAfter(238, 12));
  });
  it('follow the calendar', () => {
    expect(targetOn(238, '2026-10-25')).toBe(238);
    expect(targetOn(238, '2026-12-20')).toBe(213);
    expect(targetOn(238, '2027-04-18')).toBe(174);
    expect(targetOn(238, '2027-06-01')).toBe(174);
  });
  it('put the checkpoints on the Sundays that end weeks 8, 16 and 24', () => {
    expect(CHECKPOINTS.map(c => c.date)).toEqual(['2026-12-20', '2027-02-14', '2027-04-11']);
    expect(nextCheckpoint('2026-12-21')!.target).toBe(194);
    expect(nextCheckpoint('2027-04-12')).toBeNull();
  });
});

describe('starting weight', () => {
  const withDays = (days: Data['days'], settings = S): Data => ({ ...emptyData(), days, settings });
  it('defaults to 238 until there is a weigh-in around day 1', () => {
    expect(startWeight(withDays({ '2026-10-05': { weight: 240 } }))).toBe(DEFAULT_START_WEIGHT);
  });
  it('prefers the Oct 25 weigh-in, then day 1', () => {
    expect(startWeight(withDays({ '2026-10-25': { weight: 241.2 }, '2026-10-26': { weight: 240.4 } }))).toBe(241.2);
    expect(startWeight(withDays({ '2026-10-26': { weight: 240.4 } }))).toBe(240.4);
  });
  it('uses the one set in Settings over any weigh-in', () => {
    expect(startWeight(withDays({ '2026-10-25': { weight: 241.2 } }, { ...S, startWeight: 239 }))).toBe(239);
  });
});

describe('race countdown', () => {
  it('counts days to Apr 18, 2027', () => {
    expect(daysToRace('2026-10-26')).toBe(174);
    expect(daysToRace('2027-04-18')).toBe(0);
  });
});
