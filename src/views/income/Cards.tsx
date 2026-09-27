import { useState } from 'react';
import { fmtDay, fmtShort } from '../../lib/dates';
import { bragText, convertTime, incomeStats, jobs, outreach, tierMix, weekCounts, weekTargets, type Freelance, type Outreach, type Win } from '../../lib/income';
import { delRec, patchRec, putRec, recs, type Data, type TaskState } from '../../lib/store';
import { Sheet } from '../../components/Sheet';
import { Ring } from '../today/Cards';
import { SEED } from '../../data/seed';

const I = SEED.income;

export function Targets({ data, today }: { data: Data; today: string }) {
  const t = weekTargets(data, today), c = weekCounts(data, today);
  if (t.paused) {
    return (
      <article className="card">
        <header><h2>This week</h2><span className="aside">targets paused</span></header>
        <p className="fine">Travel mode: answer recruiters within 24 hours, no grind. {c.applications ? `${c.applications} sent anyway.` : ''}</p>
      </article>
    );
  }
  return (
    <article className="card">
      <header><h2>This week</h2><span className="aside">Mon – Sun</span></header>
      <div className="rings">
        <div><Ring done={c.applications} total={t.applications} /><span>Applications</span></div>
        {t.outreach > 0 && <div><Ring done={c.outreach} total={t.outreach} /><span>Outreach</span></div>}
      </div>
    </article>
  );
}

