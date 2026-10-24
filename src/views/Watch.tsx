import { clock, fmtShort } from '../lib/dates';
import { actsOn, garminStatus, hasGarmin, lapPace, matchActivity, paceOf, recovery, repeats, tooHard, trialTime, type GActivity } from '../lib/garmin';
import { pace, type Session } from '../lib/program';
import type { Data } from '../lib/store';

const km = (m?: number) => (m != null ? (m / 1000).toFixed(2) : '—');
const dur = (s?: number) => {
  if (s == null) return '—';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};
const label = (t: string) => t.replace(/_/g, ' ');

/** The day's activity from the Forerunner, checked against the session. */
export function WatchCard({ data, date, s }: { data: Data; date: string; s: Session }) {
  if (!hasGarmin(data)) return null;
  const a = matchActivity(data, date, s);
  const others = actsOn(data, date).filter(x => x.id !== a?.id);
  if (!a && !others.length) return null;
  return (
    <article className="card watch o-watch">
      <header><h3>From your watch</h3><span className="aside">{a ? `${label(a.type)} · ${a.start.slice(11, 16)}` : 'nothing matches today’s session'}</span></header>
      {a && <ActivityStats a={a} />}
      {a && <Verdicts data={data} a={a} s={s} />}
      {a?.laps && a.laps.length > 1 && <Laps a={a} s={s} />}
      {others.length > 0 && (
        <ul className="watch-others">
          {others.map(o => <li key={o.id}>{label(o.type)} · {o.distM ? `${km(o.distM)} km · ` : ''}{dur(o.durS)}</li>)}
        </ul>
      )}
    </article>
  );
}

function ActivityStats({ a }: { a: GActivity }) {
  const p = paceOf(a.distM, a.movS ?? a.durS);
  return (
    <dl className="minis watch-stats">
      {a.distM ? <div><dt>Distance</dt><dd>{km(a.distM)}<small> km</small></dd></div> : null}
      <div><dt>Time</dt><dd>{dur(a.durS)}</dd></div>
      {p && a.distM && a.distM > 300 ? <div><dt>Pace</dt><dd>{clock(p)}<small>/km</small></dd></div> : null}
      {a.avgHR ? <div><dt>Avg HR</dt><dd>{a.avgHR}<small> bpm</small></dd></div> : null}
      {a.aerobicTE ? <div><dt>Aerobic TE</dt><dd>{a.aerobicTE.toFixed(1)}</dd></div> : null}
    </dl>
  );
}

function Verdicts({ data, a, s }: { data: Data; a: GActivity; s: Session }) {
  const out: { tone: 'good' | 'warn' | ''; text: string }[] = [];
  if (s.goalSec && s.km) {
    const t = trialTime(a, s.km);
    if (t) {
      const diff = t.sec - s.goalSec;
      out.push({
        tone: diff <= 0 ? 'good' : 'warn',
        text: `${s.km}K in ${dur(t.sec)}${t.how === 'laps' ? ' (fastest laps)' : ''}: ${diff <= 0 ? `${dur(-diff)} under` : `${dur(diff)} over`} the ${dur(s.goalSec)} target`,
      });
    } else out.push({ tone: '', text: `Couldn’t find ${s.km} km in this activity. Set auto-lap to 1 km, or log the time by hand below.` });
  }
  const r = repeats(a, s);
  if (r && r.work.length) out.push({ tone: r.onPace === r.work.length ? 'good' : r.onPace ? '' : 'warn', text: `${r.onPace} of ${r.work.length} repeats at ${pace(s.pace!)} or faster` });
  if (s.tag === 'Tempo' && s.pace) {
    const p = paceOf(a.distM, a.movS ?? a.durS);
    if (p) out.push({ tone: '', text: `Whole run averaged ${clock(p)}/km, warm-up included. The laps show the tempo itself.` });
  }
  if (tooHard(data, a, s)) {
    const z = garminStatus(data)!.zones!;
    out.push({ tone: 'warn', text: `Average heart rate ${a.avgHR} is zone 3 or higher (from ${z.z3}). Easy days should stay below it: slow down until you can talk in full sentences.` });
  } else if (s.easy && a.avgHR && garminStatus(data)?.zones) out.push({ tone: 'good', text: 'Heart rate stayed easy' });
  if (!out.length) return null;
  return <ul className="verdicts">{out.map(v => <li key={v.text} className={v.tone}>{v.text}</li>)}</ul>;
}

