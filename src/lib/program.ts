import { addDays, clock, diff, parse } from './dates';

/** The 25-week build to the Vancouver Sun Run 10K. Weeks run Monday → Sunday; the long run and the race are on Sundays. */
export const START = '2026-10-26';
export const END = '2027-04-18';
export const RACE = END;
export const WEEKS = 25;
export const TOTAL_DAYS = WEEKS * 7;
export const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** Sub-60 pace for the Jan 31 time trial, seconds per km (5:57 → 59:30). */
export const SUB60_PACE = 357;
/** Sun Run goal pace, seconds per km (5:30 → 55:00). */
export const RACE_PACE = 330;
export const RACE_GOAL = '55:00';
export const TT_DATE = '2027-01-31';
export const TT_RETRY = '2027-02-28';
export const pace = (sec: number) => `${clock(sec)}/km`;
/** "55:00" → 3300. */
export const toSec = (mmss: string) => { const [m, s] = mmss.split(':').map(Number); return m * 60 + (s || 0); };

export type Kind = 'cardio' | 'strength' | 'rest';
export type Tone = 'work' | 'easy' | 'warm';
export interface Segment { label: string; sec: number; tone: Tone }
export interface Session {
  kind: Kind;
  tag: string;
  /** Label for the program grid. */
  short: string;
  title: string;
  lines: string[];
  minutes?: number;
  km?: number;
  segments?: Segment[];
  lifts?: string[];
  sets?: number;
  /** Suggested effort (1–10) for the log's placeholder. */
  effort?: number;
  /** An easy run: its heart rate should stay out of zone 3. */
  easy?: boolean;
  /** Time trial or race: the time to beat, seconds. */
  goalSec?: number;
  /** Target pace for the hard part, seconds per km, and the length of each repeat. */
  pace?: number;
  repKm?: number;
  repN?: number;
  /** An AMRAP: minutes of work, the moves of one round, and the exercise id its weight and rounds are logged under. */
  amrap?: number;
  moves?: Move[];
  logAs?: string;
}
export interface Move { name: string; reps: number; note?: string; cue: string }
export type PhaseId = 'rebuild' | 'base' | 'speed' | 'tt' | 'push' | 'taper' | 'race';
export interface Phase { id: PhaseId; name: string; blurb: string; from: number; to: number }
export type ProgramDay =
  | { status: 'pre'; daysUntil: number }
  | { status: 'post' }
  | { status: 'in'; idx: number; week: number; /** 0 = Sunday */ dow: number; phase: Phase; pw: number; session: Session };

export const PHASES: Phase[] = [
  { id: 'rebuild', name: 'Rebuild', blurb: 'Run/walk back to 30 minutes non-stop', from: 1, to: 3 },
  { id: 'base', name: 'Base', blurb: 'Easy running, a fourth run from week 6, first workouts', from: 4, to: 8 },
  { id: 'speed', name: 'Speed', blurb: 'One workout a week, long run to 11 km', from: 9, to: 13 },
  { id: 'tt', name: 'Sub-60', blurb: '10K time trial on Sunday, Jan 31', from: 14, to: 14 },
  { id: 'push', name: 'Push', blurb: 'Faster workouts toward 55:00, long run to 14 km', from: 15, to: 23 },
  { id: 'taper', name: 'Taper', blurb: 'Less volume, keep the pace', from: 24, to: 24 },
  { id: 'race', name: 'Race week', blurb: `Sun Run 10K on Sunday, goal ${RACE_GOAL}`, from: 25, to: 25 },
];
export const weekStart = (week: number) => addDays(START, (week - 1) * 7);
export const phaseStart = (p: Phase) => weekStart(p.from);
export const phaseEnd = (p: Phase) => addDays(START, p.to * 7 - 1);
export const phaseOfWeek = (w: number) => PHASES.find(p => w >= p.from && w <= p.to)!;

