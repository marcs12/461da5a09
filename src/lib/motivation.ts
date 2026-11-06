import { addDays, diff, fmtShort } from './dates';
import { END, RACE_PACE, START, SUB60_PACE, TOTAL_DAYS, TT_DATE, pace, programDay, sessionOf, type ProgramDay, type Session } from './program';
import { GOAL_WEIGHT, startWeight } from './targets';
import { isDone, weights } from './stats';
import { BASE_10K, GOAL_10K, body, overall, speed } from './progress';
import type { Data } from './schema';

/**
 * The parts of the app whose job is to keep you going: the arc from where you
 * started to where you're headed, the streak, and why today's session matters.
 */

const planned = (ds: string) => { const s = sessionOf(ds); return !!s && s.kind !== 'rest'; };

/** Planned sessions done in a row, ending today (or yesterday while today is still open). Rest days don't break it. */
export function sessionStreak(d: Data, t: string) {
  let ds = t > END ? END : t, n = 0;
  if (planned(ds) && !isDone(d, ds)) ds = addDays(ds, -1);
  for (; ds >= START; ds = addDays(ds, -1)) {
    if (!planned(ds)) continue;
    if (!isDone(d, ds)) break;
    n++;
  }
  return n;
}

/** Sessions done so far, and how many the whole plan has. */
export function sessionCount(d: Data, t: string) {
  let done = 0, total = 0;
  for (let i = 0; i < TOTAL_DAYS; i++) {
    const ds = addDays(START, i);
    if (!planned(ds)) continue;
    total++;
    if (ds <= t && isDone(d, ds)) done++;
  }
  return { done, total };
}

export interface Upcoming { date: string; title: string; days: number }
/** The next time trial, the Sun Run, and Hawaii after it. */
export function upcoming(t: string): Upcoming[] {
  const out: Upcoming[] = [];
  for (let i = 0; i < TOTAL_DAYS; i++) {
    const ds = addDays(START, i), s = sessionOf(ds);
    if (ds < t || !s?.goalSec || !s.km || ds === END) continue;
    out.push({ date: ds, title: ds === TT_DATE ? 'Sub-60 attempt' : `${s.km}K time trial`, days: diff(ds, t) });
    break;
  }
  if (t <= END) out.push({ date: END, title: 'Sun Run', days: diff(END, t) });
  return out;
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

/** One line on what today's session does for the goals. */
export function why(s: Session, pd: ProgramDay): string {
  const phase = pd.status === 'in' ? pd.phase.id : undefined;
  const push = phase === 'push' || phase === 'taper' || phase === 'race';
  if (s.amrap) return 'Hard, short and heavy: it burns a lot and keeps your muscle while you eat less.';
  if (s.kind === 'strength') return 'Lifting tells your body to keep its muscle while you eat less, so the weight that comes off is fat. That is the difference between thin and lean in Hawaii.';
  switch (s.tag) {
    case 'Run/walk': return 'Every minute you run now is one you won\u2019t walk later. Thirty minutes non-stop by Nov 15.';
    case 'Rest': return 'Rest is when the training turns into fitness. Hit your steps and protein and let it land.';
    case 'Walk': return 'Steps burn fat without costing you any recovery. This is free progress toward 165.';
    case 'Low impact': return 'Extra calories burned without pounding your shins, so the runs stay fresh.';
    case 'Race': return `This is what the 25 weeks were for. Go out at ${pace(RACE_PACE)}, settle, then hold on.`;
    case 'Time trial': return `A checkpoint, not a verdict. Target ${s.goalSec ? clock(s.goalSec) : 'your best'}. Whatever the clock says tells the plan what comes next.`;
    case 'Intervals': return push
      ? `Repeats faster than race pace make ${pace(RACE_PACE)} feel controlled on Apr 18.`
      : `Every repeat on pace makes sub-60 feel familiar. ${pace(SUB60_PACE)} is the number for Jan 31.`;
    case 'Tempo': return 'Comfortably hard raises the pace you can hold for a whole 10K. This is where minutes come off.';
    case 'Long run': return 'The long run is where 10K starts to feel short. Slow is fine. Finishing is the point.';
    case 'Easy run': return phase === 'rebuild'
      ? 'Every minute you run now is one you won’t walk later. Thirty minutes non-stop by Nov 15.'
      : 'Easy running builds the engine: a stronger heart moves more blood each beat, and that is what makes 55:00 possible.';
  }
  if (s.kind === 'rest') return 'Rest is when the training turns into fitness.';
  return 'One more session on the arc. They add up faster than it feels.';
}

/** Where you started, where you are, and where Apr 18 is, for the arc on Today. */
export function arc(d: Data, t: string) {
  const pd = programDay(t);
  const B = body(d, t), S = speed(d, t), O = overall(d, t);
  const day = pd.status === 'in' ? pd.idx + 1 : pd.status === 'post' ? TOTAL_DAYS : 0;
  let forecast: string;
  if (pd.status === 'pre') {
    forecast = `${Math.round(startWeight(d) - GOAL_WEIGHT)} lb lighter and ${Math.round((BASE_10K - GOAL_10K) / 60)} minutes faster than last April. It starts ${pd.daysUntil === 1 ? 'tomorrow' : `in ${pd.daysUntil} days`}.`;
  } else if (pd.status === 'post') {
    forecast = 'The arc is complete. Hawaii is the victory lap.';
  } else if (day < 21) {
    forecast = `${day <= 7 ? 'Week 1' : day <= 14 ? 'Week 2' : 'Week 3'} builds the habit. Three weeks in, this turns into a forecast. For now: show up, log it, repeat.`;
  } else if (B.projected != null && B.perWeek != null && B.perWeek < 0) {
    forecast = B.goalOn
      ? `At this pace you reach ${GOAL_WEIGHT} lb around ${fmtShort(B.goalOn)}, before the Sun Run.`
      : `At this pace you weigh about ${Math.round(B.projected)} lb on race day. Every week on plan pulls that toward ${GOAL_WEIGHT}.`;
  } else if (S.est != null && S.est < BASE_10K) {
    forecast = `Your 10K is ${Math.round((BASE_10K - S.est) / 60)} minutes faster than last April already.`;
  } else {
    forecast = B.lost > 0 ? `${Math.round(B.lost * 10) / 10} lb down. Keep logging and this turns into a forecast.` : 'Log your weigh-ins and this turns into a forecast.';
  }
  return {
    day, days: TOTAL_DAYS, pct: pd.status === 'post' ? Math.max(O.pct, 1) : O.pct,
    start: { w: B.start, tenK: BASE_10K },
    // The number you stood on most recently, with the 7-day average the percentages use alongside it.
    now: { w: [...weights(d)].reverse().find(e => e.date <= t)?.w, avg: B.now ?? undefined, tenK: S.est },
    goal: { w: GOAL_WEIGHT, tenK: GOAL_10K },
    forecast, status: pd.status,
  };
}
