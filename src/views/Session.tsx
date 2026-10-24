import { useEffect } from 'react';
import { addDays, fmtDay, fmtShort, num, parse, r1, sgn, today } from '../lib/dates';
import { DOW, END, EX, KB_COMPLEX, KB_COMPLEX_REPS, KB_COMPLEX_START_LB, KB_WEIGHTS, START, WEEKS, WEEK_NOTES, bridgeSession, programDay, weekStart, type ProgramDay, type Session } from '../lib/program';
import { AFTER, BEACH, CAL_FLOOR, CHECKPOINTS, GOAL_WEIGHT, startWeight, targetOn, targetsOn } from '../lib/targets';
import { editDay, editSet, type Data, type DayLog } from '../lib/store';
import { avg7, isDone, lastPerf, weights } from '../lib/stats';
import { Ribbon } from '../components/Ribbon';
import { Check, Icon, NumField } from '../components/ui';

interface Props { data: Data; date: string; setDate: (d: string) => void; onTimer: () => void; openGuide: () => void }
type InDay = Extract<ProgramDay, { status: 'in' }>;

export function SessionDay({ data, date, setDate, onTimer, openGuide }: Props) {
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

  const bridge = pd.status === 'pre' ? bridgeSession(date) : null;
  const eyebrow = bridge ? 'Before Vietnam'
    : pd.status === 'pre'
    ? (pd.daysUntil === 1 ? 'Training starts tomorrow' : `Training starts in ${pd.daysUntil} days`)
    : pd.status === 'post' ? 'Plan complete'
    : `Week ${pd.week} of ${WEEKS} · ${pd.phase.name}`;
  const rel = date === t ? 'Today' : date === addDays(t, 1) ? 'Tomorrow' : date === addDays(t, -1) ? 'Yesterday' : '';
  const note = pd.status === 'in' ? WEEK_NOTES[pd.week] : undefined;

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
        {note && <p className="weeknote"><b>This week.</b> {note}</p>}
      </div>

      <div className="cols">
        <div className="stack">
          {bridge && <SessionCard data={data} date={date} s={bridge} log={log} onTimer={onTimer} />}
          {pd.status === 'pre' && <PreStart date={date} setDate={setDate} />}
          {pd.status === 'post' && <AfterRace openGuide={openGuide} />}
          {pd.status === 'in' && <SessionCard data={data} date={date} s={pd.session} log={log} onTimer={onTimer} />}
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
        const s = (programDay(d) as InDay).session;
        const cls = ['wd', `k-${s.kind}`, isDone(data, d) ? 'done' : '', d === date ? 'sel' : '', d === t ? 'today' : ''].join(' ');
        return (
          <button key={d} className={cls} onClick={() => setDate(d)} aria-label={`${fmtDay(d)}: ${s.title}`} aria-current={d === date ? 'date' : undefined}>
            <small>{name}</small><b>{parse(d).getDate()}</b><i />
          </button>
        );
      })}
    </div>
  );
}

