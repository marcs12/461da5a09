import { useState } from 'react';
import { addDays, fmtShort, r1 } from '../lib/dates';
import { mondayOf } from '../lib/life';
import { checkIns, sleepNights, supportTrigger, weekLife, weekMood, type CriticNote, type WeekLife } from '../lib/mind';
import { editDay, patchRec, putRec, type Data } from '../lib/store';
import { Ring } from './today/Cards';
import { CheckInSheet } from './today/QuickLog';
import { TaskItem } from './income/Cards';
import { SEED } from '../data/seed';

const M = SEED.mind;

/** Stay steady: check-in, trends, support, connection and the tools that help on bad days. */
export function Mind({ data, today }: { data: Data; today: string }) {
  const trig = supportTrigger(data, today);
  return (
    <section className="page">
      <div className="pagehead"><div><h1>Mind</h1><p>Stay steady.</p></div></div>
      {trig.fired && <SupportAlert data={data} today={today} reason={trig.reason} />}
      <div className="areagrid">
        <div className="stack">
          <CheckInCard data={data} today={today} />
          <Trends data={data} today={today} />
          <DailyBase data={data} today={today} />
          <Connection data={data} today={today} />
        </div>
        <div className="stack">
          <Support />
          <CriticTool today={today} />
          <article className="card">
            <header><h3>Four anchors</h3><span className="aside">{M.anchorsSource}</span></header>
            <ul className="tiers">{M.anchors.map(a => <li key={a.title}><b>{a.title}</b><span>{a.body}</span></li>)}</ul>
          </article>
        </div>
      </div>
    </section>
  );
}

/** Shown on Mind and Today when the support trigger fires. */
export function SupportAlert({ data, today, reason, compact }: { data: Data; today: string; reason: 'mood' | 'interest' | null; compact?: boolean }) {
  const m = mondayOf(today), w = weekLife(data, m);
  const msg = reason === 'interest'
    ? 'You noted losing interest in things you usually enjoy. Book one support option this week. Getting help is a skill move, not a failure.'
    : M.supportTrigger.message;
  return (
    <article className="card support-alert" role="status">
      <p>{msg}</p>
      <div className="actions">
        {!compact && <a className="btn" href="tel:988">Call 9-8-8</a>}
        <button className="btn ghost" aria-pressed={!!w.supportBooked}
          onClick={() => patchRec<WeekLife>('weekLife', m, { supportBooked: !w.supportBooked }, {})}>{w.supportBooked ? 'Booked ✓' : 'I booked one'}</button>
      </div>
    </article>
  );
}

function CheckInCard({ data, today }: { data: Data; today: string }) {
  const [open, setOpen] = useState(false);
  const c = checkIns(data).find(x => x.id === today);
  return (
    <article className="card">
      <header><h3>Check-in</h3><span className="aside">under a minute</span></header>
      {c ? (
        <dl className="kv">
          <div><dt>Mood</dt><dd>{c.mood}/10</dd></div>
          {c.win && <div><dt>Win</dt><dd>{c.win}</dd></div>}
          {c.firstTaskTomorrow && <div><dt>First task tomorrow</dt><dd>{c.firstTaskTomorrow}</dd></div>}
          {c.sleepHours != null && <div><dt>Sleep</dt><dd>{c.sleepHours} h</dd></div>}
        </dl>
      ) : <p className="fine">Mood, one win and tomorrow’s first task. Best done at wind-down.</p>}
      <div className="actions"><button className={`btn ${c ? '' : 'primary'}`} onClick={() => setOpen(true)}>{c ? 'Edit' : 'Check in'}</button></div>
      {open && <CheckInSheet data={data} date={today} onClose={() => setOpen(false)} />}
    </article>
  );
}

