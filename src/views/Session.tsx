import { useEffect, useState } from 'react';
import { addDays, fmtDay, fmtShort, num, parse, r1, sgn, today } from '../lib/dates';
import { DOW, END, EX, KB_COMPLEX, KB_COMPLEX_REPS, KB_COMPLEX_START_LB, KB_WEIGHTS, START, WEEKS, WEEK_NOTES, bridgeSession, programDay, weekStart, type ProgramDay, type Session } from '../lib/program';
import { AFTER, BEACH, CAL_FLOOR, CHECKPOINTS, GOAL_WEIGHT, startWeight, targetOn, targetsOn } from '../lib/targets';
import { editDay, editSet, type Data, type DayLog } from '../lib/store';
import { avg7, isDone, lastPerf, weights } from '../lib/stats';
import { Ribbon } from '../components/Ribbon';
import { Check, Icon, NumField } from '../components/ui';
import { RecoveryCard, WatchCard } from './Watch';
import { garminDay, matchActivity, sleepOn, stepsOn, weightOn } from '../lib/garmin';
import { why } from '../lib/motivation';
import { ArcCard, DoneBanner, markJustDone } from '../components/Motivate';
import { Effort, FoodCard, LogValue, NotesCard, RunLog } from '../components/Log';

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
  const T = targetsOn(data.settings, date);

  return (
    <section>
      {date === t && <ArcCard data={data} today={t} />}
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
          <FoodCard data={data} date={date} log={log} cal={T.cal} pro={T.pro} note={T.note} floor={pd.status === 'in' ? CAL_FLOOR : undefined} />
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
  const a = matchActivity(data, date, s);
  const aMin = a?.durS ? Math.round(a.durS / 6) / 10 : undefined, aKm = a?.distM ? Math.round(a.distM / 10) / 100 : undefined;
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
          <p className="why"><b>Why it matters</b>{why(s, programDay(date))}</p>
        </div>
        <div className="session-body">
          {s.kind === 'rest' ? (
            <div className="actions"><Check id="f-done" checked={!!log.done} onChange={v => set({ done: v })} label="Rested" /></div>
          ) : (
            <div className="actions">
              {s.segments && <button className="btn primary" onClick={onTimer}><Icon.timer />Start interval timer</button>}
              <Check id="f-done" checked={isDone(data, date)} onChange={v => { if (v) markJustDone(date); set({ done: v }); }} label={log.done == null && isDone(data, date) ? 'Done, from your watch' : 'Session done'} />
            </div>
          )}
          {s.kind !== 'rest' && isDone(data, date) && <DoneBanner data={data} date={date} />}
          {s.amrap && <ComplexFields data={data} date={date} s={s} log={log} />}
          {s.kind === 'cardio' && (
            <>
              <RunLog date={date} log={log} s={s} watch={a ? { min: aMin, km: aKm } : undefined} />
              {s.tag !== 'Low impact' && s.tag !== 'Walk' && <p className="tip"><b>Shin or knee pain (pain, not soreness)?</b> Swap this run for a treadmill walk.</p>}
            </>
          )}
        </div>
      </article>
      <WatchCard data={data} date={date} s={s} />
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

function ComplexFields({ data, date, s, log }: { data: Data; date: string; s: Session; log: DayLog }) {
  const { hint, up, prefW } = complexHint(data, date, s);
  const id = s.logAs!, v = log.ex?.[id]?.[0] || {};
  return (
    <>
      <div className="fields">
        <div className="field"><label htmlFor="f-cxw">Kettlebell (lb)</label>
          <NumField className="inp" id="f-cxw" inputMode="decimal" placeholder={String(prefW)} value={v.w} onCommit={x => editSet(date, id, 0, 'w', x)} /></div>
        <div className="field"><label htmlFor="f-cxr">Rounds</label>
          <NumField className="inp" id="f-cxr" inputMode="numeric" integer placeholder="—" value={v.r} onCommit={x => editSet(date, id, 0, 'r', x)} /></div>
      </div>
      <Effort date={date} value={log.rpe} suggested={s.effort ?? 8} />
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
                      {(() => {
                        const lastR = last ? Number(last.sets[i]?.r ?? last.sets.at(-1)?.r) || undefined : undefined;
                        const planR = v.r ?? ex.target ?? lastR;
                        const planW = ex.bw ? undefined : v.w ?? num(prefW) ?? undefined;
                        const logged = v.r != null && (ex.bw || v.w != null);
                        const can = !logged && planR != null && (ex.bw || planW != null);
                        return (
                          <button className={`setok ${logged ? 'on' : ''}`} disabled={!can}
                            aria-label={logged ? `Set ${i + 1} logged` : `Log set ${i + 1}${planW != null ? ` at ${planW} lb` : ''} × ${planR ?? ''}`}
                            title={logged ? 'Logged' : can ? `Log ${planW != null ? `${planW} lb × ` : ''}${planR}` : 'Type the weight first'}
                            onClick={() => { if (planW != null && v.w == null) setEntry(id, i, 'w', planW); if (v.r == null) setEntry(id, i, 'r', planR); }}>
                            <Icon.check />
                          </button>
                        );
                      })()}
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
  const g = garminDay(data, date);
  const w = weightOn(data, date);
  const a7 = w != null ? avg7(E, date) : null;
  const inPlan = programDay(date).status === 'in';
  const plan = inPlan ? targetOn(startWeight(data), date) : null;
  const dPrev = w != null && prev ? w - prev.w : null;
  const dPlan = a7 != null && plan != null ? a7 - plan : null;
  const cls = (v: number | null) => (v == null ? '' : v < 0 ? 'down' : v > 0 ? 'upc' : '');
  const planCls = dPlan == null ? '' : dPlan <= 0 ? 'down' : 'behind';
  const set = (patch: Partial<DayLog>) => editDay(date, d => Object.assign(d, patch));
  const cp = CHECKPOINTS.find(c => c.date === date);
  const lost = a7 != null && date >= START ? startWeight(data) - a7 : null;

  const pct = (v: number | undefined, t: number) => Math.min(100, Math.round(((v || 0) / t) * 100));
  const steps = stepsOn(data, date), sleep = sleepOn(data, date);

  return (
    <>
      <article className="card o-weigh">
        <header><h3>Morning weigh-in</h3><span className="aside">{prev ? `last ${prev.w} lb · ${fmtShort(prev.date)}` : 'before breakfast'}</span></header>
        <WeighIn date={date} log={log} scale={g?.weightLb} />
        <dl className="minis">
          <div><dt>vs last</dt><dd className={cls(dPrev)}>{dPrev != null ? sgn(dPrev) : '—'}</dd></div>
          <div><dt>7-day avg</dt><dd>{a7 != null ? r1(a7).toFixed(1) : '—'}</dd></div>
          <div><dt>avg vs plan</dt><dd className={planCls}>{dPlan != null ? sgn(dPlan) : '—'}</dd></div>
        </dl>
        {plan != null && <p className="fine">The plan has you at {r1(plan).toFixed(1)} lb by tonight. Judge the 7-day average, not one weigh-in.</p>}
        {lost != null && lost >= 1 && <p className="since"><b>−{r1(lost).toFixed(1)} lb</b> since day 1{a7 != null && a7 > GOAL_WEIGHT ? ` · ${r1(a7 - GOAL_WEIGHT).toFixed(1)} to ${GOAL_WEIGHT}` : ` · ${GOAL_WEIGHT} reached`}</p>}
        <Waist data={data} date={date} log={log} onSave={v => set({ waist: v })} />
        {cp && <p className="msg">Checkpoint: {cp.target} lb is on track, {cp.floor} is the floor.</p>}
      </article>

      <RecoveryCard data={data} date={date} />

      <article className="card o-fuel">
        <header><h3>Steps and sleep</h3>{g && <span className="aside">your watch fills these in</span>}</header>
        <LogValue id="f-steps" label="Steps" unit="" date={date} integer min={0} max={100000} value={log.steps} source={g?.steps} sourceLabel="from your watch"
          placeholder={T.steps} onSave={v => set({ steps: v })} pct={pct(steps, T.steps)}
          note={steps != null && steps < T.steps ? `${(T.steps - steps).toLocaleString()} to go · at least ${T.steps.toLocaleString()} every day` : steps != null ? `Goal hit · ${T.steps.toLocaleString()} a day, on top of workouts` : `At least ${T.steps.toLocaleString()} a day, on top of workouts`} />
        <LogValue id="f-sleep" label="Sleep" unit="h" date={date} min={0} max={16} value={log.sleep} source={g?.sleepH} sourceLabel={`from your watch${g?.sleepScore ? ` · score ${g.sleepScore}` : ''}`}
          placeholder={7.5} onSave={v => set({ sleep: v })} pct={pct(sleep, 8)} tone={sleep != null && sleep < 7 ? 'warn' : ''}
          note="7 to 8 h · short sleep two weeks running is a signal to ease off" />
      </article>

      <NotesCard date={date} value={log.note} />
    </>
  );
}

/** Type a weight and press Log: it then shows as logged, with Edit to change it. */
function WeighIn({ date, log, scale }: { date: string; log: DayLog; scale?: number }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [fresh, setFresh] = useState(false);
  useEffect(() => { setEditing(false); setText(''); setFresh(false); }, [date]);
  useEffect(() => { if (!fresh) return; const id = setTimeout(() => setFresh(false), 1500); return () => clearTimeout(id); }, [fresh]);
  const v = num(text);
  const valid = v != null && v > 70 && v < 600;
  const shown = log.weight ?? scale;
  const save = () => {
    if (!valid) return;
    editDay(date, d => { d.weight = r1(v); d.wAt = Date.now(); });
    setEditing(false); setText(''); setFresh(true);
  };

  if (shown != null && !editing) {
    const when = log.weight == null ? 'From your Garmin scale'
      : log.wAt ? `Logged at ${new Date(log.wAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Logged';
    return (
      <div className={`weigh-done ${fresh ? 'pop' : ''} ${log.weight == null ? 'scale' : ''}`} role="status">
        <span className="wd-check"><Icon.check /></span>
        <div className="grow"><b>{r1(shown).toFixed(1)}<u>lb</u></b><small>{when}</small></div>
        <button className="btn sm" onClick={() => { setText(log.weight != null ? String(log.weight) : ''); setEditing(true); }}>{log.weight == null ? 'Change' : 'Edit'}</button>
      </div>
    );
  }
  return (
    <form className="weigh-form" onSubmit={e => { e.preventDefault(); save(); }}>
      <div className="weigh-row">
        <input id="f-weight" inputMode="decimal" autoComplete="off" aria-label="Body weight in pounds" autoFocus={editing}
          placeholder={scale != null ? String(scale) : '—'} value={text} onChange={e => setText(e.target.value)} />
        <span className="u">lb</span>
      </div>
      <div className="weigh-actions">
        <button className="btn primary" type="submit" disabled={!valid}><Icon.check />Log weight</button>
        {editing && <button className="btn ghost" type="button" onClick={() => { setEditing(false); setText(''); }}>Cancel</button>}
        {editing && log.weight != null && (
          <button className="btn ghost clear" type="button" onClick={() => { editDay(date, d => { delete d.weight; delete d.wAt; }); setEditing(false); setText(''); }}>Remove</button>
        )}
      </div>
    </form>
  );
}

/** Waist once a week: fat loss shows here when the scale stalls. */
function Waist({ data, date, log, onSave }: { data: Data; date: string; log: DayLog; onSave: (v?: number) => void }) {
  const all = Object.keys(data.days).sort().filter(k => data.days[k].waist != null && k <= date);
  const first = all[0] ? data.days[all[0]].waist! : undefined;
  const last = [...all].reverse().find(k => k < date);
  const [open, setOpen] = useState(false);
  const due = !last || diffDays(date, last) >= 7;
  if (log.waist == null && !open) {
    return <button className="linkbtn" onClick={() => setOpen(true)}>{due ? '+ Measure your waist (once a week)' : '+ Waist'}</button>;
  }
  const change = first != null && log.waist != null && all[0] !== date ? log.waist - first : undefined;
  return (
    <div className="waist">
      <LogValue id="f-waist" label="Waist" unit="in" date={date} min={20} max={80} value={log.waist} placeholder={last ? data.days[last].waist : undefined}
        onSave={v => { onSave(v); if (v == null) setOpen(false); }}
        note={change != null ? `${change <= 0 ? '−' : '+'}${Math.abs(r1(change)).toFixed(1)} in since ${fmtShort(all[0])}` : 'At the belly button, relaxed, same morning each week'} />
    </div>
  );
}
const diffDays = (a: string, b: string) => Math.round((parse(a).getTime() - parse(b).getTime()) / 864e5);