/** What to do between now and day 1. */
const PREP: { from: string; to: string; when: string; items: string[] }[] = [
  { from: '0000-00-00', to: '2026-10-15', when: 'Before Vietnam, to Oct 15', items: ['Kettlebell complex Mon, Oct 12, Wed, Oct 14 and Thu, Oct 15 (morning), a brisk walk Tue, Oct 13', 'Register for the Sun Run', 'Get fitted for proper running shoes'] },
  { from: '2026-10-16', to: '2026-10-24', when: 'Vietnam, Oct 15 to 24', items: ['Don’t diet. Walk 10,000 or more steps a day and enjoy the food'] },
  { from: '2026-10-25', to: '2026-10-25', when: 'Sun, Oct 25', items: ['Grocery shop for your repeat meals', 'Weigh in: it sets your starting number'] },
];
function PreStart({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const s1 = (programDay(START) as InDay).session;
  return (
    <article className="session"><div className="pre">
      <div className="eyebrow">Day 1 · {fmtDay(START)}</div>
      <h2>Before you start</h2>
      {PREP.map(p => (
        <div key={p.when} className={`prep ${date >= p.from && date <= p.to ? 'now' : ''}`}>
          <b>{p.when}</b>
          <ul className="focus">{p.items.map(i => <li key={i}>{i}</li>)}</ul>
        </div>
      ))}
      <p className="tip">Day 1 is {s1.title}. The 25 weeks run to the Sun Run on {fmtDay(END)}.</p>
      <div><button className="btn primary" onClick={() => setDate(START)}>See day 1</button></div>
    </div></article>
  );
}

function AfterRace({ openGuide }: { openGuide: () => void }) {
  return (
    <article className="session"><div className="pre">
      <div className="eyebrow">{fmtShort(END)} · done</div>
      <h2>{WEEKS} weeks complete</h2>
      <ul className="focus">
        <li>Until Hawaii: {BEACH.cal.toLocaleString()} kcal, {BEACH.pro} g protein, {BEACH.steps.toLocaleString()} steps, and both strength days</li>
        <li>The last three days before you fly: easy on salt and alcohol, plenty of water. Less water under the skin, so more definition shows</li>
        <li>After Hawaii and still above {GOAL_WEIGHT} lb? Keep the last tier going, never under {CAL_FLOOR.toLocaleString()} kcal</li>
        <li>At your weight: add 150 kcal a week until it holds steady, around {AFTER.cal.toLocaleString()}</li>
        <li>Keep the weekly average. Five pounds up means two weeks back at 1,600</li>
        <li>Keep the protein and both strength days, and book the next race</li>
      </ul>
      <div><button className="btn" onClick={openGuide}>Keeping it off</button></div>
    </div></article>
  );
}

function SessionCard({ data, date, s, log, onTimer }: { data: Data; date: string; s: Session; log: DayLog; onTimer: () => void }) {
  const set = (patch: Partial<DayLog>) => editDay(date, d => Object.assign(d, patch));
  const maint = date === '2026-12-24' || date === '2026-12-25';

  return (
    <>
      <article className={`session k-${s.kind}`}>
        <div className="session-head">
          <div className="session-meta">
            <span className={`chip k-${s.kind}`}>{s.tag}</span>
            {s.minutes != null && <span className="dur">{s.kind === 'strength' ? '~' : ''}{s.minutes} min</span>}
            {s.km != null && <span className="dur">{s.km} km</span>}
          </div>
          <h2>{s.title}</h2>
          <ul className="rx">{s.lines.map(l => <li key={l}>{l}</li>)}{maint && <li>Eat at maintenance today</li>}</ul>
        </div>
        <div className="session-body">
          {s.kind === 'rest' ? (
            <div className="actions"><Check id="f-done" checked={!!log.done} onChange={v => set({ done: v })} label="Rested" /></div>
          ) : (
            <div className="actions">
              {s.segments && <button className="btn primary" onClick={onTimer}><Icon.timer />Start interval timer</button>}
              <Check id="f-done" checked={!!log.done} onChange={v => set({ done: v })} label="Session done" />
            </div>
          )}
          {s.amrap && <ComplexFields data={data} date={date} s={s} log={log} set={set} />}
          {s.kind === 'cardio' && (
            <>
              <div className="fields">
                <div className="field"><label htmlFor="f-min">Minutes</label>
                  <NumField className="inp" id="f-min" inputMode="decimal" placeholder={s.minutes ? String(s.minutes) : '—'} value={log.min} onCommit={v => set({ min: v })} /></div>
                <div className="field"><label htmlFor="f-km">Distance (km)</label>
                  <NumField className="inp" id="f-km" inputMode="decimal" placeholder={s.km ? String(s.km) : '—'} value={log.km} onCommit={v => set({ km: v })} /></div>
                <div className="field"><label htmlFor="f-rpe">Effort (1–10)</label>
                  <NumField className="inp" id="f-rpe" inputMode="numeric" placeholder={String(s.effort ?? 4)} value={log.rpe} onCommit={v => set({ rpe: v })} /></div>
              </div>
              {log.min != null && log.km != null && log.km > 0 && <div className="hint">Pace {fmtPace(log.min / log.km)}</div>}
              {s.tag !== 'Low impact' && s.tag !== 'Walk' && <p className="tip"><b>Shin or knee pain (pain, not soreness)?</b> Swap this run for a treadmill walk.</p>}
            </>
          )}
        </div>
      </article>
      {s.lifts && <LiftCard data={data} date={date} s={s} log={log} />}
      {s.moves && <ComplexCard s={s} />}
    </>
  );
}

/** What to load next time, from the last logged complex: up 5 lb once rounds reach a third of the minutes (about 3 minutes a round). */
function complexHint(data: Data, date: string, s: Session): { hint: string; up: boolean; prefW: number } {
  const id = s.logAs!, max = EX[id]?.max ?? Infinity, min = s.amrap!;
  const last = lastPerf(data, id, date);
  if (!last) return { hint: `First time: start around ${KB_COMPLEX_START_LB} lb`, up: false, prefW: KB_COMPLEX_START_LB };
  const w = num(last.sets[0].w), r = Number(last.sets[0].r), when = fmtShort(last.date);
  if (w == null) return { hint: `Last ${when}: ${r} rounds`, up: false, prefW: KB_COMPLEX_START_LB };
  if (r >= min / 3) {
    return w + 5 <= max
      ? { hint: `${r} rounds in ${min} min ${when} → go ${w + 5} lb`, up: true, prefW: w + 5 }
      : { hint: `${r} rounds at ${w} lb, as heavy as it goes: chase rounds`, up: true, prefW: w };
  }
  return { hint: `Last ${when}: ${w} lb × ${r} rounds. Beat it`, up: false, prefW: w };
}

function ComplexFields({ data, date, s, log, set }: { data: Data; date: string; s: Session; log: DayLog; set: (p: Partial<DayLog>) => void }) {
  const { hint, up, prefW } = complexHint(data, date, s);
  const id = s.logAs!, v = log.ex?.[id]?.[0] || {};
  return (
    <>
      <div className="fields">
        <div className="field"><label htmlFor="f-cxw">Kettlebell (lb)</label>
          <NumField className="inp" id="f-cxw" inputMode="decimal" placeholder={String(prefW)} value={v.w} onCommit={x => editSet(date, id, 0, 'w', x)} /></div>
        <div className="field"><label htmlFor="f-cxr">Rounds</label>
          <NumField className="inp" id="f-cxr" inputMode="numeric" integer placeholder="—" value={v.r} onCommit={x => editSet(date, id, 0, 'r', x)} /></div>
        <div className="field"><label htmlFor="f-rpe">Effort (1–10)</label>
          <NumField className="inp" id="f-rpe" inputMode="numeric" placeholder={String(s.effort ?? 8)} value={log.rpe} onCommit={x => set({ rpe: x })} /></div>
      </div>
      <div className={`hint ${up ? 'up' : ''}`}>{hint}</div>
      <p className="fine">The timer counts rounds as you tap through the moves; they land here when you finish.</p>
    </>
  );
}

function ComplexCard({ s }: { s: Session }) {
  return (
    <article className="card">
      <header><h3>One round</h3><span className="aside">{KB_COMPLEX_REPS} reps · {s.amrap}-minute AMRAP</span></header>
      <ol className="cx-list">
        {KB_COMPLEX.map(m => <li key={m.name}><b>{m.reps} {m.name}</b><span>{m.cue}{m.note ? `. ${m.note[0].toUpperCase()}${m.note.slice(1)}` : ''}</span></li>)}
      </ol>
      <dl className="kv cx-weights">
        {KB_WEIGHTS.map(w => <div key={w.level}><dt>{w.level}</dt><dd>{w.lb} · {w.kg}</dd></div>)}
      </dl>
      <p className="fine">Your kettlebell goes up to 44 lb (20 kg), the weight used in the original workout.</p>
    </article>
  );
}

/** Minutes per km as m:ss. */
function fmtPace(minPerKm: number) {
  const sec = Math.round(minPerKm * 60);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}/km`;
}

function LiftCard({ data, date, s, log }: { data: Data; date: string; s: Session; log: DayLog }) {
  const setEntry = (id: string, i: number, k: 'w' | 'r', v: number | undefined) => editSet(date, id, i, k, v);
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
    <article className="card o-lifts">
      <header><h3>Log your sets</h3><span className="aside">{s.sets} sets · {s.tag.toLowerCase()}</span></header>
      <div className="ex-list">
        {s.lifts!.map(id => {
          const ex = EX[id], logged = log.ex?.[id] || [], n = Math.max(s.sets || 3, logged.length);
          const unit = ex.unit || 'reps', u = unit === 'sec' ? ' s' : '', last = lastPerf(data, id, date);
          const goal = ex.target ? `${ex.target}${unit === 'sec' ? ' seconds' : ' reps'}` : '';
          let hint = ex.bw ? (goal ? `Hold ${goal} with clean form` : 'Controlled reps, full range') : `First session: find a weight you can own for ${goal}`;
          let up = false;
          let prefW: number | '' = '';
          if (last) {
            const ws = last.sets.map(x => num(x.w)).filter((x): x is number => x != null);
            const rs = last.sets.map(x => Number(x.r));
            const topW = ws.length ? Math.max(...ws) : null;
            prefW = topW ?? '';
            const hitAll = !!ex.target && rs.length >= (s.sets || 3) && rs.every(r => r >= ex.target!);
            if (hitAll && !ex.bw && topW != null && topW + 5 <= (ex.max ?? Infinity)) {
              hint = `Hit ${ex.target}${u} on every set ${fmtShort(last.date)} → go ${topW + 5} lb`;
              up = true;
              prefW = topW + 5;
            } else if (hitAll && !ex.bw && topW != null) {
              hint = `${topW} lb is as heavy as it goes: lower for 3 seconds, or add reps`;
              up = true;
            } else {
              hint = `Last ${fmtShort(last.date)}: ${topW != null && !ex.bw ? topW + ' lb × ' : ''}${rs.join(' / ')}${u}`;
            }
          }
          return (
            <div className="ex" key={id}>
              <div className="ex-name">{ex.name}<span className="ex-note">{[goal && `3 × ${ex.target}${u}`, ex.note].filter(Boolean).join(' · ')}</span></div>
              <div className={`hint ${up ? 'up' : ''}`}>{hint}</div>
              <div className="sets">
                {Array.from({ length: n }, (_, i) => {
                  const v = logged[i] || {};
                  const full = !!ex.target && (v.r ?? 0) >= ex.target;
                  return (
                    <div className={`set ${full ? 'full' : ''}`} key={i}>
                      <span className="sn">{i + 1}</span>
                      {!ex.bw && <>
                        <NumField id={`s-${id}-${i}-w`} inputMode="decimal" aria-label={`${ex.name} set ${i + 1} weight`}
                          placeholder={String(prefW)} value={v.w} onCommit={x => setEntry(id, i, 'w', x)} />
                        <span className="u">lb</span>
                      </>}
                      <NumField id={`s-${id}-${i}-r`} inputMode="numeric" aria-label={`${ex.name} set ${i + 1} ${unit}`}
                        placeholder={ex.target ? String(ex.target) : unit === 'sec' ? 'sec' : 'reps'} value={v.r} onCommit={x => setEntry(id, i, 'r', x)} />
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
  const T = targetsOn(data.settings, date);
  const E = weights(data);
  const prev = [...E].reverse().find(e => e.date < date);
  const w = log.weight;
  const a7 = w != null ? avg7(E, date) : null;
  const inPlan = programDay(date).status === 'in';
  const plan = inPlan ? targetOn(startWeight(data), date) : null;
  const dPrev = w != null && prev ? w - prev.w : null;
  const dPlan = a7 != null && plan != null ? a7 - plan : null;
  const cls = (v: number | null) => (v == null ? '' : v < 0 ? 'down' : v > 0 ? 'upc' : '');
  const planCls = dPlan == null ? '' : dPlan <= 0 ? 'down' : 'behind';
  const set = (patch: Partial<DayLog>) => editDay(date, d => Object.assign(d, patch));
  const cp = CHECKPOINTS.find(c => c.date === date);

  const pct = (v: number | undefined, t: number) => Math.min(100, Math.round(((v || 0) / t) * 100));
  const { cal, pro, sleep, steps } = log;

  return (
    <>
      <article className="card o-weigh">
        <header><h3>Morning weigh-in</h3><span className="aside">{prev ? `last ${prev.w} lb · ${fmtShort(prev.date)}` : 'before breakfast'}</span></header>
        <div className="weigh-row">
          <NumField id="f-weight" inputMode="decimal" aria-label="Body weight in pounds" placeholder="—"
            value={w} onCommit={v => set({ weight: v })} />
          <span className="u">lb</span>
        </div>
        <dl className="minis">
          <div><dt>vs last</dt><dd className={cls(dPrev)}>{dPrev != null ? sgn(dPrev) : '—'}</dd></div>
          <div><dt>7-day avg</dt><dd>{a7 != null ? r1(a7).toFixed(1) : '—'}</dd></div>
          <div><dt>avg vs plan</dt><dd className={planCls}>{dPlan != null ? sgn(dPlan) : '—'}</dd></div>
        </dl>
        {plan != null && <p className="fine">The plan has you at {r1(plan).toFixed(1)} lb by tonight. Judge the 7-day average, not one weigh-in.</p>}
        {cp && <p className="msg">Checkpoint: {cp.target} lb is on track, {cp.floor} is the floor.</p>}
      </article>

      <article className="card o-fuel">
        <header><h3>Fuel and steps</h3><span className="aside">{T.note}</span></header>
        <Meter id="f-cal" label="Calories" unit="kcal" integer value={cal} placeholder={T.cal} onCommit={v => set({ cal: v })}
          pct={pct(cal, T.cal)} tone={cal != null && cal > T.cal * 1.05 ? 'bad' : ''}
          note={`Target ${T.cal.toLocaleString()} · ${cal != null
            ? (T.cal - cal >= 0 ? `${(T.cal - cal).toLocaleString()} left` : `${(cal - T.cal).toLocaleString()} over`)
            : 'no liquid calories'}${inPlan && cal != null && cal < CAL_FLOOR ? ` · under the ${CAL_FLOOR.toLocaleString()} floor` : ''}`} />
        <Meter id="f-pro" label="Protein" unit="g" integer value={pro} placeholder={T.pro} onCommit={v => set({ pro: v })}
          pct={pct(pro, T.pro)} tone={pro != null && pro < T.pro * 0.8 ? 'warn' : ''}
          note={`Target ${T.pro} g · keeps the loss from being muscle`} />
        <Meter id="f-steps" label="Steps" unit="" integer value={steps} placeholder={T.steps} onCommit={v => set({ steps: v })}
          pct={pct(steps, T.steps)} tone=""
          note={steps != null && steps < T.steps
            ? `${(T.steps - steps).toLocaleString()} to go · at least ${T.steps.toLocaleString()} every day`
            : `At least ${T.steps.toLocaleString()}, every day, on top of workouts`} />
        <Meter id="f-sleep" label="Sleep" unit="h" value={sleep} placeholder={7.5} onCommit={v => set({ sleep: v })}
          pct={pct(sleep, 8)} tone={sleep != null && sleep < 7 ? 'warn' : ''}
          note="7 to 8 h · bad sleep two weeks running is a signal to ease off" />
      </article>

      <article className="card o-note">
        <header><h3><label htmlFor="f-note">Notes</label></h3></header>
        <textarea className="inp" id="f-note" placeholder="How it felt, what you swapped, anything aching…"
          value={log.note ?? ''} onChange={e => set({ note: e.target.value })} />
      </article>
    </>
  );
}

function Meter(p: { id: string; label: string; unit: string; value?: number; placeholder: number; onCommit: (v?: number) => void; pct: number; tone: string; note: string; integer?: boolean }) {
  return (
    <div className="meter">
      <div className="meter-top">
        <label htmlFor={p.id}>{p.label}</label>
        <NumField className="inp" id={p.id} inputMode={p.integer ? 'numeric' : 'decimal'} integer={p.integer} placeholder={String(p.placeholder)} value={p.value} onCommit={p.onCommit} />
        <span className="u">{p.unit}</span>
      </div>
      <div className="track"><i className={p.tone} style={{ width: `${p.pct}%` }} /></div>
      <small>{p.note}</small>
    </div>
  );
}
