import { useEffect, useRef, useState, type ReactNode } from 'react';
import { addDays, num, r1, today } from '../lib/dates';
import { editDay, type Data, type DayLog } from '../lib/store';
import { QUICK, addFood, removeFood, repeatFood } from '../lib/meals';
import { Icon } from './ui';

/*
 * Logging on Today, one pattern throughout: you type, press a button, and the
 * value shows as logged with Edit next to it. Nothing changes until you press.
 */

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const fmt = (v: number, int?: boolean) => (int ? Math.round(v).toLocaleString() : Number.isInteger(r1(v)) ? String(r1(v)) : r1(v).toFixed(1));

/** A short pulse on whatever was just saved. */
function useFlash(): [boolean, () => void] {
  const [on, setOn] = useState(false);
  useEffect(() => { if (!on) return; const id = setTimeout(() => setOn(false), 1300); return () => clearTimeout(id); }, [on]);
  return [on, () => setOn(true)];
}

/* ---------- one number with Log / Edit ---------- */

interface ValueProps {
  id: string; label: string; unit: string; date: string;
  value?: number; source?: number; sourceLabel?: string;
  placeholder?: number; integer?: boolean; min: number; max: number;
  onSave: (v: number | undefined) => void;
  pct?: number; tone?: string; note?: ReactNode;
}
/** A number logged by hand, or one the watch filled in, with Log or Edit. */
export function LogValue(p: ValueProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [flash, pulse] = useFlash();
  useEffect(() => { setEditing(false); setText(''); }, [p.date]);
  const v = num(p.integer ? text.replace(/[^\d]/g, '') : text);
  const valid = v != null && v >= p.min && v <= p.max;
  const shown = p.value ?? p.source;
  const save = () => { if (!valid) return; p.onSave(p.integer ? Math.round(v) : r1(v)); setEditing(false); setText(''); pulse(); };
  const open = () => { setText(p.value != null ? String(p.value) : ''); setEditing(true); };

  return (
    <div className={`lv ${flash ? 'pop' : ''}`}>
      <div className="lv-top">
        <label htmlFor={p.id}>{p.label}</label>
        {editing || shown == null ? (
          <form className="lv-form" onSubmit={e => { e.preventDefault(); save(); }}>
            <input className="inp" id={p.id} inputMode={p.integer ? 'numeric' : 'decimal'} autoComplete="off" autoFocus={editing}
              placeholder={p.placeholder != null ? String(p.placeholder) : '—'} value={text} onChange={e => setText(e.target.value)} />
            <span className="u">{p.unit}</span>
            <button className="btn sm primary" type="submit" disabled={!valid}>{editing ? 'Save' : 'Log'}</button>
            {editing && <button className="iconbtn sm" type="button" aria-label="Cancel" onClick={() => setEditing(false)}><Icon.close /></button>}
          </form>
        ) : (
          <div className="lv-val">
            <b>{fmt(shown, p.integer)}<u>{p.unit}</u></b>
            <small>{p.value != null ? 'logged' : p.sourceLabel}</small>
            <button className="btn sm" onClick={open}>{p.value != null ? 'Edit' : 'Change'}</button>
          </div>
        )}
      </div>
      {editing && p.value != null && (
        <button className="linkbtn danger" onClick={() => { p.onSave(undefined); setEditing(false); }}>Remove {p.label.toLowerCase()}{p.source != null ? ' and use the watch' : ''}</button>
      )}
      {p.pct != null && <div className="track"><i className={p.tone} style={{ width: `${Math.min(100, Math.max(0, p.pct))}%` }} /></div>}
      {p.note && <small className="lv-note">{p.note}</small>}
    </div>
  );
}

/* ---------- food ---------- */

