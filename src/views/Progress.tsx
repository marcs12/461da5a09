import { useEffect, useRef, useState } from 'react';
import { addDays, diff, fmtDay, fmtShort, r1, sgn, today } from '../lib/dates';
import { END, START, TOTAL_DAYS, WEEKS, phaseOfWeek, programDay, sessionOf, weekStart } from '../lib/program';
import { hasGarmin, matchActivity, trialTime } from '../lib/garmin';
import { floorAfter, floorOn, nextCheckpoint, targetAfter, targetOn, targetsOn, weeksBy } from '../lib/targets';
import { avg7, weekAvg, weekLog, weights, type WeighIn } from '../lib/stats';
import { BASE_10K, GOAL_10K, SUB60, body, engine, habits, milestones, overall, raceDayLeft, speed, strength } from '../lib/progress';
import { Arc, Bar, Columns, LineChart } from '../components/Charts';
import type { Data } from '../lib/store';

/** Weigh-ins from the month before day 1 give the chart its run-in. */
const CHART_FROM = addDays(START, -28);

export function Progress({ data, goToday }: { data: Data; goToday: () => void }) {
  const t = today();
  const pdT = programDay(t);
  const B = body(data, t), S = speed(data, t), Hb = habits(data, t), En = engine(data, t), St = strength(data);
  const O = overall(data, t);
  const M = milestones(data, t);
  const got = M.filter(m => m.at).sort((a, b) => b.at!.localeCompare(a.at!));
  const next = M.filter(m => !m.at).sort((a, b) => b.progress - a.progress);
  const curWeek = pdT.status === 'pre' ? 0 : pdT.status === 'post' ? WEEKS : pdT.week;
  const weeks = Array.from({ length: curWeek }, (_, i) => curWeek - i);
  const all = weights(data);
  const left = raceDayLeft(t);
  const vsPlan = B.now != null && B.plan != null ? B.now - B.plan : null;
  const garmin = hasGarmin(data);

  return (
    <section className="prog">
      <div className="pagehead"><div><h1>Progress</h1><p>How far you’ve come, and how close the goals are.</p></div></div>

      <article className="hero-card">
        <Arc pct={O.pct}>
          <div className="arc-pct">{pctText(O.pct)}</div>
          <div className="arc-sub">of the way</div>
        </Arc>
        <div className="hero-side">
          <p className="hero-line">{heroLine(O.pct, B.lost, left)}</p>
          <ul className="parts">
            <PartRow name="Body" pct={B.pct} detail={B.now == null ? 'log a weigh-in' : B.lost > 0 ? `${r1(B.lost).toFixed(1)} of ${Math.round(B.start - B.goal)} lb` : `${Math.round(B.start - B.goal)} lb to go`} />
            <PartRow name="Speed" pct={S.pct} detail={S.est != null ? `10K about ${hms(S.est)}` : 'first time trial Dec 20'} muted={S.est == null} />
            <PartRow name="Training" pct={Hb.plan} detail={Hb.sched ? `${Hb.done} of ${Hb.total} sessions in the plan` : 'starts Oct 26'} muted={!Hb.sched} />
          </ul>
          <dl className="hero-facts">
            <div><dt>Sun Run</dt><dd>{left > 0 ? `${left} days` : left === 0 ? 'today' : 'done'}</dd></div>
            <div><dt>Phase</dt><dd>{pdT.status === 'in' ? `${pdT.phase.name} · week ${pdT.week}` : pdT.status === 'pre' ? 'starts Oct 26' : 'complete'}</dd></div>
            <div><dt>Plan</dt><dd className={vsPlan == null ? '' : vsPlan <= 0.05 ? 'down' : 'behind'}>{vsPlan == null ? '—' : Math.abs(vsPlan) < 0.05 ? 'on plan' : vsPlan < 0 ? `${r1(-vsPlan).toFixed(1)} lb ahead` : `${r1(vsPlan).toFixed(1)} lb behind`}</dd></div>
          </dl>
        </div>
      </article>

      {next[0] && (
        <article className="nextup">
          <span className="nextup-k">Next milestone</span>
          <b>{next[0].title}</b>
          <Bar pct={next[0].progress} />
          <span className="nextup-p">{pctText(next[0].progress)} there · {next[0].detail}</span>
        </article>
      )}

      <div className="goal-grid">
        <article className="card goal">
          <header><h3>Body</h3><span className="aside">goal {B.goal} lb by Apr 18</span></header>
          <div className="big-row">
            <div className="big"><b className={B.lost > 0 ? 'down' : ''}>{B.lost > 0 ? '−' : ''}{r1(Math.abs(B.lost)).toFixed(1)}</b><span>lb since day 1</span></div>
            <div className="big right"><b>{B.now != null ? r1(B.toGo).toFixed(1) : '—'}</b><span>lb to go</span></div>
          </div>
          <Bar pct={B.pct} marks={B.checkpoints.map(c => ({ at: (B.start - c.target) / (B.start - B.goal), label: String(c.target), hit: c.reached }))} />
          <dl className="stats4">
            <div><dt>7-day average</dt><dd>{B.now != null ? r1(B.now).toFixed(1) : '—'}</dd></div>
            <div><dt>Pace</dt><dd>{B.perWeek != null ? `${sgn(B.perWeek)} lb/wk` : '—'}</dd></div>
            <div><dt>Race day at this pace</dt><dd>{B.projected != null ? `${r1(B.projected).toFixed(0)} lb` : '—'}</dd></div>
            <div><dt>Body fat</dt><dd>{B.bodyFat != null ? `${B.bodyFat}%` : '—'}</dd></div>
          </dl>
          {all.length ? <WeightChart E={all.filter(e => e.date >= CHART_FROM)} start={B.start} /> : (
            <div className="empty">Log a weigh-in on Today to start the chart.<button className="btn" onClick={goToday}>Log a weigh-in</button></div>
          )}
          <div className="chart-legend">
            <span><i className="lg-dot" />Daily weigh-in</span><span><i className="lg-line" />7-day average</span><span><i className="lg-band" />On track to floor</span>
          </div>
        </article>

        <article className="card goal">
          <header><h3>Speed</h3><span className="aside">10K: {hms(BASE_10K)} in April → {hms(GOAL_10K)}</span></header>
          <div className="big-row">
            <div className="big"><b>{S.est != null ? hms(S.est) : '—'}</b><span>10K you could run now</span></div>
            <div className="big right"><b>{pctText(S.pct)}</b><span>to {hms(GOAL_10K)}</span></div>
          </div>
          <Bar pct={S.pct} marks={[{ at: (BASE_10K - SUB60) / (BASE_10K - GOAL_10K), label: '60:00', hit: S.est != null && S.est <= SUB60 }]} />
          <dl className="stats4">
            <div><dt>Best 5K</dt><dd>{S.best5k ? hms(S.best5k.sec) : '—'}</dd></div>
            <div><dt>Best 10K</dt><dd>{S.best10k ? hms(S.best10k.sec) : '—'}</dd></div>
            <div><dt>Sub-60 attempt</dt><dd>Jan 31</dd></div>
            <div><dt>Total run</dt><dd>{garmin ? `${Math.round(Hb.totalKm)} km` : '—'}</dd></div>
          </dl>
          <p className="chart-title">Predicted 10K, best effort each week</p>
          <LineChart points={S.series} refs={[{ y: SUB60, label: '60:00', tone: 'mark' }, { y: GOAL_10K, label: hms(GOAL_10K), tone: 'goal' }]}
            fmt={hms} unit={60} label="Predicted 10K time" color="var(--cardio)" />
          <p className="fine">Predicted from your fastest stretch of laps each week with Riegel’s formula, so hard sessions count most. Time trials make it sharpest.</p>
        </article>

        <article className="card goal">
          <header><h3>Engine</h3><span className="aside">what the training is doing inside</span></header>
          <div className="big-row">
            <div className="big"><b className={En.rhr && En.rhr.last < En.rhr.first ? 'down' : ''}>{En.rhr ? `${sgn(En.rhr.last - En.rhr.first).replace('.0', '')}` : '—'}</b><span>resting heart rate, bpm</span></div>
            <div className="big right"><b className={En.efficiency && En.efficiency.change > 0 ? 'down' : ''}>{En.efficiency ? `${En.efficiency.change >= 0 ? '+' : '−'}${Math.abs(Math.round(En.efficiency.change * 100))}%` : '—'}</b><span>distance per heartbeat</span></div>
          </div>
          <dl className="stats4">
            <div><dt>Resting HR now</dt><dd>{En.rhr ? `${Math.round(En.rhr.last)} bpm` : '—'}</dd></div>
            <div><dt>HRV now</dt><dd>{En.hrv ? `${Math.round(En.hrv.last)} ms` : '—'}</dd></div>
            <div><dt>At the start</dt><dd>{En.rhr ? `${Math.round(En.rhr.first)} bpm` : '—'}</dd></div>
            <div><dt>Easy-run HR</dt><dd>{En.easyPace?.avgHR ? `${En.easyPace.avgHR} bpm` : '—'}</dd></div>
          </dl>
          <p className="chart-title">Resting heart rate, weekly average</p>
          {garmin ? <LineChart points={En.rhrWeekly} fmt={v => String(Math.round(v))} label="Resting heart rate" color="var(--strength)" /> : <WatchNote />}
          <p className="fine">A falling resting heart rate and more distance per heartbeat on easy runs mean your heart is getting fitter, often weeks before race times show it.</p>
        </article>

        <article className="card goal">
          <header><h3>Habits</h3><span className="aside">what gets you there</span></header>
          <div className="big-row">
            <div className="big"><b>{pctText(Hb.sessions)}</b><span>sessions done</span></div>
            <div className="big right"><b>{Hb.stepStreak}</b><span>day step streak</span></div>
          </div>
          <div className="habit-bars">
            <div><span>Sessions</span><Bar pct={Hb.sessions} /><b>{Hb.done}/{Hb.sched}</b></div>
            <div><span>Step goal</span><Bar pct={Hb.steps} /><b>{Hb.stepDays}/{Hb.days}</b></div>
          </div>
          <p className="chart-title">Running per week, km</p>
          {garmin ? <Columns bars={Hb.weeks} fmt={v => (v >= 10 ? String(Math.round(v)) : v.toFixed(1).replace('.0', ''))} label="Running per week" current={pdT.status === 'in' ? weekStart(pdT.week) : undefined} /> : <WatchNote />}
        </article>

        <article className="card goal">
          <header><h3>Strength</h3><span className="aside">top set, first session → latest</span></header>
          {St.lifts.length ? (
            <>
              <div className="big-row">
                <div className="big"><b className={St.gain && St.gain > 0 ? 'down' : ''}>{St.gain != null ? `+${Math.round(St.gain * 100)}%` : '—'}</b><span>average gain</span></div>
                <div className="big right"><b>{St.improved}/{St.lifts.length}</b><span>lifts heavier</span></div>
              </div>
              <ul className="lift-bars">
                {St.lifts.map(l => (
                  <li key={l.id}>
                    <span>{l.name}</span>
                    <Bar pct={l.max ? l.now / l.max : 1} />
                    <b>{l.first === l.now ? `${l.now} lb` : `${l.first} → ${l.now} lb`}</b>
                  </li>
                ))}
              </ul>
              <p className="fine">Bars fill toward the heaviest your kettlebell (44 lb) or dumbbell (50 lb) goes.</p>
            </>
          ) : <div className="empty">Log your sets on Monday and Friday to see each lift climb.</div>}
        </article>

        <TimeTrials data={data} />
      </div>

      <section className="miles" aria-labelledby="miles-h">
        <div className="zone-head"><h2 id="miles-h">Milestones</h2><small>{got.length} of {M.length} unlocked</small></div>
        <ul className="badges">
          {[...got, ...next].map(m => (
            <li key={m.id} className={m.at ? 'got' : ''}>
              <span className="badge-k">{m.group}</span>
              <b>{m.title}</b>
              {m.at ? <span className="badge-d">{fmtShort(m.at)}</span> : <><Bar pct={m.progress} /><span className="badge-d">{pctText(m.progress)}</span></>}
            </li>
          ))}
        </ul>
      </section>

      <details className="card more">
        <summary>Week by week, targets and the details</summary>
        <div className="more-in">
          <TargetsCard data={data} t={t} />
          {weeks.length ? (
            <div className="tablewrap"><table>
              <thead><tr><th>Week</th><th>Starts</th><th>Avg lb</th><th>Target</th><th>vs target</th><th>Sessions</th><th>Run km</th><th>Step days</th><th>Avg kcal</th><th>Avg protein</th></tr></thead>
              <tbody>{weeks.map(w => <WeekRow key={w} data={data} E={all} w={w} start={B.start} />)}</tbody>
            </table></div>
          ) : <div className="empty">Weekly averages start filling in on {fmtDay(START)}.</div>}
        </div>
      </details>
    </section>
  );
}

