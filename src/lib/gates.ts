import { addDays } from './dates';
import { buildStart } from './life';
import { isComplete } from './minday';
import { recs, type Data, type GateOverride, type Job, type Rec, type TaskState } from './schema';
import { SEED } from '../data/seed';

/**
 * The two gates, auto-checked from logs. The seed's `auto` strings describe
 * these functions. Each criterion can be overridden by hand.
 */
export interface Criterion { id: string; label: string; done: boolean; auto: boolean; overridden: boolean; progress?: string }
export interface Gate { id: string; name: string; due: string | null; criteria: Criterion[] }

const taskDone = (d: Data, id: string) => !!recs<TaskState>(d, 'tasks').find(t => t.id === id)?.done;
const appliedBetween = (d: Data, from: string, to: string) =>
  recs<Job>(d, 'jobs').filter(j => j.appliedAt && j.appliedAt >= from && j.appliedAt <= to).length;

type Auto = { done: boolean; progress?: string };
function autoCheck(d: Data, gateId: string, cid: string): Auto {
  const S = d.settings, b = buildStart(S);
  switch (`${gateId}:${cid}`) {
    case 'before-fly:apps20': {
      const n = appliedBetween(d, S.planStart, addDays(S.departDate, -1));
      return { done: n >= 20, progress: `${Math.min(n, 20)}/20` };
    }
    case 'before-fly:resume-linkedin': return { done: taskDone(d, 'resume-v2') && taskDone(d, 'linkedin') };
    case 'before-fly:trip-budget':
      return { done: recs<Rec & { total?: number }>(d, 'tripBudget').some(t => (t.total ?? 0) > 0) };
    case 'first-week-back:min-day':
      return { done: !!S.returnDate && isComplete(d, addDays(S.returnDate, 1)) };
    case 'first-week-back:review':
      return { done: !!S.returnDate && recs<Rec & { weekOf?: string }>(d, 'reviews').some(r => (r.weekOf ?? '') > S.returnDate!) };
    case 'first-week-back:apps-restart':
      return { done: !!b && appliedBetween(d, b, addDays(b, 6)) >= 1 };
  }
  return { done: false };
}

export function gateDue(d: Data, gateId: string): string | null {
  if (gateId === 'before-fly') return addDays(d.settings.departDate, -1);
  const b = buildStart(d.settings);
  return b && addDays(b, 6);
}

export function gates(d: Data): Gate[] {
  const over = new Map(recs<GateOverride>(d, 'gates').map(o => [o.id, o.done]));
  return SEED.gates.map(g => ({
    id: g.id, name: g.name, due: gateDue(d, g.id),
    criteria: g.criteria.map(c => {
      const a = autoCheck(d, g.id, c.id);
      const o = over.get(`${g.id}:${c.id}`);
      return { id: c.id, label: c.label, auto: a.done, done: o ?? a.done, overridden: o != null, progress: a.progress };
    }),
  }));
}

/** The first gate not yet past its due date. After its due date, a gate drops off Today. */
export const nextGate = (d: Data, today: string) => gates(d).find(g => !g.due || g.due >= today) ?? null;
