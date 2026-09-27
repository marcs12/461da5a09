import { useState } from 'react';
import { addDays, fmtShort } from '../lib/dates';
import { exportBackup } from '../lib/backup';
import { mondayOf } from '../lib/life';
import { supportTrigger, weekLife, type WeekLife } from '../lib/mind';
import { latestFund, runway } from '../lib/money';
import { reviewText, reviewWeek, reviews, scoreRows, weekScores, type ScoreRow, type WeeklyReview } from '../lib/review';
import { patchRec, putRec, recs, type Data, type TaskState } from '../lib/store';
import { NumField } from '../components/ui';
import { PickList } from './today/Cards';
import { FundSheet } from './money/Cards';
import { Support } from './Mind';
import { SEED } from '../data/seed';

type Scores = WeeklyReview['scores'];
const STEPS = SEED.review.steps;
const title = (id: string) => SEED.tasks.find(t => t.id === id)?.title ?? id;

/** The Sunday review: a 20-minute stepper, then a copyable summary and the history. */
export function Review({ data, today, openIncome }: { data: Data; today: string; openIncome: () => void }) {
  const week = reviewWeek(today);
  const saved = reviews(data).find(r => r.weekOf === week);
  const [editing, setEditing] = useState(!saved);
  return (
    <section className="page">
      <div className="pagehead">
        <div><h1>Sunday review</h1><p>Week of {fmtShort(week)} – {fmtShort(addDays(week, 6))} · about 20 minutes, plus the 15-minute money check</p></div>
      </div>
      {editing
        ? <Stepper data={data} today={today} week={week} saved={saved} openIncome={openIncome} onDone={() => setEditing(false)} />
        : saved && <Summary r={saved} onEdit={() => setEditing(true)} />}
      <History data={data} current={week} />
    </section>
  );
}

