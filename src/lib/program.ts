import { addDays, clock, diff, parse } from './dates';

/** The 25-week build to the Vancouver Sun Run 10K. Weeks run Monday → Sunday; the long run and the race are on Sundays. */
export const START = '2026-10-26';
export const END = '2027-04-18';
export const RACE = END;
export const WEEKS = 25;
export const TOTAL_DAYS = WEEKS * 7;
export const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** Sub-60 pace, seconds per km (5:59 → 59:50). */
export const RACE_PACE = 359;
export const pace = (sec: number) => `${clock(sec)}/km`;

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
  /** An AMRAP: minutes of work, the moves of one round, and the exercise id its weight and rounds are logged under. */
  amrap?: number;
  moves?: Move[];
  logAs?: string;
}
export interface Move { name: string; reps: number; note?: string; cue: string }
export type PhaseId = 'rebuild' | 'base' | 'speed' | 'taper' | 'race';
export interface Phase { id: PhaseId; name: string; blurb: string; from: number; to: number }
export type ProgramDay =
  | { status: 'pre'; daysUntil: number }
  | { status: 'post' }
  | { status: 'in'; idx: number; week: number; /** 0 = Sunday */ dow: number; phase: Phase; pw: number; session: Session };

export const PHASES: Phase[] = [
  { id: 'rebuild', name: 'Rebuild', blurb: 'Run/walk back to 30 minutes non-stop', from: 1, to: 6 },
  { id: 'base', name: 'Base', blurb: 'All easy running, long run to 9 km', from: 7, to: 16 },
  { id: 'speed', name: 'Speed', blurb: 'One workout a week, long run to 12 km', from: 17, to: 23 },
  { id: 'taper', name: 'Taper', blurb: 'Less volume, keep the pace', from: 24, to: 24 },
  { id: 'race', name: 'Race week', blurb: 'Sun Run 10K on Sunday', from: 25, to: 25 },
];
export const weekStart = (week: number) => addDays(START, (week - 1) * 7);
export const phaseStart = (p: Phase) => weekStart(p.from);
export const phaseEnd = (p: Phase) => addDays(START, p.to * 7 - 1);
export const phaseOfWeek = (w: number) => PHASES.find(p => w >= p.from && w <= p.to)!;

