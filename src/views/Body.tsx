import type { Data } from '../lib/store';
import { SessionDay } from './body/Session';
import { Program } from './body/Program';
import { Progress } from './body/Progress';
import { Overview } from './body/Overview';

export type BodyView = 'overview' | 'session' | 'program' | 'progress';
const SUBS: { id: BodyView; name: string }[] = [
  { id: 'overview', name: 'Overview' },
  { id: 'session', name: 'Session' },
  { id: 'program', name: 'Program' },
  { id: 'progress', name: 'Progress' },
];

/** Overview (the plan's body habits), then the original 16-week training app, unchanged. */
export function Body({ data, today, sub, setSub, date, setDate, onTimer, onCircuit }: {
  data: Data; today: string; sub: BodyView; setSub: (v: BodyView) => void; date: string; setDate: (d: string) => void; onTimer: () => void; onCircuit: (date: string) => void;
}) {
  return (
    <>
      <nav className="subtabs" aria-label="Body">
        {SUBS.map(s => (
          <button key={s.id} onClick={() => setSub(s.id)} aria-current={sub === s.id ? 'page' : undefined}>{s.name}</button>
        ))}
      </nav>
      {sub === 'overview' && <Overview data={data} today={today} openSession={() => { setDate(today); setSub('session'); }} onCircuit={onCircuit} />}
      {sub === 'session' && <SessionDay data={data} date={date} setDate={setDate} onTimer={onTimer} />}
      {sub === 'program' && <Program data={data} date={date} onOpen={d => { setDate(d); setSub('session'); }} />}
      {sub === 'progress' && <Progress data={data} goToday={() => setSub('session')} />}
    </>
  );
}
