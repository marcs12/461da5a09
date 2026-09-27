import { useState } from 'react';
import { fmtDay, fmtShort, r1, sgn } from '../../lib/dates';
import { MEALS, circuitsThisWeek, mealsWithProtein, sunRunDays, waistDue, waists, weekTraining, weeklyWeight, withMeals, type WaistEntry } from '../../lib/body';
import { isTravelMode } from '../../lib/life';
import { foodOutThisWeek } from '../../lib/money';
import { programDay } from '../../lib/program';
import { editDay, putRec, type Data } from '../../lib/store';
import { Sheet } from '../../components/Sheet';
import { NumField } from '../../components/ui';
import { Ring } from '../today/Cards';
import { TaskItem } from '../income/Cards';
import { SEED } from '../../data/seed';

const B = SEED.body;

/** The week at a glance, plus the plan's food checks, waist, travel circuit, Sun Run and checkup. */
export function Overview({ data, today, openSession, onCircuit }: { data: Data; today: string; openSession: () => void; onCircuit: (date: string) => void }) {
  const pd = programDay(today);
  const circuitTime = isTravelMode(data.settings, today) || (pd.status === 'in' && pd.phase.id === 'brk');
  return (
    <div className="areagrid">
      <div className="stack">
        {circuitTime && <CircuitCard data={data} today={today} onCircuit={onCircuit} />}
        <WeekCard data={data} today={today} openSession={openSession} />
        <FoodCard data={data} today={today} />
        <WeightCard data={data} today={today} />
      </div>
      <div className="stack">
        <WaistCard data={data} today={today} />
        <SunRunCard data={data} today={today} />
        <article className="card">
          <header><h2>Checkup</h2></header>
          <p className="fine">{B.checkup}.</p>
          <ul className="tasks"><TaskItem data={data} t={SEED.tasks.find(t => t.id === 'checkup')!} /></ul>
        </article>
      </div>
    </div>
  );
}

function WeekCard({ data, today, openSession }: { data: Data; today: string; openSession: () => void }) {
  const w = weekTraining(data, today);
  if (!w) return null;
  return (
    <article className="card">
      <header><h2>This week’s training</h2><span className="aside">week {w.week} · {w.phase.id === 'brk' ? 'break' : w.phase.label.toLowerCase()} · from {fmtShort(w.from)}</span></header>
      {w.phase.id === 'brk' ? (
        <p className="fine">Break week: no structured training. Walk everywhere; the travel circuit is there if you want it.</p>
      ) : (
        <div className="rings">
          <div><Ring done={w.done} total={w.planned} /><span>Sessions</span></div>
          <div><Ring done={w.walks} total={7} /><span>Walk days</span></div>
        </div>
      )}
      <div className="actions"><button className="btn" onClick={openSession}>Today’s session</button></div>
    </article>
  );
}

function FoodCard({ data, today }: { data: Data; today: string }) {
  const l = data.days[today] || {};
  const set = (fn: Parameters<typeof editDay>[1]) => editDay(today, fn);
  const n = mealsWithProtein(l);
  const out = foodOutThisWeek(data, today), outToday = l.foodOut ?? 0;
  const max = SEED.money.spendingRules.foodOutPerWeekMax;
  return (
    <article className="card">
      <header><h2>Food today</h2><span className="aside">{n}/3 meals with protein</span></header>
      <ul className="mins">
        {MEALS.map(m => {
          const on = l.meals ? !!l.meals[m.id] : n === 3;
          return (
            <li key={m.id}>
              <button className="min" aria-pressed={on} onClick={() => set(d => { Object.assign(d, withMeals(l, { [m.id]: !on })); })}>
                <i aria-hidden="true" /><span><b>Protein at {m.label.toLowerCase()}</b></span>
              </button>
            </li>
          );
        })}
        <li><button className="min" aria-pressed={!!l.veg} onClick={() => set(d => { d.veg = !l.veg || undefined; })}><i aria-hidden="true" /><span><b>Half the plate vegetables</b></span></button></li>
        <li><button className="min" aria-pressed={!!l.noLiquidCal} onClick={() => set(d => { d.noLiquidCal = !l.noLiquidCal || undefined; })}><i aria-hidden="true" /><span><b>No liquid calories</b><small>No pop, juice, sugary coffee or weekday alcohol</small></span></button></li>
      </ul>
      <div className="stepper food-out">
        <span>Food out this week <small>max {max}</small></span>
        <div>
          <button className="iconbtn" aria-label="One fewer meal out today" disabled={!outToday} onClick={() => set(d => { d.foodOut = Math.max(0, outToday - 1) || undefined; })}>−</button>
          <b className={out > max ? 'over' : ''}>{out}</b>
          <button className="iconbtn" aria-label="One more meal out today" onClick={() => set(d => { d.foodOut = outToday + 1; })}>+</button>
        </div>
      </div>
      <details className="rules-more">
        <summary>The food rules</summary>
        <ul className="focus">{B.foodRules.map(r => <li key={r}>{r}</li>)}</ul>
      </details>
    </article>
  );
}

