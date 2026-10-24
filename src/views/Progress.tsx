import { useEffect, useRef, useState } from 'react';
import { addDays, diff, fmtDay, fmtShort, num, r1, sgn, today } from '../lib/dates';
import { END, EX, START, TOTAL_DAYS, WEEKS, phaseOfWeek, programDay, sessionOf } from '../lib/program';
import { hasGarmin, matchActivity, trialTime } from '../lib/garmin';
import { GOAL_WEIGHT, floorAfter, floorOn, nextCheckpoint, startWeight, targetAfter, targetOn, targetsOn, weeksBy } from '../lib/targets';
import { adherence, avg7, sortedKeys, weekAvg, weekLog, weights, type WeighIn } from '../lib/stats';
import type { Data } from '../lib/store';

/** Weigh-ins from the month before day 1 give the chart its run-in. */
const CHART_FROM = addDays(START, -28);

export function Progress({ data, goToday }: { data: Data; goToday: () => void }) {
  const t = today();
  const all = weights(data);
  const E = all.filter(e => e.date >= CHART_FROM);
  const start = startWeight(data);
  const last = all.length ? all[all.length - 1] : null;
  const a7 = last ? avg7(all, last.date) : null;
  const pdT = programDay(t);
  const started = pdT.status !== 'pre';
  const change = a7 != null && started ? a7 - start : null;
  const plan = started && last ? targetOn(start, last.date) : null;
  const vsPlan = a7 != null && plan != null ? a7 - plan : null;
  const adh = adherence(data);
  const T = targetsOn(data.settings, t);
  const cp = nextCheckpoint(t);

  const curWeek = pdT.status === 'pre' ? 0 : pdT.status === 'post' ? WEEKS : pdT.week;
  const weeks = Array.from({ length: curWeek }, (_, i) => curWeek - i);

  const liftRows = Object.entries(EX).map(([id, ex]) => {
    const hist: { w: number | null; r: number }[] = [];
    for (const k of sortedKeys(data)) {
      const sets = (data.days[k].ex?.[id] || []).filter(s => s && num(s.r) != null);
      if (!sets.length) continue;
      const ws = sets.map(s => num(s.w)).filter((x): x is number => x != null);
      hist.push({ w: ws.length ? Math.max(...ws) : null, r: Math.max(...sets.map(s => Number(s.r))) });
    }
    if (!hist.length) return null;
    const cx = id === 'complex';
    const val = (h: { w: number | null; r: number }) =>
      cx ? `${h.w ?? '?'} lb × ${h.r}` : ex.bw || h.w == null ? `${h.r}${ex.unit === 'sec' ? ' s' : ' reps'}` : `${h.w} lb`;
    return (
      <div className="lift-row" key={id}>
        <div>{ex.name}<br /><span>{hist.length} session{hist.length > 1 ? 's' : ''}{cx && ' · lb × rounds'}</span></div>
        <b>{val(hist[0])} → {val(hist[hist.length - 1])}</b>
      </div>
    );
  }).filter(Boolean);

  const cls = (v: number | null) => (v == null ? '' : v < 0 ? 'down' : v > 0 ? 'upc' : '');
  // Within a tenth of a pound counts as on plan.
  const onPlan = vsPlan != null && Math.abs(vsPlan) < 0.05;

  return (
    <section>
      <div className="pagehead"><div><h1>Progress</h1><p>Judge the trend by weekly averages, not single weigh-ins.</p></div></div>
      <dl className="tiles">
        <div className="tile"><dt>7-day average</dt><dd>{a7 != null ? r1(a7).toFixed(1) : '—'}<small>lb</small></dd>
          <p>{last ? `latest ${last.w} lb · ${fmtShort(last.date)}` : 'no weigh-ins yet'}</p></div>
        <div className="tile"><dt>Since day 1</dt><dd className={cls(change)}>{change != null ? sgn(change) : '—'}<small>lb</small></dd>
          <p>{started ? `from ${r1(start)} lb · goal ${GOAL_WEIGHT}` : `starts ${fmtShort(START)} · goal ${GOAL_WEIGHT} lb`}</p></div>
        <div className="tile"><dt>Against the plan</dt>
          <dd className={vsPlan == null ? '' : vsPlan <= 0 || onPlan ? 'down' : 'behind'}>
            {vsPlan == null ? '—' : onPlan ? 'On plan' : <>{Math.abs(vsPlan).toFixed(1)}<small>lb {vsPlan > 0 ? 'behind' : 'ahead'}</small></>}
          </dd>
          <p>{plan != null ? `plan says ${r1(plan).toFixed(1)} · floor ${r1(floorOn(start, last!.date)).toFixed(1)}` : cp ? `first checkpoint ${cp.target} lb · ${fmtShort(cp.date)}` : ''}</p></div>
        <div className="tile"><dt>Sessions done</dt><dd>{adh.done}<small>/ {adh.sched}</small></dd>
          <p>step-goal days {adh.stepDays} / {adh.days}</p></div>
      </dl>

      <div className="prog-grid">
        <div className="stack">
          <article className="card">
            <header><h3>Body weight</h3><span className="aside">lb</span></header>
            {E.length ? <WeightChart E={E} start={start} /> : (
              <div className="empty">Log a weigh-in on the Today tab. Your 7-day average appears here against the plan’s target band.
                <button className="btn" onClick={goToday}>Log a weigh-in</button></div>
            )}
            <div className="chart-legend">
              <span><i className="lg-dot" />Daily weigh-in</span><span><i className="lg-line" />7-day average</span><span><i className="lg-band" />On track to floor</span>
            </div>
          </article>
          <article className="card">
            <header><h3>Week by week</h3><span className="aside">Mon – Sun</span></header>
            {weeks.length ? (
              <div className="tablewrap"><table>
                <thead><tr><th>Week</th><th>Starts</th><th>Avg lb</th><th>Target</th><th>vs target</th><th>Sessions</th><th>Run km</th><th>Step days</th><th>Avg kcal</th><th>Avg protein</th></tr></thead>
                <tbody>{weeks.map(w => <WeekRow key={w} data={data} E={all} w={w} start={start} />)}</tbody>
              </table></div>
            ) : <div className="empty">Weekly averages start filling in on {fmtDay(START)}.</div>}
          </article>
        </div>
        <div className="stack">
          <TimeTrials data={data} />
          <article className="card">
            <header><h3>Targets today</h3><span className="aside">{T.note}</span></header>
            <dl className="kv">
              <div><dt>Calories</dt><dd>{T.cal.toLocaleString()} kcal</dd></div>
              <div><dt>Protein</dt><dd>{T.pro} g</dd></div>
              <div><dt>Steps</dt><dd>{T.steps.toLocaleString()}</dd></div>
              {cp && <div><dt>Next checkpoint</dt><dd>{cp.target} lb · {fmtShort(cp.date)}</dd></div>}
            </dl>
            <p className="fine">To hold a different number for a while, set it in Settings.</p>
          </article>
          <article className="card">
            <header><h3>Lifts</h3><span className="aside">first → latest top set</span></header>
            {liftRows.length ? <div className="lifts-list">{liftRows}</div> : <div className="empty">Log sets on Monday or Friday to see each lift climb.</div>}
          </article>
        </div>
      </div>
    </section>
  );
}