/** What the week is for, shown under the week strip. */
export const WEEK_NOTES: Record<number, string> = {
  1: 'The first 4 to 6 lb is mostly water. Start counting calories on day 1.',
  6: 'Milestone: 30 minutes without walking.',
  8: 'Checkpoint on Sunday: 213 lb is on track, 217 is the floor.',
  9: 'Calories drop to 1,600. Dec 24 and 25 are at maintenance, then straight back to plan.',
  12: 'Lighter week, with a 5K time trial on Sunday. Target: under 34 minutes.',
  16: 'Lighter week. Checkpoint on Sunday: 194 lb is on track, 200 is the floor.',
  17: 'Calories drop to 1,500, the floor. Eat carbs before the Thursday workout.',
  20: 'Lighter week, with a 5K time trial on Sunday. Target: under 30 minutes.',
  22: 'Longest run of the plan on Sunday.',
  24: 'Checkpoint on Sunday: 174 lb is on track, 182 is the floor.',
  25: 'Eat at maintenance all week, with extra carbs on Friday and Saturday. One strength session, on Monday.',
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
  // Earlier program only.
  bridge: { name: 'Glute bridge' },
  floor: { name: 'Floor press' },
  pullover: { name: 'Pullover' },
  deadbug: { name: 'Dead bugs', bw: true, note: 'per side' },
  lateral: { name: 'Lateral raise' },
  hammer: { name: 'Hammer curl' },
  triext: { name: 'Overhead triceps extension' },
  sideplank: { name: 'Side plank', bw: true, unit: 'sec', note: 'per side' },
  complex: { name: 'Dumbbell complex', note: 'rounds' },
  kbcomplex: { name: 'Kettlebell complex', note: 'rounds', max: KB },
};
export const STRENGTH = {
  A: { title: 'Strength A', tool: 'Kettlebell', ids: ['goblet', 'swing', 'row', 'pushup', 'plank'] },
  B: { title: 'Strength B', tool: 'Dumbbell', ids: ['rdl', 'rlunge', 'ohp', 'calf', 'farmer'] },
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
    tag: 'Run/walk', short: `${n}×${run}`, title: `${n} × ${run} min run, ${walk} min walk`, segments: segs, effort: 4,
    lines: [`${n} rounds: ${run} min running, ${walk} min walking`, '5-min walk before and after', EASY],
  });
}
/** A continuous easy run, with four 20-second strides after it on stride days. */
function easy(min: number, strides = false, lines: string[] = []): Run {
  const segs = [WALK_IN, seg('Easy run', min, 'work')];
  if (strides) for (let i = 0; i < 4; i++) segs.push(seg('Stride', 1 / 3, 'work'), seg('Walk', 1, 'easy'));
  segs.push(WALK_OUT);
  return timed({
    tag: 'Easy run', short: `${min}m`, title: strides ? `${min} min easy, then 4 strides` : `${min} min easy`, segments: segs, effort: 4,
    lines: [
      `${min} min of continuous easy running`, '5-min walk before and after', EASY,
      ...(strides ? ['Strides: 20 seconds fast but relaxed, 1 min walk between each'] : []), ...lines,
    ],
  });
}
const long = (km: number, lines: string[] = []): Run => ({
  tag: 'Long run', short: `${km}k`, title: `${km} km long run`, km, effort: 5,
  lines: [`${km} km at easy pace`, '5-min walk before and after', EASY, ...lines],
});
const timeTrial = (goalMin: number): Run => ({
  tag: 'Time trial', short: 'TT', title: '5K time trial', km: 5, effort: 9,
  lines: [`5 km as fast as you can hold evenly. Target: under ${goalMin} minutes`, '10-min easy jog first, 5-min walk after', 'Log the time in minutes so the next one has something to beat'],
});
/** `n` repeats of `km` at `p` seconds per km. The timer runs each repeat for the time that pace takes. */
function reps(n: number, km: number, p: number, rest: number, restLabel: 'Walk' | 'Jog'): Run {
  const segs = [JOG_IN];
  for (let i = 0; i < n; i++) {
    segs.push({ label: `${km} km at ${clock(p)}`, sec: Math.round(km * p), tone: 'work' });
    if (i < n - 1) segs.push(seg(restLabel, rest, 'easy'));
  }
  segs.push(JOG_OUT);
  return timed({
    tag: 'Intervals', short: `${n}×${km}k`, title: `${n} × ${km} km at ${pace(p)}`, segments: segs, effort: 8,
    lines: [`${n} × ${km} km at ${pace(p)}${p === RACE_PACE - 1 ? ', race pace' : ''}`, `${rest} min ${restLabel.toLowerCase()} between`, '10-min easy jog first, 5 min after', 'Eat carbs before this one'],
  });
}
function tempo(min: number, p: number): Run {
  const segs = [JOG_IN, seg(`Tempo at ${clock(p)}`, min, 'work'), JOG_OUT];
  return timed({
    tag: 'Tempo', short: 'Tempo', title: `${min} min tempo at ${pace(p)}`, segments: segs, effort: 7,
    lines: [`${min} min at ${pace(p)}, comfortably hard`, '10-min easy jog first, 5 min after', 'Eat carbs before this one'],
  });
}
function sharpener(): Run {
  const segs = [WALK_IN, seg('Easy run', 6, 'work')];
  for (let i = 0; i < 3; i++) segs.push(seg(`Race pace ${clock(RACE_PACE)}`, 2, 'work'), seg('Easy run', 2, 'easy'));
  segs.push(seg('Easy run', 2, 'easy'), WALK_OUT);
  return timed({
    tag: 'Easy run', short: '20m', title: '20 min easy with 3 × 2 min at race pace', segments: segs, effort: 5,
    lines: ['20 min easy', `3 × 2 min at ${pace(RACE_PACE)} in the middle, 2 min easy between`, 'Three days out: sharp legs, not tired ones'],
  });
}
const RACE_DAY: Run = {
  tag: 'Race', short: 'RACE', title: 'Sun Run 10K', km: 10, effort: 9,
  lines: [`Under 60:00 is ${pace(RACE_PACE)} on average`, 'Run the first 2 km a few seconds slower than that, then settle in', 'The last 2 km are the test'],
};

