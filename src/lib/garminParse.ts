/**
 * Turns Garmin Connect Personal API responses into the small records the app
 * keeps. Used by the GitHub Action (scripts/garmin-sync.mjs), which runs this
 * file directly with Node's type stripping, so it has no imports and uses only
 * erasable TypeScript.
 *
 * Garmin doesn't publish response shapes for the personal tier, so every
 * reader here searches the JSON for the fields it needs instead of assuming
 * one exact layout. Anything it can't find is left out, never guessed.
 */

export interface GLap { distM: number; durS: number; avgHR?: number; speed?: number }
export interface GActivity {
  id: string;
  _u: number;
  /** Local calendar date the activity started on. */
  date: string;
  /** Local start time, "YYYY-MM-DDTHH:MM:SS". */
  start: string;
  type: string;
  name?: string;
  distM?: number;
  durS?: number;
  movS?: number;
  avgHR?: number;
  maxHR?: number;
  /** Average speed, metres per second. */
  speed?: number;
  cal?: number;
  aerobicTE?: number;
  laps?: GLap[];
}
export interface GDay {
  /** The calendar date. */
  id: string;
  _u: number;
  steps?: number;
  /** Resting heart rate, bpm. */
  rhr?: number;
  /** Overnight HRV average, ms. */
  hrv?: number;
  hrvWeek?: number;
  /** Garmin's HRV status: BALANCED, UNBALANCED, LOW, POOR. */
  hrvStatus?: string;
  sleepH?: number;
  sleepScore?: number;
  weightLb?: number;
}
/** Heart rate zone floors, bpm. */
export interface GZones { z2: number; z3: number; z4: number; z5: number; max?: number }

type J = unknown;
const isObj = (v: J): v is Record<string, J> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: J): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Every object anywhere inside `v`, depth first. */
export function* objects(v: J): Generator<Record<string, J>> {
  if (Array.isArray(v)) for (const x of v) yield* objects(x);
  else if (isObj(v)) {
    yield v;
    for (const x of Object.values(v)) yield* objects(x);
  }
}
/** The first number found under `key` anywhere inside `v`. */
export function findNum(v: J, key: string): number | undefined {
  for (const o of objects(v)) {
    const n = num(o[key]);
    if (n != null) return n;
  }
  return undefined;
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}/;
/** A calendar date for an object, from the date fields Garmin uses. */
function dateOf(o: Record<string, J>): string | undefined {
  for (const k of ['calendarDate', 'summaryDate', 'date', 'measurementDate']) {
    const v = o[k];
    if (typeof v === 'string' && DATE_RE.test(v)) return v.slice(0, 10);
  }
  return undefined;
}

/* ---------- activities ---------- */

/** The activity list from /activitylist-service/activities/search/activities. */
export function parseActivities(json: J, now: number): GActivity[] {
  const out = new Map<string, GActivity>();
  for (const o of objects(json)) {
    const id = num(o.activityId);
    const start = typeof o.startTimeLocal === 'string' ? o.startTimeLocal : undefined;
    if (id == null || !start || !DATE_RE.test(start)) continue;
    const t = o.activityType;
    const type = isObj(t) && typeof t.typeKey === 'string' ? t.typeKey : typeof t === 'string' ? t : 'other';
    const a: GActivity = { id: String(id), _u: now, date: start.slice(0, 10), start: start.replace(' ', 'T').slice(0, 19), type };
    if (typeof o.activityName === 'string') a.name = o.activityName;
    const set = (k: keyof GActivity, v: number | undefined, round = r1) => { if (v != null) (a as unknown as Record<string, number>)[k] = round(v); };
    set('distM', num(o.distance), Math.round);
    set('durS', num(o.duration), Math.round);
    set('movS', num(o.movingDuration), Math.round);
    set('avgHR', num(o.averageHR), Math.round);
    set('maxHR', num(o.maxHR), Math.round);
    set('speed', num(o.averageSpeed), n => Math.round(n * 1000) / 1000);
    set('cal', num(o.calories), Math.round);
    set('aerobicTE', num(o.aerobicTrainingEffect));
    out.set(a.id, a);
  }
  return [...out.values()];
}

export const RUN_TYPES = new Set(['running', 'treadmill_running', 'track_running', 'trail_running', 'indoor_running', 'street_running', 'virtual_run', 'obstacle_run', 'ultra_run']);
export const isRun = (type: string) => RUN_TYPES.has(type) || /run/.test(type);

/** Laps from a decoded FIT file's lap messages (Garmin FIT SDK field names). */
export function lapsFromFit(lapMesgs: J): GLap[] {
  if (!Array.isArray(lapMesgs)) return [];
  const laps: GLap[] = [];
  for (const l of lapMesgs) {
    if (!isObj(l)) continue;
    const distM = num(l.totalDistance), durS = num(l.totalTimerTime);
    if (distM == null || durS == null || durS <= 0) continue;
    const lap: GLap = { distM: Math.round(distM), durS: Math.round(durS) };
    const hr = num(l.avgHeartRate), sp = num(l.enhancedAvgSpeed) ?? num(l.avgSpeed);
    if (hr != null) lap.avgHR = Math.round(hr);
    if (sp != null) lap.speed = Math.round(sp * 1000) / 1000;
    laps.push(lap);
  }
  return laps;
}

