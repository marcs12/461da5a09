import { addDays, fmtDay, fmtShort } from '../lib/dates';
import { PHASE_NAME, buildStart, phaseRanges, planDay, planEnd } from '../lib/life';
import type { Data } from '../lib/store';
import { SEED } from '../data/seed';

/** Roadmap, gates, the five rules and the weekly time budget. */
export function PlanPage({ data, today }: { data: Data; today: string }) {
  const S = data.settings;
  const cur = planDay(S, today);
  const curPhase = cur.status === 'in' ? cur.phase : null;
  const b = buildStart(S);
  const gateDue: Record<string, string | null> = {
    'before-fly': addDays(S.departDate, -1),
    'first-week-back': b && addDays(b, 6),
  };
  const seedPhase = (id: string) => SEED.phases.find(p => p.id === (id === 'reentry' ? 'travel' : id))!;
  const hours = SEED.weeklyTimeBudgetHours.reduce((a, x) => a + x.hours, 0);

  return (
    <section className="page">
      <div className="pagehead">
        <div><h1>The plan</h1><p>{SEED.plan.name} · {fmtShort(S.planStart)} – {fmtShort(planEnd(S))}</p></div>
      </div>
      <p className="north">{SEED.plan.northStar}</p>

      <div className="plangrid">
        <div className="stack">
          <article className="card">
            <header><h3>Roadmap</h3></header>
            <ol className="road">
              {phaseRanges(S).map(p => {
                const sp = seedPhase(p.id);
                return (
                  <li key={p.id} className={curPhase === p.id ? 'on' : ''}>
                    <div className="road-head"><b>{PHASE_NAME[p.id]}</b><span>{fmtShort(p.from)}{p.to ? ` – ${fmtShort(p.to)}` : ' – set your return date'}</span></div>
                    {p.id === 'reentry'
                      ? <p>Home, still on travel rules. Sunday review, then Build starts Monday.</p>
                      : <>
                        <p>{sp.summary}</p>
                        <ul>{sp.focus.map(f => <li key={f}>{f}</li>)}</ul>
                      </>}
                  </li>
                );
              })}
            </ol>
          </article>

          <article className="card">
            <header><h3>Gates</h3></header>
            <div className="stack-sm">
              {SEED.gates.map(g => (
                <div key={g.id} className="gate">
                  <div className="road-head"><b>{g.name}</b><span>{gateDue[g.id] ? `by ${fmtDay(gateDue[g.id]!)}` : 'after you’re back'}</span></div>
                  <ul>{g.criteria.map(c => <li key={c.id}>{c.label}</li>)}</ul>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="stack">
          <article className="card">
            <header><h3>The five rules</h3></header>
            <ol className="rules">
              {SEED.rules.map(r => <li key={r.id}><b>{r.title}</b><span>{r.body}</span></li>)}
            </ol>
          </article>

          <article className="card">
            <header><h3>A week’s time</h3><span className="aside">{hours} h</span></header>
            <dl className="kv">
              {SEED.weeklyTimeBudgetHours.map(x => <div key={x.area}><dt>{x.area}</dt><dd>{x.hours} h</dd></div>)}
            </dl>
          </article>

          <article className="card">
            <header><h3>{SEED.parkingLot.title}</h3></header>
            <p className="fine">{SEED.parkingLot.note}</p>
          </article>
        </div>
      </div>
    </section>
  );
}
