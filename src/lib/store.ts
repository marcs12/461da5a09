import { useSyncExternalStore } from 'react';

export interface SetEntry { w?: number; r?: number }
export interface DayLog {
  weight?: number;
  done?: boolean;
  walk?: boolean;
  min?: number;
  km?: number;
  rpe?: number;
  cal?: number;
  pro?: number;
  sleep?: number;
  note?: string;
  ex?: Record<string, SetEntry[]>;
  /** Last edit time (ms). Sync merges days last-writer-wins on this. */
  _u?: number;
}
export interface Settings { calTarget: number; proTarget: number; cutWeek?: number; _u?: number }
export interface Data { days: Record<string, DayLog>; settings: Settings }

export const DEFAULT_SETTINGS: Settings = { calTarget: 2300, proTarget: 180 };
const LS_KEY = 'twentyone-weeks-v1';

function load(): Data {
  try {
    const o = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (o && typeof o === 'object') return { days: o.days || {}, settings: { ...DEFAULT_SETTINGS, ...(o.settings || {}) } };
  } catch { /* storage unavailable */ }
  return { days: {}, settings: { ...DEFAULT_SETTINGS } };
}

let data: Data = load();
const listeners = new Set<() => void>();
const changeHooks = new Set<() => void>();

function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
}
function emit() { listeners.forEach(l => l()); }

export const getData = () => data;
export const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useData = () => useSyncExternalStore(subscribe, getData);
/** Called after every local edit (the sync layer hooks in here). */
export const onLocalChange = (fn: () => void) => { changeHooks.add(fn); return () => { changeHooks.delete(fn); }; };

function commitLocal(next: Data) {
  data = next;
  save();
  emit();
  changeHooks.forEach(h => h());
}

/** Edit one day's log. `fn` gets a shallow copy — replace nested objects, don't mutate them. */
export function editDay(ds: string, fn: (d: DayLog) => void) {
  const d: DayLog = { ...(data.days[ds] || {}) };
  fn(d);
  for (const k of Object.keys(d) as (keyof DayLog)[]) {
    if (d[k] === undefined || d[k] === null || d[k] === '') delete d[k];
  }
  d._u = Date.now();
  commitLocal({ ...data, days: { ...data.days, [ds]: d } });
}

export function editSettings(patch: Partial<Settings>) {
  commitLocal({ ...data, settings: { ...data.settings, ...patch, _u: Date.now() } });
}

/** Replace everything (sync merge, import). Doesn't trigger another sync. */
export function replaceData(next: Data) {
  data = next;
  save();
  emit();
}

/** Last-writer-wins per day and for settings. */
export function merge(a: Data, b: Data | null | undefined): Data {
  if (!b) return a;
  const days: Record<string, DayLog> = {};
  const keys = new Set([...Object.keys(a.days || {}), ...Object.keys(b.days || {})]);
  for (const k of [...keys].sort()) {
    const x = a.days?.[k], y = b.days?.[k];
    days[k] = !y ? x! : !x ? y : (x._u ?? 0) >= (y._u ?? 0) ? x : y;
  }
  const sa = a.settings, sb = b.settings;
  const settings = { ...DEFAULT_SETTINGS, ...(!sb ? sa : !sa ? sb : (sa._u ?? 0) >= (sb._u ?? 0) ? sa : sb) };
  return { days, settings };
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

export function isData(o: unknown): o is Data {
  return !!o && typeof o === 'object' && typeof (o as Data).days === 'object';
}