/** Calories and protein from one-tap meals, a custom entry, or a total you set yourself. */
export function FoodCard({ data, date, log, cal: target, pro: proTarget, note, floor }: { data: Data; date: string; log: DayLog; cal: number; pro: number; note: string; floor?: number }) {
  const [custom, setCustom] = useState(false);
  const [kcal, setKcal] = useState(''), [g, setG] = useState(''), [name, setName] = useState('');
  const [totals, setTotals] = useState(false);
  const [flash, pulse] = useFlash();
  useEffect(() => { setCustom(false); setTotals(false); }, [date]);
  const cal = log.cal ?? 0, pro = log.pro ?? 0, food = log.food ?? [];
  const yesterday = data.days[addDays(date, -1)];
  const k = num(kcal.replace(/[^\d.]/g, '')), p = num(g.replace(/[^\d.]/g, ''));
  const validCustom = k != null && k > 0 && k < 5000 && (p == null || (p >= 0 && p < 400));
  const add = (e: { name: string; cal: number; pro: number }) => { editDay(date, d => addFood(d, e)); pulse(); };
  const left = target - cal;

  return (
    <article className={`card o-fuel foodlog ${flash ? 'pop' : ''}`}>
      <header><h3>Food</h3><span className="aside">{note}</span></header>
      <div className="fuel-row">
        <div><small>Calories</small><b>{cal.toLocaleString()}<u>/ {target.toLocaleString()}</u></b></div>
        <span className={left < 0 ? 'over' : ''}>{left >= 0 ? `${left.toLocaleString()} left` : `${(-left).toLocaleString()} over`}</span>
      </div>
      <div className="track"><i className={cal > target * 1.05 ? 'bad' : ''} style={{ width: `${Math.min(100, (cal / target) * 100)}%` }} /></div>
      <div className="fuel-row">
        <div><small>Protein</small><b>{pro}<u>/ {proTarget} g</u></b></div>
        <span className={pro >= proTarget ? 'hit' : ''}>{pro >= proTarget ? 'Target hit' : `${proTarget - pro} g to go`}</span>
      </div>
      <div className="track"><i className={pro >= proTarget ? 'good' : ''} style={{ width: `${Math.min(100, (pro / proTarget) * 100)}%` }} /></div>
      {floor != null && log.cal != null && cal < floor && (date < today() || new Date().getHours() >= 20) && <p className="fine warn-t">Under the {floor.toLocaleString()} kcal floor. Eat something with protein before bed.</p>}

      <div className="subhead">Add a meal</div>
      <div className="quick">
        {QUICK.map(m => {
          const n = food.filter(e => e.name === m.name).length;
          return (
            <button key={m.name} className={`qa ${n ? 'on' : ''}`} onClick={() => add({ name: m.name, cal: m.kcal, pro: m.pro })}>
              <b>{n ? <Icon.check /> : '+'} {m.name}{n > 1 ? ` ×${n}` : ''}</b><small>{m.kcal} kcal · {m.pro} g</small>
            </button>
          );
        })}
        <button className={`qa other ${custom ? 'on' : ''}`} onClick={() => setCustom(!custom)}><b>+ Something else</b><small>type it in</small></button>
      </div>
      {custom && (
        <form className="custom-food" onSubmit={e => { e.preventDefault(); if (!validCustom) return; add({ name: name.trim() || 'Other', cal: Math.round(k), pro: Math.round(p ?? 0) }); setKcal(''); setG(''); setName(''); setCustom(false); }}>
          <input className="inp name" placeholder="What (optional)" value={name} onChange={e => setName(e.target.value)} aria-label="What you ate" />
          <input className="inp" inputMode="numeric" placeholder="kcal" value={kcal} onChange={e => setKcal(e.target.value)} aria-label="Calories" autoFocus />
          <input className="inp" inputMode="numeric" placeholder="protein g" value={g} onChange={e => setG(e.target.value)} aria-label="Protein, grams" />
          <button className="btn primary" type="submit" disabled={!validCustom}>Add</button>
        </form>
      )}
      {!food.length && !!yesterday?.food?.length && (
        <button className="btn ghost repeat" onClick={() => { editDay(date, d => repeatFood(d, yesterday)); pulse(); }}>
          Repeat yesterday · {yesterday.food.reduce((a, e) => a + e.cal, 0).toLocaleString()} kcal, {yesterday.food.reduce((a, e) => a + e.pro, 0)} g
        </button>
      )}

      {food.length > 0 && (
        <ul className="eaten">
          {food.map((e, i) => (
            <li key={`${e.at}-${i}`}>
              <span>{e.name}<small>{time(e.at)}</small></span>
              <em>{e.cal} kcal · {e.pro} g</em>
              <button className="iconbtn sm" aria-label={`Remove ${e.name}`} onClick={() => editDay(date, d => removeFood(d, i))}><Icon.close /></button>
            </li>
          ))}
        </ul>
      )}

      {totals ? (
        <TotalsForm cal={log.cal} pro={log.pro} onCancel={() => setTotals(false)}
          onSave={(c, pr) => { editDay(date, d => { d.cal = c; d.pro = pr; }); setTotals(false); pulse(); }} />
      ) : (
        <button className="linkbtn" onClick={() => setTotals(true)}>{food.length ? 'Correct the totals' : 'Tracked it in another app? Enter the totals'}</button>
      )}
    </article>
  );
}

function TotalsForm({ cal, pro, onSave, onCancel }: { cal?: number; pro?: number; onSave: (c?: number, p?: number) => void; onCancel: () => void }) {
  const [c, setC] = useState(cal != null ? String(cal) : ''), [p, setP] = useState(pro != null ? String(pro) : '');
  const cv = num(c), pv = num(p);
  const ok = (cv == null || (cv >= 0 && cv < 10000)) && (pv == null || (pv >= 0 && pv < 500)) && (cv != null || pv != null);
  return (
    <form className="custom-food" onSubmit={e => { e.preventDefault(); if (ok) onSave(cv ?? undefined, pv ?? undefined); }}>
      <input className="inp" inputMode="numeric" placeholder="kcal total" value={c} onChange={e => setC(e.target.value)} aria-label="Calories for the day" autoFocus />
      <input className="inp" inputMode="numeric" placeholder="protein g" value={p} onChange={e => setP(e.target.value)} aria-label="Protein for the day, grams" />
      <button className="btn primary" type="submit" disabled={!ok}>Save totals</button>
      <button className="btn ghost" type="button" onClick={onCancel}>Cancel</button>
    </form>
  );
}

/* ---------- runs ---------- */