/** What the week is for, shown under the week strip. */
export const WEEK_NOTES: Record<number, string> = {
  1: 'The first 4 to 6 lb is mostly water. Count calories from day 1, and walk 12,000 steps a day.',
  3: 'Thirty minutes non-stop by Sunday. Shins or knees complaining: repeat week 2 instead.',
  6: 'Wednesday becomes a fourth run: short and easy, and the first thing to drop in a busy week.',
  7: 'First speed workout on Thursday. Eat your carbs before it.',
  8: 'Lighter week, with a 5K time trial on Sunday: under 31:00. Checkpoint: 210 lb on track, 214 the fallback.',
  9: 'Christmas week: Dec 24 and 25 at maintenance. Thursday is Christmas Eve, so swap the workout to Wednesday if that’s easier.',
  12: '5K time trial on Sunday: under 28:45 means sub-60 is on for Jan 31. Miss it and Jan 31 becomes a hard tempo; the attempt moves to Feb 28.',
  14: 'Time trial week. No Friday strength. Eat at maintenance Thursday to Saturday. Sunday: 10K under 60:00. Checkpoint: 193 lb on track, 199 the fallback.',
  15: 'Recovery week after the time trial. Calories drop to 1,500 and steps go up to 15,000.',
  18: 'Missed sub-60 on Jan 31? Make Sunday a 10K time trial instead of the long run.',
  19: 'Lighter week.',
  20: '5K time trial on Sunday: under 26:30. Checkpoint: 177 lb on track, 184 the fallback.',
  22: 'Longest run of the plan on Sunday: 14 km.',
  24: 'Taper. Checkpoint on Sunday: 165 lb on track, 172 the fallback.',
  25: `Eat at maintenance all week, with extra carbs on Friday and Saturday. One strength session, on Monday. Race goal: ${RACE_GOAL}. From Monday, back to 1,500 until Hawaii.`,
};

export interface Exercise {
  name: string;
  note?: string;
  bw?: boolean;
  unit?: 'reps' | 'sec';
  /** Reps (or seconds) to hit on every set before adding weight. */
  target?: number;
  /** Heaviest the kettlebell (44) or dumbbell (50) goes. */
  max?: number;
}
const KB = 44, DB = 50;
/** Ids are what the log stores, so the ones from the earlier program stay: old sets still show under Progress. */
export const EX: Record<string, Exercise> = {
  goblet: { name: 'Goblet squat', target: 10, max: KB },
  swing: { name: 'Kettlebell swing', target: 15, max: KB },
  row: { name: 'One-arm row', note: 'per side', target: 10, max: KB },
  pushup: { name: 'Push-ups', bw: true, note: 'stop 2 short of failure' },
  plank: { name: 'Plank', bw: true, unit: 'sec', target: 40 },
  rdl: { name: 'Romanian deadlift', target: 10, max: DB },
  rlunge: { name: 'Reverse lunge', note: 'per side', target: 8, max: DB },
  ohp: { name: 'One-arm overhead press', note: 'per side', target: 8, max: DB },
  calf: { name: 'Single-leg calf raise', note: 'per side', target: 15, max: DB },
  farmer: { name: 'Suitcase carry', unit: 'sec', note: 'per side', target: 40, max: DB },
  // Earlier program only (dead bugs and floor press are back in the current one).
  bridge: { name: 'Glute bridge' },
  floor: { name: 'Dumbbell floor press', note: 'per side', target: 10, max: DB },
  crunch: { name: 'Weighted crunch', note: 'dumbbell on your chest', target: 12, max: DB },
  pullover: { name: 'Pullover' },
  deadbug: { name: 'Dead bugs', bw: true, note: 'per side', target: 10 },
  lateral: { name: 'Lateral raise' },
  hammer: { name: 'Hammer curl' },
  triext: { name: 'Overhead triceps extension' },
  sideplank: { name: 'Side plank', bw: true, unit: 'sec', note: 'per side' },
  complex: { name: 'Dumbbell complex', note: 'rounds' },
  kbcomplex: { name: 'Kettlebell complex', note: 'rounds', max: KB },
};
export const STRENGTH = {
  A: { title: 'Strength A', tool: 'Kettlebell', ids: ['goblet', 'swing', 'row', 'pushup', 'deadbug', 'plank'] },
  B: { title: 'Strength B', tool: 'Dumbbell', ids: ['rdl', 'rlunge', 'floor', 'ohp', 'calf', 'crunch', 'farmer'] },
};