/* ---------- daily health ---------- */

/** Steps by date from /usersummary-service/stats/steps/daily/{start}/{end} or the daily summaries. */
export function parseSteps(json: J): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of objects(json)) {
    const d = dateOf(o);
    if (!d) continue;
    const values = isObj(o.values) ? o.values : undefined, movement = isObj(o.movement) ? o.movement : undefined;
    const steps = num(o.totalSteps) ?? num(values?.totalSteps) ?? num(movement?.steps) ?? num(o.steps);
    if (steps != null) out[d] = Math.round(steps);
  }
  return out;
}

/** Overnight HRV by date from /hrv-service/hrv/daily/{start}/{end}. */
export function parseHrv(json: J): Record<string, Pick<GDay, 'hrv' | 'hrvWeek' | 'hrvStatus'>> {
  const out: Record<string, Pick<GDay, 'hrv' | 'hrvWeek' | 'hrvStatus'>> = {};
  for (const o of objects(json)) {
    const d = dateOf(o), hrv = num(o.lastNightAvg);
    if (!d || hrv == null) continue;
    const r: Pick<GDay, 'hrv' | 'hrvWeek' | 'hrvStatus'> = { hrv: Math.round(hrv) };
    const week = num(o.weeklyAvg);
    if (week != null) r.hrvWeek = Math.round(week);
    if (typeof o.status === 'string') r.hrvStatus = o.status.toUpperCase();
    out[d] = r;
  }
  return out;
}

/** Hours slept and the sleep score from /sleep-service/sleep/dailySleep for one date. */
export function parseSleep(json: J): Pick<GDay, 'sleepH' | 'sleepScore'> {
  const out: Pick<GDay, 'sleepH' | 'sleepScore'> = {};
  const secs = findNum(json, 'sleepTimeSeconds');
  if (secs != null && secs > 0) out.sleepH = r1(secs / 3600);
  let score: number | undefined;
  for (const o of objects(json)) {
    if (isObj(o.sleepScores) && isObj(o.sleepScores.overall)) { score = num(o.sleepScores.overall.value); if (score != null) break; }
    score = num(o.overallSleepScore) ?? num(o.sleepScore);
    if (score != null) break;
  }
  if (score != null) out.sleepScore = Math.round(score);
  return out;
}

/** Resting heart rate from /wellness-service/wellness/dailyHeartRate for one date. */
export function parseRestingHr(json: J): number | undefined {
  const v = findNum(json, 'restingHeartRate');
  return v != null && v > 25 && v < 120 ? Math.round(v) : undefined;
}

/** Weigh-ins by date, in pounds, from /weight-service/weight/range. Garmin stores grams. */
export function parseWeights(json: J): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of objects(json)) {
    const w = num(o.weight);
    if (w == null) continue;
    let d = dateOf(o);
    if (!d) {
      const ms = num(o.date) ?? num(o.timestampGMT);
      if (ms != null) d = new Date(ms).toISOString().slice(0, 10);
    }
    if (!d) continue;
    const lb = w > 1000 ? w / 453.59237 : w > 30 && w < 300 ? w * 2.20462 : undefined;
    if (lb != null && lb > 70 && lb < 600) out[d] = r1(lb);
  }
  return out;
}

/** Heart rate zone floors from /biometric-service/heartRateZones/v2, preferring the running zones. */
export function parseZones(json: J): GZones | undefined {
  let best: GZones | undefined, bestRunning = false;
  for (const o of objects(json)) {
    const z2 = num(o.zone2Floor), z3 = num(o.zone3Floor), z4 = num(o.zone4Floor), z5 = num(o.zone5Floor);
    if (z2 == null || z3 == null || z4 == null || z5 == null) continue;
    const running = o.sport === 'RUNNING';
    if (best && bestRunning && !running) continue;
    best = { z2, z3, z4, z5, ...(num(o.maxHeartRateUsed) != null ? { max: num(o.maxHeartRateUsed) } : {}) };
    bestRunning = running;
  }
  return best;
}

/** The names of the keys at the top of a response, for the sync log: never values, so no health data reaches a public log. */
export function shape(json: J): string {
  if (json instanceof Uint8Array) return `file(${json.length} bytes)`;
  if (Array.isArray(json)) return `array(${json.length})${json.length && isObj(json[0]) ? ` of {${Object.keys(json[0]).slice(0, 8).join(',')}}` : ''}`;
  if (isObj(json)) return `{${Object.keys(json).slice(0, 10).join(',')}}`;
  return json == null ? 'empty' : typeof json;
}
