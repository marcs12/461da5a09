/**
 * Pulls Garmin Connect data with the Personal API and merges it into the
 * app's secret sync gist, where every device picks it up on its next sync.
 *
 * Runs in GitHub Actions (.github/workflows/garmin-sync.yml) with two secrets:
 *   GARMIN_API_KEY  the personal API key from Garmin Connect
 *   GIST_TOKEN      a GitHub token with only the "gist" scope
 *
 * The repo is public, so the log only ever shows counts and response shapes
 * (key names), never values. Run locally with DRY_RUN=1 to fetch without writing.
 */
import { Decoder, Stream } from '@garmin/fitsdk';
import { unzipSync } from 'fflate';
import { migrate, publicData, stable } from '../src/lib/schema.ts';
import * as P from '../src/lib/garminParse.ts';

const GARMIN = process.env.GARMIN_BASE || 'https://personal.connectapi.garmin.com';
const TOKEN_PATH = '/personalapitoken-service/personal-api/personal-api-key/token';
const GH = process.env.GITHUB_API || 'https://api.github.com';
// Must match src/lib/gistSync.ts.
const FILE = 'twenty-one-weeks.json';
const DESC = 'Twenty-One Weeks — training log (synced by the app)';
/** How far back the first run reaches: a month before day 1 of the plan. */
const BACKFILL_FROM = '2026-09-26';
const TZ = 'America/Vancouver';
const MAX_FIT_DOWNLOADS = 12;

const DRY = !!process.env.DRY_RUN;
const now = Date.now();
const errors = [];
const shapes = {};
const log = (...a) => console.log(...a);

/* ---------- dates ---------- */
const localDate = (ms = now) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
const addDays = (ds, n) => { const d = new Date(`${ds}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const between = (a, b) => { const out = []; for (let d = a; d <= b; d = addDays(d, 1)) out.push(d); return out; };

/* ---------- Garmin ---------- */
class HttpError extends Error { constructor(status, what) { super(`${what}: HTTP ${status}`); this.status = status; } }

async function garminToken(key) {
  const res = await fetch(GARMIN + TOKEN_PATH, { method: 'POST', headers: { Accept: '*/*', Authorization: `ApiKey ${key}` } });
  if (!res.ok) throw new HttpError(res.status, 'token');
  return (await res.text()).trim();
}
let token;
async function garmin(name, path, params, accept = 'application/json') {
  const url = new URL(GARMIN + path);
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { Accept: accept, Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new HttpError(res.status, name);
  if (accept !== 'application/json') return new Uint8Array(await res.arrayBuffer());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
/** Run one endpoint; a failure is recorded and the sync carries on with the rest. */
async function attempt(name, fn) {
  try {
    const json = await fn();
    if (!(name in shapes)) shapes[name] = P.shape(json);
    return json;
  } catch (e) {
    errors.push(e instanceof HttpError ? e.message : `${name}: ${e.message}`);
    return null;
  }
}

/* ---------- GitHub gist ---------- */
async function gh(path, init = {}) {
  const res = await fetch(GH + path, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json', Authorization: `Bearer ${process.env.GIST_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) throw new HttpError(res.status, `GitHub ${init.method || 'GET'} ${path.split('?')[0]}`);
  return res.json();
}
async function findGist() {
  for (let page = 1; page <= 10; page++) {
    const list = await gh(`/gists?per_page=100&page=${page}`);
    const g = list.find(x => x.description === DESC && x.files[FILE]);
    if (g) return g.id;
    if (list.length < 100) break;
  }
  return null;
}
async function readGist(id) {
  const g = await gh(`/gists/${id}`);
  const f = g.files[FILE];
  if (!f) return null;
  let text = f.content ?? '';
  if (f.truncated && f.raw_url) text = await (await fetch(f.raw_url)).text();
  return migrate(JSON.parse(text));
}
const writeGist = (id, data) => gh(`/gists/${id}`, { method: 'PATCH', body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(publicData(data), null, 1) } } }) });
const createGist = data => gh('/gists', { method: 'POST', body: JSON.stringify({ description: DESC, public: false, files: { [FILE]: { content: JSON.stringify(data, null, 1) } } }) });

/* ---------- records ---------- */
const strip = ({ _u, ...rest }) => rest;
/** Keep the old `_u` when nothing changed, so a quiet run writes nothing. */
function settle(table, rec) {
  const old = table[rec.id];
  if (old && stable(strip(old)) === stable(strip(rec))) return false;
  table[rec.id] = { ...rec, _u: now };
  return true;
}

