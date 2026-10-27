/**
 * The saved data's shape, its migrations and the sync merge. No side effects,
 * so it's safe to unit test; `store.ts` owns localStorage and React.
 */

export const SCHEMA_VERSION = 5;

export interface SetEntry { w?: number; r?: number }
/** One thing eaten: what made up the day's calories and protein. */
export interface FoodEntry { name: string; cal: number; pro: number; at: number }

export interface DayLog {
  weight?: number;
  /** When the weight was logged, ms. */
  wAt?: number;
  /** Waist at the belly button, inches. */
  waist?: number;
  /** What was eaten, adding up to cal and pro. */
  food?: FoodEntry[];
  done?: boolean;
  walk?: boolean;
  min?: number;
  km?: number;
  rpe?: number;
  cal?: number;
  pro?: number;
  sleep?: number;
  /** Steps for the day. */
  steps?: number;
  note?: string;
  ex?: Record<string, SetEntry[]>;
  /** From here down: logged by the earlier life-guide version of the app. Kept so nothing saved is lost. */
  career?: boolean;
  walkMin?: number;
  proMeals?: number;
  /** Protein at breakfast, lunch, dinner. */
  meals?: { b?: boolean; l?: boolean; d?: boolean };
  veg?: boolean;
  noLiquidCal?: boolean;
  /** Travel circuit done. */
  circuit?: boolean;
  /** 10 minutes of morning daylight. */
  daylight?: boolean;
  lightsOut?: boolean;
  /** The check-in itself is private; this synced flag only says it happened. */
  checkedIn?: boolean;
  /** Training moved for this day only. Unset = Settings.trainAt. */
  trainSlot?: 'morning' | 'evening';
  /** Meals eaten out (shared by Body and Money). */
  foodOut?: number;
  /** Last edit time (ms). Sync merges days last-writer-wins on this. */
  _u?: number;
}

export type Cadence = 'weekly' | 'biweekly' | 'semimonthly';
export interface Settings {
  /** Targets from before the plan; they apply until day 1. */
  calTarget: number;
  proTarget: number;
  /** Starting weight for the target line. Unset = the weigh-in closest to day 1. */
  startWeight?: number;
  /** Daily calories and protein instead of the plan's tier. Unset = follow the plan. */
  calOverride?: number;
  proOverride?: number;
  /** From here down: settings of the earlier life-guide version. Kept so sync and old backups still merge cleanly. */
  cutWeek?: number;
  /** Set once the life-guide onboarding has been confirmed. */
  onboarded?: boolean;
  planStart: string;
  planDays: number;
  /** null = no trip in this plan: the whole plan runs as Build. */
  departDate: string | null;
  returnDate: string | null;
  /** 1 = Mon … 7 = Sun */
  workdays: number[];
  wakeTime: string;
  lightsOut: string;
  /** Where training usually goes on workdays; any day can be moved. */
  trainAt: 'morning' | 'evening';
  /** Morning session start (HH:MM). */
  trainTime: string;
  /** Workday: leave home, start, finish, get home (HH:MM). */
  shift: { leave: string; start: string; end: string; home: string } | null;
  units: { weight: 'lb'; distance: 'km'; height: 'ft-in' };
  paySchedule: { cadence: Cadence; nextPayday: string } | null;
  touchGrassUrl?: string;
  /** null = automatic (from the trip dates). */
  travelModeOverride: boolean | null;
  gamification: boolean;
  seedVersion?: number;
  _u?: number;
}

/** A stored record. Deletes keep a tombstone so they sync like edits. */
export interface Rec { id: string; _u: number; _del?: true }
export type Table = Record<string, Rec>;
export type Tables = Record<string, Table>;

export interface Data {
  schemaVersion: number;
  days: Record<string, DayLog>;
  settings: Settings;
  /** Collections that sync between devices. */
  cols: Tables;
  /** Collections that never leave this device (mood, money). Included in exports. */
  priv: Tables;
}

/** Collections the earlier life-guide version kept off the sync gist (mood and money). They still never leave the device. */
export const PRIVATE_COLS = new Set([
  'checkIns', 'reviews', 'weekLife', 'critic',
  'snapshots', 'fund', 'transfers', 'subscriptions', 'waitList', 'tripBudget', 'tripSpend', 'moneyPrefs',
]);