function WeekRow({ data, E, w, start }: { data: Data; E: WeighIn[]; w: number; start: number }) {
  const L = weekLog(data, w);
  const wa = weekAvg(E, w);
  // A week's average sits mid-week, so it is compared with the plan's mid-week weight.
  const tgt = targetAfter(start, w - 0.5);
  const d = wa != null ? wa - tgt : null;
  return (
    <tr>
      <td className="wk">W{w}</td>
      <td className="when">{fmtShort(L.from)} · {phaseOfWeek(w).name}</td>
      <td data-l="Avg lb">{wa != null ? r1(wa).toFixed(1) : '—'}</td>
      <td data-l="Target">{r1(tgt).toFixed(1)}</td>
      <td data-l="vs target" className={d == null ? '' : d <= 0 ? 'down' : 'behind'}>{d != null ? sgn(d) : '—'}</td>
      <td data-l="Sessions">{L.planned ? `${L.done}/${L.planned}` : '—'}</td>
      <td data-l="Run km">{L.km != null ? L.km.toFixed(1) : '—'}</td>
      <td data-l="Step days">{L.stepDays}/7</td>
      <td data-l="Avg kcal">{L.cal != null ? Math.round(L.cal).toLocaleString() : '—'}</td>
      <td data-l="Avg protein">{L.pro != null ? `${Math.round(L.pro)} g` : '—'}</td>
    </tr>
  );
}