function WeightCard({ data, today }: { data: Data; today: string }) {
  const w = weeklyWeight(data, today);
  if (!w) return null;
  return (
    <article className="card">
      <header><h2>Weekly average</h2><span className="aside">{w.count} weigh-in{w.count === 1 ? '' : 's'} this week · aim {w.perWeek}</span></header>
      <dl className="tiles mini">
        <div className="tile"><dt>This week</dt><dd>{w.avg != null ? r1(w.avg).toFixed(1) : '—'}</dd></div>
        <div className="tile"><dt>Last week</dt><dd>{w.prev != null ? r1(w.prev).toFixed(1) : '—'}</dd></div>
        <div className="tile"><dt>Change</dt><dd>{w.change != null ? sgn(w.change) : '—'}</dd></div>
      </dl>
      <p className="fine">The plan’s pace is about {w.targetPace} lb a week. Single weigh-ins bounce; the weekly average is the one to watch. The full chart is in Progress.</p>
    </article>
  );
}

function WaistCard({ data, today }: { data: Data; today: string }) {
  const [open, setOpen] = useState(false);
  const all = waists(data), last = all.at(-1), first = all[0];
  return (
    <article className="card">
      <header><h2>Waist</h2><span className="aside">first of each month</span></header>
      {last ? (
        <p className="waist"><b>{last.value}</b> in <small>{fmtShort(last.date)}{first && first !== last ? ` · ${sgn(last.value - first.value)} in since ${fmtShort(first.date)}` : ''}</small></p>
      ) : <p className="fine">At the belly button, relaxed, first thing in the morning.</p>}
      {waistDue(data, today) && <p className="msg">Measurement day.</p>}
      <div className="actions"><button className="btn" onClick={() => setOpen(true)}>Log waist</button></div>
      {open && <WaistSheet today={today} last={last?.value} onClose={() => setOpen(false)} />}
    </article>
  );
}

function WaistSheet({ today, last, onClose }: { today: string; last?: number; onClose: () => void }) {
  const [v, setV] = useState<number | undefined>();
  return (
    <Sheet title="Waist" onClose={onClose}>
      <form className="stack-sm" onSubmit={e => { e.preventDefault(); if (v == null) return; putRec<WaistEntry>('waist', { id: today.slice(0, 7), date: today, value: v, unit: 'in' }); onClose(); }}>
        <div className="weigh-row"><NumField id="waist-v" inputMode="decimal" autoFocus aria-label="Waist in inches" placeholder={last ? String(last) : '—'} value={v} onCommit={setV} /><span className="u">in</span></div>
        <p className="fine">One a month; a second one this month replaces it.</p>
        <div className="actions sheet-go"><button className="btn primary" disabled={v == null}>Save</button></div>
      </form>
    </Sheet>
  );
}

function SunRunCard({ data, today }: { data: Data; today: string }) {
  const days = sunRunDays(today);
  if (days < 0) return null;
  return (
    <article className="card">
      <header><h2>Sun Run {B.sunRun.distance}</h2><span className="aside">{fmtDay(B.sunRun.date)}</span></header>
      <p className="waist"><b>{days}</b> days <small>after the 10K on Jan 10, it’s the next one</small></p>
      <ul className="tasks"><TaskItem data={data} t={SEED.tasks.find(t => t.id === 'sun-run')!} /></ul>
      <p className="fine">{B.sunRun.note} <a href={B.sunRun.url} target="_blank" rel="noreferrer">Registration details</a></p>
    </article>
  );
}

export function CircuitCard({ data, today, onCircuit }: { data: Data; today: string; onCircuit: (date: string) => void }) {
  const done = circuitsThisWeek(data, today);
  const target = SEED.weeklyTargets.travel.circuits;
  const l = data.days[today] || {};
  const c = B.travelCircuit;
  return (
    <article className="card">
      <header><h2>Travel circuit</h2><span className="aside">{done}/{target} this week</span></header>
      <ol className="cx-list">{c.moves.map(m => <li key={m}><b>{m}</b><span>{c.rounds} rounds, 1 min rest between</span></li>)}</ol>
      <div className="actions">
        <button className="btn primary" onClick={() => onCircuit(today)}>Start the circuit</button>
        <button className="btn ghost" aria-pressed={!!l.circuit} onClick={() => editDay(today, d => { d.circuit = !l.circuit || undefined; })}>{l.circuit ? 'Done today ✓' : 'Mark done'}</button>
      </div>
    </article>
  );
}