const seg = (label: string, min: number, tone: Tone): Segment => ({ label, sec: Math.round(min * 60), tone });
export const segTotal = (segs: Segment[]) => segs.reduce((a, s) => a + s.sec, 0);
const segMin = (segs: Segment[]) => Math.round(segTotal(segs) / 60);
const WALK_IN = seg('Walk', 5, 'warm'), WALK_OUT = seg('Walk', 5, 'easy');
const JOG_IN = seg('Easy jog', 10, 'warm'), JOG_OUT = seg('Easy jog', 5, 'easy');
const EASY = 'Easy means you can talk in full sentences';

type Run = Omit<Session, 'kind'>;
const timed = (r: Omit<Run, 'minutes'> & { segments: Segment[] }): Run => ({ ...r, minutes: segMin(r.segments) });

/** Run/walk intervals, bracketed by 5 minutes of walking. */
function runWalk(n: number, run: number, walk: number): Run {
  const segs = [WALK_IN];
  for (let i = 0; i < n; i++) {
    segs.push(seg('Run', run, 'work'));
    if (i < n - 1) segs.push(seg('Walk', walk, 'easy'));
  }
  segs.push(WALK_OUT);
  return timed({
    tag: 'Run/walk', short: `${n}×${run}`, title: `${n} × ${run} min run, ${walk} min walk`, segments: segs, effort: 4, easy: true,
    lines: [`${n} rounds: ${run} min running, ${walk} min walking`, '5-min walk before and after', EASY],
  });
}
/** A continuous easy run, with four 20-second strides after it on stride days. */
function easy(min: number, strides = false, lines: string[] = []): Run {
  const segs = [WALK_IN, seg('Easy run', min, 'work')];
  if (strides) for (let i = 0; i < 4; i++) segs.push(seg('Stride', 1 / 3, 'work'), seg('Walk', 1, 'easy'));
  segs.push(WALK_OUT);
  return timed({
    tag: 'Easy run', short: `${min}m`, title: strides ? `${min} min easy, then 4 strides` : `${min} min easy`, segments: segs, effort: 4, easy: true,
    lines: [
      `${min} min of continuous easy running`, '5-min walk before and after', EASY,
      ...(strides ? ['Strides: 20 seconds fast but relaxed, 1 min walk between each'] : []), ...lines,
    ],
  });
}
const long = (km: number, lines: string[] = []): Run => ({
  tag: 'Long run', short: `${km}k`, title: `${km} km long run`, km, effort: 5, easy: true,
  lines: [`${km} km at easy pace`, '5-min walk before and after', EASY, ...lines],
});
const timeTrial = (km: 5 | 10, goal: string, lines: string[] = []): Run => ({
  tag: 'Time trial', short: 'TT', title: `${km}K time trial`, km, effort: 9, goalSec: toSec(goal),
  lines: [`${km} km as fast as you can hold evenly. Target: under ${goal}`, '10-min easy jog first, 5-min walk after', 'Log the time in minutes so the next one has something to beat', ...lines],
});
const PACE_NAMES: Record<number, string> = { [SUB60_PACE]: 'sub-60 pace', [RACE_PACE]: 'Sun Run goal pace' };
/** `n` repeats of `km` at `p` seconds per km. The timer runs each repeat for the time that pace takes. */
function reps(n: number, km: number, p: number, rest: number, restLabel: 'Walk' | 'Jog'): Run {
  const segs = [JOG_IN];
  for (let i = 0; i < n; i++) {
    segs.push({ label: `${km} km at ${clock(p)}`, sec: Math.round(km * p), tone: 'work' });
    if (i < n - 1) segs.push(seg(restLabel, rest, 'easy'));
  }
  segs.push(JOG_OUT);
  return timed({
    tag: 'Intervals', short: `${n}×${km}k`, title: `${n} × ${km} km at ${pace(p)}`, segments: segs, effort: 8, pace: p, repKm: km, repN: n,
    lines: [`${n} × ${km} km at ${pace(p)}${PACE_NAMES[p] ? `, ${PACE_NAMES[p]}` : ''}`, `${rest} min ${restLabel.toLowerCase()} between`, '10-min easy jog first, 5 min after', 'Eat carbs before this one'],
  });
}
function tempo(min: number, p: number): Run {
  const segs = [JOG_IN, seg(`Tempo at ${clock(p)}`, min, 'work'), JOG_OUT];
  return timed({
    tag: 'Tempo', short: 'Tempo', title: `${min} min tempo at ${pace(p)}`, segments: segs, effort: 7, pace: p,
    lines: [`${min} min at ${pace(p)}, comfortably hard`, '10-min easy jog first, 5 min after', 'Eat carbs before this one'],
  });
}
/** 20 minutes easy with a few short efforts at goal pace, a few days before a time trial or the race. */
function sharpener(n: number, p: number, when: string): Run {
  const segs = [WALK_IN, seg('Easy run', 4, 'work')];
  for (let i = 0; i < n; i++) segs.push(seg(`Goal pace ${clock(p)}`, 2, 'work'), seg('Easy run', 2, 'easy'));
  segs.push(seg('Easy run', Math.max(2, 16 - 4 * n), 'easy'), WALK_OUT);
  return timed({
    tag: 'Easy run', short: '20m', title: `20 min easy with ${n} × 2 min at ${pace(p)}`, segments: segs, effort: 5,
    lines: ['20 min easy', `${n} × 2 min at ${pace(p)} in the middle, 2 min easy between`, `${when}: sharp legs, not tired ones`],
  });
}
const SUB60_TT: Run = {
  ...timeTrial(10, '60:00', [`That is ${pace(SUB60_PACE)} on average: run the first km a few seconds slower, then settle in`]),
  short: '10K TT', title: 'Sub-60 10K time trial', effort: 9,
};
const RACE_DAY: Run = {
  tag: 'Race', short: 'RACE', title: 'Sun Run 10K', km: 10, effort: 9, goalSec: toSec(RACE_GOAL),
  lines: [`Goal ${RACE_GOAL}: ${pace(RACE_PACE)} on average`, 'Run the first 2 km a few seconds slower than that, then settle in', 'The last 2 km are the test'],
};

