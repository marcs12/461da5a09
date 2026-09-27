import { fmtDay, fmtShort } from '../lib/dates';
import { gates } from '../lib/gates';
import { PHASE_NAME, phaseRanges, planDay, planEnd } from '../lib/life';
import { scoreboard } from '../lib/review';
import { delRec, putRec, type Data, type GateOverride } from '../lib/store';
import { SEED } from '../data/seed';

const AREAS = [['income', 'Income'], ['body', 'Body'], ['mind', 'Mind'], ['money', 'Money']] as const;

/** Roadmap, gates, the Day-90 scoreboard, the five rules and the weekly time budget. */
export function PlanPage({ data, today, openSettings }: { data: Data; today: string; openSettings: () => void }) {
  const S = data.settings;
  const cur = planDay(S, today);
  const curPhase = cur.status === 'in' ? cur.phase : null;
  const seedPhase = (id: string) => SEED.phases.find(p => p.id === (id === 'reentry' ? 'travel' : id))!;
  const hours = SEED.weeklyTimeBudgetHours.reduce((a, x) => a + x.hours, 0);
  const board = scoreboard(data, today);

  return (
    <section className="page">
      <div className="pagehead">
        <div><h1>The plan</h1><p>{SEED.plan.name} · {fmtShort(S.planStart)} – {fmtShort(planEnd(S))}</p></div>
      </div>
      <p className="north">{SEED.plan.northStar}</p>
      {cur.status === 'post' && (
        <button className="banner" onClick={openSettings}><b>Day 90 is done</b><span>Score the table below, then start the next 90 days in Settings</span></button>
      )}

      <div className="plangrid">
        <div className="stack">
          <article className="card">
            <header><h2>Scoreboard</h2><span className="aside">Day-90 targets · {board.filter(b => b.met).length}/{board.length} met</span></header>
            {AREAS.map(([id, name]) => (
              <section key={id}>
                <h3 className="subhead">{name}</h3>
                <ul className="board">
                  {board.filter(b => b.area === id).map(b => (
                    <li key={b.id} className={b.met ? 'met' : ''}>
                      <span>{b.label}</span>
                      <b>{b.value}</b>
                      {b.progress != null && <div className="track"><i style={{ width: `${b.progress * 100}%` }} /></div>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <p className="fine">Stretch: {SEED.stretchGoals.join(' · ')}.</p>
          </article>

          <article className="card">
            <header><h2>Roadmap</h2></header>
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
        </div>

        <div className="stack">
          {gates(data).map(g => (
            <article key={g.id} className="card">
              <header><h2>{g.name}</h2><span className="aside">{g.criteria.filter(c => c.done).length}/{g.criteria.length}{g.due ? ` · by ${fmtDay(g.due)}` : ' · after you’re back'}</span></header>
              <ul className="mins">
                {g.criteria.map(c => (
                  <li key={c.id}>
                    <button className="min" aria-pressed={c.done} onClick={() => {
                      const id = `${g.id}:${c.id}`;
                      if (c.overridden) delRec('gates', id); else putRec<GateOverride>('gates', { id, done: !c.auto });
                    }}>
                      <i aria-hidden="true" />
                      <span><b>{c.label}</b>{(c.progress || c.overridden) && <small>{[c.progress, c.overridden && 'ticked by hand · tap to undo'].filter(Boolean).join(' · ')}</small>}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </article>
          ))}

          <article className="card">
            <header><h2>The five rules</h2></header>
            <ol className="rules">
              {SEED.rules.map(r => <li key={r.id}><b>{r.title}</b><span>{r.body}</span></li>)}
            </ol>
          </article>

          <article className="card">
            <header><h2>A week’s time</h2><span className="aside">{hours} h</span></header>
            <dl className="kv">
              {SEED.weeklyTimeBudgetHours.map(x => <div key={x.area}><dt>{x.area}</dt><dd>{x.hours} h</dd></div>)}
            </dl>
          </article>

          <article className="card">
            <header><h2>{SEED.parkingLot.title}</h2></header>
            <p className="fine">{SEED.parkingLot.note}</p>
          </article>
        </div>
      </div>
    </section>
  );
}
