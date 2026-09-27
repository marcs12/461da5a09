import { useState } from 'react';
import { diff, fmtDay, fmtShort, iso } from '../../lib/dates';
import {
  foodOutThisWeek, latestFund, latestSnapshot, monthlyCost, nextPaydayFrom, orderStep, paydays, prefs, raise, runway,
  subscriptionUnused, waitHoursLeft, type FundEntry, type MoneyPrefs, type Snapshot, type Subscription, type Transfer, type WaitItem,
} from '../../lib/money';
import { delRec, editDay, patchRec, putRec, recs, type Data } from '../../lib/store';
import { Sheet } from '../../components/Sheet';
import { NumField } from '../../components/ui';
import { cad } from './Trip';
import { SEED } from '../../data/seed';

const M = SEED.money;

export function RunwayCard({ data }: { data: Data }) {
  const [sheet, setSheet] = useState<'fund' | 'target' | 'snapshot' | null>(null);
  const r = runway(data), s = latestSnapshot(data), f = latestFund(data), p = prefs(data);
  return (
    <article className="card">
      <header><h2>Freedom Fund</h2><span className="aside">runway</span></header>
      <div className="runway">
        <b>{r ?? '—'}</b><span>{r != null ? `month${r === 1 ? '' : 's'}` : ''}</span>
        {p.runwayTarget != null && <small>Day-90 target: {p.runwayTarget} months</small>}
      </div>
      <dl className="kv">
        <div><dt>Fund balance</dt><dd>{f ? `${cad(f.balance)} · ${fmtShort(f.date)}` : 'not logged'}</dd></div>
        <div><dt>Cost of living</dt><dd>{s ? `${cad(s.monthlyCost)} a month` : 'needs the snapshot'}</dd></div>
      </dl>
      <div className="actions">
        {!s && <button className="btn primary" onClick={() => setSheet('snapshot')}>Do the money snapshot</button>}
        <button className={`btn ${s ? 'primary' : ''}`} onClick={() => setSheet('fund')}>Update balance</button>
        {s && <button className="btn ghost" onClick={() => setSheet('target')}>{p.runwayTarget != null ? 'Change target' : 'Set Day-90 target'}</button>}
      </div>
      {sheet === 'fund' && <FundSheet onClose={() => setSheet(null)} current={f?.balance} />}
      {sheet === 'target' && <TargetSheet data={data} onClose={() => setSheet(null)} />}
      {sheet === 'snapshot' && <SnapshotSheet data={data} onClose={() => setSheet(null)} />}
    </article>
  );
}

export function FundSheet({ current, onClose }: { current?: number; onClose: () => void }) {
  const [v, setV] = useState<number | undefined>(current);
  const save = () => { if (v == null) return; putRec<FundEntry>('fund', { id: crypto.randomUUID(), date: iso(new Date()), balance: v }); onClose(); };
  return (
    <Sheet title="Freedom Fund balance" onClose={onClose}>
      <form className="stack-sm" onSubmit={e => { e.preventDefault(); save(); }}>
        <div className="weigh-row"><span className="u">$</span><NumField id="f-bal" inputMode="decimal" autoFocus aria-label="Balance in dollars" value={v} onCommit={setV} /></div>
        <div className="actions sheet-go"><button className="btn primary" disabled={v == null}>Save</button></div>
      </form>
    </Sheet>
  );
}

function TargetSheet({ data, onClose }: { data: Data; onClose: () => void }) {
  const [v, setV] = useState<number | undefined>(prefs(data).runwayTarget);
  const save = () => { patchRec<MoneyPrefs>('moneyPrefs', 'main', { runwayTarget: v }, {}); onClose(); };
  return (
    <Sheet title="Runway by Dec 26" onClose={onClose}>
      <form className="stack-sm" onSubmit={e => { e.preventDefault(); save(); }}>
        <div className="weigh-row"><NumField id="f-target" inputMode="decimal" autoFocus aria-label="Months of runway" value={v} onCommit={setV} /><span className="u">months</span></div>
        <p className="fine">Now: {runway(data) ?? '—'} months. Pick a number you can reach with a transfer every payday.</p>
        <div className="actions sheet-go"><button className="btn primary">Save</button></div>
      </form>
    </Sheet>
  );
}

