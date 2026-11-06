import { useMemo, useState } from 'react';
import { addDays, diff, fmtShort, num, r1 } from '../lib/dates';
import { MAX_RATE, SETTLE_DAYS, forecastOn, weightModel, whenReach } from '../lib/forecast';
import { END, TT_DATE } from '../lib/program';
import { BEACH_END, GOAL_WEIGHT } from '../lib/targets';
import type { Data } from '../lib/schema';

const long = (ds: string) => new Date(`${ds}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

/** Pick a date, see where your weight lands; or pick a weight, see when. */
export function ForecastCard({ data, today }: { data: Data; today: string }) {
  const M = useMemo(() => weightModel(data, today), [data, today]);
  const presets = useMemo(() => [
    { label: 'In 4 weeks', date: addDays(today, 28) },
    { label: 'Christmas', date: '2026-12-25' },
    { label: 'Sub-60 trial', date: TT_DATE },
    { label: 'Sun Run', date: END },
    { label: 'Hawaii', date: BEACH_END },
  ].filter(p => p.date > today), [today]);
  const [date, setDate] = useState(presets.find(p => p.label === 'Sun Run')?.date ?? addDays(today, 28));
  const [target, setTarget] = useState('');

  if (!M) {
    return (
      <article className="card goal forecast">
        <header><h3>Weight forecast</h3></header>
        <p className="empty">Log a weigh-in from day 1 on and this shows where your weight is heading.</p>
      </article>
    );
  }

  const F = forecastOn(data, M, date < today ? today : date);
  const delta = F.w - M.now, vsPlan = F.w - F.plan;
  const tv = num(target);
  const tValid = tv != null && tv >= GOAL_WEIGHT && tv < M.now;
  const when = tValid ? whenReach(M, tv) : undefined;
  const weekly = M.now * M.rate * 7;

  return (
    <article className="card goal forecast">
      <header><h3>Weight forecast</h3><span className="aside">{M.basis === 'trend' ? 'from your last 4 weeks' : 'from the plan, until week 3'}</span></header>

      <div className="fc-pick">
        <label htmlFor="fc-date">On</label>
        <input id="fc-date" className="inp" type="date" min={addDays(today, 1)} max="2027-12-31" value={date} onChange={e => e.target.value && setDate(e.target.value)} />
      </div>
      <div className="fc-chips">
        {presets.map(p => <button key={p.label} className={`chip-btn ${p.date === date ? 'on' : ''}`} onClick={() => setDate(p.date)}>{p.label}</button>)}
      </div>

      <div className="fc-result">
        <div className="fc-big">
          <small>{long(F.date)} · {diff(F.date, today)} days</small>
          <b>{F.goalOn ? GOAL_WEIGHT : Math.round(F.w)}<u>lb</u></b>
          <span>{F.goalOn ? `Goal reached around ${fmtShort(F.goalOn)}` : `likely ${Math.round(F.low)}–${Math.round(F.high)} lb`}</span>
        </div>
        <dl className="fc-facts">
          <div><dt>From now</dt><dd className={delta < 0 ? 'down' : ''}>{delta < 0 ? '−' : '+'}{r1(Math.abs(delta)).toFixed(1)} lb</dd></div>
          <div><dt>The plan says</dt><dd>{Math.round(F.plan)} lb</dd></div>
          <div><dt>Vs the plan</dt><dd className={vsPlan <= 1 ? 'good' : 'warn'}>{Math.abs(vsPlan) <= 1 ? 'on track' : vsPlan < 0 ? `${Math.round(-vsPlan)} lb ahead` : `${Math.round(vsPlan)} lb behind`}</dd></div>
        </dl>
      </div>

      <form className="fc-when" onSubmit={e => e.preventDefault()}>
        <label htmlFor="fc-target">When will I weigh</label>
        <input id="fc-target" className="inp" inputMode="decimal" placeholder={String(Math.max(GOAL_WEIGHT, Math.floor((M.now - 10) / 5) * 5))} value={target} onChange={e => setTarget(e.target.value)} />
        <span className="u">lb?</span>
      </form>
      {target && (
        <p className="fc-answer">
          {tv == null ? 'Type a weight.'
            : tv >= M.now ? `You're already under ${tv}: your 7-day average is ${r1(M.now).toFixed(1)}.`
            : tv < GOAL_WEIGHT ? `The plan stops at ${GOAL_WEIGHT}: after that you eat at maintenance, so the forecast does too.`
            : !when ? 'Your trend is flat right now, so there is no date to give. A couple of on-plan weeks will fix that.'
            : <>Around <b>{long(when.date)}</b>{when.early && when.late && when.early !== when.late ? <>, likely between {fmtShort(when.early)} and {fmtShort(when.late)}</> : null}. That's {diff(when.date, today)} days from today{when.date > END ? ', after the Sun Run' : ''}.</>}
        </p>
      )}

      <p className="fine">
        {M.basis === 'trend'
          ? <>You're losing about {r1(weekly).toFixed(1)} lb a week{M.perWeek < -weekly - 0.05 ? ` (measured ${r1(-M.perWeek).toFixed(1)}, capped at ${(MAX_RATE * 7 * 100).toFixed(1)}% of bodyweight, about the fastest fat comes off)` : ''}. </>
          : <>Until you have three weeks of weigh-ins this follows the plan's pace. </>}
        Loss slows as you get lighter, so the forecast curves rather than running in a straight line. The first {SETTLE_DAYS} days are left out because they're mostly water.
        {M.gaining && ' Your average is creeping up right now, so the forecast holds flat until it turns.'}
      </p>
    </article>
  );
}
