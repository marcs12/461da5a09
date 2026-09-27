import { addDays, avg, diff, fmtShort, parse } from './dates';
import { circuitsThisWeek } from './body';
import { incomeStats, jobs, outreach } from './income';
import { mondayOf, planDay, planEnd, targetsKey } from './life';
import { sleepNights, weekLife, weekMood, type WeekLife } from './mind';
import { paydays, runway, tripStats, type Snapshot, type Transfer } from './money';
import { sessionOf } from './program';
import { isDone, weights } from './stats';
import { recs, type Data, type Rec, type Settings, type TaskState } from './schema';
import { SEED } from '../data/seed';

/** Private. `id` is the Monday of the reviewed week. */
export interface WeeklyReview extends Rec {
  weekOf: string;
  scores: Record<string, number | boolean | null>;
  keep: string;
  change: string;
  top3: string[];
  supportTriggered: boolean;
  supportBooked?: boolean;
}

export const reviews = (d: Data) => recs<WeeklyReview>(d, 'reviews').sort((a, b) => b.weekOf.localeCompare(a.weekOf));

/** The week to review: this one on Sunday, otherwise the one that ended last Sunday. */
export function reviewWeek(today: string) {
  const sunday = addDays(today, -parse(today).getDay());
  return addDays(sunday, -6);
}

const inWeek = (ds: string | undefined, monday: string) => !!ds && ds >= monday && ds <= addDays(monday, 6);

export interface ScoreRow { id: string; label: string; kind: 'count' | 'bool' | 'number'; target?: number | null }

/** Rows of the week's score, in the template's order, with this phase's targets. */
export function scoreRows(d: Data, monday: string): ScoreRow[] {
  const key = targetsKey(planDay(d.settings, addDays(monday, 6))) ?? 'sprint';
  const t = SEED.weeklyTargets[key];
  const workouts = t.strength + t.bodyCombat + t.runWalk + t.circuits;
  return [
    { id: 'applications', label: 'Applications', kind: 'count', target: t.applications },
    { id: 'outreach', label: 'Outreach', kind: 'count', target: t.outreach },
    { id: 'workouts', label: 'Workouts', kind: 'count', target: workouts },
    { id: 'walkDays', label: 'Walk days', kind: 'count', target: t.walkDays },
    { id: 'sleep7', label: 'Nights with 7+ hours', kind: 'count', target: t.sleepNights7h || 7 },
    { id: 'transfer', label: 'Payday transfer done', kind: 'bool' },
    { id: 'runway', label: 'Runway (months)', kind: 'number' },
    { id: 'touchGrass', label: 'TouchGrass activity', kind: 'bool' },
    { id: 'socialPlan', label: 'Social plan', kind: 'bool' },
    { id: 'mood', label: 'Mood average', kind: 'number', target: 10 },
    { id: 'noNewCardBalance', label: 'No new credit card balance', kind: 'bool' },
  ];
}

/** The week scored from the logs. `null` = nothing to score (no payday that week, no check-ins). */
export function weekScores(d: Data, monday: string): Record<string, number | boolean | null> {
  let workouts = 0, walkDays = 0;
  for (let i = 0; i < 7; i++) {
    const ds = addDays(monday, i), s = sessionOf(ds), l = d.days[ds] || {};
    if (s && (s.kind === 'cardio' || s.kind === 'strength') && isDone(d, ds, s)) workouts++;
    if ((l.walkMin ?? 0) >= 20 || l.walk || (s?.kind === 'rest' && l.done)) walkDays++;
  }
  workouts += circuitsThisWeek(d, monday);
  const pays = paydays(d.settings, monday, addDays(monday, 6));
  const transfers = recs<Transfer>(d, 'transfers');
  const w = weekLife(d, monday), mood = weekMood(d, monday).avg;
  return {
    applications: jobs(d).filter(j => inWeek(j.appliedAt, monday)).length,
    outreach: outreach(d).filter(o => inWeek(o.date, monday)).length,
    workouts,
    walkDays,
    sleep7: sleepNights(d, monday).n,
    transfer: pays.length ? transfers.some(t => t.date >= pays[0] && t.date <= addDays(monday, 6)) : null,
    runway: runway(d),
    touchGrass: !!w.touchGrass,
    socialPlan: !!w.socialPlan,
    mood: mood == null ? null : Math.round(mood * 10) / 10,
    noNewCardBalance: w.noNewCardBalance ?? null,
  };
}

const yn = (v: unknown) => (v === true ? 'yes' : v === false ? 'no' : '—');
const n = (v: unknown) => (v == null ? '__' : String(v));

/** The review in the plan's text template, for pasting anywhere. */
export function reviewText(r: WeeklyReview, title: (id: string) => string): string {
  const s = r.scores;
  const top = [0, 1, 2].map(i => `${i + 1}) ${r.top3[i] ? title(r.top3[i]) : '____'}`).join(' ');
  return [
    `Week of ${fmtShort(r.weekOf)}`,
    `Applications: ${n(s.applications)}   Outreach: ${n(s.outreach)}`,
    `Workouts: ${n(s.workouts)}   Walk days: ${n(s.walkDays)}`,
    `Nights with 7+ hours of sleep: ${n(s.sleep7)} / 7`,
    `Payday transfer done: ${yn(s.transfer)}   Runway: ${n(s.runway)} months`,
    `TouchGrass activity: ${yn(s.touchGrass)}   Social plan: ${yn(s.socialPlan)}`,
    `Mood average: ${n(s.mood)} / 10`,
    `Keep: ${r.keep || '______'}`,
    `Change: ${r.change || '______'}`,
    `Top 3 for next week: ${top}`,
  ].join('\n');
}

