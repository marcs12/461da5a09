import { addDays, diff, num } from './dates';
import { END, START, WEEKS, programDay } from './program';
import type { Data, Settings } from './schema';

/**
 * Calories, protein and the weight the plan expects, by program week.
 * `target` is the weight at the end of the tier if the plan is on track;
 * `floor` is the slower outcome that still counts as a good result.
 */
export interface Tier { from: number; to: number; cal: number; pro: number; steps: number; target: number; floor: number }
export const TIERS: Tier[] = [
  { from: 1, to: 8, cal: 1450, pro: 190, steps: 12000, target: 210, floor: 214 },
  { from: 9, to: 14, cal: 1600, pro: 190, steps: 12000, target: 193, floor: 199 },
  { from: 15, to: 20, cal: 1500, pro: 180, steps: 15000, target: 177, floor: 184 },
  { from: 21, to: 24, cal: 1500, pro: 180, steps: 15000, target: 165, floor: 172 },
  { from: 25, to: 25, cal: 2400, pro: 150, steps: 10000, target: 165, floor: 172 },
];
/** Never eat below this while training. */
export const CAL_FLOOR = 1500;
/** Steps outside the plan's tiers (before day 1, after the race). */
export const STEPS = 10000;
export const GOAL_WEIGHT = 165;
/** Used until there is a weigh-in around day 1. */
export const DEFAULT_START_WEIGHT = 238;
/** Christmas Eve and Christmas Day, and the three days before the Jan 31 time trial, are eaten at maintenance. */
export const MAINTENANCE_DAYS: Record<string, number> = {
  '2026-12-24': 2700, '2026-12-25': 2700,
  '2027-01-28': 2600, '2027-01-29': 2600, '2027-01-30': 2600,
};
/** After the race: roughly where weight holds steady. */
export const AFTER = { cal: 2400, pro: 150 };
/** The race to the end of April is a short beach block before Hawaii: still cutting, at the floor. */
export const BEACH_END = '2027-04-30';
export const BEACH = { cal: 1500, pro: 180, steps: 12000 };

export const tierOfWeek = (w: number) => TIERS.find(t => w >= t.from && w <= t.to)!;

export interface DayTargets { cal: number; pro: number; steps: number; note: string }
/** The day's food targets. Before day 1 they are whatever was already set; an override in Settings wins during the plan. */
export function targetsOn(s: Settings, ds: string): DayTargets {
  const pd = programDay(ds);
  if (pd.status === 'pre') return { cal: s.calTarget, pro: s.proTarget, steps: STEPS, note: 'plan targets start on day 1' };
  if (pd.status === 'post' && ds <= BEACH_END) return { ...BEACH, note: 'until Hawaii, then add 150 a week' };
  if (pd.status === 'post') return { cal: AFTER.cal, pro: AFTER.pro, steps: STEPS, note: 'add 150 a week until weight holds' };
  const t = tierOfWeek(pd.week);
  const pro = s.proOverride ?? t.pro;
  if (MAINTENANCE_DAYS[ds]) return { cal: MAINTENANCE_DAYS[ds], pro, steps: t.steps, note: ds > '2027-01-01' ? 'maintenance before the time trial' : 'maintenance today, then back to plan' };
  if (s.calOverride != null) return { cal: s.calOverride, pro, steps: t.steps, note: `your override · plan says ${t.cal.toLocaleString()}` };
  return { cal: t.cal, pro, steps: t.steps, note: pd.week === WEEKS ? 'race week: maintenance' : `targets for weeks ${t.from}–${t.to}` };
}

/** The starting weight: the one set in Settings, else the weigh-in closest to day 1, else the default. */
export function startWeight(d: Data): number {
  if (d.settings.startWeight != null) return d.settings.startWeight;
  for (const off of [-1, 0, -2, 1]) {
    const w = num(d.days[addDays(START, off)]?.weight);
    if (w != null) return w;
  }
  return DEFAULT_START_WEIGHT;
}

function line(key: 'target' | 'floor', start: number, weeks: number): number {
  if (weeks <= 0) return start;
  let prevW = 0, prev = start;
  for (const t of TIERS) {
    if (weeks <= t.to) return prev - ((prev - t[key]) * (weeks - prevW)) / (t.to - prevW);
    prevW = t.to;
    prev = t[key];
  }
  return prev;
}
/** Weight the plan expects after `weeks` weeks (fractions allowed), from a starting weight. */
export const targetAfter = (start: number, weeks: number) => line('target', start, weeks);
export const floorAfter = (start: number, weeks: number) => line('floor', start, weeks);
/** Weeks of the plan completed by the end of `ds`, clamped to the plan. */
export const weeksBy = (ds: string) => Math.min(WEEKS, Math.max(0, (diff(ds, START) + 1) / 7));
export const targetOn = (start: number, ds: string) => targetAfter(start, weeksBy(ds));
export const floorOn = (start: number, ds: string) => floorAfter(start, weeksBy(ds));

/** The end of each calorie tier is a weight checkpoint. */
export const CHECKPOINTS = TIERS.slice(0, -1).map(t => ({ week: t.to, date: addDays(START, t.to * 7 - 1), target: t.target, floor: t.floor }));
export const nextCheckpoint = (ds: string) => CHECKPOINTS.find(c => c.date >= ds) ?? null;
export const daysToRace = (ds: string) => diff(END, ds);
