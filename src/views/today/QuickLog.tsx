import { useState } from 'react';
import { addDays, fmtDay } from '../../lib/dates';
import { sessionOf } from '../../lib/program';
import { weights } from '../../lib/stats';
import { editDay, putRec, recs, type CheckIn, type Data, type Job, type Tier } from '../../lib/store';
import { Sheet } from '../../components/Sheet';
import { Toggle } from '../../components/fields';
import { sleepHours } from '../../lib/mind';
import { Check, NumField } from '../../components/ui';
import { SEED } from '../../data/seed';

export type QuickKind = 'weight' | 'workout' | 'walk' | 'application' | 'checkin';
export const QUICK: { id: QuickKind; label: string }[] = [
  { id: 'weight', label: 'Weight' },
  { id: 'workout', label: 'Workout' },
  { id: 'walk', label: 'Walk' },
  { id: 'application', label: 'Application' },
  { id: 'checkin', label: 'Check-in' },
];

interface Props { data: Data; date: string; onClose: () => void }

export function QuickSheet({ kind, openSession, ...p }: Props & { kind: QuickKind; openSession: () => void }) {
  switch (kind) {
    case 'weight': return <WeightSheet {...p} />;
    case 'workout': return <WorkoutSheet {...p} openSession={openSession} />;
    case 'walk': return <WalkSheet {...p} />;
    case 'application': return <ApplicationSheet {...p} />;
    case 'checkin': return <CheckInSheet {...p} />;
  }
}

function WeightSheet({ data, date, onClose }: Props) {
  const prev = [...weights(data)].reverse().find(e => e.date < date);
  const [v, setV] = useState<number | undefined>(data.days[date]?.weight);
  const save = () => { editDay(date, d => { d.weight = v; }); onClose(); };
  return (
    <Sheet title="Weight" onClose={onClose}>
      <form className="stack-sm" onSubmit={e => { e.preventDefault(); save(); }}>
        <div className="weigh-row">
          <NumField id="q-weight" inputMode="decimal" autoFocus aria-label="Body weight in pounds" placeholder={prev ? String(prev.w) : '—'} value={v} onCommit={setV} />
          <span className="u">lb</span>
        </div>
        <p className="fine">{prev ? `Last: ${prev.w} lb on ${fmtDay(prev.date)}. ` : ''}Three mornings a week is enough; the weekly average is what counts.</p>
        <div className="actions sheet-go"><button className="btn primary" disabled={v == null}>Save</button></div>
      </form>
    </Sheet>
  );
}

function WorkoutSheet({ data, date, onClose, openSession }: Props & { openSession: () => void }) {
  const s = sessionOf(date);
  const l = data.days[date] || {};
  return (
    <Sheet title="Workout" onClose={onClose}>
      {s ? (
        <div className="stack-sm">
          <div><span className={`chip k-${s.kind}`}>{s.tag}</span></div>
          <b className="todo-title">{s.title}</b>
          <ul className="focus">{s.lines.map(x => <li key={x}>{x}</li>)}</ul>
          {s.kind !== 'break' && <Check id="q-done" checked={!!l.done} onChange={v => editDay(date, d => { d.done = v; })} label={s.kind === 'rest' ? 'Walk done' : 'Session done'} />}
          <div className="actions sheet-go"><button className="btn primary" onClick={() => { onClose(); openSession(); }}>Log sets and timer</button></div>
        </div>
      ) : <p className="fine">No session on this day.</p>}
    </Sheet>
  );
}

function WalkSheet({ data, date, onClose }: Props) {
  const [v, setV] = useState<number | undefined>(data.days[date]?.walkMin);
  const save = (n: number | undefined) => { editDay(date, d => { d.walkMin = n; }); onClose(); };
  return (
    <Sheet title="Walk" onClose={onClose}>
      <div className="stack-sm">
        <div className="chips-row">
          {[20, 30, 45, 60].map(n => <button key={n} className="btn bigchip" onClick={() => save(n)}>{n} min</button>)}
        </div>
        <form className="actions" onSubmit={e => { e.preventDefault(); save(v); }}>
          <NumField className="inp" id="q-walk" inputMode="numeric" aria-label="Minutes walked" placeholder="Other" value={v} onCommit={setV} style={{ width: 110 }} />
          <button className="btn">Save</button>
        </form>
        <p className="fine">20 minutes or more ticks the minimum day.</p>
      </div>
    </Sheet>
  );
}

const TIERS = SEED.income.tiers.map(t => ({ id: t.id as Tier, label: t.label }));

