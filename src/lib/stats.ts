import { addDays, avg, diff, num, today } from './dates';
import { START, programDay, weekStart, type Session } from './program';
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
export function isDone(d: Data, ds: string, s: Session) {
  const l = d.days[ds] || {};
  return s.kind === 'rest' ? !!(l.done || l.walk) : !!l.done;
}

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

/** Plan rule: if the weekly average isn't dropping after week 1, cut ~200 kcal. */
export function calorieNudge(d: Data) {
  const pd = programDay(today());
  if (pd.status !== 'in' || pd.phase.id !== 'p1') return null;
  const w = pd.week - 1;
  if (w < 2) return null;
  const E = weights(d);
  const a = weekAvg(E, w), b = weekAvg(E, w - 1);
  if (a == null || b == null || a < b - 0.1) return null;
  if ((d.settings.cutWeek || 0) >= w) return null;
  return { week: w, a, b, next: d.settings.calTarget - 200 };
}

export function adherence(d: Data) {
  const t = today();
  let sched = 0, done = 0, wSched = 0, wDone = 0;
  const last = diff(t, START);
  for (let i = 0; i <= Math.min(last, 146); i++) {
    const ds = addDays(START, i);
    const pd = programDay(ds);
    if (pd.status !== 'in') continue;
    const s = pd.session, l = d.days[ds] || {};
    if ((s.kind === 'cardio' || s.kind === 'strength') && (ds < t || l.done)) { sched++; if (l.done) done++; }
    if ((s.walk || s.kind === 'rest') && (ds < t || l.walk || l.done)) {
      wSched++;
      if (s.kind === 'rest' ? l.done || l.walk : l.walk) wDone++;
    }
  }
  return { sched, done, wSched, wDone };
}