export const DEFAULT_SETTINGS: Settings = {
  calTarget: 2300,
  proTarget: 180,
  planStart: '2026-09-28',
  planDays: 90,
  departDate: '2026-10-16',
  returnDate: '2026-10-24',
  workdays: [1, 2, 3, 4, 5],
  wakeTime: '05:00',
  trainAt: 'morning',
  trainTime: '05:15',
  lightsOut: '22:30',
  shift: { leave: '06:30', start: '08:00', end: '16:20', home: '17:45' },
  units: { weight: 'lb', distance: 'km', height: 'ft-in' },
  paySchedule: { cadence: 'biweekly', nextPayday: '2026-10-09' },
  travelModeOverride: null,
  gamification: false,
};

export const emptyData = (): Data => ({ schemaVersion: SCHEMA_VERSION, days: {}, settings: { ...DEFAULT_SETTINGS }, cols: {}, priv: {} });

const isObj = (o: unknown): o is Record<string, unknown> => !!o && typeof o === 'object' && !Array.isArray(o);

export function isData(o: unknown): o is Data {
  return isObj(o) && isObj(o.days);
}

/**
 * Bring any saved shape up to the current schema. Only ever adds: existing
 * days and settings pass through untouched. Returns null for anything that
 * isn't app data.
 *   v1 (no version): { days, settings: { calTarget, proTarget, cutWeek? } }
 *   v2: adds life-guide settings, `cols` and `priv`.
 *   v3: adds morning training. An unconfirmed 06:00 wake moves to 05:00 to fit it.
 *   v4: an unconfirmed 22:00 lights-out moves to 22:30.
 *   v5: WinterArc. Adds steps, a start weight and target overrides; removes nothing.
 */
export function migrate(raw: unknown): Data | null {
  if (!isData(raw)) return null;
  const o = raw as Partial<Data>;
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(isObj(o.settings) ? o.settings : {}) };
  const from = o.schemaVersion ?? 1;
  if (from < 3 && !settings.onboarded && settings.wakeTime === '06:00') settings.wakeTime = DEFAULT_SETTINGS.wakeTime;
  if (from < 4 && !settings.onboarded && settings.lightsOut === '22:00') settings.lightsOut = DEFAULT_SETTINGS.lightsOut;
  return {
    schemaVersion: SCHEMA_VERSION,
    days: o.days || {},
    settings,
    cols: isObj(o.cols) ? o.cols : {},
    priv: isObj(o.priv) ? o.priv : {},
  };
}

const newer = <T extends { _u?: number }>(x: T | undefined, y: T | undefined) =>
  !y ? x! : !x ? y : (x._u ?? 0) >= (y._u ?? 0) ? x : y;

function mergeTables(a: Tables = {}, b: Tables = {}): Tables {
  const out: Tables = {};
  for (const col of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[col] || {}, y = b[col] || {};
    const t: Table = {};
    for (const id of new Set([...Object.keys(x), ...Object.keys(y)])) t[id] = newer(x[id], y[id]);
    out[col] = t;
  }
  return out;
}

/**
 * Last-writer-wins per day, per record and for settings. Anything missing on
 * one side counts as "no news", never as a delete, so an older app version
 * syncing without `cols` can't wipe them.
 */
export function merge(a: Data, b: Data | null | undefined): Data {
  if (!b) return a;
  const days: Record<string, DayLog> = {};
  const keys = new Set([...Object.keys(a.days || {}), ...Object.keys(b.days || {})]);
  for (const k of [...keys].sort()) days[k] = newer(a.days?.[k], b.days?.[k]);
  const settings = { ...DEFAULT_SETTINGS, ...newer(a.settings, b.settings) };
  return { schemaVersion: SCHEMA_VERSION, days, settings, cols: mergeTables(a.cols, b.cols), priv: mergeTables(a.priv, b.priv) };
}

/** What goes to the sync gist: everything except the private collections. */
export function publicData(d: Data): Omit<Data, 'priv'> {
  const { priv: _, ...rest } = d;
  return rest;
}

/** Live (not deleted) records of a collection, from wherever it's stored. */
export function recs<T extends Rec>(d: Data, col: string): T[] {
  const t = (PRIVATE_COLS.has(col) ? d.priv : d.cols)[col] || {};
  return Object.values(t).filter(r => !r._del) as T[];
}

/** JSON with sorted keys, for comparing data sets. */
export function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().filter(k => (v as Record<string, unknown>)[k] !== undefined)
      .map(k => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}
