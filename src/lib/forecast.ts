import { addDays, avg, diff } from './dates';
import { START } from './program';
import { avg7, weights, type WeighIn } from './stats';
import { GOAL_WEIGHT, startWeight, targetOn } from './targets';
import type { Data } from './schema';

/**
 * Where your weight is heading, from your own weigh-ins.
 *
 * A straight line through the first weeks of a diet is badly wrong: the first
 * week or two drops water and glycogen, then fat comes off more slowly, and
 * more slowly still as you get lighter. So the model:
 *   - uses weigh-ins from day 1 of the plan on, as 7-day averages;
 *   - ignores the first 10 days when there's enough after them;
 *   - treats the trend as a share of bodyweight per week, so the curve bends;
 *   - caps that share at 1.5% a week, about the fastest fat comes off;
 *   - stops at your goal, where the plan switches to maintenance.
 * Until three weeks of weigh-ins exist, it uses the plan's own pace.
 */

/** About the fastest sustainable loss: 1.5% of bodyweight a week. */
export const MAX_RATE = 0.015 / 7;
/** Water and glycogen come off first: these days don't count toward the trend. */
export const SETTLE_DAYS = 10;
const WINDOW = 28;

export interface Model {
  /** The 7-day average on `from`. */
  now: number;
  from: string;
  /** Share of bodyweight lost per day (0 when flat or gaining). */
  rate: number;
  /** lb per week, signed, as measured (before the cap). */
  perWeek: number;
  basis: 'trend' | 'plan';
  gaining: boolean;
}

export function weightModel(d: Data, t: string): Model | undefined {
  const E: WeighIn[] = weights(d).filter(e => e.date >= START && e.date <= t);
  if (!E.length) return undefined;
  const from = E.at(-1)!.date, now = avg7(E, from)!;
  const settled = E.filter(e => diff(e.date, START) >= SETTLE_DAYS);
  const pool = settled.length && diff(from, settled[0].date) >= 10 ? settled : E;
  const pts = pool.filter(e => diff(from, e.date) < WINDOW).map(e => ({ x: diff(e.date, from), y: avg7(E, e.date)! }));
  const span = pts.length ? -pts[0].x : 0;
  if (pts.length >= 6 && span >= 14 && diff(from, START) >= 20) {
    const mx = avg(pts.map(p => p.x))!, my = avg(pts.map(p => p.y))!;
    let a = 0, b = 0;
    for (const p of pts) { a += (p.x - mx) * (p.y - my); b += (p.x - mx) ** 2; }
    const s = b ? a / b : 0;
    return { now, from, rate: Math.min(MAX_RATE, Math.max(0, -s / now)), perWeek: s * 7, basis: 'trend', gaining: s > 0.02 };
  }
  // Not enough yet: the plan's pace from here.
  const start = startWeight(d), a = targetOn(start, from), b = targetOn(start, addDays(from, 28));
  const rate = a > b ? Math.min(MAX_RATE, Math.log(a / b) / 28) : 0;
  return { now, from, rate, perWeek: -(now * rate * 7), basis: 'plan', gaining: false };
}

export interface Forecast {
  date: string;
  /** Best estimate, with a range: slower (×0.75) and faster (×1.2, still capped) than the trend. */
  w: number; low: number; high: number;
  /** The date the estimate reaches the goal, if it does by `date`. */
  goalOn?: string;
  /** What the plan has you at on that date. */
  plan: number;
}

const at = (m: Model, rate: number, days: number) => Math.max(GOAL_WEIGHT, m.now * Math.exp(-rate * days));

/** Days from the model's last weigh-in until the trend reaches `target`. */
export function daysTo(m: Model, target: number, rate = m.rate): number | undefined {
  if (target >= m.now) return 0;
  if (rate <= 0 || target < GOAL_WEIGHT) return undefined;
  return Math.ceil(Math.log(m.now / target) / rate);
}

export function forecastOn(d: Data, m: Model, date: string): Forecast {
  const days = Math.max(0, diff(date, m.from));
  const fast = Math.min(MAX_RATE, m.rate * 1.2), slow = m.rate * 0.75;
  const g = daysTo(m, GOAL_WEIGHT + 0.01);
  return {
    date, w: at(m, m.rate, days), low: at(m, fast, days), high: at(m, slow, days),
    goalOn: g != null && g <= days ? addDays(m.from, g) : undefined,
    plan: targetOn(startWeight(d), date),
  };
}

/** When the trend reaches `target`, with the faster and slower edges of the range. */
export function whenReach(m: Model, target: number) {
  const mid = daysTo(m, target), early = daysTo(m, target, Math.min(MAX_RATE, m.rate * 1.2)), late = daysTo(m, target, m.rate * 0.75);
  if (mid == null) return undefined;
  return { date: addDays(m.from, mid), early: early != null ? addDays(m.from, early) : undefined, late: late != null ? addDays(m.from, late) : undefined };
}
