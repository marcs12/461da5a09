import { addDays, avg } from './dates';
import { mondayOf } from './life';
import { recs, type CheckIn, type Data, type Rec } from './schema';
import { SEED } from '../data/seed';

/**
 * Mind: check-ins, trends, the support trigger and connection. Check-ins,
 * critic notes and the weekly connection record are private.
 */
const T = SEED.mind.supportTrigger;

/** Private. `id` is the week's Monday. */
export interface WeekLife extends Rec {
  touchGrass?: string;
  socialPlan?: boolean;
  creativeMinutes?: number;
  noNewCardBalance?: boolean;
  supportBooked?: boolean;
}
/** Private. A note from the critic tool. */
export interface CriticNote extends Rec { date: string; note: string }

export const checkIns = (d: Data) => recs<CheckIn>(d, 'checkIns');
export const weekLife = (d: Data, monday: string): WeekLife => recs<WeekLife>(d, 'weekLife').find(w => w.id === monday) ?? { id: monday, _u: 0 };

const inWeek = (ds: string, monday: string) => ds >= monday && ds <= addDays(monday, 6);

/** Mood average and check-in count for the Monday–Sunday week starting `monday`. */
export function weekMood(d: Data, monday: string) {
  const xs = checkIns(d).filter(c => inWeek(c.date, monday) && c.mood > 0);
  return { avg: avg(xs.map(c => c.mood)), n: xs.length };
}

/** Nights with 7+ hours logged in the week (sleep is logged on the morning after). */
export function sleepNights(d: Data, monday: string) {
  let n = 0, logged = 0;
  for (let i = 0; i < 7; i++) {
    const h = d.days[addDays(monday, i)]?.sleep;
    if (h != null) { logged++; if (h >= 7) n++; }
  }
  return { n, logged };
}

/**
 * Fires when the weekly mood average was at or under 4 for the last two
 * completed weeks (each with 3+ check-ins), or when "losing interest" was on
 * in any check-in this week. It only changes prominence: support is always
 * one tap away.
 */
export function supportTrigger(d: Data, today: string): { fired: boolean; reason: 'mood' | 'interest' | null } {
  const m = mondayOf(today);
  if (T.orLosingInterest && checkIns(d).some(c => inWeek(c.date, m) && c.losingInterest)) return { fired: true, reason: 'interest' };
  const low = (mon: string) => { const w = weekMood(d, mon); return w.n >= T.minCheckInsPerWeek && w.avg != null && w.avg <= T.weeklyMoodAvgAtOrBelow; };
  const weeks = Array.from({ length: T.consecutiveWeeks }, (_, i) => addDays(m, -7 * (i + 1)));
  return weeks.every(low) ? { fired: true, reason: 'mood' } : { fired: false, reason: null };
}

/** Hours between a bedtime and a wake time (HH:MM), across midnight. */
export function sleepHours(bed: string, wake: string) {
  const toMin = (t: string) => { const [h, mi] = t.split(':').map(Number); return h * 60 + mi; };
  let m = toMin(wake) - toMin(bed);
  if (m <= 0) m += 24 * 60;
  return Math.round((m / 60) * 4) / 4;
}
