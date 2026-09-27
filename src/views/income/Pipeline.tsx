import { useState } from 'react';
import { fmtShort } from '../../lib/dates';
import { STAGES, followUpDue, jobs, stagePatch } from '../../lib/income';
import { delRec, patchRec, putRec, type Data, type Job, type Stage, type Tier } from '../../lib/store';
import { Sheet } from '../../components/Sheet';
import { SEED } from '../../data/seed';

const TIERS = SEED.income.tiers.map(t => ({ id: t.id as Tier, label: t.label }));
const tierLabel = (t: Tier) => TIERS.find(x => x.id === t)?.label ?? t;

export function Pipeline({ data, today }: { data: Data; today: string }) {
  const all = jobs(data);
  const due = all.filter(j => followUpDue(j, today));
  const [stage, setStage] = useState<Stage>(() => (due.length ? 'applied' : all.some(j => j.stage === 'saved') ? 'saved' : 'applied'));
  const [edit, setEdit] = useState<Job | 'saved' | 'applied' | null>(null);
  const list = all.filter(j => j.stage === stage)
    .sort((a, b) => Number(followUpDue(b, today)) - Number(followUpDue(a, today)) || (b.appliedAt ?? b.savedAt).localeCompare(a.appliedAt ?? a.savedAt));

  return (
    <article className="card pipeline">
      <header><h3>Job pipeline</h3><span className="aside">{all.length} total</span></header>
      <div className="stagebar" role="tablist" aria-label="Stages">
        {STAGES.map(s => {
          const n = all.filter(j => j.stage === s.id).length;
          const hasDue = s.id === 'applied' && due.length > 0;
          return (
            <button key={s.id} role="tab" aria-selected={stage === s.id} onClick={() => setStage(s.id)}>
              {s.label}<span className="n">{n}</span>{hasDue && <i className="due-dot" aria-label={`${due.length} follow-ups due`} />}
            </button>
          );
        })}
      </div>
      {list.length ? (
        <ul className="jobs">
          {list.map(j => {
            const isDue = followUpDue(j, today);
            return (
              <li key={j.id}>
                <button className="job" onClick={() => setEdit(j)}>
                  <b>{j.company}</b><span>{j.role}</span>
                  <small>{tierLabel(j.tier)} · {j.appliedAt ? `applied ${fmtShort(j.appliedAt)}` : `saved ${fmtShort(j.savedAt)}`}{j.payRange ? ` · ${j.payRange}` : ''}</small>
                  {isDue && <em className="due">Follow-up due</em>}
                </button>
                {j.stage === 'saved' && <button className="btn small" onClick={() => patchRec<Job>('jobs', j.id, stagePatch(j, 'applied', today), j)}>Applied</button>}
                {isDue && <button className="btn small" onClick={() => patchRec<Job>('jobs', j.id, stagePatch(j, 'followup', today), j)}>Followed up</button>}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="empty">{stage === 'saved' || !all.length ? 'Save your first posting. Five this week is the target.' : `Nothing in ${STAGES.find(s => s.id === stage)!.label} yet.`}</div>
      )}
      <div className="actions">
        <button className="btn" onClick={() => setEdit('saved')}>Save a posting</button>
        <button className="btn primary" onClick={() => setEdit('applied')}>Log an application</button>
      </div>
      {edit && <JobSheet job={typeof edit === 'string' ? null : edit} stage={typeof edit === 'string' ? edit : edit.stage} today={today} onClose={() => setEdit(null)} />}
    </article>
  );
}

function JobSheet({ job, stage: initialStage, today, onClose }: { job: Job | null; stage: Stage; today: string; onClose: () => void }) {
  const [f, setF] = useState({
    company: job?.company ?? '', role: job?.role ?? '', url: job?.url ?? '', tier: job?.tier ?? ('bridge' as Tier),
    stage: job?.stage ?? initialStage, payRange: job?.payRange ?? '', notes: job?.notes ?? '',
  });
  const [armed, setArmed] = useState(false);
  const set = (p: Partial<typeof f>) => setF(x => ({ ...x, ...p }));
  const ok = f.company.trim() && f.role.trim();
  const save = () => {
    if (!ok) return;
    const fields = { company: f.company.trim(), role: f.role.trim(), url: f.url.trim() || undefined, tier: f.tier, payRange: f.payRange.trim() || undefined, notes: f.notes.trim() || undefined };
    if (job) {
      patchRec<Job>('jobs', job.id, { ...fields, ...(f.stage !== job.stage ? stagePatch(job, f.stage, today) : {}) }, job);
    } else {
      const base: Job = { id: crypto.randomUUID(), _u: 0, ...fields, stage: 'saved', savedAt: today };
      putRec<Job>('jobs', { ...base, ...stagePatch(base, f.stage, today) });
    }
    onClose();
  };
  return (
    <Sheet title={job ? job.company : f.stage === 'applied' ? 'Application sent' : 'Save a posting'} onClose={onClose}>
      <form className="stack-sm" onSubmit={e => { e.preventDefault(); save(); }}>
        <div className="fields">
          <div className="field"><label htmlFor="j-co">Company</label><input className="inp" id="j-co" autoFocus={!job} autoComplete="off" value={f.company} onChange={e => set({ company: e.target.value })} /></div>
          <div className="field"><label htmlFor="j-role">Role</label><input className="inp" id="j-role" autoComplete="off" value={f.role} onChange={e => set({ role: e.target.value })} /></div>
        </div>
        <div className="seg" role="radiogroup" aria-label="Tier">
          {TIERS.map(t => <button type="button" key={t.id} role="radio" aria-checked={f.tier === t.id} onClick={() => set({ tier: t.id })}>{t.label}</button>)}
        </div>
        <div className="fields">
          <div className="field">
            <label htmlFor="j-stage">Stage</label>
            <select className="inp" id="j-stage" value={f.stage} onChange={e => set({ stage: e.target.value as Stage })}>
              {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="j-pay">Posted pay</label><input className="inp" id="j-pay" autoComplete="off" placeholder="$55–62K" value={f.payRange} onChange={e => set({ payRange: e.target.value })} /></div>
        </div>
        <div className="field"><label htmlFor="j-url">Posting link</label><input className="inp" id="j-url" type="url" inputMode="url" value={f.url} onChange={e => set({ url: e.target.value })} /></div>
        <div className="field"><label htmlFor="j-notes">Notes</label><textarea className="inp" id="j-notes" value={f.notes} onChange={e => set({ notes: e.target.value })} /></div>
        {job && (
          <p className="fine">
            Saved {fmtShort(job.savedAt)}{job.appliedAt && ` · applied ${fmtShort(job.appliedAt)}`}{job.followUpAt && job.stage === 'applied' && ` · follow up ${fmtShort(job.followUpAt)}`}
            {job.url && <> · <a href={job.url} target="_blank" rel="noreferrer">Open posting</a></>}
          </p>
        )}
        <div className="actions sheet-go">
          {job && (armed
            ? <button type="button" className="btn danger" onClick={() => { delRec('jobs', job.id); onClose(); }}>Delete — tap to confirm</button>
            : <button type="button" className="btn ghost" onClick={() => setArmed(true)}>Delete</button>)}
          <button className="btn primary" disabled={!ok}>Save</button>
        </div>
      </form>
    </Sheet>
  );
}
