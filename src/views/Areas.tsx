import { SEED } from '../data/seed';

/**
 * Income, Mind and Money. Mostly outlines for now; each area fills in over the
 * next phases. Mind's support resources are complete: they must always be one tap away.
 */

export function Income() {
  const I = SEED.income;
  return (
    <section className="page">
      <div className="pagehead"><div><h1>Income</h1><p>Get paid more, from anywhere.</p></div></div>
      <div className="areagrid">
        <article className="card">
          <header><h3>Job pipeline</h3></header>
          <div className="empty">Save your first posting. Five this week is the target.<small>The pipeline arrives in the next update.</small></div>
        </article>
        <article className="card">
          <header><h3>Where to aim</h3></header>
          <ul className="tiers">
            {I.tiers.map(t => (
              <li key={t.id}><b>{t.label}{t.targetShare != null && <span> · {Math.round(t.targetShare * 100)}%</span>}</b><span>{t.desc}</span></li>
            ))}
          </ul>
          <p className="fine">Search: {I.searchTerms.join(' · ')}</p>
        </article>
      </div>
    </section>
  );
}

export function Mind() {
  const M = SEED.mind;
  return (
    <section className="page">
      <div className="pagehead"><div><h1>Mind</h1><p>Stay steady.</p></div></div>
      <div className="areagrid">
        <Support />
        <article className="card">
          <header><h3>Four anchors</h3><span className="aside">{M.anchorsSource}</span></header>
          <ul className="tiers">{M.anchors.map(a => <li key={a.title}><b>{a.title}</b><span>{a.body}</span></li>)}</ul>
        </article>
        <article className="card">
          <header><h3>When the critic shows up</h3></header>
          <ol className="rules">{M.criticTool.map(s => <li key={s}><span>{s}</span></li>)}</ol>
        </article>
      </div>
    </section>
  );
}

/** Support resources. 9-8-8 is always visible. */
export function Support() {
  return (
    <article className="card support">
      <header><h3>Support</h3><span className="aside">free, any time</span></header>
      <ul className="res">
        {SEED.mind.supportResources.map(r => (
          <li key={r.id}>
            <div><b>{r.name}</b><span>{r.detail}</span></div>
            <div className="res-act">
              {'tel' in r && r.tel && <a className="btn" href={`tel:${r.tel}`}>Call</a>}
              {'sms' in r && r.sms && <a className="btn" href={`sms:${r.sms}`}>Text</a>}
              {'url' in r && r.url && !('tel' in r && r.tel) && <a className="btn ghost" href={r.url} target="_blank" rel="noreferrer">Open</a>}
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function Money() {
  const M = SEED.money;
  return (
    <section className="page">
      <div className="pagehead"><div><h1>Money</h1><p>Build runway.</p></div></div>
      <div className="areagrid">
        <article className="card">
          <header><h3>Vietnam budget</h3></header>
          <ol className="rules">{M.trip.steps.map(s => <li key={s}><span>{s}</span></li>)}</ol>
          <p className="fine">Trip budget and daily spend tracking arrive before you fly.</p>
        </article>
        <article className="card">
          <header><h3>Order of operations</h3></header>
          <ol className="rules">{M.orderOfOperations.map(s => <li key={s}><span>{s}</span></li>)}</ol>
          <p className="fine">Pay yourself first: {M.payYourselfFirstPct}% of every paycheque. {M.raiseRule}.</p>
        </article>
      </div>
      <p className="fine disclaimer">{M.disclaimer}</p>
    </section>
  );
}
