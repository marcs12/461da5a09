import { addDays, diff, parse } from './dates';
import type { Settings } from './schema';

/**
 * The 90-day life plan, derived from Settings. Separate from the 16-week
 * training program in program.ts, which keeps its own Sunday-start weeks.
 * Life-plan weeks run Monday → Sunday.
 */
export type LifePhaseId = 'sprint' | 'travel' | 'reentry' | 'build';
type Dates = Pick<Settings, 'planStart' | 'planDays' | 'departDate' | 'returnDate'>;

export const planEnd = (s: Dates) => addDays(s.planStart, s.planDays - 1);

/** Monday of the week containing `ds`. */
export const mondayOf = (ds: string) => addDays(ds, -((parse(ds).getDay() + 6) % 7));
/** The first Sunday on or after `ds`. */
export const sundayFrom = (ds: string) => addDays(ds, (7 - parse(ds).getDay()) % 7);

/** Travel runs from departure to the Sunday after you're home (days home before
 *  it are Re-entry). Build starts the Monday after. Null while the return date is unset. */
export const travelEnd = (s: Dates) => (s.returnDate ? sundayFrom(s.returnDate) : null);
export const buildStart = (s: Dates) => {
  const t = travelEnd(s);
  return t ? addDays(t, 1) : null;
};

export type PlanDay =
  | { status: 'pre'; daysUntil: number }
  | { status: 'post' }
  | { status: 'in'; day: number; phase: LifePhaseId; buildWeek: number | null };

export function phaseOn(s: Dates, ds: string): LifePhaseId {
  if (ds < s.departDate) return 'sprint';
  if (!s.returnDate || ds < s.returnDate) return 'travel';
  if (ds <= travelEnd(s)!) return 'reentry';
  return 'build';
}

export function planDay(s: Dates, ds: string): PlanDay {
  const idx = diff(ds, s.planStart);
  if (idx < 0) return { status: 'pre', daysUntil: -idx };
  if (idx >= s.planDays) return { status: 'post' };
  const phase = phaseOn(s, ds);
  const b = buildStart(s);
  return { status: 'in', day: idx + 1, phase, buildWeek: phase === 'build' && b ? Math.floor(diff(ds, b) / 7) + 1 : null };
}

/** Travel rules apply abroad and during Re-entry, unless overridden in Settings. */
export const isTravelMode = (s: Settings, ds: string) =>
  s.travelModeOverride ?? ['travel', 'reentry'].includes(phaseOn(s, ds));

/** Which `weeklyTargets` row of the seed applies. */
export function targetsKey(p: PlanDay): 'sprint' | 'travel' | 'build1to4' | 'build5plus' | null {
  if (p.status !== 'in') return null;
  if (p.phase === 'sprint') return 'sprint';
  if (p.phase !== 'build') return 'travel';
  return (p.buildWeek ?? 1) <= 4 ? 'build1to4' : 'build5plus';
}

export const PHASE_NAME: Record<LifePhaseId, string> = { sprint: 'Sprint', travel: 'Travel', reentry: 'Re-entry', build: 'Build' };

/** Each phase's date range, for the roadmap. */
export function phaseRanges(s: Dates): { id: LifePhaseId; from: string; to: string | null }[] {
  const end = planEnd(s), te = travelEnd(s), b = buildStart(s);
  return [
    { id: 'sprint', from: s.planStart, to: addDays(s.departDate, -1) },
    { id: 'travel', from: s.departDate, to: s.returnDate ? addDays(s.returnDate, -1) : null },
    ...(s.returnDate ? [{ id: 'reentry' as const, from: s.returnDate, to: te }] : []),
    ...(b ? [{ id: 'build' as const, from: b, to: end }] : []),
  ];
}