/** Minutes and distance for a run: the watch's numbers, or yours with Save run. Effort is one tap. */
export function RunLog({ date, log, s, watch }: { date: string; log: DayLog; s: { minutes?: number; km?: number; effort?: number }; watch?: { min?: number; km?: number } }) {
  const [editing, setEditing] = useState(false);
  const [m, setM] = useState(''), [k, setK] = useState('');
  const [flash, pulse] = useFlash();
  useEffect(() => { setEditing(false); }, [date]);
  const typed = log.min != null || log.km != null;
  const showMin = log.min ?? watch?.min, showKm = log.km ?? watch?.km;
  const mv = num(m), kv = num(k);
  const ok = (mv == null || (mv > 0 && mv < 600)) && (kv == null || (kv > 0 && kv < 100)) && (mv != null || kv != null);
  const pace = showMin && showKm ? showMin / showKm : undefined;
  const open = () => { setM(log.min != null ? String(log.min) : ''); setK(log.km != null ? String(log.km) : ''); setEditing(true); };

  return (
    <div className={`runlog ${flash ? 'pop' : ''}`}>
      {!editing && (showMin != null || showKm != null) ? (
        <div className={`logged ${typed ? '' : 'watch'}`}>
          <span className="wd-check"><Icon.check /></span>
          <div className="grow">
            <b>{[showMin != null && `${fmt(showMin)} min`, showKm != null && `${fmt(showKm)} km`].filter(Boolean).join(' · ')}</b>
            <small>{typed ? 'Logged' : 'From your watch'}{pace ? ` · ${clockPace(pace)}/km` : ''}</small>
          </div>
          <button className="btn sm" onClick={open}>{typed ? 'Edit' : 'Correct'}</button>
        </div>
      ) : (
        <form onSubmit={e => { e.preventDefault(); if (!ok) return; editDay(date, d => { d.min = mv != null ? r1(mv) : undefined; d.km = kv != null ? Math.round(kv * 100) / 100 : undefined; }); setEditing(false); pulse(); }}>
          <div className="fields">
            <div className="field"><label htmlFor="f-min">Minutes</label>
              <input className="inp" id="f-min" inputMode="decimal" autoComplete="off" placeholder={s.minutes ? String(s.minutes) : '—'} value={m} onChange={e => setM(e.target.value)} /></div>
            <div className="field"><label htmlFor="f-km">Distance (km)</label>
              <input className="inp" id="f-km" inputMode="decimal" autoComplete="off" placeholder={s.km ? String(s.km) : '—'} value={k} onChange={e => setK(e.target.value)} /></div>
          </div>
          <div className="row-actions">
            <button className="btn primary" type="submit" disabled={!ok}><Icon.check />Save run</button>
            {editing && <button className="btn ghost" type="button" onClick={() => setEditing(false)}>Cancel</button>}
            {editing && typed && <button className="btn ghost clear" type="button" onClick={() => { editDay(date, d => { delete d.min; delete d.km; }); setEditing(false); }}>Remove</button>}
          </div>
        </form>
      )}
      <Effort date={date} value={log.rpe} suggested={s.effort} />
    </div>
  );
}
const clockPace = (minPerKm: number) => { const sec = Math.round(minPerKm * 60); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };

const EFFORT_WORDS: Record<number, string> = { 1: 'Nothing', 3: 'Easy', 5: 'Steady', 7: 'Hard', 9: 'Very hard', 10: 'All out' };
/** How hard it felt, 1 to 10, saved on tap. */
export function Effort({ date, value, suggested }: { date: string; value?: number; suggested?: number }) {
  return (
    <div className="effort">
      <div className="effort-top"><span>How hard did it feel?</span>{value != null ? <b>{value} · {EFFORT_WORDS[value] ?? EFFORT_WORDS[value - 1] ?? ''}</b> : suggested != null && <small>plan says about {suggested}</small>}</div>
      <div className="effort-row" role="radiogroup" aria-label="Effort, 1 to 10">
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
          <button key={n} role="radio" aria-checked={value === n} className={`${value === n ? 'on' : ''} ${n === suggested && value == null ? 'sug' : ''} e${Math.ceil(n / 3.4)}`}
            onClick={() => editDay(date, d => { d.rpe = value === n ? undefined : n; })}>{n}</button>
        ))}
      </div>
    </div>
  );
}

/* ---------- notes ---------- */

/** Notes save as you type; this says so. */
export function NotesCard({ date, value }: { date: string; value?: string }) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => { setState('idle'); }, [date]);
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <article className="card o-note">
      <header><h3><label htmlFor="f-note">Notes</label></h3>
        <span className={`aside saved s-${state}`}>{state === 'saved' ? <><Icon.check />Saved</> : state === 'saving' ? 'Saving…' : 'Saves as you type'}</span></header>
      <textarea className="inp" id="f-note" placeholder="How it felt, what you swapped, anything aching…"
        value={value ?? ''} onChange={e => {
          const v = e.target.value;
          editDay(date, d => { d.note = v; });
          setState('saving'); clearTimeout(t.current); t.current = setTimeout(() => setState('saved'), 500);
        }} />
    </article>
  );
}
