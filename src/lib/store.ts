import { useSyncExternalStore } from 'react';
import { PRIVATE_COLS, SCHEMA_VERSION, emptyData, migrate, publicData, type Data, type DayLog, type Rec, type SetEntry, type Settings } from './schema';

export * from './schema';

const LS_KEY = 'twentyone-weeks-v1';
/** Mood and money collections live under their own key and are never synced. */
const PRIV_KEY = 'twentyone-weeks-private';
/** A copy of the data as it was before a schema upgrade, written once per old version. */
const backupKey = (v: number) => `${LS_KEY}.bak-v${v}`;

function load(): Data {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    const priv = JSON.parse(localStorage.getItem(PRIV_KEY) || 'null');
    const d = migrate(raw);
    if (!d) return emptyData();
    const from = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1;
    if (from < SCHEMA_VERSION && !localStorage.getItem(backupKey(from))) {
      localStorage.setItem(backupKey(from), localStorage.getItem(LS_KEY)!);
    }
    if (priv && typeof priv === 'object') d.priv = priv;
    return d;
  } catch { /* storage unavailable */ }
  return emptyData();
}

let data: Data = load();
const listeners = new Set<() => void>();
const changeHooks = new Set<() => void>();

function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(publicData(data)));
    localStorage.setItem(PRIV_KEY, JSON.stringify(data.priv));
  } catch { /* storage unavailable */ }
}
save();
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

/** Set one field of one logged set (`i`) of exercise `id` on a day; `undefined` clears it. */
export function editSet(ds: string, id: string, i: number, k: keyof SetEntry, v: number | undefined) {
  editDay(ds, d => {
    const ex = { ...(d.ex || {}) };
    const arr = [...(ex[id] || [])];
    while (arr.length <= i) arr.push({});
    const e = { ...arr[i] };
    if (v == null) delete e[k]; else e[k] = v;
    arr[i] = e;
    ex[id] = arr;
    d.ex = ex;
  });
}

export function editSettings(patch: Partial<Settings>) {
  commitLocal({ ...data, settings: { ...data.settings, ...patch, _u: Date.now() } });
}

/** Create or replace a record in collection `col` (private collections stay on this device). */
export function putRec<T extends Rec>(col: string, rec: Omit<T, '_u'>) {
  const where = PRIVATE_COLS.has(col) ? 'priv' : 'cols';
  const tables = data[where];
  const next = { ...rec, _u: Date.now() } as Rec;
  commitLocal({ ...data, [where]: { ...tables, [col]: { ...(tables[col] || {}), [rec.id]: next } } });
}

/** Merge `patch` into a record, starting from `base` if it doesn't exist yet. */
export function patchRec<T extends Rec>(col: string, id: string, patch: Partial<T>, base: Omit<T, 'id' | '_u'>) {
  const where = PRIVATE_COLS.has(col) ? 'priv' : 'cols';
  const cur = data[where][col]?.[id] as T | undefined;
  const { _del, ...live } = (cur && !cur._del ? cur : { ...base, id }) as T;
  putRec<T>(col, { ...live, ...patch, id } as Omit<T, '_u'>);
}

export function delRec(col: string, id: string) {
  putRec(col, { id, _del: true });
}

/** Wipe every logged day and start the program over. Targets and the sync
 *  connection stay; the empty log syncs out like any other edit. */
export function resetDays() {
  commitLocal({ ...data, days: {} });
}

/** Replace everything (sync merge, import). Doesn't trigger another sync. */
export function replaceData(next: Data) {
  data = next;
  save();
  emit();
}

/** Ask the browser not to evict our storage under pressure. */
export function persistStorage() {
  try { navigator.storage?.persist?.().catch(() => {}); } catch { /* unsupported */ }
}
