import { diff, fmtShort } from '../lib/dates';
import { END, PHASES, START, TOTAL_DAYS, phaseEnd, phaseStart, programDay } from '../lib/program';

/** The 25-week timeline, one segment per phase, with a marker on `date`. */
export function Ribbon({ date }: { date: string }) {
  const pd = programDay(date);
  const cur = pd.status === 'in' ? pd.phase.id : null;
  const inRange = diff(date, START) >= 0 && diff(date, END) <= 0;
  const idx = Math.min(Math.max(diff(date, START), 0), TOTAL_DAYS - 1);
  /** The one-week phases are too narrow for a label on a phone; the long ones carry the dates. */
  const wide = PHASES.filter(p => p.to - p.from >= 2);
  return (
    <div className="ribbon" aria-label="Program timeline">
      <div className="ribbon-bar">
        {PHASES.map(p => <span key={p.id} className={cur === p.id ? 'on' : ''} style={{ flex: p.to - p.from + 1 }} />)}
      </div>
      {inRange && <div className="ribbon-marker" style={{ left: `${((idx + 0.5) / TOTAL_DAYS) * 100}%` }} />}
      <div className="ribbon-labels">
        {wide.map((p, i) => (
          <div key={p.id} style={{ flex: (i === wide.length - 1 ? PHASES[PHASES.length - 1].to : p.to) - p.from + 1 }}
            title={`${p.name} · ${fmtShort(phaseStart(p))} – ${fmtShort(phaseEnd(p))}`}>
            <b>{i === wide.length - 1 ? 'Speed to race day' : p.name}</b>
            <span>{fmtShort(phaseStart(p))} – {fmtShort(i === wide.length - 1 ? END : phaseEnd(p))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