function WeightChart({ E, start }: { E: WeighIn[]; start: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(300, Math.round(el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = W < 520 ? 230 : 290;
  const m = { l: 38, r: 44, t: 22, b: 26 };
  const firstD = E[0].date, lastD = E[E.length - 1].date;
  // Look four weeks past the latest weigh-in (or day 1), never past race day.
  let x1 = addDays(lastD > START ? lastD : START, 28);
  if (x1 > END) x1 = END;
  if (x1 < lastD) x1 = lastD;
  const x0 = addDays(firstD < START ? firstD : START, -1);
  x1 = addDays(x1, 1);
  const span = diff(x1, x0);

  // The target band, one point a week from day 1 to the right edge.
  const bandTo = x1 > END ? END : x1;
  const band: { ds: string; hi: number; lo: number }[] = [];
  for (let ds = addDays(START, -1); ds <= bandTo; ds = addDays(ds, 7)) band.push({ ds, hi: floorAfter(start, weeksBy(ds)), lo: targetAfter(start, weeksBy(ds)) });
  if (band.length && band[band.length - 1].ds !== bandTo) band.push({ ds: bandTo, hi: floorOn(start, bandTo), lo: targetOn(start, bandTo) });

  const vals = [...E.map(e => e.w), ...band.flatMap(b => [b.hi, b.lo])];
  let lo = Math.min(...vals) - 1, hi = Math.max(...vals) + 1;
  const step = hi - lo > 40 ? 10 : hi - lo > 24 ? 5 : hi - lo > 10 ? 2 : 1;
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const X = (ds: string) => m.l + (diff(ds, x0) / span) * (W - m.l - m.r);
  const Y = (v: number) => m.t + ((hi - v) / (hi - lo)) * (H - m.t - m.b);

  const yTicks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) yTicks.push(v);
  const pxPerWeek = ((W - m.l - m.r) / span) * 7;
  const every = pxPerWeek >= 52 ? 7 : pxPerWeek >= 26 ? 14 : pxPerWeek >= 13 ? 28 : 56;
  const off = ((diff(x0, START) % 7) + 7) % 7;
  const xTicks: string[] = [];
  for (let ds = addDays(x0, (7 - off) % 7); ds <= x1; ds = addDays(ds, every)) xTicks.push(ds);

  const pts = E.map(e => [X(e.date), Y(avg7(E, e.date)!)] as const);
  const lp = pts[pts.length - 1];
  const la = avg7(E, lastD)!;
  const edge = band[band.length - 1];
  const xy = (ds: string, v: number) => `${X(ds).toFixed(1)},${Y(v).toFixed(1)}`;

  return (
    <div ref={ref} className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Body weight: ${E.length} weigh-ins, 7-day average ${r1(la)} lb, plan ${r1(targetOn(start, lastD))} lb`}>
        {yTicks.map(v => (
          <g key={v}>
            <line className="gl" x1={m.l} x2={W - m.r} y1={Y(v)} y2={Y(v)} />
            <text className="tx" x={m.l - 6} y={Y(v) + 4} textAnchor="end">{v}</text>
          </g>
        ))}
        {xTicks.map(ds => (
          <g key={ds}>
            <line className="gl" x1={X(ds)} x2={X(ds)} y1={H - m.b} y2={H - m.b + 4} />
            <text className="tx" x={X(ds)} y={H - 8} textAnchor="middle">{fmtShort(ds)}</text>
          </g>
        ))}
        {band.length > 1 && <>
          <polygon className="corr" points={[...band.map(b => xy(b.ds, b.hi)), ...[...band].reverse().map(b => xy(b.ds, b.lo))].join(' ')} />
          <polyline className="corr-edge" points={band.map(b => xy(b.ds, b.lo)).join(' ')} />
          <text className="tx" x={X(edge.ds) + 5} y={Y(edge.lo) + 4}>{Math.round(edge.lo)}</text>
          {edge.hi - edge.lo >= step && <text className="tx" x={X(edge.ds) + 5} y={Y(edge.hi) + 4}>{Math.round(edge.hi)}</text>}
        </>}
        {E.map(e => <circle key={e.date} className="dot" cx={X(e.date)} cy={Y(e.w)} r={3}><title>{`${fmtDay(e.date)}: ${e.w} lb`}</title></circle>)}
        {pts.length > 1 && <path className="avg" d={'M' + pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')} />}
        <circle className="endp" cx={lp[0]} cy={lp[1]} r={5} />
        <text className="endl" x={lp[0]} y={lp[1] - 11} textAnchor={lp[0] > W - m.r - 30 ? 'end' : 'middle'}>{r1(la).toFixed(1)}</text>
      </svg>
    </div>
  );
}

const hms = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

/** Every time trial and the race: the target, and the result from the watch or typed in by hand. */
function TimeTrials({ data }: { data: Data }) {
  const rows: { date: string; km: number; goal: number; result?: number; title: string }[] = [];
  for (let i = 0; i < TOTAL_DAYS; i++) {
    const ds = addDays(START, i), s = sessionOf(ds);
    if (!s?.goalSec || !s.km) continue;
    const log = data.days[ds];
    const typed = log?.min != null && (log.km == null || Math.abs(log.km - s.km) < 0.3) ? log.min * 60 : undefined;
    const fromWatch = hasGarmin(data) ? trialTime(matchActivity(data, ds, s), s.km)?.sec : undefined;
    rows.push({ date: ds, km: s.km, goal: s.goalSec, result: typed ?? fromWatch, title: s.tag === 'Race' ? 'Sun Run' : `${s.km}K time trial` });
  }
  return (
    <article className="card">
      <header><h3>Time trials</h3><span className="aside">target → result</span></header>
      <dl className="kv tt">
        {rows.map(r => (
          <div key={r.date}>
            <dt>{r.title} · {fmtShort(r.date)}</dt>
            <dd>
              {hms(r.goal)}
              {r.result != null && <span className={r.result <= r.goal ? 'down' : 'behind'}> → {hms(r.result)}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <p className="fine">Results come from your watch, or from the minutes you type in on the day.</p>
    </article>
  );
}
