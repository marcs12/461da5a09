import type { Data } from '../lib/store';
import { SessionDay } from './body/Session';
import { Program } from './body/Program';
import { Progress } from './body/Progress';

export type BodyView = 'session' | 'program' | 'progress';
const SUBS: { id: BodyView; name: string }[] = [
  { id: 'session', name: 'Session' },
  { id: 'program', name: 'Program' },
  { id: 'progress', name: 'Progress' },
];

/** The original 16-week training app, unchanged, under three sub-tabs. */
export function Body({ data, sub, setSub, date, setDate, onTimer }: {
  data: Data; sub: BodyView; setSub: (v: BodyView) => void; date: string; setDate: (d: string) => void; onTimer: () => void;
}) {
  return (
    <>
      <nav className="subtabs" aria-label="Body">
        {SUBS.map(s => (
          <button key={s.id} onClick={() => setSub(s.id)} aria-current={sub === s.id ? 'page' : undefined}>{s.name}</button>
        ))}
      </nav>
      {sub === 'session' && <SessionDay data={data} date={date} setDate={setDate} onTimer={onTimer} />}
      {sub === 'program' && <Program data={data} date={date} onOpen={d => { setDate(d); setSub('session'); }} />}
      {sub === 'progress' && <Progress data={data} goToday={() => setSub('session')} />}
    </>
  );
}