/** Tuesday, Thursday and Sunday of each week. */
const RUNS: [Run, Run, Run][] = [
  [runWalk(6, 2, 2), runWalk(6, 2, 2), runWalk(7, 2, 2)],
  [runWalk(6, 3, 2), runWalk(6, 3, 2), runWalk(7, 3, 2)],
  [runWalk(5, 4, 2), runWalk(5, 4, 2), runWalk(6, 4, 2)],
  [runWalk(4, 6, 2), runWalk(4, 6, 2), runWalk(4, 7, 2)],
  [runWalk(3, 9, 1), runWalk(3, 9, 1), runWalk(2, 14, 2)],
  [easy(25, false, ['First run with no walk breaks']), easy(25), easy(30, false, ['Thirty minutes non-stop: the rebuild is done'])],
  [easy(30), easy(30), long(5)],
  [easy(30, true), easy(30), long(5.5)],
  [easy(35, true), easy(30), long(6)],
  [easy(35, true), easy(35), long(6.5)],
  [easy(35, true), easy(35), long(7)],
  [easy(30), easy(30), timeTrial(34)],
  [easy(40, true), easy(35), long(7.5)],
  [easy(40, true), easy(35), long(8)],
  [easy(40, true), easy(40), long(9)],
  [easy(35), easy(35), long(8)],
  [easy(40, true), reps(4, 1, 360, 2, 'Walk'), long(9)],
  [easy(40), tempo(20, 375), long(10)],
  [easy(40, true), reps(5, 1, 355, 2, 'Walk'), long(10)],
  [easy(35), easy(30), timeTrial(30)],
  [easy(40, true), tempo(25, 370), long(11)],
  [easy(40), reps(6, 1, 355, 2, 'Walk'), long(12, ['Longest run of the plan'])],
  [easy(40, true), reps(3, 2, 358, 3, 'Jog'), long(10)],
  [easy(35, true), reps(4, 1, 355, 2, 'Walk'), long(8, ['Last long run before the race'])],
  [easy(30, true), sharpener(), RACE_DAY],
];

function strength(which: 'A' | 'B'): Session {
  const s = STRENGTH[which];
  return {
    kind: 'strength', tag: s.tool, short: `Str ${which}`, title: s.title, minutes: 35, lifts: s.ids, sets: 3,
    lines: ['3 sets of each, 60 to 90 seconds rest between sets', 'Hit every rep on every set, then add weight next time'],
  };
}
const rest = (title: string, lines: string[]): Session => ({ kind: 'rest', tag: 'Rest', short: 'Rest', title, lines });

function buildSession(week: number, dow: number): Session {
  const raceWeek = week === WEEKS;
  const [tue, thu, sun] = RUNS[week - 1];
  switch (dow) {
    case 1: return strength('A');
    case 2: return { kind: 'cardio', ...tue };
    case 3: return {
      kind: 'cardio', tag: 'Low impact', short: 'Walk', title: 'Low-impact cardio', minutes: 30, effort: 4,
      lines: raceWeek
        ? ['20 to 30 min easy treadmill walk', 'Nothing hard this week']
        : ['30 min: brisk treadmill walk or Body Combat', 'The first thing to drop in a busy week'],
    };
    case 4: return { kind: 'cardio', ...thu };
    case 5: return raceWeek
      ? rest('Rest', ['No strength today: Monday was the only session this week', 'Extra carbs today and tomorrow'])
      : strength('B');
    case 6: return raceWeek
      ? rest('Rest before the race', ['Easy walk only', 'Extra carbs, and lay your kit out tonight'])
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

function kbComplex(first: boolean): Session {
  const segs = [seg('Warm-up', 5, 'warm'), seg('AMRAP', 20, 'work'), seg('Cool-down', 3, 'easy')];
  return {
    kind: 'strength', tag: 'Kettlebell', short: 'Cmplx', title: 'Kettlebell complex', segments: segs, minutes: segMin(segs),
    amrap: 20, moves: KB_COMPLEX, logAs: 'kbcomplex', effort: 8,
    lines: [
      `20-minute AMRAP: as many rounds as you can of all ${KB_COMPLEX.length} moves`,
      'Rest as needed, but keep the timer running',
      first ? `First time: start around ${KB_COMPLEX_START_LB} lb and keep every rep clean` : 'Same weight as Monday unless the app says go up',
    ],
  };
}
/** Oct 12 to 14, the days left before the trip. The complex twice, with a walk between so Wednesday's is fresh. */
const BRIDGE: Record<string, Session> = {
  '2026-10-12': kbComplex(true),
  '2026-10-13': {
    kind: 'cardio', tag: 'Walk', short: 'Walk', title: 'Brisk walk', minutes: 30, effort: 4,
    lines: ['30 minutes at a brisk pace', 'Recovery between the two complexes'],
  },
  '2026-10-14': kbComplex(false),
};
export const bridgeSession = (ds: string): Session | null => BRIDGE[ds] ?? null;
/** The session on any day: the program's, or one of the pre-trip days. */
export const sessionFor = (ds: string) => sessionOf(ds) ?? bridgeSession(ds);
