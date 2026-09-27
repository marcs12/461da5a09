import { useState } from 'react';
import { addDays, fmtShort, parse } from '../../lib/dates';
import { nextGate } from '../../lib/gates';
import { mondayOf, planDay } from '../../lib/life';
import { dayStreak, isOpen, minItems, type MinItem } from '../../lib/minday';
import { blocksFor, currentBlock, isWorkday } from '../../lib/schedule';
import { sessionOf } from '../../lib/program';
import { mealsWithProtein, withMeals } from '../../lib/body';
import { delRec, editDay, patchRec, putRec, recs, type Data, type GateOverride, type TaskState } from '../../lib/store';
import { Sheet } from '../../components/Sheet';
import { SEED } from '../../data/seed';

const WDS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const clock12 = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}${h < 12 ? ' am' : ' pm'}`;
};

export function Ring({ done, total }: { done: number; total: number }) {
  const r = 22, c = 2 * Math.PI * r, f = total ? done / total : 0;
  return (
    <svg className="ring" viewBox="0 0 56 56" role="img" aria-label={`${done} of ${total} done`}>
      <circle cx="28" cy="28" r={r} className="ring-bg" />
      <circle cx="28" cy="28" r={r} className="ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - f)} transform="rotate(-90 28 28)" />
      <text x="28" y="33" textAnchor="middle">{done}/{total}</text>
    </svg>
  );
}

/** Tap an item to tick it. Items met by other logs (an application, protein grams) tick themselves. */
function toggle(data: Data, ds: string, it: MinItem, openCheckIn: (ds: string) => void) {
  const l = data.days[ds] || {};
  switch (it.id) {
    case 'careerAction': if (!it.done || l.career) editDay(ds, d => { d.career = !l.career; }); break;
    case 'walk': editDay(ds, d => { if (it.done) { d.walkMin = undefined; d.walk = undefined; } else d.walkMin = Math.max(20, l.walkMin ?? 0); }); break;
    case 'protein': if (!it.done || mealsWithProtein(l) === 3) editDay(ds, d => { Object.assign(d, withMeals(l, { b: !it.done, l: !it.done, d: !it.done })); }); break;
    case 'lightsOut': editDay(ds, d => { d.lightsOut = !l.lightsOut; }); break;
    case 'checkIn': openCheckIn(ds); break;
  }
}

function Items({ data, ds, items, openCheckIn }: { data: Data; ds: string; items: MinItem[]; openCheckIn: (ds: string) => void }) {
  return (
    <ul className="mins">
      {items.map(it => (
        <li key={it.id}>
          <button className="min" aria-pressed={it.done} onClick={() => toggle(data, ds, it, openCheckIn)}>
            <i aria-hidden="true" />
            <span><b>{it.label}</b>{(it.why || (!it.done && it.hint)) && <small>{it.why ?? it.hint}</small>}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function MinimumDay({ data, today, now, openCheckIn }: { data: Data; today: string; now: Date; openCheckIn: (ds: string) => void }) {
  const items = minItems(data, today);
  const done = items.filter(i => i.done).length;
  const st = dayStreak(data, now);
  const yest = addDays(today, -1);
  const yItems = yest >= data.settings.planStart && isOpen(yest, now) ? minItems(data, yest).filter(i => !i.done) : [];
  const slipped = st.lastClosed === yest ? 'Yesterday' : WDS[parse(st.lastClosed).getDay()];

  const line = st.graceUsed ? `${slipped} slipped. A minimum day today keeps your streak.`
    : st.current > 0 ? `Streak ${st.current} · grace available`
    : st.best > 0 ? `A minimum day today starts a new run. Best so far: ${st.best}.`
    : 'Your streak starts with the first minimum day.';

  return (
    <article className="card minday">
      <header>
        <div><h3>Minimum day</h3><p className="streak">{line}{st.best > st.current && st.current > 0 ? ` · best ${st.best}` : ''}</p></div>
        <Ring done={done} total={items.length} />
      </header>
      <Items data={data} ds={today} items={items} openCheckIn={openCheckIn} />
      {yItems.length > 0 && (
        <div className="yest">
          <div className="eyebrow">Yesterday · open until noon</div>
          <Items data={data} ds={yest} items={yItems} openCheckIn={openCheckIn} />
        </div>
      )}
    </article>
  );
}

export function GateCard({ data, today, openPlan }: { data: Data; today: string; openPlan: () => void }) {
  const g = nextGate(data, today);
  if (!g) return null;
  const cycle = (cid: string, auto: boolean, overridden: boolean) => {
    const id = `${g.id}:${cid}`;
    if (overridden) delRec('gates', id); else putRec<GateOverride>('gates', { id, done: !auto });
  };
  const n = g.criteria.filter(c => c.done).length;
  return (
    <article className="card gatecard">
      <header>
        <button className="linkish" onClick={openPlan}><h3>{g.name}</h3></button>
        <span className="aside">{n}/{g.criteria.length}{g.due ? ` · by ${fmtShort(g.due)}` : ''}</span>
      </header>
      <ul className="mins">
        {g.criteria.map(c => (
          <li key={c.id}>
            <button className="min" aria-pressed={c.done} onClick={() => cycle(c.id, c.auto, c.overridden)}>
              <i aria-hidden="true" />
              <span><b>{c.label}</b>{(c.progress || c.overridden) && <small>{[c.progress, c.overridden && 'ticked by hand · tap to undo'].filter(Boolean).join(' · ')}</small>}</span>
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function TimeBlocks({ data, today, now, onLink }: { data: Data; today: string; now: Date; onLink: (link: string) => void }) {
  const S = data.settings;
  const slot = data.days[today]?.trainSlot ?? S.trainAt;
  const blocks = blocksFor(S, today, slot);
  const work = isWorkday(S, today);
  const sess = sessionOf(today);
  const sessionLine = sess && `${sess.title}${sess.minutes ? ` · ${sess.minutes} min` : ''}`;
  const moveTo = (to: 'morning' | 'evening') => editDay(today, d => { d.trainSlot = to === S.trainAt ? undefined : to; });
  const cur = work ? currentBlock(blocks, hhmm(now)) : -1;
  return (
    <article className="card">
      <header><h3>{work ? 'Workday' : 'Day off'}</h3><span className="aside">{work ? `wake ${clock12(S.wakeTime)} · lights out ${clock12(S.lightsOut)}` : 'same wake time, within an hour'}</span></header>
      <ol className={`blocks${work ? '' : ' untimed'}`}>
        {blocks.map((b, i) => (
          <li key={b.label} className={i === cur ? 'now' : ''} aria-current={i === cur ? 'time' : undefined}>
            <span className="bt">{b.at ? clock12(b.at) : b.when}</span>
            <div className="bd">
              <b>{b.label}</b>
              {(b.move ? sessionLine : b.detail) && <small>{b.move ? sessionLine : b.detail}</small>}
              {b.move && <button className="movebtn" onClick={() => moveTo(b.move!)}>{b.move === 'evening' ? 'Push to the evening' : 'Move back to the morning'}</button>}
            </div>
            {b.link && <button className="btn ghost go" onClick={() => onLink(b.link!)} aria-label={`Go: ${b.label}`}>Go</button>}
          </li>
        ))}
      </ol>
    </article>
  );
}

type SeedTask = (typeof SEED.tasks)[number];
const taskState = (data: Data, id: string) => recs<TaskState>(data, 'tasks').find(t => t.id === id);
const baseTask = (t: SeedTask) => ({ checklist: t.checklist.map(() => false), done: false });

export function TopThree({ data, today }: { data: Data; today: string }) {
  const [picking, setPicking] = useState(false);
  const week = mondayOf(today);
  const picked = SEED.tasks.filter(t => taskState(data, t.id)?.pickedForWeek === week);
  return (
    <article className="card">
      <header><h3>This week’s top 3</h3><button className="btn ghost small" onClick={() => setPicking(true)}>{picked.length ? 'Change' : 'Pick'}</button></header>
      {picked.length ? (
        <ul className="mins">
          {picked.map(t => {
            const done = !!taskState(data, t.id)?.done;
            return (
              <li key={t.id}>
                <button className="min" aria-pressed={done} onClick={() => patchRec<TaskState>('tasks', t.id, { done: !done }, baseTask(t))}>
                  <i aria-hidden="true" />
                  <span><b>{t.title}</b><small>{t.priority} · {t.estimate}</small></span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : <p className="fine">Pick three P1 tasks for the week. Income first.</p>}
      {picking && <PickSheet data={data} today={today} week={week} onClose={() => setPicking(false)} />}
    </article>
  );
}

function PickSheet({ data, today, week, onClose }: { data: Data; today: string; week: string; onClose: () => void }) {
  const pd = planDay(data.settings, today);
  const list = pd.status !== 'in' || pd.phase === 'sprint' ? 'sprint' : pd.phase === 'build' ? 'build' : 'travel';
  const order = [list, ...['sprint', 'build', 'travel'].filter(x => x !== list)];
  const count = SEED.tasks.filter(t => taskState(data, t.id)?.pickedForWeek === week).length;
  const pri = (p: string) => Number(p.slice(1));
  return (
    <Sheet title={`Top 3 · week of ${fmtShort(week)}`} onClose={onClose}>
      <p className="fine">{count}/3 picked. Tap to add or remove.</p>
      {order.map(l => {
        const tasks = SEED.tasks.filter(t => t.list === l && !taskState(data, t.id)?.done).sort((a, b) => pri(a.priority) - pri(b.priority));
        if (!tasks.length) return null;
        return (
          <section key={l} className="stack-sm">
            <h3 className="picklist">{l === 'sprint' ? 'Sprint' : l === 'build' ? 'Build' : 'Travel'}</h3>
            <ul className="mins">
              {tasks.map(t => {
                const on = taskState(data, t.id)?.pickedForWeek === week;
                return (
                  <li key={t.id}>
                    <button className="min" aria-pressed={on} disabled={!on && count >= 3}
                      onClick={() => patchRec<TaskState>('tasks', t.id, { pickedForWeek: on ? undefined : week }, baseTask(t))}>
                      <i aria-hidden="true" />
                      <span><b>{t.title}</b><small>{t.priority} · {t.area} · {t.estimate}</small></span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <div className="actions sheet-go"><button className="btn primary" onClick={onClose}>Done</button></div>
    </Sheet>
  );
}
