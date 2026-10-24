import { diff, fmtShort } from '../lib/dates';
import { END, PHASES, START, TOTAL_DAYS, WEEKS, phaseEnd, phaseStart, programDay } from '../lib/program';

/** Labels for the long phases; each one also covers the one-week phases that follow it. */
const LABELS: Record<string, string> = { rebuild: 'Rebuild', base: 'Base', speed: 'Speed to sub-60', push: 'Push to race day' };
/** On a phone the long labels are cut down to the phase name. */
const SHORT: Record<string, string> = { speed: 'Speed', push: 'Push' };

/** The 25-week timeline, one segment per phase, with a marker on `date`. */
export function Ribbon({ date }: { date: string }) {
  const pd = programDay(date);
  const cur = pd.status === 'in' ? pd.phase.id : null;
  const inRange = diff(date, START) >= 0 && diff(date, END) <= 0;
  const idx = Math.min(Math.max(diff(date, START), 0), TOTAL_DAYS - 1);
  const wide = PHASES.filter(p => LABELS[p.id]);
  return (
    <div className="ribbon" aria-label="Program timeline">
      <div className="ribbon-bar">
        {PHASES.map(p => <span key={p.id} className={cur === p.id ? 'on' : ''} style={{ flex: p.to - p.from + 1 }} />)}
      </div>
      {inRange && <div className="ribbon-marker" style={{ left: `${((idx + 0.5) / TOTAL_DAYS) * 100}%` }} />}
      <div className="ribbon-labels">
        {wide.map((p, i) => {
          const next = wide[i + 1];
          const to = next ? next.from - 1 : WEEKS;
          const last = PHASES.find(x => x.to === to)!;
          return (
            <div key={p.id} style={{ flex: to - p.from + 1 }} title={`${LABELS[p.id]} · ${fmtShort(phaseStart(p))} – ${fmtShort(phaseEnd(last))}`}>
              <b><i className="rl-long">{LABELS[p.id]}</i><i className="rl-short">{SHORT[p.id] ?? LABELS[p.id]}</i></b>
              <span>{fmtShort(phaseStart(p))} – {fmtShort(phaseEnd(last))}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
