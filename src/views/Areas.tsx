import { SEED } from '../data/seed';

/**
 * Mind. Mostly an outline for now; it fills in during Phase 6. Mind's support resources are complete: they must always be one tap away.
 */

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