function Laps({ a, s }: { a: GActivity; s: Session }) {
  const target = s.pace;
  return (
    <details className="laps" open={!!(s.pace || s.goalSec)}>
      <summary>{a.laps!.length} laps</summary>
      <div className="lapwrap"><table className="lap-table">
        <thead><tr><th>Lap</th><th>Distance</th><th>Time</th><th>Pace</th><th>HR</th></tr></thead>
        <tbody>
          {a.laps!.map((l, i) => {
            const p = lapPace(l);
            const hit = target != null && p <= target + 3 && l.distM >= 400;
            return (
              <tr key={i} className={hit ? 'hit' : ''}>
                <td className="wk">{i + 1}</td>
                <td data-l="Distance">{km(l.distM)} km</td>
                <td data-l="Time">{dur(l.durS)}</td>
                <td data-l="Pace">{l.distM >= 100 ? `${clock(p)}/km` : '—'}</td>
                <td data-l="HR">{l.avgHR ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
    </details>
  );
}

const LEVEL = {
  ok: { title: 'Recovering well', text: 'Nothing in your watch data says ease off.' },
  watch: { title: 'Keep an eye on it', text: 'One warning sign. One on its own is normal; two together means ease off.' },
  ease: { title: 'Ease off', text: 'Two or more warning signs at once. The plan says: go back to the previous calorie tier for two weeks, and keep runs easy.' },
};

/** The plan's ease-off rule, read from HRV, resting heart rate, sleep and easy-run heart rate. */
export function RecoveryCard({ data, date }: { data: Data; date: string }) {
  if (!hasGarmin(data)) return null;
  const r = recovery(data, date);
  if (!r) return null;
  const L = LEVEL[r.level];
  return (
    <article className={`card recovery o-recovery lvl-${r.level}`}>
      <header><h3>Recovery</h3><span className="aside">last 7 days vs the 4 weeks before</span></header>
      <p className="rec-title"><b>{L.title}</b> {L.text}</p>
      {r.flags.length > 0 && <ul className="verdicts">{r.flags.map(f => <li key={f.key} className="warn">{f.text}</li>)}</ul>}
      <dl className="minis">
        <div><dt>HRV</dt><dd>{r.hrv7 ?? '—'}<small>{r.hrvBase ? ` / ${r.hrvBase}` : ''} ms</small></dd></div>
        <div><dt>Resting HR</dt><dd>{r.rhr7 ?? '—'}<small>{r.rhrBase ? ` / ${r.rhrBase}` : ''}</small></dd></div>
        <div><dt>Sleep</dt><dd>{r.sleep7 ?? '—'}<small> h</small></dd></div>
      </dl>
    </article>
  );
}

/** Settings: what the last Garmin sync did, and how it's set up. */
export function GarminPanel({ data }: { data: Data }) {
  const st = garminStatus(data);
  return (
    <section className="stack-sm">
      {st ? (
        <>
          <dl className="kv">
            <div><dt>Last sync</dt><dd>{fmtShort(new Date(st.at).toISOString().slice(0, 10))} · {new Date(st.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</dd></div>
            <div><dt>Activities in the last pull</dt><dd>{st.activities} ({st.runsWithLaps} runs with laps)</dd></div>
            <div><dt>Days of health data</dt><dd>{st.days}</dd></div>
            <div><dt>Heart rate zones</dt><dd>{st.zones ? `zone 3 from ${st.zones.z3} bpm` : 'not found'}</dd></div>
          </dl>
          {st.errors.length > 0 && (
            <details className="rules-more">
              <summary>{st.errors.length} part{st.errors.length === 1 ? '' : 's'} didn’t come through</summary>
              <ul className="focus">{st.errors.map(e => <li key={e}>{e}</li>)}</ul>
            </details>
          )}
          <details className="rules-more">
            <summary>What Garmin sent</summary>
            <ul className="focus mono">{Object.entries(st.shapes).map(([k, v]) => <li key={k}><b>{k}</b> {v}</li>)}</ul>
          </details>
        </>
      ) : (
        <p className="fine">No Garmin data yet. It arrives through the sync below, so connect sync first.</p>
      )}
      <ol className="steps">
        <li>The GitHub Action “Garmin sync” runs every 30 minutes. Run it by hand from the repo’s Actions tab for an instant update.</li>
        <li>It needs two repository secrets: <b>GARMIN_API_KEY</b> and <b>GIST_TOKEN</b> (a GitHub token with only the gist scope, like the one used for sync).</li>
        <li>Anything you type in by hand wins over the watch. Untick “Session done” to overrule a matched activity.</li>
      </ol>
      <p className="fine">GitHub pauses scheduled Actions in a public repo after 60 days without a commit. If the last sync stops moving, re-enable it in the Actions tab.</p>
    </section>
  );
}
