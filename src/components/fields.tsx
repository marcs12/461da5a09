import type { Cadence, Settings } from '../lib/schema';

export function DateField({ id, label, value, onChange, hint }: { id: string; label: string; value: string | null; onChange: (v: string | null) => void; hint?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input className="inp" id={id} type="date" value={value ?? ''} onChange={e => onChange(e.target.value || null)} />
      {hint && <small className="fine">{hint}</small>}
    </div>
  );
}

export function TimeField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input className="inp" id={id} type="time" value={value} onChange={e => e.target.value && onChange(e.target.value)} />
    </div>
  );
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export function Workdays({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <fieldset className="field daypick">
      <legend>Workdays</legend>
      <div>
        {DAYS.map((d, i) => {
          const n = i + 1, on = value.includes(n);
          return (
            <button key={d} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter(x => x !== n) : [...value, n].sort())}>{d}</button>
          );
        })}
      </div>
    </fieldset>
  );
}

type Shift = NonNullable<Settings['shift']>;
export function ShiftFields({ value, onChange }: { value: Shift; onChange: (v: Shift) => void }) {
  const f = (k: keyof Shift, label: string) => (
    <TimeField id={`shift-${k}`} label={label} value={value[k]} onChange={v => onChange({ ...value, [k]: v })} />
  );
  return <div className="fields">{f('leave', 'Leave home')}{f('start', 'Start work')}{f('end', 'Finish work')}{f('home', 'Home by')}</div>;
}

type Pay = NonNullable<Settings['paySchedule']>;
const CADENCES: { id: Cadence; label: string }[] = [
  { id: 'weekly', label: 'Weekly' }, { id: 'biweekly', label: 'Every 2 weeks' }, { id: 'semimonthly', label: 'Twice a month' },
];
export function PayFields({ value, onChange }: { value: Pay; onChange: (v: Pay) => void }) {
  return (
    <div className="fields">
      <div className="field">
        <label htmlFor="pay-cadence">Paid</label>
        <select className="inp" id="pay-cadence" value={value.cadence} onChange={e => onChange({ ...value, cadence: e.target.value as Cadence })}>
          {CADENCES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
      <DateField id="pay-next" label="Next payday" value={value.nextPayday} onChange={v => v && onChange({ ...value, nextPayday: v })} />
    </div>
  );
}

export function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={e => onChange(e.target.checked)} />
    </label>
  );
}

export function TrainFields({ at, time, onChange }: { at: Settings['trainAt']; time: string; onChange: (p: Pick<Settings, 'trainAt' | 'trainTime'>) => void }) {
  return (
    <div className="fields">
      <div className="field">
        <label htmlFor="train-at">Train on workdays</label>
        <select className="inp" id="train-at" value={at} onChange={e => onChange({ trainAt: e.target.value as Settings['trainAt'], trainTime: time })}>
          <option value="morning">Morning, before work</option>
          <option value="evening">Evening, after work</option>
        </select>
      </div>
      <TimeField id="train-time" label="Morning session" value={time} onChange={v => onChange({ trainAt: at, trainTime: v })} />
    </div>
  );
}
