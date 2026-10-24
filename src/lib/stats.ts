import { addDays, avg, diff, num, today } from './dates';
import { START, TOTAL_DAYS, isTraining, programDay, weekStart, type Session } from './program';
import { targetsOn } from './targets';
import type { Data, SetEntry } from './store';

export interface WeighIn { date: string; w: number }

export const sortedKeys = (d: Data) => Object.keys(d.days).sort();

export function weights(d: Data): WeighIn[] {
  return sortedKeys(d)
    .filter(k => num(d.days[k].weight) != null)
    .map(k => ({ date: k, w: Number(d.days[k].weight) }));
}
export function avg7(E: WeighIn[], ds: string) {
  return avg(E.filter(e => { const x = diff(ds, e.date); return x >= 0 && x < 7; }).map(e => e.w));
}
export function weekAvg(E: WeighIn[], week: number) {
  const s = weekStart(week);
  return avg(E.filter(e => { const x = diff(e.date, s); return x >= 0 && x < 7; }).map(e => e.w));
}
export const isDone = (d: Data, ds: string) => !!d.days[ds]?.done;
export const hitSteps = (d: Data, ds: string) => (d.days[ds]?.steps ?? 0) >= targetsOn(d.settings, ds).steps;

export function lastPerf(d: Data, exId: string, before: string): { date: string; sets: SetEntry[] } | null {
  const ks = sortedKeys(d);
  for (let i = ks.length - 1; i >= 0; i--) {
    if (ks[i] >= before) continue;
    const sets = d.days[ks[i]].ex?.[exId];
    const valid = sets?.filter(s => s && num(s.r) != null);
    if (valid?.length) return { date: ks[i], sets: valid };
  }
  return null;
}

/** One program week (Mon–Sun) from the log. */
export function weekLog(d: Data, week: number) {
  const ws = weekStart(week);
  let planned = 0, done = 0, stepDays = 0;
  const cals: number[] = [], pros: number[] = [];
  for (let i = 0; i < 7; i++) {
    const ds = addDays(ws, i), l = d.days[ds] || {};
    const s = (programDay(ds) as { session?: Session }).session ?? null;
    if (isTraining(s)) { planned++; if (l.done) done++; }
    if (hitSteps(d, ds)) stepDays++;
    if (l.cal != null) cals.push(l.cal);
    if (l.pro != null) pros.push(l.pro);
  }
  return { from: ws, planned, done, stepDays, cal: avg(cals), pro: avg(pros) };
}

/** Sessions and 10,000-step days so far: everything due before today, plus anything already done today. */
export function adherence(d: Data) {
  const t = today();
  let sched = 0, done = 0, days = 0, stepDays = 0;
  const last = Math.min(diff(t, START), TOTAL_DAYS - 1);
  for (let i = 0; i <= last; i++) {
    const ds = addDays(START, i);
    const pd = programDay(ds);
    if (pd.status !== 'in') continue;
    const l = d.days[ds] || {};
    if (isTraining(pd.session) && (ds < t || l.done)) { sched++; if (l.done) done++; }
    if (ds < t || hitSteps(d, ds)) { days++; if (hitSteps(d, ds)) stepDays++; }
  }
  return { sched, done, days, stepDays };
}