function Trends({ data, today }: { data: Data; today: string }) {
  const m = mondayOf(today);
  const first = mondayOf(data.settings.planStart);
  const weeks = Array.from({ length: 6 }, (_, i) => addDays(m, -7 * i)).reverse().filter(w => w >= first || w === m);
  const sleep = sleepNights(data, m);
  const target = SEED.weeklyTargets.sprint.sleepNights7h;
  return (
    <article className="card">
      <header><h3>Trends</h3><span className="aside">weekly, Mon – Sun</span></header>
      <div className="rings"><div><Ring done={sleep.n} total={7} /><span>Nights with 7+ hours<small> · aim {target}</small></span></div></div>
      <h4 className="subhead">Mood, weekly average</h4>
      <ul className="moodweeks">
        {weeks.map(w => {
          const x = weekMood(data, w);
          return (
            <li key={w}>
              <span>{w === m ? 'This week' : fmtShort(w)}</span>
              <div className="track"><i style={{ width: `${x.avg != null ? x.avg * 10 : 0}%` }} /></div>
              <b>{x.avg != null ? r1(x.avg).toFixed(1) : '—'}</b>
              <small>{x.n} check-in{x.n === 1 ? '' : 's'}</small>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function DailyBase({ data, today }: { data: Data; today: string }) {
  const l = data.days[today] || {};
  const walked = (l.walkMin ?? 0) >= 20 || !!l.walk;
  return (
    <article className="card">
      <header><h3>Daily base</h3></header>
      <ul className="mins">
        <li><button className="min" aria-pressed={!!l.daylight} onClick={() => editDay(today, d => { d.daylight = !l.daylight || undefined; })}>
          <i aria-hidden="true" /><span><b>10 minutes of morning daylight</b><small>Sunrise is after 7 until spring: the lunch walk counts</small></span></button></li>
        <li><div className="min static" aria-pressed={walked}><i aria-hidden="true" /><span><b>Daily walk</b><small>{walked ? 'logged' : 'log it from Today'}</small></span></div></li>
        <li><div className="min static" aria-pressed={!!l.checkedIn}><i aria-hidden="true" /><span><b>Evening check-in</b></span></div></li>
      </ul>
      <p className="fine">{M.dailyBase[3]}.</p>
    </article>
  );
}

function Connection({ data, today }: { data: Data; today: string }) {
  const m = mondayOf(today), w = weekLife(data, m);
  const patch = (p: Partial<WeekLife>) => patchRec<WeekLife>('weekLife', m, p, {});
  const [tg, setTg] = useState(w.touchGrass ?? '');
  const C = M.connection;
  const url = data.settings.touchGrassUrl;
  const mins = w.creativeMinutes ?? 0;
  return (
    <article className="card">
      <header><h3>Connection and fun</h3><span className="aside">this week</span></header>
      <div className="stack-sm">
        <form className="field" onSubmit={e => { e.preventDefault(); patch({ touchGrass: tg.trim() || undefined }); }}>
          <label htmlFor="tg">A TouchGrass activity{url && <> · <a href={url} target="_blank" rel="noreferrer">Battlepass</a></>}</label>
          <div className="actions">
            <input className="inp" id="tg" autoComplete="off" value={tg} onChange={e => setTg(e.target.value)} onBlur={() => patch({ touchGrass: tg.trim() || undefined })} placeholder="What did you do?" style={{ flex: 1, minWidth: 0 }} />
            {w.touchGrass && <span className="chip">done</span>}
          </div>
        </form>
        <label className="toggle" htmlFor="social"><span>A social plan this week</span>
          <input id="social" type="checkbox" role="switch" checked={!!w.socialPlan} onChange={e => patch({ socialPlan: e.target.checked || undefined })} /></label>
        <div className="stepper">
          <span>Creative time <small>{C.creativeOptions.join(', ').toLowerCase()} · aim {C.creativeMinutesPerWeek} min</small></span>
          <div>
            <button className="iconbtn" aria-label="Remove 15 minutes" disabled={!mins} onClick={() => patch({ creativeMinutes: Math.max(0, mins - 15) || undefined })}>−</button>
            <b>{mins}</b>
            <button className="iconbtn" aria-label="Add 15 minutes" onClick={() => patch({ creativeMinutes: mins + 15 })}>+</button>
          </div>
        </div>
      </div>
      <h4 className="subhead">Vietnam film</h4>
      <ul className="tasks">
        {['film-clips', 'travel-edit'].map(id => <TaskItem key={id} data={data} t={SEED.tasks.find(t => t.id === id)!} />)}
      </ul>
    </article>
  );
}

function CriticTool({ today }: { today: string }) {
  const [step, setStep] = useState(0);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const steps = M.criticTool;
  const done = step >= steps.length;
  return (
    <article className="card">
      <header><h3>When the critic shows up</h3>{step > 0 && <button className="btn ghost small" onClick={() => { setStep(0); setNote(''); setSaved(false); }}>Start over</button>}</header>
      <ol className="rules critic">
        {steps.map((s, i) => <li key={s} className={i === step ? 'on' : i < step ? 'past' : ''}><span>{s}</span></li>)}
      </ol>
      {step === 1 && (
        <div className="field"><label htmlFor="critic-note">What you’d tell a friend (optional, private)</label>
          <textarea className="inp" id="critic-note" value={note} onChange={e => setNote(e.target.value)} /></div>
      )}
      {!done ? (
        <div className="actions"><button className="btn primary" onClick={() => {
          if (step === 1 && note.trim() && !saved) { putRec<CriticNote>('critic', { id: crypto.randomUUID(), date: today, note: note.trim() }); setSaved(true); }
          setStep(step + 1);
        }}>{step === 0 ? 'Start' : step === steps.length - 1 ? 'Done' : 'Next'}</button></div>
      ) : <p className="fine">Nice. {saved ? 'The note is saved on this device. ' : ''}One 5-minute action from the minimum day now.</p>}
    </article>
  );
}

/** Support resources. 9-8-8 is always visible. */
export function Support() {
  return (
    <article className="card support">
      <header><h3>Support</h3><span className="aside">free, any time</span></header>
      <ul className="res">
        {M.supportResources.map(r => (
          <li key={r.id}>
            <div><b>{r.name}</b><span>{r.detail}</span></div>
            <div className="res-act">
              {'tel' in r && r.tel && <a className="btn" href={`tel:${r.tel}`}>Call</a>}
              {'sms' in r && r.sms && <a className="btn" href={`sms:${r.sms}`}>Text</a>}
              {'url' in r && r.url && !('tel' in r && r.tel) && <a className="btn ghost" href={r.url} target="_blank" rel="noreferrer">Open</a>}
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}

