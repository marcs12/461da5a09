import { addDays, avg, diff } from './dates';
import { isRun, type GActivity, type GDay, type GLap, type GZones } from './garminParse';
import { sessionFor, type Session } from './program';
import { recs, type Data } from './schema';

/**
 * What the app does with the Garmin records the GitHub Action writes into the
 * sync gist (cols.garminActs, cols.garminDays, cols.garminSync). Anything
 * logged by hand always wins over what came from the watch.
 */
export type { GActivity, GDay, GLap, GZones };
export interface GStatus {
  id: 'status'; _u: number; at: number; ok: boolean;
  activities: number; runsWithLaps: number; days: number; changed: number;
  errors: string[]; shapes: Record<string, string>; zones?: GZones;
}

export const garminActs = (d: Data) => recs<GActivity & { _del?: true }>(d, 'garminActs');
export const garminDay = (d: Data, ds: string): GDay | undefined => {
  const r = d.cols.garminDays?.[ds] as GDay | undefined;
  return r && !(r as { _del?: true })._del ? r : undefined;
};
export const garminStatus = (d: Data) => d.cols.garminSync?.status as GStatus | undefined;
export const hasGarmin = (d: Data) => !!garminStatus(d);
export const actsOn = (d: Data, ds: string) => garminActs(d).filter(a => a.date === ds).sort((a, b) => a.start.localeCompare(b.start));

const isStrength = (t: string) => /strength|hiit|cardio|fitness_equipment|bootcamp/.test(t);
const mins = (a: GActivity) => (a.durS ?? 0) / 60;

/** The watch activity that is this day's session, if there is one. */
export function matchActivity(d: Data, ds: string, s: Session | null = sessionFor(ds)): GActivity | undefined {
  if (!s || s.kind === 'rest') return undefined;
  const acts = actsOn(d, ds);
  const longest = (xs: GActivity[]) => xs.sort((a, b) => (b.durS ?? 0) - (a.durS ?? 0))[0];
  if (s.kind === 'strength') return longest(acts.filter(a => isStrength(a.type)));
  if (s.tag === 'Low impact' || s.tag === 'Walk') return longest(acts.filter(a => mins(a) >= 15));
  return longest(acts.filter(a => isRun(a.type)));
}

/** Whether the matched activity covers enough of the session to count it done. */
export function autoDone(d: Data, ds: string, s: Session | null = sessionFor(ds)): boolean {
  const a = matchActivity(d, ds, s);
  if (!a || !s) return false;
  if (s.kind === 'cardio' && s.tag !== 'Low impact' && s.tag !== 'Walk') {
    const byKm = s.km != null && (a.distM ?? 0) >= s.km * 1000 * 0.6;
    const byMin = s.minutes != null && mins(a) >= s.minutes * 0.6;
    return byKm || byMin || (s.km == null && s.minutes == null);
  }
  return mins(a) >= 15;
}

/* ---------- effective day values: hand-logged first, then the watch ---------- */

export const stepsOn = (d: Data, ds: string) => d.days[ds]?.steps ?? garminDay(d, ds)?.steps;
export const sleepOn = (d: Data, ds: string) => d.days[ds]?.sleep ?? garminDay(d, ds)?.sleepH;
export const weightOn = (d: Data, ds: string) => d.days[ds]?.weight ?? garminDay(d, ds)?.weightLb;

/* ---------- runs ---------- */

/** Seconds per km. */
export const paceOf = (distM?: number, durS?: number) => (distM && durS ? durS / (distM / 1000) : undefined);
export const lapPace = (l: GLap) => paceOf(l.distM, l.durS)!;

/**
 * The fastest stretch of consecutive laps that covers `km`, scaled to exactly
 * `km`. Finds a time trial inside an activity that also has the warm-up in it.
 */
export function bestEffort(laps: GLap[] | undefined, km: number): { sec: number; laps: number } | undefined {
  if (!laps?.length) return undefined;
  const target = km * 1000;
  let best: { sec: number; laps: number } | undefined;
  for (let i = 0; i < laps.length; i++) {
    let dist = 0, sec = 0;
    for (let j = i; j < laps.length; j++) {
      dist += laps[j].distM; sec += laps[j].durS;
      if (dist >= target * 0.98) {
        const scaled = (sec * target) / dist;
        if (!best || scaled < best.sec) best = { sec: Math.round(scaled), laps: j - i + 1 };
        break;
      }
    }
  }
  return best;
}

/** A time trial or race result: the whole activity if it's the right length, else the best stretch of laps. */
export function trialTime(a: GActivity | undefined, km: number): { sec: number; how: 'activity' | 'laps' } | undefined {
  if (!a) return undefined;
  const m = a.distM ?? 0;
  if (m >= km * 1000 * 0.97 && m <= km * 1000 * 1.06 && a.durS) return { sec: Math.round((a.durS * km * 1000) / m), how: 'activity' };
  const b = bestEffort(a.laps, km);
  return b && { sec: b.sec, how: 'laps' };
}

/**
 * The work repeats of an interval session: the fastest laps about one repeat
 * long, as many as the session has, kept in the order they were run.
 */