function ApplicationSheet({ date, onClose }: Props) {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [tier, setTier] = useState<Tier>('bridge');
  const [url, setUrl] = useState('');
  const ok = company.trim() && role.trim();
  const save = () => {
    if (!ok) return;
    putRec<Job>('jobs', {
      id: crypto.randomUUID(), company: company.trim(), role: role.trim(), tier, url: url.trim() || undefined,
      stage: 'applied', savedAt: date, appliedAt: date, followUpAt: addDays(date, SEED.income.followUpDays),
    });
    onClose();
  };
  return (
    <Sheet title="Application sent" onClose={onClose}>
      <form className="stack-sm" onSubmit={e => { e.preventDefault(); save(); }}>
        <div className="fields">
          <div className="field"><label htmlFor="q-co">Company</label><input className="inp" id="q-co" autoFocus autoComplete="off" value={company} onChange={e => setCompany(e.target.value)} /></div>
          <div className="field"><label htmlFor="q-role">Role</label><input className="inp" id="q-role" autoComplete="off" value={role} onChange={e => setRole(e.target.value)} /></div>
        </div>
        <div className="seg" role="radiogroup" aria-label="Tier">
          {TIERS.map(t => <button type="button" key={t.id} role="radio" aria-checked={tier === t.id} onClick={() => setTier(t.id)}>{t.label}</button>)}
        </div>
        <div className="field"><label htmlFor="q-url">Posting link (optional)</label><input className="inp" id="q-url" type="url" inputMode="url" value={url} onChange={e => setUrl(e.target.value)} /></div>
        <p className="fine">Follow-up reminder on {fmtDay(addDays(date, SEED.income.followUpDays))}. Counts as today’s career action.</p>
        <div className="actions sheet-go"><button className="btn primary" disabled={!ok}>Save</button></div>
      </form>
    </Sheet>
  );
}

export function CheckInSheet({ data, date, onClose }: Props) {
  const cur = recs<CheckIn>(data, 'checkIns').find(c => c.id === date);
  const S = data.settings;
  const [mood, setMood] = useState<number | undefined>(cur?.mood);
  const [win, setWin] = useState(cur?.win ?? '');
  const [first, setFirst] = useState(cur?.firstTaskTomorrow ?? '');
  const [lost, setLost] = useState(!!cur?.losingInterest);
  const [sleep, setSleep] = useState<number | undefined>(data.days[date]?.sleep);
  const [times, setTimes] = useState<{ bed: string; wake: string } | null>(null);
  const hours = times ? sleepHours(times.bed, times.wake) : sleep;
  const save = () => {
    if (mood == null) return;
    putRec<CheckIn>('checkIns', { id: date, date, mood, win: win.trim(), firstTaskTomorrow: first.trim(), sleepHours: hours, losingInterest: lost || undefined });
    editDay(date, d => { d.checkedIn = true; if (hours != null) d.sleep = hours; });
    onClose();
  };
  return (
    <Sheet title={`Check-in · ${fmtDay(date)}`} onClose={onClose}>
      <form className="stack-sm" onSubmit={e => { e.preventDefault(); save(); }}>
        <fieldset className="field moods">
          <legend>Mood today</legend>
          <div>{Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
            <button type="button" key={n} aria-pressed={mood === n} onClick={() => setMood(n)}>{n}</button>
          ))}</div>
        </fieldset>
        <div className="field"><label htmlFor="q-win">One win</label><input className="inp" id="q-win" autoComplete="off" value={win} onChange={e => setWin(e.target.value)} placeholder="Small counts" /></div>
        <div className="field"><label htmlFor="q-first">Tomorrow’s first task</label><input className="inp" id="q-first" autoComplete="off" value={first} onChange={e => setFirst(e.target.value)} /></div>
        <div className="field">
          <label htmlFor="q-sleep">Last night’s sleep (optional)</label>
          {times ? (
            <div className="fields">
              <input className="inp" type="time" aria-label="Went to bed" value={times.bed} onChange={e => e.target.value && setTimes({ ...times, bed: e.target.value })} />
              <input className="inp" type="time" aria-label="Woke up" value={times.wake} onChange={e => e.target.value && setTimes({ ...times, wake: e.target.value })} />
            </div>
          ) : (
            <div className="actions">
              <NumField className="inp" id="q-sleep" inputMode="decimal" placeholder="hours" value={sleep} onCommit={setSleep} style={{ width: 110 }} />
              <button type="button" className="btn ghost small" onClick={() => setTimes({ bed: S.lightsOut, wake: S.wakeTime })}>From bed and wake times</button>
            </div>
          )}
          {times && <small className="fine">{hours} hours</small>}
        </div>
        <Toggle id="q-lost" label="Losing interest in things I usually enjoy" checked={lost} onChange={setLost} />
        <p className="fine">Stays on this device. It never syncs.</p>
        <div className="actions sheet-go"><button className="btn primary" disabled={mood == null}>Save</button></div>
      </form>
    </Sheet>
  );
}