export function Stats({ data }: { data: Data }) {
  const s = incomeStats(data), m = tierMix(data);
  return (
    <article className="card">
      <header><h2>90-day numbers</h2></header>
      <dl className="tiles mini">
        <div className="tile"><dt>Applications</dt><dd>{s.applied}<small>/ {s.target}</small></dd></div>
        <div className="tile"><dt>Interviews</dt><dd>{s.interviews}</dd></div>
        <div className="tile"><dt>Heard back</dt><dd>{s.heardPct ?? '—'}{s.heardPct != null && <small>%</small>}</dd></div>
      </dl>
      <h3 className="subhead">Tier mix</h3>
      <ul className="mix">
        {m.rows.map(r => {
          const pct = m.total ? Math.round((r.n / m.total) * 100) : 0;
          return (
            <li key={r.id}>
              <div className="mix-top"><span>{r.label}</span><span>{r.n} · {pct}% <small>(aim {Math.round(r.target * 100)}%)</small></span></div>
              <div className="track"><i style={{ width: `${pct}%` }} /><b style={{ left: `${r.target * 100}%` }} aria-hidden="true" /></div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export function OutreachCard({ data, today }: { data: Data; today: string }) {
  const [adding, setAdding] = useState(false);
  const list = outreach(data).sort((a, b) => b.date.localeCompare(a.date));
  const replied = list.filter(o => o.replied).length;
  return (
    <article className="card">
      <header><h2>Outreach</h2><span className="aside">{replied} conversation{replied === 1 ? '' : 's'} · aim 10</span></header>
      {list.length ? (
        <ul className="mins">
          {list.slice(0, 8).map(o => (
            <li key={o.id}>
              <button className="min" aria-pressed={o.replied} onClick={() => patchRec<Outreach>('outreach', o.id, { replied: !o.replied }, o)}>
                <i aria-hidden="true" />
                <span><b>{o.name}{o.company ? ` · ${o.company}` : ''}</b><small>{fmtShort(o.date)} · {o.channel}{o.replied ? ' · replied' : ''}{o.nextStep ? ` · next: ${o.nextStep}` : ''}</small></span>
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="fine">One message to someone in a role you want. Tick it when they reply.</p>}
      <div className="actions"><button className="btn" onClick={() => setAdding(true)}>Log outreach</button></div>
      {adding && <OutreachSheet today={today} onClose={() => setAdding(false)} />}
    </article>
  );
}

const CHANNELS = ['LinkedIn', 'Email', 'In person', 'Referral'];
function OutreachSheet({ today, onClose }: { today: string; onClose: () => void }) {
  const [f, setF] = useState({ name: '', company: '', channel: 'LinkedIn', nextStep: '' });
  const set = (p: Partial<typeof f>) => setF(x => ({ ...x, ...p }));
  const save = () => {
    if (!f.name.trim()) return;
    putRec<Outreach>('outreach', { id: crypto.randomUUID(), date: today, name: f.name.trim(), company: f.company.trim() || undefined, channel: f.channel, replied: false, nextStep: f.nextStep.trim() || undefined });
    onClose();
  };
  return (
    <Sheet title="Outreach" onClose={onClose}>
      <form className="stack-sm" onSubmit={e => { e.preventDefault(); save(); }}>
        <div className="fields">
          <div className="field"><label htmlFor="o-name">Name</label><input className="inp" id="o-name" autoFocus autoComplete="off" value={f.name} onChange={e => set({ name: e.target.value })} /></div>
          <div className="field"><label htmlFor="o-co">Company</label><input className="inp" id="o-co" autoComplete="off" value={f.company} onChange={e => set({ company: e.target.value })} /></div>
        </div>
        <div className="seg" role="radiogroup" aria-label="Channel">
          {CHANNELS.map(c => <button type="button" key={c} role="radio" aria-checked={f.channel === c} onClick={() => set({ channel: c })}>{c}</button>)}
        </div>
        <div className="field"><label htmlFor="o-next">Next step</label><input className="inp" id="o-next" autoComplete="off" value={f.nextStep} onChange={e => set({ nextStep: e.target.value })} /></div>
        <p className="fine">Counts as today’s career action.</p>
        <div className="actions sheet-go"><button className="btn primary" disabled={!f.name.trim()}>Save</button></div>
      </form>
    </Sheet>
  );
}

type SeedTask = (typeof SEED.tasks)[number];
const stateOf = (d: Data, id: string) => recs<TaskState>(d, 'tasks').find(t => t.id === id);
const base = (t: SeedTask) => ({ checklist: t.checklist.map(() => false), done: false });

/** One seed task with its checklist. Ticking every step marks it done. */
export function TaskItem({ data, t, auto }: { data: Data; t: SeedTask; auto?: { line: string; done: boolean } }) {
  const [open, setOpen] = useState(false);
  const st = stateOf(data, t.id);
  const checks = t.checklist.map((_, i) => !!st?.checklist?.[i]);
  const n = checks.filter(Boolean).length;
  const tick = (i: number) => {
    const next = checks.map((c, j) => (j === i ? !c : c));
    patchRec<TaskState>('tasks', t.id, { checklist: next, done: next.every(Boolean) }, base(t));
  };
  return (
    <li className="task">
      <div className="task-row">
        <button className="min" aria-pressed={!!st?.done || !!auto?.done} onClick={() => patchRec<TaskState>('tasks', t.id, { done: !st?.done }, base(t))}>
          <i aria-hidden="true" />
          <span><b>{t.title}</b><small>{t.priority} · {t.estimate} · {auto ? auto.line : `${n}/${checks.length}`}</small></span>
        </button>
        <button className="iconbtn" aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} steps for ${t.title}`} onClick={() => setOpen(!open)}>{open ? '−' : '+'}</button>
      </div>
      {open && (
        <ul className="steps-list">
          {t.checklist.map((c, i) => (
            <li key={c}><label className="check"><input type="checkbox" checked={checks[i]} onChange={() => tick(i)} /><span>{c}</span></label></li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function Checklist({ data, today }: { data: Data; today: string }) {
  const S = data.settings;
  const sprintApps = jobs(data).filter(j => j.appliedAt && j.appliedAt >= S.planStart && !!S.departDate && j.appliedAt < S.departDate).length;
  const wk = weekCounts(data, today);
  const autos: Record<string, { line: string; done: boolean }> = {
    'apps-20': { line: `${sprintApps}/20 from the pipeline`, done: sprintApps >= 20 },
    'weekly-apps': { line: `this week ${wk.applications}/5 · ${wk.outreach}/2`, done: wk.applications >= 5 && wk.outreach >= 2 },
  };
  const groups = [['sprint', 'Sprint'], ['travel', 'Travel'], ['build', 'Build']] as const;
  return (
    <article className="card">
      <header><h2>Career checklist</h2></header>
      {groups.map(([id, name]) => {
        const tasks = SEED.tasks.filter(t => t.list === id && t.area === 'income' && t.id !== 'applied-skills' && t.id !== 'pl-900');
        if (!tasks.length) return null;
        return (
          <section key={id}>
            <h3 className="subhead">{name}</h3>
            <ul className="tasks">{tasks.map(t => <TaskItem key={t.id} data={data} t={t} auto={autos[t.id]} />)}</ul>
          </section>
        );
      })}
    </article>
  );
}

export function Credential({ data }: { data: Data }) {
  return (
    <article className="card">
      <header><h2>Microsoft credential</h2></header>
      {I.credentials.map(c => {
        const t = SEED.tasks.find(x => x.id === c.id);
        return (
          <section key={c.id} className="cred">
            <div className="cred-head">
              <b>{c.name}</b>
              <small>{c.primary ? 'Start here' : 'Optional'} · {c.cost} · {c.format}</small>
              <a href={c.url} target="_blank" rel="noreferrer">Microsoft Learn</a>
            </div>
            {t && <ul className="tasks"><TaskItem data={data} t={t} /></ul>}
          </section>
        );
      })}
    </article>
  );
}

export function FreelanceCard({ data }: { data: Data }) {
  const f = recs<Freelance>(data, 'freelance').find(x => x.id === 'main') ?? { pitches: 0, intros: 0, paidClient: false };
  const patch = (p: Partial<Freelance>) => patchRec<Freelance>('freelance', 'main', p, { pitches: 0, intros: 0, paidClient: false });
  const step = (k: 'pitches' | 'intros', label: string, target: number) => (
    <div className="stepper">
      <span>{label} <small>aim {target}</small></span>
      <div>
        <button className="iconbtn" aria-label={`One fewer: ${label}`} onClick={() => patch({ [k]: Math.max(0, f[k] - 1) })}>−</button>
        <b>{f[k]}</b>
        <button className="iconbtn" aria-label={`One more: ${label}`} onClick={() => patch({ [k]: f[k] + 1 })}>+</button>
      </div>
    </div>
  );
  return (
    <article className="card">
      <header><h2>Freelance test</h2></header>
      <div className="stack-sm">
        {step('pitches', 'Pitches sent', I.freelance.pitchesTarget)}
        {step('intros', 'Intros asked for', I.freelance.introsToAsk)}
        <label className="toggle" htmlFor="fl-paid"><span>A paying client</span>
          <input id="fl-paid" type="checkbox" role="switch" checked={f.paidClient} onChange={e => patch({ paidClient: e.target.checked })} /></label>
        <p className="fine">{I.freelance.note}</p>
      </div>
    </article>
  );
}

export function BragFile({ data, today }: { data: Data; today: string }) {
  const wins = recs<Win>(data, 'wins').sort((a, b) => b.date.localeCompare(a.date));
  const [text, setText] = useState('');
  const [metric, setMetric] = useState('');
  const [msg, setMsg] = useState('');
  const add = (t: string, m?: string) => { putRec<Win>('wins', { id: crypto.randomUUID(), date: today, text: t, metric: m || undefined }); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(bragText(wins)); setMsg('Copied as résumé bullets.'); } catch { setMsg('Couldn’t reach the clipboard.'); }
  };
  const starters = I.resumeBullets.filter(b => !wins.some(w => w.text === b));
  return (
    <article className="card">
      <header><h2>Brag file</h2>{wins.length > 0 && <button className="btn ghost small" onClick={copy}>Copy all</button>}</header>
      <form className="stack-sm" onSubmit={e => { e.preventDefault(); if (text.trim()) { add(text.trim(), metric.trim()); setText(''); setMetric(''); } }}>
        <div className="field"><label htmlFor="w-text">A win, with a number if there is one</label>
          <input className="inp" id="w-text" autoComplete="off" value={text} onChange={e => setText(e.target.value)} placeholder="Laptops processed through the auction workflow" /></div>
        <div className="actions">
          <input className="inp" aria-label="Number" autoComplete="off" value={metric} onChange={e => setMetric(e.target.value)} placeholder="The number: 140 laptops" style={{ flex: 1, minWidth: 0 }} />
          <button className="btn" disabled={!text.trim()}>Add</button>
        </div>
      </form>
      {msg && <p className="msg">{msg}</p>}
      {wins.length > 0 && (
        <ul className="wins">
          {wins.map(w => (
            <li key={w.id}><span>{w.text}{w.metric && <b> · {w.metric}</b>}<small>{fmtShort(w.date)}</small></span>
              <button className="iconbtn" aria-label="Remove win" onClick={() => delRec('wins', w.id)}>✕</button></li>
          ))}
        </ul>
      )}
      {starters.length > 0 && (
        <div className="starters">
          <h3 className="subhead">From the plan</h3>
          {starters.map(b => <button key={b} className="starter" onClick={() => add(b)}><span>{b}</span><small>Add</small></button>)}
        </div>
      )}
    </article>
  );
}

export function TimeZones({ today }: { today: string }) {
  const z = I.timeZones;
  const [time, setTime] = useState('16:00');
  const [homeSide, setHomeSide] = useState(true);
  const from = homeSide ? z.home : z.trip, to = homeSide ? z.trip : z.home;
  const r = convertTime(today, time, from, to);
  const name = (zone: string) => (zone === z.home ? 'Vancouver' : 'Vietnam');
  return (
    <article className="card">
      <header><h2>Time zones</h2><button className="btn ghost small" onClick={() => setHomeSide(!homeSide)}>Swap</button></header>
      <div className="tz">
        <div className="field"><label htmlFor="tz-in">{name(from)}</label><input className="inp" id="tz-in" type="time" value={time} onChange={e => e.target.value && setTime(e.target.value)} /></div>
        <div className="tz-out"><small>{name(to)}</small><b>{r.time}</b><small>{r.date === today ? 'same day' : fmtDay(r.date)}</small></div>
      </div>
      <p className="fine">{z.tip}</p>
    </article>
  );
}