async function main() {
  if (!process.env.GARMIN_API_KEY) throw new Error('GARMIN_API_KEY secret is missing.');
  if (!process.env.GIST_TOKEN) throw new Error('GIST_TOKEN secret is missing: add a GitHub token with only the "gist" scope.');

  const today = localDate();
  let gistId = await findGist();
  let remote = gistId ? await readGist(gistId) : null;
  const cols = remote?.cols ?? {};
  const acts = { ...(cols.garminActs ?? {}) }, days = { ...(cols.garminDays ?? {}) };
  const first = !Object.keys(acts).length;
  const from = first ? BACKFILL_FROM : addDays(today, -10);
  log(`today ${today} · ${first ? 'first run, backfilling' : 'incremental'} from ${from} · gist ${gistId ? 'found' : 'not found yet'}`);

  try { token = await garminToken(process.env.GARMIN_API_KEY); }
  catch (e) {
    const msg = `Garmin didn't accept the API key (${e.message}). It may have expired: create a new one and update the GARMIN_API_KEY secret.`;
    // Tell the app, so Settings shows why nothing new is arriving.
    if (gistId && !DRY) {
      const latest = (await readGist(gistId)) ?? remote;
      const old = latest.cols?.garminSync?.status ?? {};
      latest.cols = { ...latest.cols, garminSync: { status: { activities: 0, runsWithLaps: 0, days: 0, changed: 0, shapes: {}, ...old, id: 'status', _u: now, at: now, ok: false, errors: [msg] } } };
      await writeGist(gistId, latest);
    }
    throw new Error(msg);
  }

  /* Activities */
  const found = [];
  for (let start = 0; start < 500; start += 50) {
    const page = await attempt('activities', () => garmin('activities', '/activitylist-service/activities/search/activities', { start, limit: 50, startDate: from, endDate: today }));
    const list = P.parseActivities(page, now);
    found.push(...list);
    if (list.length < 50) break;
  }
  let fits = 0;
  for (const a of found) {
    const old = acts[a.id];
    if (old?.laps) a.laps = old.laps;
    else if (P.isRun(a.type) && fits < MAX_FIT_DOWNLOADS) {
      fits++;
      const zip = await attempt('fit', () => garmin('fit', `/download-service/files/activity/${a.id}`, null, 'application/zip, application/x-zip-compressed, application/octet-stream'));
      if (zip) {
        try {
          const entries = unzipSync(zip);
          const name = Object.keys(entries).find(n => n.toLowerCase().endsWith('.fit'));
          if (name) {
            const { messages } = new Decoder(Stream.fromByteArray(entries[name])).read();
            const laps = P.lapsFromFit(messages.lapMesgs);
            if (laps.length) a.laps = laps;
          }
        } catch (e) { errors.push(`fit: ${e.message}`); }
      }
    }
  }
  let changedActs = 0;
  for (const a of found) if (settle(acts, a)) changedActs++;

  /* Daily health */
  const fresh = {};
  const put = (d, fields) => { if (d >= BACKFILL_FROM && d <= today) fresh[d] = { ...(fresh[d] ?? {}), ...fields }; };
  for (let end = today; end >= from; end = addDays(end, -7)) {
    const start = addDays(end, -6) < from ? from : addDays(end, -6);
    const json = await attempt('steps', () => garmin('steps', `/usersummary-service/stats/steps/daily/${start}/${end}`));
    for (const [d, steps] of Object.entries(P.parseSteps(json))) put(d, { steps });
    if (!first) break;
  }
  const hrv = await attempt('hrv', () => garmin('hrv', `/hrv-service/hrv/daily/${first ? from : addDays(today, -27)}/${today}`));
  for (const [d, v] of Object.entries(P.parseHrv(hrv))) put(d, v);
  const recent = between(first ? addDays(today, -13) : addDays(today, -2), today);
  for (const d of recent) {
    const sleep = P.parseSleep(await attempt('sleep', () => garmin('sleep', '/sleep-service/sleep/dailySleep', { date: d })));
    if (Object.keys(sleep).length) put(d, sleep);
    const rhr = P.parseRestingHr(await attempt('heartRate', () => garmin('heartRate', '/wellness-service/wellness/dailyHeartRate', { date: d })));
    if (rhr != null) put(d, { rhr });
  }
  const weights = await attempt('weight', () => garmin('weight', `/weight-service/weight/range/${from}/${today}`, { includeAll: 'true' }));
  for (const [d, weightLb] of Object.entries(P.parseWeights(weights))) put(d, { weightLb });
  const zones = P.parseZones(await attempt('zones', () => garmin('zones', '/biometric-service/heartRateZones/v2')));

  let changedDays = 0;
  for (const [d, f] of Object.entries(fresh)) {
    const { _u, id, ...old } = days[d] ?? {};
    if (settle(days, { id: d, ...old, ...f })) changedDays++;
  }

  const status = {
    id: 'status', _u: now, at: now, ok: !errors.length,
    activities: found.length, runsWithLaps: found.filter(a => a.laps).length, days: Object.keys(fresh).length,
    changed: changedActs + changedDays, errors: errors.slice(0, 12), shapes, ...(zones ? { zones } : {}),
  };
  log(`activities ${found.length} (${changedActs} new or changed, ${fits} FIT files) · days ${Object.keys(fresh).length} (${changedDays} changed)`);
  log('shapes', JSON.stringify(shapes));
  if (errors.length) log('errors', JSON.stringify(errors));
  if (DRY) { log('DRY_RUN: not writing'); return; }

  // Read again just before writing, so edits made on a device meanwhile are kept.
  const garminCols = { garminActs: acts, garminDays: days, garminSync: { status } };
  if (!gistId) {
    const g = await createGist({ schemaVersion: 5, days: {}, cols: garminCols });
    log('created the sync gist; connect the app to it in Settings');
    gistId = g.id;
    return;
  }
  const latest = (await readGist(gistId)) ?? remote ?? migrate({ days: {} });
  latest.cols = { ...latest.cols, ...garminCols };
  await writeGist(gistId, latest);
  log('gist updated');
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