/** Tuesday, Wednesday, Thursday and Sunday of each week. A null Wednesday is low-impact cardio instead of a run. */
const RUNS: [Run, Run | null, Run, Run][] = [
  [runWalk(6, 3, 2), null, runWalk(5, 4, 2), runWalk(4, 6, 2)],
  [runWalk(3, 8, 2), null, runWalk(3, 8, 2), runWalk(2, 12, 2)],
  [easy(20, false, ['First run with no walk breaks']), null, easy(20), easy(30, false, ['Thirty minutes non-stop: the rebuild is done'])],
  [easy(30), null, easy(30), long(5)],
  [easy(30, true), null, easy(30), long(6)],
  [easy(35, true), easy(20, false, ['The new fourth run: keep it truly easy']), easy(35), long(7)],
  [easy(35, true), easy(25), reps(4, 1, 380, 2, 'Walk'), long(8)],
  [easy(35), easy(25), tempo(20, 390), timeTrial(5, '31:00')],
  [easy(40, true), easy(25), reps(5, 1, 365, 2, 'Walk'), long(9)],
  [easy(40), easy(30), tempo(25, 375), long(10)],
  [easy(40, true), easy(30), reps(6, 1, 355, 2, 'Walk'), long(10)],
  [easy(35), easy(25), reps(3, 2, 360, 3, 'Jog'), timeTrial(5, '28:45', ['Under 28:45 predicts a 10K just under an hour'])],
  [easy(40, true), easy(30), reps(2, 3, 355, 3, 'Jog'), long(11)],
  [easy(30), easy(20), sharpener(4, 350, 'Three days out'), SUB60_TT],
  [easy(35, false, ['Recovery week: easy only']), easy(25), easy(30), long(9)],
  [easy(40, true), easy(30), reps(5, 1, 330, 2, 'Walk'), long(11)],
  [easy(40, true), easy(30), tempo(25, 350), long(12)],
  [easy(40), easy(30), reps(6, 1, 325, 2, 'Walk'), long(12, ['Missed sub-60 on Jan 31? Run a 10K time trial today instead'])],
  [easy(35), easy(25), easy(30), long(10)],
  [easy(40, true), easy(30), reps(3, 2, 335, 3, 'Jog'), timeTrial(5, '26:30')],
  [easy(45, true), easy(35), tempo(30, 345), long(13)],
  [easy(45), easy(35), reps(6, 1, 320, 2, 'Walk'), long(14, ['Longest run of the plan'])],
  [easy(40, true), easy(30), reps(2, 3, 330, 3, 'Jog'), long(12)],
  [easy(35, true), easy(25), reps(4, 1, 325, 2, 'Walk'), long(8, ['Last long run before the race'])],
  [easy(30, true), null, sharpener(3, RACE_PACE, 'Three days out'), RACE_DAY],
];