const pctText = (p: number) => `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
function heroLine(pct: number, lost: number, left: number) {
  if (left < 0) return 'The Sun Run is done. Look at what you built.';
  if (pct >= 0.99) return 'Every goal reached. Now it’s about keeping it.';
  if (lost <= 0) return 'Day 1 is the hardest number to move. Everything below fills in from here.';
  if (pct < 0.25) return `${r1(lost).toFixed(1)} lb gone already. The first quarter is the slowest; it speeds up from here.`;
  if (pct < 0.5) return `Closing in on halfway, with ${left} days left to finish the job.`;
  if (pct < 0.75) return `Past halfway. Every week from here is a week closer than the last.`;
  return `The last stretch. ${left} days to bring it home.`;
}

function PartRow({ name, pct, detail, muted }: { name: string; pct: number; detail: string; muted?: boolean }) {
  return (
    <li className={muted ? 'muted' : ''}>
      <div className="part-top"><span>{name}</span><b>{pctText(pct)}</b></div>
      <Bar pct={pct} />
      <small>{detail}</small>
    </li>
  );
}

function WatchNote() {
  return <div className="empty chart-empty">Connect the Garmin sync to fill this in. Settings has the steps.</div>;
}

function TargetsCard({ data, t }: { data: Data; t: string }) {
  const T = targetsOn(data.settings, t), cp = nextCheckpoint(t);
  return (
    <dl className="kv">
      <div><dt>Calories today</dt><dd>{T.cal.toLocaleString()} kcal</dd></div>
      <div><dt>Protein</dt><dd>{T.pro} g</dd></div>
      <div><dt>Steps</dt><dd>{T.steps.toLocaleString()}</dd></div>
      {cp && <div><dt>Next checkpoint</dt><dd>{cp.target} lb · {fmtShort(cp.date)}</dd></div>}
    </dl>
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
