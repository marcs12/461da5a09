import { useEffect } from 'react';
import { addDays, diff, fmtDay, fmtShort, num, parse, r1, sgn, today } from '../lib/dates';
import { DOW, EST_NOTE, EX, START, WEEKS, programDay, weekStart, type ProgramDay, type Session } from '../lib/program';
import { editDay, editSettings, type Data, type DayLog, type SetEntry } from '../lib/store';
import { avg7, calorieNudge, isDone, lastPerf, weights } from '../lib/stats';
import { Ribbon } from '../components/Ribbon';
import { Check, Icon, NumField } from '../components/ui';

interface Props { data: Data; date: string; setDate: (d: string) => void; onTimer: () => void }

export function Today({ data, date, setDate, onTimer }: Props) {
  const pd = programDay(date);
  const t = today();
  const log = data.days[date] || {};

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.querySelector('.timer, .sheet-back')) return;
      if (e.key === 'ArrowLeft') setDate(addDays(date, -1));
      if (e.key === 'ArrowRight') setDate(addDays(date, 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [date, setDate]);

  const eyebrow = pd.status === 'pre'
    ? (pd.daysUntil === 1 ? 'Program starts tomorrow' : `Program starts in ${pd.daysUntil} days`)
    : pd.status === 'post' ? 'Program complete'
    : `Week ${pd.week} of ${WEEKS} · ${pd.phase.name}${pd.phase.id !== 'brk' ? ' — ' + pd.phase.label : ''}`;
  const rel = date === t ? 'Today' : date === addDays(t, 1) ? 'Tomorrow' : date === addDays(t, -1) ? 'Yesterday' : '';

  return (
    <section>
      <div className="dayhead">
        <div className="datenav">
          <button className="iconbtn" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day"><Icon.prev /></button>
          <div className="grow">
            <div className="eyebrow">{eyebrow}{rel && <> · <span className="rel">{rel}</span></>}</div>
            <h1>{fmtDay(date)}</h1>
          </div>
          {date !== t && <button className="btn ghost todaybtn" onClick={() => setDate(t)}>Today</button>}
          <button className="iconbtn" onClick={() => setDate(addDays(date, 1))} aria-label="Next day"><Icon.next /></button>
        </div>
        <Ribbon date={date} />
        {pd.status === 'in' && <WeekStrip data={data} date={date} week={pd.week} setDate={setDate} />}
      </div>

      <div className="cols">
        <div className="stack">
          {pd.status === 'pre' && <PreStart setDate={setDate} />}
          {pd.status === 'post' && (
            <article className="session"><div className="pre">
              <div className="eyebrow">Jan 9, 2027 — done</div>
              <h2>{WEEKS} weeks complete</h2>
              <p className="tip">Your log is still here. Check Progress for the whole arc.</p>
            </div></article>
          )}
          {pd.status === 'in' && <SessionCard data={data} date={date} pd={pd} log={log} onTimer={onTimer} />}
        </div>
        <aside className="stack"><SideCards data={data} date={date} log={log} /></aside>
      </div>
    </section>
  );
}

function WeekStrip({ data, date, week, setDate }: { data: Data; date: string; week: number; setDate: (d: string) => void }) {
  const ws = weekStart(week), t = today();
  return (
    <div className="weekstrip">
      {DOW.map((name, i) => {
        const d = addDays(ws, i);
        const s = (programDay(d) as Extract<ProgramDay, { status: 'in' }>).session;
        const cls = ['wd', `k-${s.kind}`, s.kind !== 'break' && isDone(data, d, s) ? 'done' : '', d === date ? 'sel' : '', d === t ? 'today' : ''].join(' ');
        return (
          <button key={d} className={cls} onClick={() => setDate(d)} aria-label={`${fmtDay(d)}: ${s.title}`} aria-current={d === date ? 'date' : undefined}>
            <small>{name}</small><b>{parse(d).getDate()}</b><i />
          </button>
        );
      })}
    </div>
  );
}

