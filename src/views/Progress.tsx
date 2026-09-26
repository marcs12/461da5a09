import { useEffect, useRef, useState } from 'react';
import { addDays, avg, diff, fmtDay, fmtShort, num, r1, sgn, today } from '../lib/dates';
import { EX, P1_END, P1_TARGET, START, WEEKS, phaseOfWeek, programDay, sessionOf, weekStart } from '../lib/program';
import { adherence, avg7, calorieNudge, sortedKeys, weekAvg, weights, type WeighIn } from '../lib/stats';
import { editSettings, type Data } from '../lib/store';
import { NumField } from '../components/ui';
import { Nudge } from './Today';

export function Progress({ data, goToday }: { data: Data; goToday: () => void }) {
  const E = weights(data), S = data.settings;
  const start = E.length ? E[0].w : null;
  const last = E.length ? E[E.length - 1] : null;
  const a7 = last ? avg7(E, last.date) : null;
  const change = a7 != null && start != null && E.length > 1 ? a7 - start : null;
  const adh = adherence(data);
  const nudge = calorieNudge(data);

  const pdT = programDay(today());
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

  const cls = (v: number | null) => (v == null ? '' : v < 0 ? 'down' : 'upc');

  return (
    <section>
      <div className="pagehead"><div><h1>Progress</h1><p>Judge the trend by weekly averages, not single weigh-ins.</p></div></div>
      <dl className="tiles">
        <div className="tile"><dt>7-day average</dt><dd>{a7 != null ? r1(a7).toFixed(1) : '—'}<small>lb</small></dd>
          <p>{last ? `latest ${last.w} lb · ${fmtShort(last.date)}` : 'no weigh-ins yet'}</p></div>
        <div className="tile"><dt>Since start</dt><dd className={cls(change)}>{change != null ? sgn(change) : '—'}<small>lb</small></dd>
          <p>{start != null ? `from ${start} lb · ${fmtShort(E[0].date)}` : 'first weigh-in sets the baseline'}</p></div>
        <div className="tile"><dt>{fmtShort(P1_END)} target</dt><dd>{start != null ? `${r1(start - P1_TARGET[1])}–${r1(start - P1_TARGET[0])}` : `−${P1_TARGET[0]} to −${P1_TARGET[1]}`}<small>lb</small></dd>
          <p>Week 1 drops faster (water weight)</p></div>
        <div className="tile"><dt>Sessions done</dt><dd>{adh.done}<small>/ {adh.sched}</small></dd>
          <p>walks {adh.wDone} / {adh.wSched}</p></div>
      </dl>

      <div className="prog-grid">
        <div className="stack">
          <article className="card">
            <header><h3>Body weight</h3><span className="aside">lb</span></header>
            {E.length ? <WeightChart E={E} /> : (
              <div className="empty">Log a weigh-in on the Today tab. Your 7-day average and the {fmtShort(P1_END)} target corridor appear here.
                <button className="btn" onClick={goToday}>Go to Today</button></div>
            )}
            <div className="chart-legend">
              <span><i className="lg-dot" />Daily weigh-in</span><span><i className="lg-line" />7-day average</span><span><i className="lg-band" />Phase 1 target corridor</span>
            </div>
          </article>
          {nudge && <article className="card"><Nudge {...nudge} /></article>}
          <article className="card">
            <header><h3>Week by week</h3><span className="aside">Sun – Sat</span></header>
            {weeks.length ? (
              <div className="tablewrap"><table>
                <thead><tr><th>Week</th><th>Starts</th><th>Avg lb</th><th>Δ</th><th>Sessions</th><th>Walks</th><th>Avg kcal</th><th>Avg protein</th></tr></thead>
                <tbody>{weeks.map(w => <WeekRow key={w} data={data} E={E} w={w} />)}</tbody>
              </table></div>
            ) : <div className="empty">Weekly averages start filling in on {fmtDay(START)}.</div>}
          </article>
        </div>
        <div className="stack">
          <article className="card">
            <header><h3>Lifts</h3><span className="aside">first → latest top set</span></header>
            {liftRows.length ? <div className="lifts-list">{liftRows}</div> : <div className="empty">Log sets on Mon, Wed or Sat — or the Friday complex — to see each lift climb.</div>}
          </article>
          <article className="card">
            <header><h3>Daily targets</h3></header>
            <div className="fields">
              <div className="field"><label htmlFor="st-cal">Calories (kcal)</label>
                <NumField className="inp" id="st-cal" inputMode="numeric" value={S.calTarget} onCommit={v => v && v > 0 && editSettings({ calTarget: Math.round(v) })} /></div>
              <div className="field"><label htmlFor="st-pro">Protein (g)</label>
                <NumField className="inp" id="st-pro" inputMode="numeric" value={S.proTarget} onCommit={v => v && v > 0 && editSettings({ proTarget: Math.round(v) })} /></div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function WeekRow({ data, E, w }: { data: Data; E: WeighIn[]; w: number }) {
  const ws = weekStart(w);
  const wa = weekAvg(E, w), pa = w > 1 ? weekAvg(E, w - 1) : null;
  let s = 0, dn = 0, wk = 0;
  const cals: number[] = [], pros: number[] = [];
  for (let i = 0; i < 7; i++) {
    const ds = addDays(ws, i), se = sessionOf(ds)!, l = data.days[ds] || {};
    if (se.kind === 'cardio' || se.kind === 'strength') { s++; if (l.done) dn++; }
    if (l.walk || (se.kind === 'rest' && l.done)) wk++;
    if (l.cal != null) cals.push(l.cal);
    if (l.pro != null) pros.push(l.pro);
  }
  const dl = wa != null && pa != null ? wa - pa : null;
  const ph = phaseOfWeek(w);
  const ac = avg(cals), ap = avg(pros);
  return (
    <tr>
      <td className="wk">W{w}</td>
      <td className="when">{fmtShort(ws)} · {ph.id === 'brk' ? 'Break' : ph.label}</td>
      <td data-l="Avg lb">{wa != null ? r1(wa).toFixed(1) : '—'}</td>
      <td data-l="Δ" className={dl == null ? '' : dl < 0 ? 'down' : 'upc'}>{dl != null ? sgn(dl) : '—'}</td>
      <td data-l="Sessions">{s ? `${dn}/${s}` : '—'}</td>
      <td data-l="Walks">{wk}</td>
      <td data-l="Avg kcal">{ac != null ? Math.round(ac).toLocaleString() : '—'}</td>
      <td data-l="Avg protein">{ap != null ? `${Math.round(ap)} g` : '—'}</td>
    </tr>
  );
}

function WeightChart({ E }: { E: WeighIn[] }) {
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
  const startW = E[0].w, firstD = E[0].date;
  const showCorr = diff(firstD, P1_END) < 0;
  let x1 = E[E.length - 1].date;
  if (showCorr && x1 < P1_END) x1 = P1_END;
  if (diff(x1, firstD) < 14) x1 = addDays(firstD, 14);
  const x0 = addDays(firstD, -1);
  x1 = addDays(x1, 1);
  const span = diff(x1, x0);
  const vals = E.map(e => e.w);
  if (showCorr) vals.push(startW - P1_TARGET[1]);
  let lo = Math.min(...vals) - 1, hi = Math.max(...vals) + 1;
  const step = hi - lo > 24 ? 5 : hi - lo > 10 ? 2 : 1;
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const X = (ds: string) => m.l + (diff(ds, x0) / span) * (W - m.l - m.r);
  const Y = (v: number) => m.t + ((hi - v) / (hi - lo)) * (H - m.t - m.b);

  const yTicks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) yTicks.push(v);
  const pxPerWeek = ((W - m.l - m.r) / span) * 7;
  const every = pxPerWeek >= 52 ? 7 : pxPerWeek >= 26 ? 14 : 28;
  const off = ((diff(x0, START) % 7) + 7) % 7;
  const xTicks: string[] = [];
  for (let ds = addDays(x0, (7 - off) % 7); ds <= x1; ds = addDays(ds, every)) xTicks.push(ds);

  const pts = E.map(e => [X(e.date), Y(avg7(E, e.date)!)] as const);
  const lp = pts[pts.length - 1];
  const la = avg7(E, E[E.length - 1].date)!;
  const bx = X(P1_END), ax = X(firstD), ay = Y(startW);

  return (
    <div ref={ref} className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Body weight: ${E.length} weigh-ins, 7-day average ${r1(la)} lb`}>
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
        {showCorr && <>
          <polygon className="corr" points={`${ax},${ay} ${bx},${Y(startW - P1_TARGET[0])} ${bx},${Y(startW - P1_TARGET[1])}`} />
          <polyline className="corr-edge" points={`${bx},${Y(startW - P1_TARGET[0])} ${ax},${ay} ${bx},${Y(startW - P1_TARGET[1])}`} />
          <text className="tx" x={bx + 5} y={Y(startW - P1_TARGET[0]) + 4}>−{P1_TARGET[0]}</text>
          <text className="tx" x={bx + 5} y={Y(startW - P1_TARGET[1]) + 4}>−{P1_TARGET[1]}</text>
        </>}
        {E.map(e => <circle key={e.date} className="dot" cx={X(e.date)} cy={Y(e.w)} r={3}><title>{`${fmtDay(e.date)}: ${e.w} lb`}</title></circle>)}
        {pts.length > 1 && <path className="avg" d={'M' + pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')} />}
        <circle className="endp" cx={lp[0]} cy={lp[1]} r={5} />
        <text className="endl" x={lp[0]} y={lp[1] - 11} textAnchor={lp[0] > W - m.r - 30 ? 'end' : 'middle'}>{r1(la).toFixed(1)}</text>
      </svg>
    </div>
  );
}