function strength(which: 'A' | 'B'): Session {
  const s = STRENGTH[which];
  return {
    kind: 'strength', tag: s.tool, short: `Str ${which}`, title: s.title, minutes: 45, lifts: s.ids, sets: 3,
    lines: ['3 sets of each, 60 to 90 seconds rest between sets', 'Hit every rep on every set, then add weight next time', 'Finish with the core moves: they build the abs that show once you’re lean enough'],
  };
}
const rest = (title: string, lines: string[]): Session => ({ kind: 'rest', tag: 'Rest', short: 'Rest', title, lines });

function buildSession(week: number, dow: number): Session {
  const raceWeek = week === WEEKS, ttWeek = week === 14;
  const [tue, wed, thu, sun] = RUNS[week - 1];
  switch (dow) {
    case 1: return strength('A');
    case 2: return { kind: 'cardio', ...tue };
    case 3: return wed ? { kind: 'cardio', ...wed } : {
      kind: 'cardio', tag: 'Low impact', short: 'Walk', title: 'Low-impact cardio', minutes: 30, effort: 4,
      lines: raceWeek
        ? ['20 to 30 min easy treadmill walk', 'Nothing hard this week']
        : ['30 min: brisk treadmill walk or Body Combat', 'The first thing to drop in a busy week'],
    };
    case 4: return { kind: 'cardio', ...thu };
    case 5: return raceWeek
      ? rest('Rest', ['No strength today: Monday was the only session this week', 'Extra carbs today and tomorrow'])
      : ttWeek ? rest('Rest', ['No strength this week after Monday: fresh legs for Sunday', 'Maintenance calories today'])
      : strength('B');
    case 6: return raceWeek
      ? rest('Rest before the race', ['Easy walk only', 'Extra carbs, and lay your kit out tonight'])
      : ttWeek ? rest('Rest before the time trial', ['Easy walk only', 'Maintenance calories, with extra carbs at dinner'])
      : rest('Rest', ['Rest, or an easy walk', 'Still hit your steps']);
    default: return { kind: 'cardio', ...sun };
  }
}