type Row = Record<string, string | number>;
/** Editable rows (name + numbers) for the snapshot's lists. */
function Rows<T extends Row>({ rows, cols, blank, onChange }: { rows: T[]; cols: { k: keyof T; label: string; num?: boolean }[]; blank: T; onChange: (r: T[]) => void }) {
  const set = (i: number, k: keyof T, v: string | number | undefined) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v ?? 0 } : r)));
  return (
    <div className="rows">
      {rows.map((r, i) => (
        <div className="row" key={i}>
          {cols.map(c => c.num
            ? <NumField key={String(c.k)} className="inp" inputMode="decimal" aria-label={`${c.label} ${i + 1}`} placeholder={c.label} value={(r[c.k] as number) || undefined} onCommit={v => set(i, c.k, v)} />
            : <input key={String(c.k)} className="inp" aria-label={`${c.label} ${i + 1}`} placeholder={c.label} value={r[c.k] as string} onChange={e => set(i, c.k, e.target.value)} />)}
          <button type="button" className="iconbtn" aria-label="Remove row" onClick={() => onChange(rows.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="addset" onClick={() => onChange([...rows, { ...blank }])}>+ Add</button>
    </div>
  );
}

function SnapshotSheet({ data, onClose }: { data: Data; onClose: () => void }) {
  const prev = latestSnapshot(data);
  const [step, setStep] = useState(0);
  const [accounts, setAccounts] = useState(prev?.accounts ?? [{ name: 'Chequing', balance: 0 }, { name: 'Savings', balance: 0 }]);
  const [debts, setDebts] = useState(prev?.debts ?? [{ name: 'Credit card', balance: 0, ratePct: 0 }]);
  const [fixed, setFixed] = useState(prev?.fixedCosts ?? [{ name: 'Phone', monthly: 0 }, { name: 'Transit', monthly: 0 }]);
  const [split, setSplit] = useState(prev?.spendSplit ?? { needs: 0, wants: 0, foodOut: 0 });
  const computed = monthlyCost(fixed, split);
  const [override, setOverride] = useState<number | undefined>();
  const titles = ['Accounts', 'Debts', 'Fixed monthly costs', 'Last 3 months', 'Cost of living'];
  const save = () => {
    const named = <T extends { name: string }>(xs: T[]) => xs.filter(x => x.name.trim());
    putRec<Snapshot>('snapshots', {
      id: crypto.randomUUID(), date: iso(new Date()), accounts: named(accounts), debts: named(debts), fixedCosts: named(fixed), spendSplit: split, monthlyCost: override ?? computed,
    });
    onClose();
  };
  const splitField = (k: keyof typeof split, label: string) => (
    <div className="field"><label htmlFor={`sp-${k}`}>{label}</label>
      <NumField className="inp" id={`sp-${k}`} inputMode="decimal" value={split[k] || undefined} onCommit={v => setSplit({ ...split, [k]: v ?? 0 })} /></div>
  );
  return (
    <Sheet title={`Snapshot · ${titles[step]}`} onClose={onClose}>
      <div className="ob-dots" aria-hidden="true">{titles.map((t, i) => <i key={t} className={i <= step ? 'on' : ''} />)}</div>
      <p className="fine">{M.snapshotSteps[step]}.</p>
      {step === 0 && <Rows rows={accounts} blank={{ name: '', balance: 0 }} onChange={setAccounts} cols={[{ k: 'name', label: 'Account' }, { k: 'balance', label: 'Balance', num: true }]} />}
      {step === 1 && <Rows rows={debts} blank={{ name: '', balance: 0, ratePct: 0 }} onChange={setDebts} cols={[{ k: 'name', label: 'Debt' }, { k: 'balance', label: 'Owing', num: true }, { k: 'ratePct', label: 'Rate %', num: true }]} />}
      {step === 2 && <Rows rows={fixed} blank={{ name: '', monthly: 0 }} onChange={setFixed} cols={[{ k: 'name', label: 'Cost' }, { k: 'monthly', label: 'A month', num: true }]} />}
      {step === 3 && (
        <div className="stack-sm">
          <p className="fine">Everything else you spent over 3 months, beyond the fixed costs. Bank and card statements have it.</p>
          <div className="fields">{splitField('needs', 'Needs')}{splitField('wants', 'Wants')}{splitField('foodOut', 'Food out')}</div>
        </div>
      )}
      {step === 4 && (
        <div className="stack-sm">
          <div className="weigh-row"><span className="u">$</span><NumField id="sp-total" inputMode="decimal" aria-label="Monthly cost of living" placeholder={String(computed)} value={override} onCommit={setOverride} /><span className="u">a month</span></div>
          <p className="fine">Fixed costs plus a third of the 3-month spending: {cad(computed)}. Type over it if you know better.</p>
        </div>
      )}
      <div className="actions ob-nav">
        {step > 0 && <button className="btn ghost" onClick={() => setStep(step - 1)}>Back</button>}
        <button className="btn primary" onClick={() => (step === titles.length - 1 ? save() : setStep(step + 1))}>{step === titles.length - 1 ? 'Save snapshot' : 'Next'}</button>
      </div>
    </Sheet>
  );
}

export function OrderCard({ data }: { data: Data }) {
  const step = orderStep(data);
  const s = latestSnapshot(data);
  return (
    <article className="card">
      <header><h2>Order of operations</h2>{s && <span className="aside">snapshot {fmtShort(s.date)}</span>}</header>
      <ol className="order">
        {M.orderOfOperations.map((o, i) => (
          <li key={o} className={step === i + 1 ? 'on' : step != null && i + 1 < step ? 'past' : ''}>{o}</li>
        ))}
      </ol>
      <p className="fine">{step == null ? 'The snapshot tells you which step you’re on.' : `You’re on step ${step}.`} {s && diff(iso(new Date()), s.date) >= 28 ? 'Time for this month’s snapshot.' : ''}</p>
    </article>
  );
}

export function PaydayCard({ data, today }: { data: Data; today: string }) {
  const [open, setOpen] = useState(false);
  const S = data.settings, p = prefs(data);
  const next = nextPaydayFrom(S, today);
  const pct = M.payYourselfFirstPct;
  const transfers = recs<Transfer>(data, 'transfers').sort((a, b) => b.date.localeCompare(a.date));
  const due = paydays(S, S.planStart, today).length;
  const logged = new Set(paydays(S, S.planStart, today).filter(pd => transfers.some(t => t.date >= pd && diff(t.date, pd) < 14))).size;
  const r = raise(data);
  return (
    <article className="card">
      <header><h2>Pay yourself first</h2><span className="aside">{pct}% of take-home</span></header>
      <dl className="kv">
        <div><dt>Next payday</dt><dd>{next ? fmtDay(next) : 'set it in Settings'}</dd></div>
        {p.takeHome != null && <div><dt>Transfer</dt><dd>{cad(Math.round((p.takeHome * pct) / 100))} of {cad(p.takeHome)}</dd></div>}
        <div><dt>Paydays covered</dt><dd>{logged} of {due}</dd></div>
      </dl>
      {r && <p className="msg">Take-home went up {cad(r.amount)}. {M.raiseRule}: at least {cad(r.save)} more each payday.</p>}
      {transfers.length > 0 && (
        <ul className="wins">
          {transfers.slice(0, 4).map(t => (
            <li key={t.id}><span>{cad(t.amount)}<small>{fmtShort(t.date)}{t.takeHome ? ` · of ${cad(t.takeHome)}` : ''}</small></span>
              <button className="iconbtn" aria-label="Remove transfer" onClick={() => delRec('transfers', t.id)}>✕</button></li>
          ))}
        </ul>
      )}
      <div className="actions"><button className="btn primary" onClick={() => setOpen(true)}>Log a transfer</button></div>
      {open && <TransferSheet data={data} today={today} onClose={() => setOpen(false)} />}
    </article>
  );
}

export function TransferSheet({ data, today, onClose }: { data: Data; today: string; onClose: () => void }) {
  const p = prefs(data);
  const [takeHome, setTakeHome] = useState<number | undefined>(p.takeHome);
  const suggested = takeHome ? Math.round((takeHome * M.payYourselfFirstPct) / 100) : undefined;
  const [amount, setAmount] = useState<number | undefined>();
  const save = () => {
    const a = amount ?? suggested;
    if (!a) return;
    putRec<Transfer>('transfers', { id: crypto.randomUUID(), date: today, amount: a, takeHome });
    if (takeHome != null && takeHome !== p.takeHome) patchRec<MoneyPrefs>('moneyPrefs', 'main', { takeHome }, {});
    onClose();
  };
  return (
    <Sheet title="Payday transfer" onClose={onClose}>
      <form className="stack-sm" onSubmit={e => { e.preventDefault(); save(); }}>
        <div className="fields">
          <div className="field"><label htmlFor="tr-home">This paycheque (take-home)</label><NumField className="inp" id="tr-home" inputMode="decimal" value={takeHome} onCommit={setTakeHome} /></div>
          <div className="field"><label htmlFor="tr-amt">Moved to the Freedom Fund</label><NumField className="inp" id="tr-amt" inputMode="decimal" autoFocus={p.takeHome != null} placeholder={suggested ? String(suggested) : ''} value={amount} onCommit={setAmount} /></div>
        </div>
        <p className="fine">{suggested ? `${M.payYourselfFirstPct}% is ${cad(suggested)}. ` : ''}Set up an automatic transfer for payday and this becomes one tap.</p>
        <div className="actions sheet-go"><button className="btn primary" disabled={!(amount ?? suggested)}>Save</button></div>
      </form>
    </Sheet>
  );
}

export function SpendingCard({ data, today, now }: { data: Data; today: string; now: Date }) {
  const [sheet, setSheet] = useState<'sub' | 'wait' | null>(null);
  const R = M.spendingRules;
  const out = foodOutThisWeek(data, today), outToday = data.days[today]?.foodOut ?? 0;
  const subs = recs<Subscription>(data, 'subscriptions').sort((a, b) => a.name.localeCompare(b.name));
  const waits = recs<WaitItem>(data, 'waitList').filter(w => !w.decision).sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  const monthlySubs = subs.filter(s => !s.cancel).reduce((a, s) => a + s.monthly, 0);
  return (
    <article className="card">
      <header><h2>Spending rules</h2></header>
      <div className="stepper">
        <span>Food out this week <small>max {R.foodOutPerWeekMax}</small></span>
        <div>
          <button className="iconbtn" aria-label="One fewer meal out today" disabled={!outToday} onClick={() => editDay(today, d => { d.foodOut = Math.max(0, outToday - 1) || undefined; })}>−</button>
          <b className={out > R.foodOutPerWeekMax ? 'over' : ''}>{out}</b>
          <button className="iconbtn" aria-label="One more meal out today" onClick={() => editDay(today, d => { d.foodOut = outToday + 1; })}>+</button>
        </div>
      </div>

      <h3 className="subhead">Subscriptions{subs.length ? ` · ${cad(monthlySubs)} a month` : ''}</h3>
      {subs.length ? (
        <ul className="wins">
          {subs.map(s => {
            const unused = subscriptionUnused(s, today);
            return (
              <li key={s.id} className={s.cancel ? 'dim' : ''}>
                <span>{s.name} · {cad(s.monthly, true)}<small>{s.cancel ? 'cancelling' : s.lastUsed ? `used ${fmtShort(s.lastUsed)}` : 'last use not logged'}{unused && <em className="due"> · unused 30+ days</em>}</small></span>
                <div className="res-act">
                  {!s.cancel && <button className="btn small" onClick={() => patchRec<Subscription>('subscriptions', s.id, { lastUsed: today }, s)}>Used</button>}
                  <button className="btn small ghost" onClick={() => patchRec<Subscription>('subscriptions', s.id, { cancel: !s.cancel }, s)}>{s.cancel ? 'Keep' : 'Cancel'}</button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : <p className="fine">List every subscription. Anything unused for {R.subscriptionUnusedDays} days gets flagged.</p>}
      <div className="actions"><button className="btn" onClick={() => setSheet('sub')}>Add a subscription</button></div>

      <h3 className="subhead">48-hour list</h3>
      {waits.length ? (
        <ul className="wins">
          {waits.map(w => {
            const left = waitHoursLeft(w, now);
            return (
              <li key={w.id}>
                <span>{w.item} · {cad(w.price)}<small>{left ? `decide in ${left} h` : 'decide now'}</small></span>
                <div className="res-act">
                  <button className="btn small" disabled={left > 0} onClick={() => patchRec<WaitItem>('waitList', w.id, { decision: 'buy' }, w)}>Buy</button>
                  <button className="btn small ghost" disabled={left > 0} onClick={() => patchRec<WaitItem>('waitList', w.id, { decision: 'skip' }, w)}>Skip</button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : <p className="fine">Anything non-essential over {cad(R.waitThresholdCad)} waits {R.waitHours} hours first.</p>}
      <div className="actions"><button className="btn" onClick={() => setSheet('wait')}>Add to the list</button></div>

      {sheet === 'sub' && <SubSheet today={today} onClose={() => setSheet(null)} />}
      {sheet === 'wait' && <WaitSheet onClose={() => setSheet(null)} />}
    </article>
  );
}

function SubSheet({ today, onClose }: { today: string; onClose: () => void }) {
  const [name, setName] = useState('');
  const [monthly, setMonthly] = useState<number | undefined>();
  const [usedToday, setUsedToday] = useState(true);
  const ok = name.trim() && monthly;
  return (
    <Sheet title="Subscription" onClose={onClose}>
      <form className="stack-sm" onSubmit={e => { e.preventDefault(); if (!ok) return; putRec<Subscription>('subscriptions', { id: crypto.randomUUID(), name: name.trim(), monthly: monthly!, lastUsed: usedToday ? today : undefined }); onClose(); }}>
        <div className="fields">
          <div className="field"><label htmlFor="sb-name">Name</label><input className="inp" id="sb-name" autoFocus autoComplete="off" value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="field"><label htmlFor="sb-m">A month</label><NumField className="inp" id="sb-m" inputMode="decimal" value={monthly} onCommit={setMonthly} /></div>
        </div>
        <label className="check" htmlFor="sb-used"><input type="checkbox" id="sb-used" checked={usedToday} onChange={e => setUsedToday(e.target.checked)} /><span>Used it recently</span></label>
        <div className="actions sheet-go"><button className="btn primary" disabled={!ok}>Save</button></div>
      </form>
    </Sheet>
  );
}

function WaitSheet({ onClose }: { onClose: () => void }) {
  const [item, setItem] = useState('');
  const [price, setPrice] = useState<number | undefined>();
  const ok = item.trim() && price;
  return (
    <Sheet title="48-hour list" onClose={onClose}>
      <form className="stack-sm" onSubmit={e => { e.preventDefault(); if (!ok) return; putRec<WaitItem>('waitList', { id: crypto.randomUUID(), item: item.trim(), price: price!, addedAt: new Date().toISOString() }); onClose(); }}>
        <div className="fields">
          <div className="field"><label htmlFor="wl-item">What</label><input className="inp" id="wl-item" autoFocus autoComplete="off" value={item} onChange={e => setItem(e.target.value)} /></div>
          <div className="field"><label htmlFor="wl-price">Price</label><NumField className="inp" id="wl-price" inputMode="decimal" value={price} onCommit={setPrice} /></div>
        </div>
        <p className="fine">Buy and Skip unlock in {M.spendingRules.waitHours} hours.</p>
        <div className="actions sheet-go"><button className="btn primary" disabled={!ok}>Add</button></div>
      </form>
    </Sheet>
  );
}
