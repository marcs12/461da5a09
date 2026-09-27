import { addDays, avg, diff, parse } from './dates';
import { mondayOf } from './life';
import { programDay, sessionOf, weekStart, type Segment } from './program';
import { isDone, weights } from './stats';
import { recs, type Data, type DayLog, type Rec } from './schema';
import { SEED } from '../data/seed';

/**
 * Body additions around the existing 16-week program: food checks, the week's
 * training, weekly weight averages, waist, the travel circuit and the Sun Run.
 */
const B = SEED.body;

export type Meal = 'b' | 'l' | 'd';
export const MEALS: { id: Meal; label: string }[] = [{ id: 'b', label: 'Breakfast' }, { id: 'l', label: 'Lunch' }, { id: 'd', label: 'Dinner' }];

/** Meals with protein. Older logs stored only a count (`proMeals`). */
export const mealsWithProtein = (l: DayLog) => (l.meals ? MEALS.filter(m => l.meals![m.id]).length : l.proMeals ?? 0);

/** Set every meal at once (the minimum-day tick) or one meal. Keeps `proMeals` in step. */
export function withMeals(l: DayLog, patch: Partial<Record<Meal, boolean>>): Pick<DayLog, 'meals' | 'proMeals'> {
  const base = l.meals ?? (l.proMeals === 3 ? { b: true, l: true, d: true } : {});
  const meals = { ...base, ...patch };
  const n = MEALS.filter(m => meals[m.id]).length;
  return { meals: n ? meals : undefined, proMeals: n || undefined };
}

/** This program week (Sun–Sat): training sessions done against planned, and walk days. */
export function weekTraining(d: Data, ds: string) {
  const pd = programDay(ds);
  if (pd.status !== 'in') return null;
  const ws = weekStart(pd.week);
  let planned = 0, done = 0, walks = 0;
  for (let i = 0; i < 7; i++) {
    const day = addDays(ws, i), s = sessionOf(day)!, l = d.days[day] || {};
    if (s.kind === 'cardio' || s.kind === 'strength') { planned++; if (isDone(d, day, s)) done++; }
    if ((l.walkMin ?? 0) >= 20 || l.walk || (s.kind === 'rest' && l.done)) walks++;
  }
  return { week: pd.week, phase: pd.phase, from: ws, planned, done, walks };
}

/** Average of the weigh-ins in each program week, this one against the last. */
export function weeklyWeight(d: Data, ds: string) {
  const pd = programDay(ds);
  if (pd.status !== 'in') return null;
  const E = weights(d);
  const weekAvg = (from: string) => avg(E.filter(e => e.date >= from && e.date <= addDays(from, 6)).map(e => e.w));
  const ws = weekStart(pd.week);
  const cur = weekAvg(ws), prev = pd.week > 1 ? weekAvg(addDays(ws, -7)) : null;
  const count = E.filter(e => e.date >= ws && e.date <= addDays(ws, 6)).length;
  return { avg: cur, prev, change: cur != null && prev != null ? cur - prev : null, count, targetPace: B.weighIns.targetPaceLbPerWeek, perWeek: B.weighIns.perWeek };
}

export interface WaistEntry extends Rec { date: string; value: number; unit: 'in' }
export const waists = (d: Data) => recs<WaistEntry>(d, 'waist').sort((a, b) => a.date.localeCompare(b.date));
/** From the 1st to the 3rd of the month, until this month's measurement is in. */
export function waistDue(d: Data, today: string) {
  if (parse(today).getDate() > 3) return false;
  const month = today.slice(0, 7);
  return !waists(d).some(w => w.date.startsWith(month));
}

/* ---------- travel circuit ---------- */

const ROUND_MIN = 4, REST_MIN = 1, WARM_MIN = 2;
/** 3 rounds of the circuit as timer segments: a short warm-up, rounds with a minute's rest between. */
export function circuitSegments(): Segment[] {
  const n = B.travelCircuit.rounds;
  const out: Segment[] = [{ label: 'Warm-up', sec: WARM_MIN * 60, tone: 'warm' }];
  for (let i = 1; i <= n; i++) {
    out.push({ label: `Round ${i}`, sec: ROUND_MIN * 60, tone: 'work' });
    if (i < n) out.push({ label: 'Rest', sec: REST_MIN * 60, tone: 'easy' });
  }
  return out;
}

export function circuitsThisWeek(d: Data, ds: string) {
  const m = mondayOf(ds);
  let n = 0;
  for (let i = 0; i < 7; i++) if (d.days[addDays(m, i)]?.circuit) n++;
  return n;
}

export const sunRunDays = (today: string) => diff(B.sunRun.date, today);
