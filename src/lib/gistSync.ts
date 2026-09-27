import { useSyncExternalStore } from 'react';
import { getData, merge, migrate, onLocalChange, publicData, replaceData, stable, type Data } from './store';

/**
 * Syncs the log to a secret GitHub Gist so the MacBook and the phone share one record.
 * The token and gist id live in this browser's localStorage only. Private
 * collections (mood, money) are stripped before upload and never come back down.
 */
const API = 'https://api.github.com';
const CFG_KEY = 'twentyone-weeks-gist';
const FILE = 'twenty-one-weeks.json';
const DESC = 'Twenty-One Weeks — training log (synced by the app)';

export interface GistConfig { token: string; gistId: string; login: string }
export type SyncState = 'off' | 'syncing' | 'synced' | 'pending' | 'offline' | 'error';
export interface SyncStatus { state: SyncState; message?: string; last?: number; login?: string; gistId?: string }

let cfg: GistConfig | null = (() => {
  try { return JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); } catch { return null; }
})();
let status: SyncStatus = cfg ? { state: 'pending', login: cfg.login, gistId: cfg.gistId } : { state: 'off' };
const listeners = new Set<() => void>();

function setStatus(s: Partial<SyncStatus>) {
  status = { ...status, ...s, login: cfg?.login, gistId: cfg?.gistId };
  listeners.forEach(l => l());
}
export const useSyncStatus = () =>
  useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l); }; }, () => status);

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function gh<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API + path, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).message || msg; } catch { /* no body */ }
    throw new HttpError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

interface GistFile { content?: string; truncated?: boolean; raw_url?: string }
interface Gist { id: string; description: string | null; files: Record<string, GistFile | undefined>; html_url: string }

async function readRemote(c: GistConfig): Promise<Data | null> {
  const g = await gh<Gist>(c.token, `/gists/${c.gistId}`);
  const f = g.files[FILE];
  if (!f) return null;
  let text = f.content ?? '';
  if (f.truncated && f.raw_url) text = await (await fetch(f.raw_url, { cache: 'no-store' })).text();
  try {
    // Older app versions write a v1 shape; bring it up to date before merging.
    const d = migrate(JSON.parse(text));
    return d && { ...d, priv: {} };
  } catch { return null; }
}

function writeRemote(c: GistConfig, d: Data) {
  return gh<Gist>(c.token, `/gists/${c.gistId}`, {
    method: 'PATCH',
    body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(publicData(d), null, 1) } } }),
  });
}

function explain(e: unknown): Partial<SyncStatus> {
  if (e instanceof HttpError) {
    if (e.status === 401) return { state: 'error', message: 'GitHub rejected the token. It may have expired — reconnect with a new one.' };
    if (e.status === 403 || e.status === 404) return { state: 'error', message: 'Can’t reach the sync gist. Check the token has the “gist” scope, then reconnect.' };
    return { state: 'error', message: `GitHub said: ${e.message}` };
  }
  return { state: 'offline', message: 'Offline — changes are saved here and will sync when you’re back online.' };
}

/* ---------- sync loop ---------- */
let busy = false;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;

export async function syncNow(): Promise<void> {
  const c = cfg;
  if (!c) return;
  if (busy) { again = true; return; }
  busy = true;
  clearTimeout(timer);
  setStatus({ state: 'syncing', message: undefined });
  try {
    const remote = await readRemote(c);
    // Merge with whatever is local *now* (edits may have landed during the fetch).
    const merged = merge(getData(), remote);
    if (stable(merged) !== stable(getData())) replaceData(merged);
    if (!remote || stable(publicData(merged)) !== stable(publicData(remote))) await writeRemote(c, merged);
    setStatus({ state: 'synced', last: Date.now() });
  } catch (e) {
    setStatus(explain(e));
  } finally {
    busy = false;
  }
  if (again) { again = false; return syncNow(); }
}

function schedule(ms = 2000) {
  if (!cfg) return;
  clearTimeout(timer);
  if (status.state !== 'syncing') setStatus({ state: 'pending' });
  timer = setTimeout(syncNow, ms);
}

/* ---------- connect / disconnect ---------- */
export async function connect(token: string): Promise<void> {
  token = token.trim();
  const user = await gh<{ login: string }>(token, '/user').catch(e => {
    throw new Error(e instanceof HttpError && e.status === 401 ? 'That token wasn’t accepted by GitHub.' : 'Couldn’t reach GitHub. Check your connection.');
  });
  // Reuse the gist from another device if one exists.
  let found: Gist | undefined;
  for (let page = 1; page <= 10 && !found; page++) {
    const list = await gh<Gist[]>(token, `/gists?per_page=100&page=${page}`).catch(() => {
      throw new Error('The token can’t read your gists. Create one with the “gist” scope.');
    });
    found = list.find(g => g.description === DESC && g.files[FILE]);
    if (list.length < 100) break;
  }
  if (!found) {
    found = await gh<Gist>(token, '/gists', {
      method: 'POST',
      body: JSON.stringify({ description: DESC, public: false, files: { [FILE]: { content: JSON.stringify(publicData(getData()), null, 1) } } }),
    }).catch(() => { throw new Error('The token can’t create gists. Create one with the “gist” scope.'); });
  }
  cfg = { token, gistId: found.id, login: user.login };
  try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch { /* storage unavailable */ }
  setStatus({ state: 'pending' });
  await syncNow();
}

export function disconnect() {
  cfg = null;
  clearTimeout(timer);
  try { localStorage.removeItem(CFG_KEY); } catch { /* storage unavailable */ }
  status = { state: 'off' };
  listeners.forEach(l => l());
}

/* ---------- wiring ---------- */
export function startSync() {
  onLocalChange(() => schedule());
  const poke = () => { if (cfg && document.visibilityState === 'visible') syncNow(); };
  document.addEventListener('visibilitychange', () => {
    if (!cfg) return;
    if (document.visibilityState === 'visible') syncNow();
    else if (status.state === 'pending') syncNow(); // push before the phone sleeps the tab
  });
  window.addEventListener('online', poke);
  window.addEventListener('focus', poke);
  setInterval(poke, 90_000);
  if (cfg) syncNow();
}