function PreStart({ setDate }: { setDate: (d: string) => void }) {
  const s1 = (programDay(START) as Extract<ProgramDay, { status: 'in' }>).session;
  return (
    <article className="session"><div className="pre">
      <div className="eyebrow">Day 1 · {fmtDay(START)}</div>
      <h2>{s1.title}</h2>
      <p className="tip">{s1.lines[0]}. Log a baseline weigh-in today so the Oct 17 target has a starting point.</p>
      <div><button className="btn primary" onClick={() => setDate(START)}>See Day 1</button></div>
    </div></article>
  );
}

function SessionCard({ data, date, pd, log, onTimer }: { data: Data; date: string; pd: Extract<ProgramDay, { status: 'in' }>; log: DayLog; onTimer: () => void }) {
  const s = pd.session;
  const set = (patch: Partial<DayLog>) => editDay(date, d => Object.assign(d, patch));
  const effortHint = s.tag === 'Hard cardio' || s.tag === 'Intervals' ? '8' : s.tag === 'Tempo' ? '7' : '4';

  return (
    <>
      <article className={`session k-${s.kind}`}>
        <div className="session-head">
          <div className="session-meta">
            <span className={`chip k-${s.kind}`}>{s.tag}</span>
            {s.minutes != null && <span className="dur">{s.kind === 'strength' ? '~' : ''}{s.minutes} min</span>}
            {s.km != null && <span className="dur">{s.km} km</span>}
            {s.est && <span className="chip est" title={EST_NOTE}>≈ interpolated</span>}
          </div>
          <h2>{s.title}</h2>
          <ul className="rx">{s.lines.map(l => <li key={l}>{l}</li>)}</ul>
        </div>
        <div className="session-body">
          {s.kind === 'break' && <Check id="f-walk" checked={!!log.walk} onChange={v => set({ walk: v })} label="Walked today" />}
          {s.kind === 'rest' && <div className="actions"><Check id="f-done" checked={!!log.done} onChange={v => set({ done: v })} label="Walk done" /></div>}
          {(s.kind === 'cardio' || s.kind === 'strength') && (
            <div className="actions">
              {s.segments && <button className="btn primary" onClick={onTimer}><Icon.timer />Start interval timer</button>}
              <Check id="f-done" checked={!!log.done} onChange={v => set({ done: v })} label="Session done" />
            </div>
          )}
          {s.kind === 'cardio' && (
            <>
              <div className="fields">
                <div className="field"><label htmlFor="f-min">Minutes</label>
                  <NumField className="inp" id="f-min" inputMode="decimal" placeholder={s.minutes ? String(s.minutes) : ''} value={log.min} onCommit={v => set({ min: v })} /></div>
                <div className="field"><label htmlFor="f-km">Distance (km)</label>
                  <NumField className="inp" id="f-km" inputMode="decimal" placeholder={s.km ? String(s.km) : '—'} value={log.km} onCommit={v => set({ km: v })} /></div>
                <div className="field"><label htmlFor="f-rpe">Effort (1–10)</label>
                  <NumField className="inp" id="f-rpe" inputMode="numeric" placeholder={effortHint} value={log.rpe} onCommit={v => set({ rpe: v })} /></div>
              </div>
              {pd.phase.id !== 'p1' && <p className="tip"><b>Shins, knees or Achilles aching?</b> Repeat this week before moving on.</p>}
            </>
          )}
        </div>
      </article>

      {s.walk && (
        <article className="card walk">
          <div><h3>45-min easy treadmill walk</h3><p>These daily walks do a lot of the fat-burning work.</p></div>
          <Check id="f-walk" checked={!!log.walk} onChange={v => set({ walk: v })} label="Walked" />
        </article>
      )}
      {s.lifts && <LiftCard data={data} date={date} s={s} log={log} />}
    </>
  );
}

