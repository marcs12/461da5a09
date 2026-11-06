import { addDays, avg, diff, num, today as todayStr } from './dates';
import { bestEffort, efficiency, garminActs, garminDay, garminStatus, hasGarmin, trialTime, type GActivity } from './garmin';
import { isRun } from './garminParse';
import { END, EX, RACE_GOAL, START, STRENGTH, TOTAL_DAYS, WEEKS, programDay, sessionFor, sessionOf, toSec, weekStart } from './program';
import { CHECKPOINTS, GOAL_WEIGHT, daysToRace, startWeight, targetOn } from './targets';
import { adherence, avg7, hitSteps, isDone, sortedKeys, weights } from './stats';
import type { Data } from './schema';
import { forecastOn, weightModel } from './forecast';

/**
 * Everything the Progress tab shows, worked out from the log and the watch.
 * Percentages are 0–1 and measure the distance covered from where the plan
 * started to where it ends, so 100% is the goal reached.
 */
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
export interface Point { date: string; y: number }

/** Least-squares slope of y against days, per day. */
export function slope(pts: Point[]): number | undefined {
  if (pts.length < 2) return undefined;
  const xs = pts.map(p => diff(p.date, pts[0].date)), ys = pts.map(p => p.y);
  const mx = avg(xs)!, my = avg(ys)!;
  let a = 0, b = 0;
  xs.forEach((x, i) => { a += (x - mx) * (ys[i] - my); b += (x - mx) ** 2; });
  return b ? a / b : undefined;
}

/* ---------- body ---------- */

export function body(d: Data, t: string) {
  const E = weights(d), start = startWeight(d), goal = GOAL_WEIGHT;
  const last = E.at(-1);
  const now = last ? avg7(E, last.date)! : null;
  const lost = now != null ? start - now : 0;
  const pct = clamp01(lost / (start - goal));
  const inPlan = programDay(t).status !== 'pre';
  // Race-day forecast from the curved, capped model in forecast.ts (a straight line through early water weight said 114 lb).
  const M = inPlan ? weightModel(d, t) : undefined;
  const F = M && daysToRace(t) > 0 ? forecastOn(d, M, END) : undefined;
  return {
    start, goal, now, lost, pct, toGo: now != null ? Math.max(0, now - goal) : start - goal,
    /** Measured lb per week over the last four weeks, once there's a trend to measure. */
    perWeek: M?.basis === 'trend' ? M.perWeek : undefined,
    projected: M?.basis === 'trend' ? F?.w : undefined,
    projectedRange: M?.basis === 'trend' && F ? [F.low, F.high] as const : undefined,
    goalOn: M?.basis === 'trend' ? F?.goalOn : undefined,
    plan: inPlan ? targetOn(start, t) : undefined,
    checkpoints: CHECKPOINTS.map(c => ({ ...c, reached: now != null && now <= c.target })),
    series: E.filter(e => e.date >= addDays(START, -28)).map(e => ({ date: e.date, y: avg7(E, e.date)! })),
    bodyFat: [...E].reverse().map(e => garminDay(d, e.date)?.bodyFat).find((x): x is number => x != null),
    waist: (() => {
      const ks = Object.keys(d.days).filter(k => k <= t && d.days[k].waist != null).sort();
      return ks.length ? { first: d.days[ks[0]].waist!, now: d.days[ks.at(-1)!].waist!, since: ks[0] } : undefined;
    })(),
  };
}

/* ---------- speed ---------- */

/** Where the plan started (the April 2026 Sun Run) and where it ends. */
export const BASE_10K = 71 * 60;
export const SUB60 = 60 * 60;
export const GOAL_10K = toSec(RACE_GOAL);
/** Riegel's formula: time over one distance predicts another. */
export const riegel = (sec: number, km: number, toKm = 10) => sec * (toKm / km) ** 1.06;

