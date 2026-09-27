import { useState } from 'react';
import { fmtDay, fmtShort } from '../../lib/dates';
import { tripBudget, tripDays, tripStats, type TripBudget, type TripSpend } from '../../lib/money';
import { delRec, putRec, recs, type Data } from '../../lib/store';
import { Sheet } from '../../components/Sheet';
import { NumField } from '../../components/ui';
import { TaskItem } from '../income/Cards';
import { SEED } from '../../data/seed';

export const cad = (n: number, cents = false) =>
  n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: cents ? 2 : 0, minimumFractionDigits: cents ? 2 : 0 });

/** The Vietnam budget: set it before you fly, log spending once a day while you're there. */
export function TripCard({ data, today, compact = false }: { data: Data; today: string; compact?: boolean }) {
  const [sheet, setSheet] = useState<'budget' | 'spend' | null>(null);
  const st = tripStats(data, today);
  const b = st.budget;
  const during = !!st.trip && today >= st.trip.from && today <= st.trip.to;
  const task = SEED.tasks.find(t => t.id === 'trip-budget')!;
  const spends = recs<TripSpend>(data, 'tripSpend').sort((x, y) => y.date.localeCompare(x.date) || y._u - x._u);

  return (
    <article className="card trip">
      <header><h2>{SEED.plan.tripDestination} budget</h2>{st.trip && <span className="aside">{fmtShort(st.trip.from)} – {fmtShort(st.trip.to)} · {st.trip.days} days</span>}</header>
      {b ? (
        <>
          <dl className="tiles mini">
            <div className="tile"><dt>Spent</dt><dd>{cad(st.spent)}<small>/ {cad(b.total)}</small></dd></div>
            <div className="tile"><dt>{during ? 'Today' : 'Daily cap'}</dt><dd>{during ? cad(st.spentToday) : cad(b.dailyCap)}{during && <small>/ {cad(b.dailyCap)}</small>}</dd></div>
            <div className="tile"><dt>Left per day</dt><dd>{st.perDayLeft != null ? cad(st.perDayLeft) : '—'}</dd></div>
          </dl>
          <div className="track trip-track"><i className={st.onBudget ? '' : 'warn'} style={{ width: `${Math.min(100, (st.spent / b.total) * 100)}%` }} /></div>
          {!st.onBudget && <p className="fine">Over the total by {cad(st.spent - b.total)}. The scoreboard marks it; nothing else changes.</p>}
          {!compact && spends.length > 0 && (
            <ul className="wins">
              {spends.slice(0, 6).map(s => (
                <li key={s.id}>
                  <span>{cad(s.amountCad, true)}{s.note && <b> · {s.note}</b>}<small>{fmtShort(s.date)}{s.amountVnd ? ` · ${s.amountVnd.toLocaleString('en-CA')} ₫` : ''}</small></span>
                  <button className="iconbtn" aria-label="Remove spend" onClick={() => delRec('tripSpend', s.id)}>✕</button>
                </li>
              ))}
            </ul>
          )}
          <div className="actions">
            <button className="btn primary" onClick={() => setSheet('spend')}>Log spending</button>
            {!compact && <button className="btn ghost" onClick={() => setSheet('budget')}>Edit budget</button>}
          </div>
        </>
      ) : (
        <>
          <p className="fine">Set a total and a daily cap before you fly. That ticks the last box on the “Before you fly” gate.</p>
          <ul className="tasks"><TaskItem data={data} t={task} /></ul>
          <div className="actions"><button className="btn primary" onClick={() => setSheet('budget')}>Set the budget</button></div>
        </>
      )}
      {sheet === 'budget' && <BudgetSheet data={data} onClose={() => setSheet(null)} />}
      {sheet === 'spend' && <SpendSheet data={data} today={today} onClose={() => setSheet(null)} />}
    </article>
  );
}

