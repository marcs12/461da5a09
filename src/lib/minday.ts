import { addDays, iso } from './dates';
import { isTravelMode } from './life';
import { sessionOf } from './program';
import { recs, type Data, type Job, type Rec } from './schema';
import { SEED } from '../data/seed';

/**
 * The minimum day and the never-miss-twice streak.
 * A day stays editable until noon the next day; the streak only judges days
 * whose window has closed.
 */
export type MinItemId = 'careerAction' | 'walk' | 'protein' | 'lightsOut' | 'checkIn';
export interface MinItem { id: MinItemId; label: string; hint?: string; done: boolean; why?: string }

const EDIT_HOURS = SEED.minimumDay.editWindowHoursIntoNextDay;

export function appliedOn(d: Data, ds: string) {
  return recs<Job>(d, 'jobs').filter(j => j.appliedAt === ds).length;
}
const reachedOutOn = (d: Data, ds: string) => recs<Rec & { date?: string }>(d, 'outreach').filter(o => o.date === ds).length;

/** The items that count on `ds` (three in travel mode), each with whether it's met. */
export function minItems(d: Data, ds: string): MinItem[] {
  const l = d.days[ds] || {};
  const travel = isTravelMode(d.settings, ds);
  const s = sessionOf(ds);
  const apps = appliedOn(d, ds);
  const outs = reachedOutOn(d, ds);
  const career = [apps && `${apps} application${apps > 1 ? 's' : ''}`, outs && `${outs} outreach`].filter(Boolean).join(' · ');
  const walked = (l.walkMin ?? 0) >= 20 || !!l.walk || (s?.kind === 'rest' && !!l.done);
  const proteinByGrams = (l.pro ?? 0) >= d.settings.proTarget;
  const met: Record<MinItemId, [boolean, string?]> = {
    careerAction: [!!l.career || apps + outs > 0, career ? `${career} logged` : undefined],
    walk: [walked, l.walkMin ? `${l.walkMin} min` : l.walk || walked ? 'walk logged' : undefined],
    protein: [l.proMeals === 3 || proteinByGrams, proteinByGrams ? `${l.pro} g` : undefined],
    lightsOut: [!!l.lightsOut],
    checkIn: [!!l.checkedIn],
  };
  return SEED.minimumDay.items
    .filter(i => !travel || i.requiredInTravel)
    .map(i => {
      const [done, why] = met[i.id as MinItemId];
      return { id: i.id as MinItemId, label: i.label, hint: 'hint' in i ? i.hint : undefined, done, why };
    });
}

export const isComplete = (d: Data, ds: string) => minItems(d, ds).every(i => i.done);

/** The most recent day whose edit window has closed. */
export const lastClosedDay = (now: Date) => addDays(iso(now), now.getHours() >= EDIT_HOURS ? -1 : -2);
/** Yesterday is still open before noon; today always is. */
export const isOpen = (ds: string, now: Date) => ds > lastClosedDay(now) && ds <= iso(now);

export interface Streak { current: number; best: number; graceUsed: boolean; lastClosed: string }

/**
 * Never miss twice: a completed day adds 1 and resets the miss counter, a
 * missed day adds 0, and two misses in a row end the run. Days before the
 * plan start don't count.
 */
export function streak(done: (ds: string) => boolean, start: string, lastClosed: string): Streak {
  let current = 0, miss = 0;
  for (let ds = lastClosed; ds >= start; ds = addDays(ds, -1)) {
    if (done(ds)) { current++; miss = 0; } else if (++miss >= 2) break;
  }
  let best = 0, run = 0;
  miss = 0;
  for (let ds = start; ds <= lastClosed; ds = addDays(ds, 1)) {
    if (done(ds)) { run++; miss = 0; } else if (++miss >= 2) run = 0;
    best = Math.max(best, run);
  }
  return { current, best, graceUsed: current > 0 && lastClosed >= start && !done(lastClosed), lastClosed };
}

export const dayStreak = (d: Data, now: Date) => streak(ds => isComplete(d, ds), d.settings.planStart, lastClosedDay(now));