export function repeats(a: GActivity | undefined, s: Session) {
  if (!a?.laps || !s.repKm || !s.pace) return undefined;
  const len = s.repKm * 1000;
  const fit = a.laps.filter(l => l.distM >= len * 0.85 && l.distM <= len * 1.15 && lapPace(l) < s.pace! + 25);
  const keep = new Set([...fit].sort((x, y) => lapPace(x) - lapPace(y)).slice(0, s.repN ?? fit.length));
  const work = fit.filter(l => keep.has(l));
  return { work, onPace: work.filter(l => lapPace(l) <= s.pace! + 3).length };
}

/** An easy run done in zone 3 or above. */
export function tooHard(d: Data, a: GActivity | undefined, s: Session | null) {
  const z = garminStatus(d)?.zones;
  if (!z || !a?.avgHR || !s?.easy) return false;
  return a.avgHR >= z.z3;
}

/** Metres covered per heartbeat on an easy run: goes up as aerobic fitness improves. */
export const efficiency = (a: GActivity) => (a.speed && a.avgHR ? (a.speed * 60) / a.avgHR : undefined);

/** Running distance in a Monday-to-Sunday week, km. */
export function runKm(d: Data, from: string) {
  const to = addDays(from, 6);
  return garminActs(d).filter(a => a.date >= from && a.date <= to && isRun(a.type)).reduce((t, a) => t + (a.distM ?? 0), 0) / 1000;
}

/* ---------- recovery ---------- */

export interface Flag { key: 'hrv' | 'rhr' | 'sleep' | 'efficiency'; text: string }
export interface Recovery {
  level: 'ok' | 'watch' | 'ease';
  flags: Flag[];
  hrv7?: number; hrvBase?: number; rhr7?: number; rhrBase?: number; sleep7?: number; status?: string;
}

/**
 * The plan's "ease off" signals, read from the watch: HRV below its baseline,
 * resting heart rate up, short sleep, or easy runs costing more heartbeats.
 * Two or more at once means drop back a calorie tier for two weeks.
 */
export function recovery(d: Data, today: string): Recovery | undefined {
  const day = (i: number) => garminDay(d, addDays(today, -i));
  const span = (a: number, b: number, f: (g: GDay | undefined, i: number) => number | undefined) => {
    const xs: number[] = [];
    for (let i = a; i <= b; i++) { const v = f(day(i), i); if (v != null) xs.push(v); }
    return xs;
  };
  const hrv7 = span(0, 6, g => g?.hrv), hrvBase = span(7, 34, g => g?.hrv);
  const rhr7 = span(0, 6, g => g?.rhr), rhrBase = span(7, 34, g => g?.rhr);
  const sleep7 = span(1, 7, (_, i) => sleepOn(d, addDays(today, -i)));
  if (!hrv7.length && !rhr7.length && !sleep7.length) return undefined;

  const flags: Flag[] = [];
  const r: Recovery = { level: 'ok', flags };
  if (hrv7.length >= 3) r.hrv7 = Math.round(avg(hrv7)!);
  if (hrvBase.length >= 7) r.hrvBase = Math.round(avg(hrvBase)!);
  if (r.hrv7 != null && r.hrvBase != null && r.hrv7 < r.hrvBase * 0.93) {
    flags.push({ key: 'hrv', text: `HRV ${r.hrv7} ms this week, against your ${r.hrvBase} ms baseline` });
  }
  const statuses = span(0, 6, g => (g?.hrvStatus === 'LOW' || g?.hrvStatus === 'UNBALANCED' || g?.hrvStatus === 'POOR' ? 1 : g?.hrvStatus ? 0 : undefined));
  r.status = day(0)?.hrvStatus ?? day(1)?.hrvStatus;
  if (!flags.some(f => f.key === 'hrv') && statuses.filter(x => x === 1).length >= 4) {
    flags.push({ key: 'hrv', text: 'Garmin has rated your HRV low or unbalanced most nights this week' });
  }
  if (rhr7.length >= 3) r.rhr7 = Math.round(avg(rhr7)!);
  if (rhrBase.length >= 7) r.rhrBase = Math.round(avg(rhrBase)!);
  if (r.rhr7 != null && r.rhrBase != null && r.rhr7 >= r.rhrBase + 4) {
    flags.push({ key: 'rhr', text: `Resting heart rate ${r.rhr7} bpm, up from ${r.rhrBase}` });
  }
  if (sleep7.length >= 4) {
    r.sleep7 = Math.round(avg(sleep7)! * 10) / 10;
    if (r.sleep7 < 6.5) flags.push({ key: 'sleep', text: `Averaging ${r.sleep7} h of sleep this week` });
  }
  const easyRuns = (a: number, b: number) => garminActs(d)
    .filter(x => { const k = diff(today, x.date); return k >= a && k <= b && isRun(x.type) && !!sessionFor(x.date)?.easy; })
    .map(efficiency).filter((x): x is number => x != null);
  const recent = easyRuns(0, 13), before = easyRuns(14, 41);
  if (recent.length >= 2 && before.length >= 2 && avg(recent)! < avg(before)! * 0.95) {
    flags.push({ key: 'efficiency', text: 'Easy runs are costing more heartbeats per kilometre than two weeks ago' });
  }
  r.level = flags.length >= 2 ? 'ease' : flags.length ? 'watch' : 'ok';
  return r;
}