function BudgetSheet({ data, onClose }: { data: Data; onClose: () => void }) {
  const cur = tripBudget(data);
  const days = tripDays(data.settings)?.days ?? 8;
  const [total, setTotal] = useState<number | undefined>(cur?.total);
  const [cap, setCap] = useState<number | undefined>(cur?.dailyCap);
  const [rate, setRate] = useState<number | undefined>(cur?.vndPerCad);
  const suggested = total ? Math.floor(total / days) : undefined;
  const save = () => {
    if (!total) return;
    putRec<TripBudget>('tripBudget', { id: 'trip', total, dailyCap: cap ?? suggested ?? 0, vndPerCad: rate });
    onClose();
  };
  return (
    <Sheet title="Trip budget" onClose={onClose}>
      <form className="stack-sm" onSubmit={e => { e.preventDefault(); save(); }}>
        <div className="fields">
          <div className="field"><label htmlFor="t-total">Total (CAD)</label><NumField className="inp" id="t-total" inputMode="decimal" autoFocus value={total} onCommit={setTotal} /></div>
          <div className="field"><label htmlFor="t-cap">Daily cap (CAD)</label><NumField className="inp" id="t-cap" inputMode="decimal" placeholder={suggested ? String(suggested) : ''} value={cap} onCommit={setCap} /></div>
        </div>
        <div className="field"><label htmlFor="t-rate">Dong per dollar (optional)</label><NumField className="inp" id="t-rate" inputMode="decimal" placeholder="e.g. 18500" value={rate} onCommit={setRate} /></div>
        <p className="fine">{suggested ? `${cad(total!)} over ${days} days is about ${cad(suggested)} a day. ` : ''}Flights and the hotel you’ve already paid can stay out of it.</p>
        <div className="actions sheet-go"><button className="btn primary" disabled={!total}>Save</button></div>
      </form>
    </Sheet>
  );
}

export function SpendSheet({ data, today, onClose }: { data: Data; today: string; onClose: () => void }) {
  const b = tripBudget(data);
  const [vnd, setVnd] = useState(false);
  const [amount, setAmount] = useState<number | undefined>();
  const [note, setNote] = useState('');
  const rate = b?.vndPerCad;
  const asCad = amount == null ? undefined : vnd && rate ? Math.round((amount / rate) * 100) / 100 : amount;
  const save = () => {
    if (!asCad) return;
    putRec<TripSpend>('tripSpend', { id: crypto.randomUUID(), date: today, amountCad: asCad, amountVnd: vnd ? amount : undefined, note: note.trim() || undefined });
    onClose();
  };
  return (
    <Sheet title={`Spending · ${fmtDay(today)}`} onClose={onClose}>
      <form className="stack-sm" onSubmit={e => { e.preventDefault(); save(); }}>
        {rate && (
          <div className="seg" role="radiogroup" aria-label="Currency">
            <button type="button" role="radio" aria-checked={!vnd} onClick={() => setVnd(false)}>CAD</button>
            <button type="button" role="radio" aria-checked={vnd} onClick={() => setVnd(true)}>VND</button>
          </div>
        )}
        <div className="weigh-row">
          <NumField id="t-amt" inputMode="decimal" autoFocus aria-label={`Amount in ${vnd ? 'dong' : 'dollars'}`} placeholder="0" value={amount} onCommit={setAmount} />
          <span className="u">{vnd ? '₫' : '$'}</span>
        </div>
        {vnd && asCad != null && <p className="fine">= {cad(asCad, true)}</p>}
        <div className="field"><label htmlFor="t-note">What for (optional)</label><input className="inp" id="t-note" autoComplete="off" value={note} onChange={e => setNote(e.target.value)} placeholder="Food, Grab, tour" /></div>
        <p className="fine">Once a day is enough: log the day’s total.</p>
        <div className="actions sheet-go"><button className="btn primary" disabled={!asCad}>Save</button></div>
      </form>
    </Sheet>
  );
}
