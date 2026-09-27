import { diff, fmtDay, parse } from '../lib/dates';
import { PHASE_NAME, planDay } from '../lib/life';
import { sessionOf } from '../lib/program';
import { isDone } from '../lib/stats';
import type { Data } from '../lib/store';
import { SEED } from '../data/seed';

const WDS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The home screen: where you are in the 90 days and what's on today. */
export function Today({ data, today, openSession, openPlan }: { data: Data; today: string; openSession: () => void; openPlan: () => void }) {
  const S = data.settings;
  const pd = planDay(S, today);
  const toFly = diff(S.departDate, today);
  const trip = SEED.plan.tripDestination;

  const parts = pd.status === 'pre'
    ? [`Starts ${WDS[parse(S.planStart).getDay()]}`]
    : pd.status === 'post' ? ['90 days done']
    : [`Day ${pd.day} of ${S.planDays}`, PHASE_NAME[pd.phase]];
  if (toFly > 0) parts.push(toFly === 1 ? `${trip} tomorrow` : `${toFly} days to ${trip}`);

  const phase = pd.status === 'in' ? SEED.phases.find(p => p.id === (pd.phase === 'reentry' ? 'travel' : pd.phase)) : SEED.phases[0];
  const s = sessionOf(today);
  const done = s && s.kind !== 'break' && isDone(data, today, s);

  return (
    <section className="page">
      <button className="homehead" onClick={openPlan}>
        <span className="eyebrow">{parts.join(' · ')}</span>
        <h1>{fmtDay(today)}</h1>
      </button>

      <div className="areagrid">
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
        {phase && (
          <article className="card">
            <header><h3>{pd.status === 'pre' ? 'First up' : 'This phase'}</h3><span className="aside">{phase.name}</span></header>
            <p className="fine">{phase.summary}</p>
            <ul className="focus">{phase.focus.map(f => <li key={f}>{f}</li>)}</ul>
          </article>
        )}
        <article className="card">
          <header><h3>The minimum day</h3></header>
          <ul className="focus">{SEED.minimumDay.items.map(i => <li key={i.id}>{i.label}</li>)}</ul>
          <p className="fine">About 45 minutes. It counts even on a bad day.</p>
        </article>
      </div>
    </section>
  );
}