/* ---------- the 90-day scoreboard ---------- */

export interface ScoreItem { id: string; area: string; label: string; value: string; met: boolean | null; progress: number | null }

const taskDone = (d: Data, id: string) => !!recs<TaskState>(d, 'tasks').find(t => t.id === id)?.done;

/** Each Day-90 target from the seed, measured from the logs so far. */
export function scoreboard(d: Data, today: string): ScoreItem[] {
  const S = d.settings, end = planEnd(S), upTo = today < end ? today : end;
  const inPlan = (ds?: string) => !!ds && ds >= S.planStart && ds <= end;
  const lives = recs<WeekLife>(d, 'weekLife').filter(w => inPlan(w.id));
  const revs = reviews(d).filter(r => inPlan(r.weekOf));
  const count = (n: number, target: number) => ({ value: `${n} / ${target}`, met: n >= target, progress: Math.min(1, n / target) });
  const flag = (b: boolean | null, yes = 'Yes', no = 'Not yet') => ({ value: b == null ? '—' : b ? yes : no, met: b, progress: null });

  let workouts = 0, fiveK = false;
  for (let ds = S.planStart; ds <= upTo; ds = addDays(ds, 1)) {
    const s = sessionOf(ds), l = d.days[ds] || {};
    if (s && (s.kind === 'cardio' || s.kind === 'strength') && isDone(d, ds, s)) workouts++;
    if (l.circuit) workouts++;
    if ((l.km ?? 0) >= 5 || (s?.km && s.km >= 5 && l.done)) fiveK = true;
  }
  const payCount = paydays(S, S.planStart, upTo);
  const transfers = recs<Transfer>(d, 'transfers');
  const covered = payCount.filter(p => transfers.some(t => t.date >= p && diff(t.date, p) < 14)).length;
  const trip = tripStats(d, today);
  const triggered = revs.filter(r => r.supportTriggered);

  // Weight: average change per week between the first and latest weekly averages.
  const E = weights(d).filter(e => inPlan(e.date));
  const weekAvgs: number[] = [];
  for (let m = mondayOf(S.planStart); m <= upTo; m = addDays(m, 7)) {
    const a = avg(E.filter(e => inWeek(e.date, m)).map(e => e.w));
    if (a != null) weekAvgs.push(a);
  }
  const pace = weekAvgs.length > 1 ? (weekAvgs.at(-1)! - weekAvgs[0]) / (weekAvgs.length - 1) : null;

  const m: Record<string, Omit<ScoreItem, 'id' | 'area' | 'label'>> = {
    apps: count(incomeStats(d).applied, 60),
    conversations: count(outreach(d).filter(o => o.replied && inPlan(o.date)).length, 10),
    credential: flag(taskDone(d, 'applied-skills') || taskDone(d, 'pl-900'), 'Earned'),
    'case-studies': count(Number(taskDone(d, 'case-study-1')) + Number(taskDone(d, 'case-study-2')), 2),
    snapshot: flag(recs<Snapshot>(d, 'snapshots').length > 0, 'Done'),
    transfers: { value: `${covered} / ${payCount.length} paydays`, met: payCount.length ? covered === payCount.length : null, progress: payCount.length ? covered / payCount.length : null },
    'trip-budget': flag(trip.budget ? trip.onBudget : null, 'On budget', 'Over'),
    'no-new-card-balance': (() => {
      const asked = lives.filter(w => w.noNewCardBalance != null);
      return asked.length ? { value: `${asked.filter(w => w.noNewCardBalance).length} / ${asked.length} weeks`, met: asked.every(w => w.noNewCardBalance), progress: null } : flag(null);
    })(),
    workouts: count(workouts, 36),
    '5k': flag(fiveK, 'Done'),
    'weight-trend': { value: pace == null ? '—' : `${pace > 0 ? '+' : ''}${pace.toFixed(1)} lb a week`, met: pace == null ? null : pace <= -0.8, progress: null },
    'sleep-weeks': count(Array.from({ length: Math.ceil((diff(upTo, S.planStart) + 1) / 7) }, (_, i) => addDays(mondayOf(S.planStart), i * 7)).filter(w => sleepNights(d, w).n >= 5).length, 12),
    reviews: count(revs.length, 12),
    support: triggered.length ? flag(triggered.every(r => r.supportBooked), 'Every time', 'Not every time') : { value: 'Not needed so far', met: null, progress: null },
    touchgrass: count(lives.filter(w => w.touchGrass).length, 12),
    social: count(lives.filter(w => w.socialPlan).length, 12),
    'travel-edit': flag(taskDone(d, 'travel-edit'), 'Edited'),
  };
  return SEED.scoreboard.map(s => ({ id: s.id, area: s.area, label: s.label, ...(m[s.id] ?? flag(null)) }));
}

/* ---------- the next 90 days ---------- */

/** Same structure, new dates: starts the Monday on or after the day after this plan (or today, if later). No trip. */
export function nextPlan(s: Settings, today: string): Pick<Settings, 'planStart' | 'departDate' | 'returnDate'> {
  const after = addDays(planEnd(s), 1);
  const from = after > today ? after : today;
  const start = addDays(from, (8 - parse(from).getDay()) % 7);
  return { planStart: start, departDate: null, returnDate: null };
}

