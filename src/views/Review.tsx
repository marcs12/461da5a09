import { addDays, fmtDay, parse } from '../lib/dates';
import { SEED } from '../data/seed';

/** The Sunday review. For now: what it covers and when the next one is. */
export function Review({ today }: { today: string }) {
  const sunday = addDays(today, (7 - parse(today).getDay()) % 7);
  const minutes = SEED.review.steps.reduce((a, s) => a + s.minutes, 0);
  return (
    <section className="page">
      <div className="pagehead">
        <div><h1>Sunday review</h1><p>{sunday === today ? 'Today' : `Next: ${fmtDay(sunday)}`} · about {minutes} minutes</p></div>
      </div>
      <article className="card">
        <ol className="rules">
          {SEED.review.steps.map(s => <li key={s.id}><b>{s.label}</b><span>{s.minutes} min</span></li>)}
        </ol>
        <p className="fine rv-note">Scores fill themselves in from the week’s logs once the review is built. Until then, the template below works on paper.</p>
        <pre className="tmpl">{SEED.review.template}</pre>
      </article>
    </section>
  );
}