function Stepper({ data, today, week, saved, openIncome, onDone }: { data: Data; today: string; week: string; saved?: WeeklyReview; openIncome: () => void; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState<Scores>(() => ({ ...weekScores(data, week), ...saved?.scores }));
  const [keep, setKeep] = useState(saved?.keep ?? '');
  const [change, setChange] = useState(saved?.change ?? '');
  const [fund, setFund] = useState(false);
  const next = addDays(week, 7);
  const trig = supportTrigger(data, today);
  const life = weekLife(data, mondayOf(today));
  const rows = scoreRows(data, week);
  const last = step === STEPS.length - 1;

  const save = () => {
    const top3 = recs<TaskState>(data, 'tasks').filter(t => t.pickedForWeek === next).map(t => t.id);
    const nnc = scores.noNewCardBalance;
    putRec<WeeklyReview>('reviews', {
      id: week, weekOf: week, scores: { ...scores, runway: runway(data) ?? scores.runway }, keep: keep.trim(), change: change.trim(), top3,
      supportTriggered: trig.fired, supportBooked: life.supportBooked,
    });
    if (typeof nnc === 'boolean') patchRec<WeekLife>('weekLife', week, { noNewCardBalance: nnc }, {});
    onDone();
  };

  return (
    <article className="card review">
      <div className="ob-dots" aria-hidden="true">{STEPS.map((s, i) => <i key={s.id} className={i <= step ? 'on' : ''} />)}</div>
      <header><h2>{step + 1}. {STEPS[step].label}</h2><span className="aside">{STEPS[step].minutes} min</span></header>

      {step === 0 && (
        <>
          <p className="fine">Filled in from the week’s logs. Fix anything that’s off.</p>
          <ul className="scores">{rows.map(r => <ScoreInput key={r.id} row={r} value={scores[r.id]} onChange={v => setScores({ ...scores, [r.id]: v })} />)}</ul>
        </>
      )}

      {step === 1 && (
        <div className="stack-sm">
          <div className="field"><label htmlFor="rv-keep">Keep one thing</label><input className="inp" id="rv-keep" autoComplete="off" value={keep} onChange={e => setKeep(e.target.value)} /></div>
          <div className="field"><label htmlFor="rv-change">Change one thing</label><input className="inp" id="rv-change" autoComplete="off" value={change} onChange={e => setChange(e.target.value)} /></div>
          <p className="fine">A rough week is data for this, not proof of anything about you.</p>
        </div>
      )}

      {step === 2 && (
        <div className="stack-sm">
          <h3 className="subhead">Top 3 for the week of {fmtShort(next)}</h3>
          <PickList data={data} today={addDays(next, 1)} week={next} />
          <div className="actions"><button className="btn" onClick={openIncome}>Save 5 postings in Income</button></div>
          <p className="fine">Put the workouts and a TouchGrass or social plan in your calendar now.</p>
        </div>
      )}

      {step === 3 && (
        trig.fired ? (
          <div className="stack-sm">
            <p className="msg">{trig.reason === 'interest' ? 'You noted losing interest this week.' : SEED.mind.supportTrigger.message}</p>
            <label className="toggle" htmlFor="rv-booked"><span>I booked a support option</span>
              <input id="rv-booked" type="checkbox" role="switch" checked={!!life.supportBooked} onChange={e => patchRec<WeekLife>('weekLife', mondayOf(today), { supportBooked: e.target.checked }, {})} /></label>
            <Support />
          </div>
        ) : <p className="fine">Nothing flagged this week. Support is always on Mind, and 9-8-8 is always there: <a href="tel:988">call</a> or <a href="sms:988">text</a>.</p>
      )}

      {step === 4 && (
        <div className="stack-sm">
          <p className="runway"><b>{runway(data) ?? '—'}</b><span>months of runway</span>
            <small>{latestFund(data) ? `Freedom Fund last updated ${fmtShort(latestFund(data)!.date)}` : 'Log the Freedom Fund balance to see it.'}</small></p>
          <div className="actions"><button className="btn primary" onClick={() => setFund(true)}>Update the balance</button></div>
          <p className="fine">Check the accounts, the card balance and anything on the 48-hour list. {SEED.money.disclaimer}</p>
          {fund && <FundSheet current={latestFund(data)?.balance} onClose={() => setFund(false)} />}
        </div>
      )}

      {step === 5 && (
        <div className="stack-sm">
          <p className="fine">Export a backup, then save the review. The file holds your weight, mood and money data, so keep it private.</p>
          <div className="actions"><button className="btn" onClick={exportBackup}>Export a backup</button></div>
        </div>
      )}

      <div className="actions ob-nav">
        {step > 0 && <button className="btn ghost" onClick={() => setStep(step - 1)}>Back</button>}
        <button className="btn primary" onClick={() => (last ? save() : setStep(step + 1))}>{last ? 'Save the review' : 'Next'}</button>
      </div>
    </article>
  );
}

function ScoreInput({ row, value, onChange }: { row: ScoreRow; value: number | boolean | null | undefined; onChange: (v: number | boolean | null) => void }) {
  return (
    <li>
      <span>{row.label}</span>
      {row.kind === 'bool' ? (
        <div className="seg yn" role="radiogroup" aria-label={row.label}>
          <button type="button" role="radio" aria-checked={value === true} onClick={() => onChange(value === true ? null : true)}>Yes</button>
          <button type="button" role="radio" aria-checked={value === false} onClick={() => onChange(value === false ? null : false)}>No</button>
        </div>
      ) : (
        <div className="scorenum">
          <NumField className="inp" inputMode="decimal" aria-label={row.label} placeholder="—" value={typeof value === 'number' ? value : undefined} onCommit={v => onChange(v ?? null)} />
          {row.target ? <small>/ {row.target}</small> : null}
        </div>
      )}
    </li>
  );
}

function Summary({ r, onEdit }: { r: WeeklyReview; onEdit: () => void }) {
  const [msg, setMsg] = useState('');
  const text = reviewText(r, title);
  const copy = async () => { try { await navigator.clipboard.writeText(text); setMsg('Copied.'); } catch { setMsg('Couldn’t reach the clipboard.'); } };
  return (
    <article className="card">
      <header><h2>Done for this week</h2><button className="btn ghost small" onClick={onEdit}>Edit</button></header>
      <pre className="tmpl">{text}</pre>
      <div className="actions"><button className="btn" onClick={copy}>Copy as text</button>{msg && <span className="fine">{msg}</span>}</div>
    </article>
  );
}

function History({ data, current }: { data: Data; current: string }) {
  const past = reviews(data).filter(r => r.weekOf !== current);
  const [open, setOpen] = useState<string | null>(null);
  if (!past.length) return null;
  return (
    <article className="card">
      <header><h2>Past reviews</h2><span className="aside">{past.length}</span></header>
      <ul className="wins">
        {past.map(r => (
          <li key={r.id} className="hist">
            <button className="linkish" onClick={() => setOpen(open === r.id ? null : r.id)}>
              <b>Week of {fmtShort(r.weekOf)}</b><small>{[r.keep && `Keep: ${r.keep}`, r.change && `Change: ${r.change}`].filter(Boolean).join(' · ') || 'No notes'}</small>
            </button>
            {open === r.id && <pre className="tmpl">{reviewText(r, title)}</pre>}
          </li>
        ))}
      </ul>
    </article>
  );
}