const cache = new Map<string, ProgramDay>();
export function programDay(ds: string): ProgramDay {
  const hit = cache.get(ds);
  if (hit) return hit;
  const idx = diff(ds, START);
  let r: ProgramDay;
  if (idx < 0) r = { status: 'pre', daysUntil: -idx };
  else if (idx >= TOTAL_DAYS) r = { status: 'post' };
  else {
    const week = Math.floor(idx / 7) + 1;
    const dow = parse(ds).getDay();
    const phase = phaseOfWeek(week);
    r = { status: 'in', idx, week, dow, phase, pw: week - phase.from + 1, session: buildSession(week, dow) };
  }
  cache.set(ds, r);
  return r;
}
export const sessionOf = (ds: string) => {
  const p = programDay(ds);
  return p.status === 'in' ? p.session : null;
};
/** Sessions that count toward the week: everything but the rest days. */
export const isTraining = (s: Session | null) => !!s && s.kind !== 'rest';

/* ---------- Before Vietnam: the kettlebell complex ---------- */

/** One round of the 20-minute kettlebell AMRAP. */
export const KB_COMPLEX: Move[] = [
  { name: 'Bent-over rows', reps: 10, cue: 'Pull your elbows toward your back pockets' },
  { name: 'Swings', reps: 15, cue: 'Drive with your hips, not your arms' },
  { name: 'Clean + thrusters', reps: 8, cue: 'Let your legs create the power' },
  { name: 'Alternating reverse lunges', reps: 10, note: '5 per leg', cue: 'Stay tall and drive through your front heel' },
  { name: 'Kettlebell toe taps', reps: 20, note: 'alternating feet on the bell', cue: 'Stay light and keep moving' },
  { name: 'Horn push-ups', reps: 10, note: 'hands on the horns', cue: 'Keep your body rigid from head to heels' },
];
export const KB_COMPLEX_REPS = KB_COMPLEX.reduce((a, m) => a + m.reps, 0);
/** 12 kg, the top of the beginner range and the bottom of intermediate. */
export const KB_COMPLEX_START_LB = 26;
export const KB_WEIGHTS = [
  { level: 'Beginner', kg: '8–12 kg', lb: '18–26 lb' },
  { level: 'Intermediate', kg: '12–16 kg', lb: '26–35 lb' },
  { level: 'Advanced', kg: '20–24 kg', lb: '44–53 lb' },
];

function kbComplex(note: string): Session {
  const segs = [seg('Warm-up', 5, 'warm'), seg('AMRAP', 20, 'work'), seg('Cool-down', 3, 'easy')];
  return {
    kind: 'strength', tag: 'Kettlebell', short: 'Cmplx', title: 'Kettlebell complex', segments: segs, minutes: segMin(segs),
    amrap: 20, moves: KB_COMPLEX, logAs: 'kbcomplex', effort: 8,
    lines: [
      `20-minute AMRAP: as many rounds as you can of all ${KB_COMPLEX.length} moves`,
      'Rest as needed, but keep the timer running',
      note,
    ],
  };
}
/** Oct 12 to 15, the days left before the trip: the complex three times, with a walk after the first. The 15th is a morning session before the night flight. */
const BRIDGE: Record<string, Session> = {
  '2026-10-12': kbComplex(`First time: start around ${KB_COMPLEX_START_LB} lb and keep every rep clean`),
  '2026-10-13': {
    kind: 'cardio', tag: 'Walk', short: 'Walk', title: 'Brisk walk', minutes: 30, effort: 4,
    lines: ['30 minutes at a brisk pace', 'Recovery between the two complexes'],
  },
  '2026-10-14': kbComplex('Same weight as Monday unless the app says go up'),
  '2026-10-15': kbComplex('Do it in the morning, before the night flight. Second day in a row: keep the weight, keep every rep clean'),
};
export const bridgeSession = (ds: string): Session | null => BRIDGE[ds] ?? null;
/** The session on any day: the program's, or one of the pre-trip days. */
export const sessionFor = (ds: string) => sessionOf(ds) ?? bridgeSession(ds);
