import { Fragment } from 'react';
import { addDays, fmtDay, fmtShort, parse, today } from '../lib/dates';
import { DOW, PHASES, phaseEnd, phaseStart, sessionOf, weekStart } from '../lib/program';
import { isDone } from '../lib/stats';
import type { Data } from '../lib/store';
import { Ribbon } from '../components/Ribbon';

export function Plan({ data, date, onOpen }: { data: Data; date: string; onOpen: (d: string) => void }) {
  const t = today();
  const S = data.settings;
  return (
    <section>
      <div className="pagehead">
        <div><h1>The program</h1><p>Sep 20, 2026 – Jan 9, 2027 · 16 weeks · Huberman’s Day 1 on Sundays</p></div>
        <div className="legend">
          <span className="chip k-cardio">Cardio</span><span className="chip k-strength">Resistance</span>
          <span className="chip k-rest">Rest + walk</span><span className="chip k-break">Break</span>
        </div>
      </div>
      <Ribbon date={date} />
      <div className="plan-wrap">
        <div className="plan">
          <div className="prow hdr"><span />{DOW.map(x => <span key={x}>{x}</span>)}</div>
          {PHASES.map(p => (
            <Fragment key={p.id}>
              <div className="phase-row">
                <b className={p.id === 'brk' ? 'brk' : ''}>{p.name}{p.id !== 'brk' && ` · ${p.label}`}</b>
                <span>{fmtShort(phaseStart(p))} – {fmtShort(phaseEnd(p))}{p.id === 'p1' && ' · target −8 to −12 lb'}</span>
              </div>
              {Array.from({ length: p.to - p.from + 1 }, (_, k) => {
                const w = p.from + k, ws = weekStart(w);
                return (
                  <div className="prow" key={w}>
                    <div className="wlab"><b>W{w}</b>{fmtShort(ws)}</div>
                    {DOW.map((_, i) => {
                      const ds = addDays(ws, i), s = sessionOf(ds)!;
                      const done = s.kind !== 'break' && isDone(data, ds, s);
                      const missed = !done && ds < t && s.kind !== 'break';
                      const cls = ['cell', `k-${s.kind}`, done && 'done', missed && 'missed', ds === t && 'today', ds === date && ds !== t && 'sel'].filter(Boolean).join(' ');
                      return (
                        <button key={ds} className={cls} onClick={() => onOpen(ds)} title={`${fmtDay(ds)} · ${s.title}`}>
                          {s.short}<small>{parse(ds).getDate()}{done && ' ✓'}</small>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
        <div className="guides">
          <article className="card"><h3>Every week</h3><ul>
            <li><b>Sun</b> long run · <b>Mon</b> legs · <b>Tue</b> rest</li>
            <li><b>Wed</b> torso · <b>Thu</b> medium cardio · <b>Fri</b> short, hard</li>
            <li><b>Sat</b> shoulders & arms</li>
            <li>45-min easy treadmill walk on Mon, Tue, Wed and Sat</li>
          </ul></article>
          <article className="card"><h3>Resistance</h3><ul>
            <li>Week 1: 2 sets, leave 2–3 reps in the tank</li>
            <li>Week 2 on: 3 sets of 8–15 reps</li>
            <li>15 reps on every set → add 5 lb</li>
          </ul></article>
          <article className="card"><h3>Nutrition</h3><ul>
            <li>~{S.calTarget.toLocaleString()} kcal a day; weekly average not dropping after week 1 → cut ~200</li>
            <li>~{S.proTarget} g protein a day</li>
            <li>Drop liquid calories and alcohol; lean protein + vegetables</li>
            <li>Sleep 7–8 hours</li>
          </ul></article>
          <article className="card"><h3>Running · Vancouver winter</h3>
            <p>Baseline going in: 2.5 km at 7:30/km. Every easy run is written at that pace or slower — tempo and intervals are the only places you push.</p>
            <p>The treadmill can’t reach running speed, so you’ll run in the rain. A light waterproof shell and grippy running shoes keep you consistent.</p>
            <p><b>Shins, knees or Achilles aching?</b> Repeat that week before moving on — the 10K date moves, you don’t.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
