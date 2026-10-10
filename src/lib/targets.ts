import { addDays, diff, num } from './dates';
import { END, START, WEEKS, programDay } from './program';
import type { Data, Settings } from './schema';

/**
 * Calories, protein and the weight the plan expects, by program week.
 * `target` is the weight at the end of the tier if the plan is on track;
 * `floor` is the slower outcome that still counts as a good result.
 */
export interface Tier { from: number; to: number; cal: number; pro: number; target: number; floor: number }
export const TIERS: Tier[] = [
  { from: 1, to: 8, cal: 1700, pro: 180, target: 213, floor: 217 },
  { from: 9, to: 16, cal: 1600, pro: 180, target: 194, floor: 200 },
  { from: 17, to: 24, cal: 1500, pro: 170, target: 174, floor: 182 },
  { from: 25, to: 25, cal: 2300, pro: 150, target: 174, floor: 182 },
];
/** Never eat below this while training. */
export const CAL_FLOOR = 1500;
export const STEPS = 10000;
export const GOAL_WEIGHT = 170;
/** Used until there is a weigh-in around day 1. */
export const DEFAULT_START_WEIGHT = 238;
/** Christmas Eve and Christmas Day are eaten at maintenance. */
export const MAINTENANCE_DAYS: Record<string, number> = { '2026-12-24': 2700, '2026-12-25': 2700 };
/** After the race: roughly where weight holds steady. */
export const AFTER = { cal: 2400, pro: 150 };

export const tierOfWeek = (w: number) => TIERS.find(t => w >= t.from && w <= t.to)!;

export interface DayTargets { cal: number; pro: number; steps: number; note: string }
/** The day's food targets. Before day 1 they are whatever was already set; an override in Settings wins during the plan. */
export function targetsOn(s: Settings, ds: string): DayTargets {
  const pd = programDay(ds);
  if (pd.status === 'pre') return { cal: s.calTarget, pro: s.proTarget, steps: STEPS, note: 'plan targets start on day 1' };
  if (pd.status === 'post') return { cal: AFTER.cal, pro: AFTER.pro, steps: STEPS, note: 'add 150 a week until weight holds' };
  const t = tierOfWeek(pd.week);
  const pro = s.proOverride ?? t.pro;
  if (MAINTENANCE_DAYS[ds]) return { cal: MAINTENANCE_DAYS[ds], pro, steps: STEPS, note: 'maintenance today, then back to plan' };
  if (s.calOverride != null) return { cal: s.calOverride, pro, steps: STEPS, note: `your override · plan says ${t.cal.toLocaleString()}` };
  return { cal: t.cal, pro, steps: STEPS, note: pd.week === WEEKS ? 'race week: maintenance' : `targets for weeks ${t.from}–${t.to}` };
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
export const CHECKPOINTS = TIERS.slice(0, 3).map(t => ({ week: t.to, date: addDays(START, t.to * 7 - 1), target: t.target, floor: t.floor }));
export const nextCheckpoint = (ds: string) => CHECKPOINTS.find(c => c.date >= ds) ?? null;
export const daysToRace = (ds: string) => diff(END, ds);
