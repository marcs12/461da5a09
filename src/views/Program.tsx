import { Fragment, useEffect } from 'react';
import { addDays, fmtDay, fmtShort, parse, today } from '../lib/dates';
import { DOW, END, EX, PHASES, RACE_GOAL, RACE_PACE, STRENGTH, SUB60_PACE, START, WEEKS, pace, phaseEnd, phaseStart, programDay, sessionOf, weekStart } from '../lib/program';
import { CAL_FLOOR, CHECKPOINTS, TIERS, daysToRace, tierOfWeek } from '../lib/targets';
import { isDone } from '../lib/stats';
import type { Data } from '../lib/store';
import { Ribbon } from '../components/Ribbon';

const lifts = (ids: string[]) => ids.map(id => {
  const e = EX[id];
  return <li key={id}><b>{e.name}</b> {e.target ? `3 × ${e.target}${e.unit === 'sec' ? ' seconds' : ''}` : '3 sets'}{e.note ? `, ${e.note}` : ''}</li>;
});

export function Program({ data, date, onOpen }: { data: Data; date: string; onOpen: (d: string) => void }) {
  const t = today();
  const left = daysToRace(t);
  const pdT = programDay(t);
  const curWeek = pdT.status === 'in' ? pdT.week : 0;
  // Twenty-five weeks is a long scroll on a phone: open on the current one.
  useEffect(() => {
    if (curWeek > 2) document.querySelector('.prow.cur')?.scrollIntoView({ block: 'center' });
  }, [curWeek]);
  return (
    <section>
      <div className="pagehead">
        <div>
          <h1>The program</h1>
          <p>{fmtShort(START)}, 2026 – {fmtShort(END)}, 2027 · {WEEKS} weeks · Monday to Sunday{left > 0 && ` · ${left} days to the Sun Run`}</p>
        </div>
        <div className="legend">
          <span className="chip k-cardio">Run or cardio</span><span className="chip k-strength">Strength</span><span className="chip k-rest">Rest</span>
        </div>
      </div>
      <Ribbon date={date} />
      <div className="plan-wrap">
        <div className="plan">
          <div className="prow hdr"><span />{DOW.map(x => <span key={x}>{x}</span>)}</div>
          {PHASES.map(p => {
            const cps = CHECKPOINTS.filter(c => c.week >= p.from && c.week <= p.to).map(c => `${c.target} lb by ${fmtShort(c.date)}`).join(', ');
            return (
              <Fragment key={p.id}>
                <div className="phase-row">
                  <b>{p.name}</b>
                  <span>{fmtShort(phaseStart(p))} – {fmtShort(phaseEnd(p))}</span>
                  <p>{p.blurb}{cps && `. Checkpoint: ${cps}`}</p>
                </div>
                {Array.from({ length: p.to - p.from + 1 }, (_, k) => {
                  const w = p.from + k, ws = weekStart(w);
                  return (
                    <div className={w === curWeek ? 'prow cur' : 'prow'} key={w}>
                      <div className="wlab" aria-current={w === curWeek ? 'true' : undefined}><b>W{w}</b>{fmtShort(ws)}<i>{tierOfWeek(w).cal.toLocaleString()}</i></div>
                      {DOW.map((_, i) => {
                        const ds = addDays(ws, i), s = sessionOf(ds)!;
                        const done = isDone(data, ds);
                        const missed = !done && ds < t && s.kind !== 'rest';
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
            );
          })}
        </div>
        <div className="guides">
          <article className="card"><h3>Every week</h3><ul>
            <li><b>Mon</b> strength A · <b>Tue</b> run · <b>Wed</b> low-impact cardio, an easy run from week 6</li>
            <li><b>Thu</b> run (a workout from week 7) · <b>Fri</b> strength B</li>
            <li><b>Sat</b> rest · <b>Sun</b> long run or time trial, the one never to skip</li>
            <li>{TIERS[0].steps.toLocaleString()} steps a day to January, {TIERS[2].steps.toLocaleString()} from February</li>
            <li>In a busy week, Wednesday is the first thing to drop</li>
          </ul></article>
          <article className="card"><h3>Strength A · Monday · kettlebell</h3><ul>{lifts(STRENGTH.A.ids)}</ul></article>
          <article className="card"><h3>Strength B · Friday · dumbbell</h3><ul>{lifts(STRENGTH.B.ids)}
            <li>Rest 60 to 90 seconds between sets. Hit every rep, then add weight</li>
          </ul></article>
          <article className="card"><h3>Calories and protein</h3><ul>
            {TIERS.map(x => <li key={x.from}><b>{x.from === x.to ? `Week ${x.from}` : `Weeks ${x.from}–${x.to}`}</b> {x.cal.toLocaleString()} kcal · {x.pro} g protein</li>)}
            <li>Maintenance on Dec 24 and 25, and Jan 28 to 30 before the time trial</li>
            <li>Never under {CAL_FLOOR.toLocaleString()} kcal while training</li>
            <li>The small number under each week is that week’s calories</li>
          </ul></article>
          <article className="card"><h3>Paces</h3><ul>
            <li><b>Easy</b> you can talk in full sentences</li>
            <li><b>Sub-60</b> {pace(SUB60_PACE)} for the 10K time trial on Jan 31</li>
            <li><b>Sun Run goal</b> {pace(RACE_PACE)} for {RACE_GOAL}</li>
            <li><b>5K time trials</b> under 31:00 on Dec 20, under 28:45 on Jan 17, under 26:30 on Mar 14</li>
            <li>Never raise your weekly running time by more than about 10%</li>
          </ul></article>
        </div>
      </div>
    </section>
  );
}