export interface Effort { date: string; km: number; sec: number; est10k: number; from: 'laps' | 'activity' | 'typed' }
/** Hard efforts from the watch and typed time trial results, each with the 10K it predicts. */
export function efforts(d: Data): Effort[] {
  const out: Effort[] = [];
  for (const a of garminActs(d)) {
    if (!isRun(a.type)) continue;
    for (const km of [3, 5, 10]) {
      const b = bestEffort(a.laps, km);
      if (b) out.push({ date: a.date, km, sec: b.sec, est10k: riegel(b.sec, km), from: 'laps' });
    }
    const s = sessionFor(a.date);
    if (s?.goalSec && s.km && !a.laps) {
      const t = trialTime(a, s.km);
      if (t) out.push({ date: a.date, km: s.km, sec: t.sec, est10k: riegel(t.sec, s.km), from: 'activity' });
    }
  }
  for (let i = 0; i < TOTAL_DAYS; i++) {
    const ds = addDays(START, i), s = sessionOf(ds), log = d.days[ds];
    if (s?.goalSec && s.km && log?.min != null && (log.km == null || Math.abs(log.km - s.km) < 0.3)) {
      out.push({ date: ds, km: s.km, sec: log.min * 60, est10k: riegel(log.min * 60, s.km), from: 'typed' });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function speed(d: Data, t: string) {
  const all = efforts(d).filter(e => e.date <= t);
  const recent = all.filter(e => diff(t, e.date) <= 42);
  const best = recent.length ? Math.min(...recent.map(e => e.est10k)) : undefined;
  // One point a week: the best prediction from that week's runs.
  const byWeek = new Map<string, number>();
  for (const e of all) {
    const w = weekStart(Math.max(1, Math.floor(diff(e.date, START) / 7) + 1));
    byWeek.set(w, Math.min(byWeek.get(w) ?? Infinity, e.est10k));
  }
  const fastest = (km: number) => {
    const xs = all.filter(e => e.km === km);
    return xs.length ? xs.reduce((m, e) => (e.sec < m.sec ? e : m)) : undefined;
  };
  return {
    est: best, pct: best != null ? clamp01((BASE_10K - best) / (BASE_10K - GOAL_10K)) : 0,
    series: [...byWeek].sort(([a], [b]) => a.localeCompare(b)).map(([date, y]) => ({ date, y })),
    best5k: fastest(5), best10k: fastest(10),
  };
}

/* ---------- engine ---------- */

export function engine(d: Data, t: string) {
  const days = (k: 'rhr' | 'hrv') => {
    const out: Point[] = [];
    for (let ds = addDays(START, -28); ds <= t; ds = addDays(ds, 1)) {
      const v = garminDay(d, ds)?.[k];
      if (v != null) out.push({ date: ds, y: v });
    }
    return out;
  };
  const weekly = (pts: Point[]) => {
    const m = new Map<string, number[]>();
    for (const p of pts) {
      const w = addDays(p.date, -((new Date(`${p.date}T12:00:00`).getDay() + 6) % 7));
      m.set(w, [...(m.get(w) ?? []), p.y]);
    }
    return [...m].sort(([a], [b]) => a.localeCompare(b)).map(([date, ys]) => ({ date, y: Math.round(avg(ys)! * 10) / 10 }));
  };
  const rhr = days('rhr'), hrv = days('hrv');
  const firstLast = (pts: Point[]) => (pts.length >= 6
    ? { first: avg(pts.slice(0, 7).map(p => p.y))!, last: avg(pts.slice(-7).map(p => p.y))! }
    : undefined);
  const easy = garminActs(d)
    .filter(a => a.date <= t && isRun(a.type) && !!sessionFor(a.date)?.easy && efficiency(a) != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const eff = easy.length >= 4
    ? { first: avg(easy.slice(0, 3).map(efficiency) as number[])!, last: avg(easy.slice(-3).map(efficiency) as number[])! }
    : undefined;
  return {
    rhr: firstLast(rhr), hrv: firstLast(hrv), rhrWeekly: weekly(rhr), hrvWeekly: weekly(hrv),
    efficiency: eff && { ...eff, change: eff.last / eff.first - 1 },
    easyPace: easy.length ? easy.slice(-1)[0] : undefined,
  };
}

/* ---------- habits ---------- */

/** Days in a row ending today (or yesterday, if today isn't done yet) that pass `ok`. */
export function streak(ok: (ds: string) => boolean, t: string, from = START) {
  let ds = ok(t) ? t : addDays(t, -1), n = 0;
  while (ds >= from && ok(ds)) { n++; ds = addDays(ds, -1); }
  return n;
}
export function longestStreak(ok: (ds: string) => boolean, t: string, from = START) {
  let best = 0, cur = 0, bestEnd: string | undefined;
  for (let ds = from; ds <= t; ds = addDays(ds, 1)) {
    cur = ok(ds) ? cur + 1 : 0;
    if (cur > best) { best = cur; bestEnd = ds; }
  }
  return { n: best, end: bestEnd };
}

/** Sessions in the whole plan (rest days aside). */
export const PLAN_SESSIONS = Array.from({ length: TOTAL_DAYS }, (_, i) => sessionOf(addDays(START, i))).filter(s => s && s.kind !== 'rest').length;

export function habits(d: Data, t: string) {
  const a = adherence(d);
  const runKm = new Map<string, number>();
  for (const x of garminActs(d)) {
    if (!isRun(x.type) || x.date < START || x.date > t) continue;
    const w = weekStart(Math.floor(diff(x.date, START) / 7) + 1);
    runKm.set(w, (runKm.get(w) ?? 0) + (x.distM ?? 0) / 1000);
  }
  const weeks: Point[] = [];
  const cur = programDay(t);
  const upto = cur.status === 'in' ? cur.week : cur.status === 'post' ? WEEKS : 0;
  for (let w = 1; w <= upto; w++) weeks.push({ date: weekStart(w), y: Math.round((runKm.get(weekStart(w)) ?? 0) * 10) / 10 });
  return {
    sessions: a.sched ? a.done / a.sched : 0, done: a.done, sched: a.sched,
    /** How much of the whole plan is behind you: what the overall gauge counts, so one early session can't read as 100%. */
    plan: a.done / PLAN_SESSIONS, total: PLAN_SESSIONS,
    steps: a.days ? a.stepDays / a.days : 0, stepDays: a.stepDays, days: a.days,
    stepStreak: streak(ds => hitSteps(d, ds), t),
    totalKm: [...runKm.values()].reduce((s, x) => s + x, 0),
    weeks: hasGarmin(d) ? weeks : [],
  };
}

/* ---------- strength ---------- */

export function strength(d: Data) {
  const ids = [...STRENGTH.A.ids, ...STRENGTH.B.ids].filter(id => !EX[id].bw);
  const lifts = ids.map(id => {
    const tops: number[] = [];
    for (const k of sortedKeys(d)) {
      const ws = (d.days[k].ex?.[id] ?? []).map(s => num(s.w)).filter((w): w is number => w != null);
      if (ws.length) tops.push(Math.max(...ws));
    }
    return tops.length ? { id, name: EX[id].name, first: tops[0], now: tops.at(-1)!, max: EX[id].max } : null;
  }).filter((x): x is NonNullable<typeof x> => !!x);
  const gains = lifts.filter(l => l.first > 0).map(l => l.now / l.first - 1);
  return { lifts, gain: gains.length ? avg(gains)! : undefined, improved: lifts.filter(l => l.now > l.first).length };
}

/* ---------- overall ---------- */

export function overall(d: Data, t: string) {
  const b = body(d, t), s = speed(d, t), h = habits(d, t);
  const parts = [{ key: 'body', pct: b.pct }, { key: 'speed', pct: s.pct, missing: s.est == null }, { key: 'training', pct: h.plan, missing: !h.sched }];
  const live = parts.filter(p => !p.missing);
  return { pct: live.length ? avg(live.map(p => p.pct))! : 0, parts };
}

/* ---------- milestones ---------- */

export interface Milestone { id: string; group: 'Body' | 'Speed' | 'Distance' | 'Habits'; title: string; detail: string; at?: string; progress: number }

export function milestones(d: Data, t: string = todayStr()): Milestone[] {
  const out: Milestone[] = [];
  const E = weights(d), start = startWeight(d);
  const avgs = E.map(e => ({ date: e.date, y: avg7(E, e.date)! }));
  const latest = avgs.at(-1)?.y ?? start;
  const firstAtOrBelow = (lb: number) => avgs.find(p => p.date >= START && p.y <= lb)?.date;
  for (const n of [10, 20, 30, 40, 50, 60]) {
    out.push({ id: `lost-${n}`, group: 'Body', title: `${n} lb down`, detail: `From ${Math.round(start)} lb`, at: firstAtOrBelow(start - n), progress: clamp01((start - latest) / n) });
  }
  for (const lb of [220, 200, 180, GOAL_WEIGHT]) {
    out.push({
      id: `under-${lb}`, group: 'Body', title: lb === GOAL_WEIGHT ? `${lb} lb: the goal` : `Under ${lb} lb`,
      detail: lb === 200 ? 'Out of the 200s' : '7-day average', at: firstAtOrBelow(lb === GOAL_WEIGHT ? lb : lb - 0.1),
      progress: clamp01((start - latest) / (start - lb)),
    });
  }
  const ef = efforts(d).filter(e => e.date <= t);
  const firstUnder = (km: number, sec: number) => ef.find(e => e.km === km && e.sec <= sec)?.date;
  const bestOf = (km: number) => Math.min(...ef.filter(e => e.km === km).map(e => e.sec), Infinity);
  const speedGoal = (id: string, km: number, sec: number, title: string, detail: string) => {
    const b = bestOf(km);
    out.push({ id, group: 'Speed', title, detail, at: firstUnder(km, sec), progress: b === Infinity ? 0 : clamp01(sec / b) });
  };
  speedGoal('5k-31', 5, 31 * 60, '5K under 31:00', 'The Dec 20 time trial target');
  speedGoal('5k-2845', 5, 28 * 60 + 45, '5K under 28:45', 'Says sub-60 is on');
  speedGoal('10k-60', 10, SUB60, '10K under 60:00', 'The Jan 31 goal');
  speedGoal('10k-55', 10, GOAL_10K, `10K under ${RACE_GOAL}`, 'The Sun Run goal');

  const runs = garminActs(d).filter(a => isRun(a.type) && a.date >= START && a.date <= t).sort((a, b) => a.date.localeCompare(b.date));
  const longest = runs.reduce((m, a) => Math.max(m, a.distM ?? 0), 0);
  const tenK = runs.find(a => (a.distM ?? 0) >= 9950);
  out.push({ id: 'run-10k', group: 'Distance', title: 'First 10 km run', detail: 'Any run, any pace', at: tenK?.date, progress: clamp01(longest / 10000) });
  let total = 0;
  const cum = runs.map((a: GActivity) => ({ date: a.date, km: (total += (a.distM ?? 0) / 1000) }));
  for (const km of [100, 250, 500]) {
    out.push({ id: `total-${km}`, group: 'Distance', title: `${km} km run`, detail: 'Since Oct 26', at: cum.find(c => c.km >= km)?.date, progress: clamp01(total / km) });
  }

  const nonstop = addDays(START, 20); // Sunday of week 3: 30 minutes non-stop
  out.push({ id: 'nonstop', group: 'Habits', title: '30 minutes non-stop', detail: 'The end of the rebuild', at: nonstop <= t && isDone(d, nonstop) ? nonstop : undefined, progress: nonstop <= t && isDone(d, nonstop) ? 1 : 0 });
  for (const n of [7, 30]) {
    const s = longestStreak(ds => hitSteps(d, ds), t);
    out.push({ id: `steps-${n}`, group: 'Habits', title: `${n}-day step streak`, detail: 'Step goal every day', at: s.n >= n ? addDays(s.end!, -(s.n - n)) : undefined, progress: clamp01(s.n / n) });
  }
  let perfect: string | undefined, best = 0;
  for (let w = 1; w <= WEEKS; w++) {
    const ws = weekStart(w), we = addDays(ws, 6);
    if (we > t) break;
    let planned = 0, done = 0;
    for (let i = 0; i < 7; i++) { const ds = addDays(ws, i), p = programDay(ds); if (p.status === 'in' && p.session.kind !== 'rest') { planned++; if (isDone(d, ds)) done++; } }
    best = Math.max(best, planned ? done / planned : 0);
    if (planned && done === planned && !perfect) perfect = we;
  }
  out.push({ id: 'perfect-week', group: 'Habits', title: 'A perfect week', detail: 'Every session done', at: perfect, progress: perfect ? 1 : best });
  return out;
}

export const raceDayLeft = (t: string) => Math.max(0, diff(END, t));
export { garminStatus };