function LiftCard({ data, date, s, log }: { data: Data; date: string; s: Session; log: DayLog }) {
  const setEntry = (id: string, i: number, k: keyof SetEntry, v: number | undefined) =>
    editDay(date, d => {
      const ex = { ...(d.ex || {}) };
      const arr = [...(ex[id] || [])];
      while (arr.length <= i) arr.push({});
      const e = { ...arr[i] };
      if (v == null) delete e[k]; else e[k] = v;
      arr[i] = e;
      ex[id] = arr;
      d.ex = ex;
    });
  const addSet = (id: string, n: number) => {
    editDay(date, d => {
      const ex = { ...(d.ex || {}) };
      const arr = [...(ex[id] || [])];
      while (arr.length <= n) arr.push({});
      ex[id] = arr;
      d.ex = ex;
    });
    requestAnimationFrame(() => document.getElementById(`s-${id}-${n}-${EX[id].bw ? 'r' : 'w'}`)?.focus());
  };

  return (
    <article className="card">
      <header><h3>Log your sets</h3><span className="aside">{s.sets} sets · 8–15 reps</span></header>
      <div className="ex-list">
        {s.lifts!.map(id => {
          const ex = EX[id], logged = log.ex?.[id] || [], n = Math.max(s.sets || 3, logged.length);
          const unit = ex.unit || 'reps', last = lastPerf(data, id, date);
          let hint = ex.bw ? (unit === 'sec' ? 'Hold with clean form' : 'Controlled reps, full range') : 'First session — find a weight you can own';
          let up = false;
          let prefW: number | '' = '';
          if (last) {
            const ws = last.sets.map(x => num(x.w)).filter((x): x is number => x != null);
            const rs = last.sets.map(x => Number(x.r));
            const topW = ws.length ? Math.max(...ws) : null;
            prefW = topW ?? '';
            if (!ex.bw && unit === 'reps' && rs.length >= 2 && rs.every(r => r >= 15)) {
              hint = `Hit 15 on every set ${fmtShort(last.date)} → go ${topW != null ? topW + 5 + ' lb' : '+5 lb'}`;
              up = true;
              prefW = topW != null ? topW + 5 : '';
            } else {
              hint = `Last ${fmtShort(last.date)}: ${topW != null && !ex.bw ? topW + ' lb × ' : ''}${rs.join(' / ')}${unit === 'sec' ? ' s' : ''}`;
            }
          }
          return (
            <div className="ex" key={id}>
              <div className="ex-name">{ex.name}{ex.note && <span className="ex-note">{ex.note}</span>}</div>
              <div className={`hint ${up ? 'up' : ''}`}>{hint}</div>
              <div className="sets">
                {Array.from({ length: n }, (_, i) => {
                  const v = logged[i] || {};
                  const full = unit === 'reps' && (v.r ?? 0) >= 15;
                  return (
                    <div className={`set ${full ? 'full' : ''}`} key={i}>
                      <span className="sn">{i + 1}</span>
                      {!ex.bw && <>
                        <NumField id={`s-${id}-${i}-w`} inputMode="decimal" aria-label={`${ex.name} set ${i + 1} weight`}
                          placeholder={String(prefW)} value={v.w} onCommit={x => setEntry(id, i, 'w', x)} />
                        <span className="u">lb</span>
                      </>}
                      <NumField id={`s-${id}-${i}-r`} inputMode="numeric" aria-label={`${ex.name} set ${i + 1} ${unit}`}
                        placeholder={unit === 'sec' ? 'sec' : 'reps'} value={v.r} onCommit={x => setEntry(id, i, 'r', x)} />
                      <span className="u">{unit === 'sec' ? 's' : 'reps'}</span>
                    </div>
                  );
                })}
                <button className="addset" onClick={() => addSet(id, n)}>+ Set</button>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function SideCards({ data, date, log }: { data: Data; date: string; log: DayLog }) {
  const S = data.settings;
  const E = weights(data);
  const prev = [...E].reverse().find(e => e.date < date);
  const w = log.weight;
  const a7 = w != null ? avg7(E, date) : null;
  const start = E.length ? E[0].w : null;
  const dPrev = w != null && prev ? w - prev.w : null;
  const dStart = a7 != null && start != null && E[0].date !== date ? a7 - start : null;
  const cls = (v: number | null) => (v == null ? '' : v < 0 ? 'down' : v > 0 ? 'upc' : '');
  const nudge = calorieNudge(data);
  const set = (patch: Partial<DayLog>) => editDay(date, d => Object.assign(d, patch));

  const pct = (v: number | undefined, t: number) => Math.min(100, Math.round(((v || 0) / t) * 100));
  const { cal, pro, sleep } = log;

  return (
    <>
      <article className="card">
        <header><h3>Morning weigh-in</h3><span className="aside">{prev ? `last ${prev.w} lb · ${fmtShort(prev.date)}` : 'before breakfast'}</span></header>
        <div className="weigh-row">
          <NumField id="f-weight" inputMode="decimal" aria-label="Body weight in pounds" placeholder={prev ? String(prev.w) : '—'}
            value={w} onCommit={v => set({ weight: v })} />
          <span className="u">lb</span>
        </div>
        <dl className="minis">
          <div><dt>vs last</dt><dd className={cls(dPrev)}>{dPrev != null ? sgn(dPrev) : '—'}</dd></div>
          <div><dt>7-day avg</dt><dd>{a7 != null ? r1(a7).toFixed(1) : '—'}</dd></div>
          <div><dt>since start</dt><dd className={cls(dStart)}>{dStart != null ? sgn(dStart) : '—'}</dd></div>
        </dl>
        {nudge && <Nudge {...nudge} />}
      </article>

      <article className="card">
        <header><h3>Fuel & recovery</h3><span className="aside">drives the weight loss</span></header>
        <Meter id="f-cal" label="Calories" unit="kcal" value={cal} placeholder={S.calTarget} onCommit={v => set({ cal: v })}
          pct={pct(cal, S.calTarget)} tone={cal != null && cal > S.calTarget * 1.05 ? 'bad' : ''}
          note={`Target ${S.calTarget.toLocaleString()} · ${cal != null
            ? (S.calTarget - cal >= 0 ? `${(S.calTarget - cal).toLocaleString()} left` : `${(cal - S.calTarget).toLocaleString()} over`)
            : 'drop liquid calories & alcohol'}`} />
        <Meter id="f-pro" label="Protein" unit="g" value={pro} placeholder={S.proTarget} onCommit={v => set({ pro: v })}
          pct={pct(pro, S.proTarget)} tone={pro != null && pro < S.proTarget * 0.8 ? 'warn' : ''}
          note={`Target ${S.proTarget} g · protects muscle, keeps hunger down`} />
        <Meter id="f-sleep" label="Sleep" unit="h" value={sleep} placeholder={7.5} onCommit={v => set({ sleep: v })}
          pct={pct(sleep, 8)} tone={sleep != null && sleep < 7 ? 'warn' : ''}
          note="7–8 h · short sleep stalls fat loss and recovery" />
      </article>

      <article className="card">
        <header><h3><label htmlFor="f-note">Notes</label></h3></header>
        <textarea className="inp" id="f-note" placeholder="How it felt, what you swapped, anything aching…"
          value={log.note ?? ''} onChange={e => set({ note: e.target.value })} />
      </article>
    </>
  );
}

function Meter(p: { id: string; label: string; unit: string; value?: number; placeholder: number; onCommit: (v?: number) => void; pct: number; tone: string; note: string }) {
  return (
    <div className="meter">
      <div className="meter-top">
        <label htmlFor={p.id}>{p.label}</label>
        <NumField className="inp" id={p.id} inputMode="decimal" placeholder={String(p.placeholder)} value={p.value} onCommit={p.onCommit} />
        <span className="u">{p.unit}</span>
      </div>
      <div className="track"><i className={p.tone} style={{ width: `${p.pct}%` }} /></div>
      <small>{p.note}</small>
    </div>
  );
}

export function Nudge({ week, a, b, next }: { week: number; a: number; b: number; next: number }) {
  return (
    <div className="nudge">
      <div><b>Weekly average didn’t drop.</b> Week {week - 1}: {r1(b)} lb → week {week}: {r1(a)} lb. The plan says cut about 200 kcal.</div>
      <div><button className="btn" onClick={() => editSettings({ calTarget: next, cutWeek: week })}>Set calories to {next.toLocaleString()}</button></div>
    </div>
  );
}

export const initialDate = () => {
  const t = today();
  return diff(t, START) < 0 ? START : t;
};
