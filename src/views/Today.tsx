import { useState } from 'react';
import { diff, fmtDay, parse } from '../lib/dates';
import { PHASE_NAME, isTravelMode, planDay } from '../lib/life';
import { sessionOf } from '../lib/program';
import { toMin } from '../lib/schedule';
import { isDone } from '../lib/stats';
import type { Data } from '../lib/store';
import { SEED } from '../data/seed';
import { GateCard, MinimumDay, TimeBlocks, TopThree } from './today/Cards';
import { CheckInSheet, QUICK, QuickSheet, type QuickKind } from './today/QuickLog';
import { SpendSheet, TripCard, cad } from './money/Trip';
import { TransferSheet } from './money/Cards';
import { CircuitCard } from './body/Overview';
import { waistDue } from '../lib/body';
import { prefs, transferDue, tripStats } from '../lib/money';

const WDS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Props {
  data: Data;
  today: string;
  now: Date;
  openSession: () => void;
  openPlan: () => void;
  openReview: () => void;
  openIncome: () => void;
  onCircuit: (date: string) => void;
  openBody: () => void;
}

/** The home screen: what to do now, pulled from all four areas. */
export function Today({ data, today, now, openSession, openPlan, openReview, openIncome, onCircuit, openBody }: Props) {
  const [quick, setQuick] = useState<QuickKind | null>(null);
  const [checkInDate, setCheckInDate] = useState<string | null>(null);
  const [moneySheet, setMoneySheet] = useState<'transfer' | 'spend' | null>(null);
  const S = data.settings;
  const pd = planDay(S, today);
  const toFly = diff(S.departDate, today);
  const trip = SEED.plan.tripDestination;
  const travel = isTravelMode(S, today);

  const parts = pd.status === 'pre'
    ? [`Starts ${WDS[parse(S.planStart).getDay()]}`]
    : pd.status === 'post' ? ['90 days done']
    : [`Day ${pd.day} of ${S.planDays}`, PHASE_NAME[pd.phase]];
  if (toFly > 0) parts.push(toFly === 1 ? `${trip} tomorrow` : `${toFly} days to ${trip}`);
  if (pd.status === 'in' && pd.phase === 'travel' && !S.returnDate) parts.push('Back yet? Set it in Settings');

  const s = sessionOf(today);
  const done = s && s.kind !== 'break' && isDone(data, today, s);
  const hm = now.getHours() * 60 + now.getMinutes();
  const evening = hm >= toMin(S.lightsOut) - 30;
  const payday = transferDue(data, today);
  const takeHome = prefs(data).takeHome;
  const tripBudget = tripStats(data, today).budget;
  const onLink = (l: string) => (l === 'income' ? openIncome() : l === 'body' ? openSession() : setCheckInDate(today));

  return (
    <section className="page">
      <button className="homehead" onClick={openPlan}>
        <span className="eyebrow">{parts.join(' · ')}</span>
        <h1>{fmtDay(today)}</h1>
      </button>

      {parse(today).getDay() === 0 && (
        <button className="banner" onClick={openReview}><b>Sunday review</b><span>About 20 minutes. Open it</span></button>
      )}
      {payday && (
        <button className="banner" onClick={() => setMoneySheet('transfer')}>
          <b>Pay yourself first</b><span>Payday {payday === today ? 'today' : fmtDay(payday)}. Log the transfer{takeHome ? `: ${cad(Math.round((takeHome * SEED.money.payYourselfFirstPct) / 100))}` : ''}</span>
        </button>
      )}
      {waistDue(data, today) && !travel && (
        <button className="banner" onClick={openBody}><b>Waist measurement</b><span>First of the month. Log it in Body</span></button>
      )}
      {travel && <p className="banner quiet">Enjoy it. Walk, protein, check-in. That’s the whole job today.</p>}
      {evening && !data.days[today]?.checkedIn && (
        <button className="banner" onClick={() => setCheckInDate(today)}>
          <b>Evening check-in</b><span>Under a minute. Mood, one win, tomorrow’s first task</span>
        </button>
      )}

      <div className="areagrid">
        <div className="stack">
          <MinimumDay data={data} today={today} now={now} openCheckIn={setCheckInDate} />
          <nav className="quick" aria-label="Quick log">
            {QUICK.filter(q => !travel || q.id !== 'application').map(q => (
              <button key={q.id} className="btn" onClick={() => setQuick(q.id)}>{q.label}</button>
            ))}
            {travel && tripBudget && <button className="btn" onClick={() => setMoneySheet('spend')}>Spending</button>}
          </nav>
          {travel && <TripCard data={data} today={today} compact />}
          {travel && <CircuitCard data={data} today={today} onCircuit={onCircuit} />}
          <GateCard data={data} today={today} openPlan={openPlan} />
        </div>
        <div className="stack">
          {!travel && <TimeBlocks data={data} today={today} now={now} onLink={onLink} />}
          {!travel && <TopThree data={data} today={today} />}
          {s && (
            <article className={`card todo k-${s.kind}`}>
              <header><h3>Training</h3><span className={`chip k-${s.kind}`}>{s.tag}</span></header>
              <b className="todo-title">{s.title}</b>
              <p className="fine">{s.lines[0]}</p>
              <div className="actions">
                <button className="btn primary" onClick={openSession}>{done ? 'Done · view session' : 'Open session'}</button>
              </div>
            </article>
          )}
        </div>
      </div>

      {quick && <QuickSheet kind={quick} data={data} date={today} onClose={() => setQuick(null)} openSession={openSession} />}
      {moneySheet === 'transfer' && <TransferSheet data={data} today={today} onClose={() => setMoneySheet(null)} />}
      {moneySheet === 'spend' && <SpendSheet data={data} today={today} onClose={() => setMoneySheet(null)} />}
      {checkInDate && <CheckInSheet data={data} date={checkInDate} onClose={() => setCheckInDate(null)} />}
    </section>
  );
}
