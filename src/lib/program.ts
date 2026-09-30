import { addDays, diff, fmtMin, parse } from './dates';

export const START = '2026-09-28';
export const END = '2027-01-17';
export const P1_END = '2026-10-18';
/** The cut's last weekend, already in Vietnam (flight is the night of Fri, Oct 16). */
export const TRAVEL_DAYS = new Set(['2026-10-17', '2026-10-18']);
/** Phase 1 weight target (lb below the first weigh-in), shown as a corridor on Progress. */
export const P1_TARGET = [6, 9] as const;
/** The calorie nudge never takes the daily target below this. */
export const CAL_FLOOR = 1800;
export const WEEKS = 16;
export const TOTAL_DAYS = WEEKS * 7;
/** Program weeks run Monday → Sunday, like the life plan's. Sessions still follow the weekday, so the long run closes each week. */
export const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export type Kind = 'cardio' | 'strength' | 'rest' | 'break';
export type Tone = 'work' | 'easy' | 'warm';
export interface Segment { label: string; sec: number; tone: Tone }
export interface Session {
  kind: Kind;
  tag: string;
  short: string;
  title: string;
  lines: string[];
  minutes?: number;
  km?: number;
  segments?: Segment[];
  lifts?: string[];
  sets?: number;
  walk?: boolean;
  est?: boolean;
  /** Minutes of work for the dumbbell complex (AMRAP). */
  amrap?: number;
}
export interface Phase { id: 'p1' | 'brk' | 'p2' | 'p3'; name: string; label: string; from: number; to: number }
export type ProgramDay =
  | { status: 'pre'; daysUntil: number }
  | { status: 'post' }
  | { status: 'in'; idx: number; week: number; /** 0 = Sunday */ dow: number; phase: Phase; pw: number; session: Session };

export const PHASES: Phase[] = [
  { id: 'p1', name: 'Phase 1', label: 'Cut', from: 1, to: 3 },
  { id: 'brk', name: 'Break', label: 'Break', from: 4, to: 4 },
  { id: 'p2', name: 'Phase 2', label: 'Base', from: 5, to: 8 },
  { id: 'p3', name: 'Phase 3', label: 'Build to 10K', from: 9, to: 16 },
];
export const weekStart = (week: number) => addDays(START, (week - 1) * 7);
export const phaseStart = (p: Phase) => weekStart(p.from);
export const phaseEnd = (p: Phase) => addDays(START, p.to * 7 - 1);
export const phaseOfWeek = (w: number) => PHASES.find(p => w >= p.from && w <= p.to)!;

export interface Exercise { name: string; note?: string; bw?: boolean; unit?: 'reps' | 'sec' }
export const EX: Record<string, Exercise> = {
  goblet: { name: 'Goblet squat' },
  rdl: { name: 'Romanian deadlift' },
  rlunge: { name: 'Reverse lunge', note: 'per leg' },
  calf: { name: 'Single-leg calf raise', note: 'per leg' },
  bridge: { name: 'Glute bridge' },
  floor: { name: 'Floor press' },
  row: { name: 'One-arm row', note: 'per arm' },
  pushup: { name: 'Push-ups', bw: true },
  pullover: { name: 'Pullover' },
  deadbug: { name: 'Dead bugs', bw: true, note: 'per side' },
  ohp: { name: 'Overhead press' },
  lateral: { name: 'Lateral raise' },
  hammer: { name: 'Hammer curl' },
  triext: { name: 'Overhead triceps extension' },
  farmer: { name: 'Farmer carry', unit: 'sec', note: 'per hand' },
  sideplank: { name: 'Side plank', bw: true, unit: 'sec', note: 'per side' },
  complex: { name: 'Dumbbell complex', note: 'rounds' },
};

/** A 20-minute kettlebell AMRAP, done with one adjustable dumbbell. Every move back to back = 1 round. */
export const COMPLEX: { name: string; reps: number; cue: string }[] = [
  { name: 'Bent-over row', reps: 10, cue: 'Both hands on the handle, hinge to about 45°, pull your elbows toward your back pockets' },
  { name: 'Swing', reps: 15, cue: 'Both hands around the handle; drive with your hips, not your arms — chest height, never overhead' },
  { name: 'Clean + thruster', reps: 8, cue: 'Pull it up to a goblet hold, squat, then drive up and press it overhead with both hands. Let your legs make the power' },
  { name: 'Alternating reverse lunge', reps: 10, cue: 'Goblet hold, 5 per leg. Stay tall and drive through your front heel' },
  { name: 'Toe taps', reps: 20, cue: 'Alternate feet on the bottom stair or a low step, not the dumbbell (round plates roll). Stay light and keep moving' },
  { name: 'Close-grip push-ups', reps: 10, cue: 'Replace the kettlebell horn push-ups. Hands under your shoulders, body rigid from head to heels; drop to your knees once form breaks' },
];
export const COMPLEX_REPS = COMPLEX.reduce((a, m) => a + m.reps, 0);
export const COMPLEX_START_LB = 25;
/** Keyed by weekday (0 = Sunday). */
const LIFTS: Record<number, { title: string; short: string; ids: string[] }> = {
  1: { title: 'Legs', short: 'Legs', ids: ['goblet', 'rdl', 'rlunge', 'calf', 'bridge'] },
  3: { title: 'Torso', short: 'Torso', ids: ['floor', 'row', 'pushup', 'pullover', 'deadbug'] },
  6: { title: 'Shoulders & arms', short: 'S + A', ids: ['ohp', 'lateral', 'hammer', 'triext', 'farmer', 'sideplank'] },
};

const seg = (label: string, min: number, tone: Tone): Segment => ({ label, sec: Math.round(min * 60), tone });
export const segTotal = (segs: Segment[]) => segs.reduce((a, s) => a + s.sec, 0);
const segMin = (segs: Segment[]) => Math.round(segTotal(segs) / 60);

/** An easy run bracketed by walking, as timer segments. */
const easyRun = (min: number, warm = 5, cool = 5) => [seg('Walk', warm, 'warm'), seg('Jog', min, 'work'), seg('Walk', cool, 'easy')];
/** Warm-up, a tempo block, cool-down. */
const tempo = (min: number) => [seg('Warm-up', 8, 'warm'), seg('Tempo', min, 'work'), seg('Cool-down', 5, 'easy')];
function rounds(n: number, on: number, off: number, onL = 'Hard', offL = 'Easy', warm = 5) {
  const out: Segment[] = warm ? [seg('Warm-up', warm, 'warm')] : [];
  for (let i = 0; i < n; i++) out.push(seg(onL, on / 60, 'work'), seg(offL, off / 60, 'easy'));
  return out;
}

export const EST_NOTE = 'The source plan gives this phase’s start and end points; weeks in between are filled in evenly.';
type CardioSession = Omit<Session, 'kind'>;

/** Huberman's Day 6 (high intensity): the dumbbell complex as a 20-minute AMRAP. */
const complex = (extra: string[] = [], min = 20): CardioSession => {
  const segs = [seg('Warm-up', 5, 'warm'), seg('Complex', min, 'work'), seg('Cool-down', 3, 'easy')];
  return {
    tag: 'HIIT', short: 'HIIT', title: 'Dumbbell complex', minutes: segMin(segs), segments: segs, amrap: min,
    lines: [`${min}-min AMRAP · ${COMPLEX.length} moves, ${COMPLEX_REPS} reps a round`, 'Rest as needed, but keep the timer running — count full rounds', ...extra],
  };
};

const longRun = (km: number, lines: string[]): CardioSession => ({
  tag: 'Long run', short: `${km}k`, title: 'Long easy run', km, lines: [`${km} km easy, conversational pace`, ...lines],
});

const CARDIO: Record<'p1' | 'p2' | 'p3', (pw: number, dow: number) => CardioSession> = {
  p1(pw, dow) {
    if (dow === 0) {
      const km = [3, 3.5, 4][pw - 1];
      return {
        ...longRun(km, ['10-min walk to warm up, 5-min walk to finish', 'You are in a deficit — keep this one genuinely easy']),
        est: pw === 2,
      };
    }
    // Wed and Fri: easy runs between the complexes.
    const j = [20, 22, 25][pw - 1];
    const segs = easyRun(j);
    return {
      tag: 'Medium cardio', short: `${segMin(segs)}m`, title: 'Continuous easy run', minutes: segMin(segs), segments: segs,
      est: pw === 2,
      lines: [`${j} min of continuous easy jogging`, '5-min walk either side', 'No walk breaks — you already hold this pace'],
    };
  },
  p2(pw, dow) {
    if (dow === 0) {
      const km = [4, 4.5, 5, 5.5][pw - 1];
      return {
        ...longRun(km, [pw === 1 ? 'First long run since the break' : 'Adds 0.5 km a week', 'Still in a deficit — conversational pace only']),
        est: pw === 2 || pw === 3,
      };
    }
    if (dow === 4) {
      if (pw <= 2) {
        const j = pw === 1 ? 25 : 30;
        const segs = easyRun(j);
        return {
          tag: 'Medium cardio', short: `${segMin(segs)}m`, title: 'Continuous easy run', minutes: segMin(segs), segments: segs,
          lines: pw === 1
            ? ['25 min of continuous easy jogging', 'First run back from the break — back where the cut left off']
            : ['30 min of continuous easy jogging', 'First full half-hour with no walk breaks'],
        };
      }
      const t = pw === 3 ? 15 : 20;
      const segs = tempo(t);
      return {
        tag: 'Tempo', short: 'Tempo', title: 'Tempo run', minutes: segMin(segs), segments: segs, est: true,
        lines: [`${fmtMin(t)} tempo, “comfortably hard”`, 'Faster than your 7:30/km easy pace, not a sprint', '8-min easy warm-up, 5-min cool-down'],
      };
    }
    return complex(pw === 1
      ? ['Back from the break — drop 5 lb if the first round feels heavy']
      : ['Same weight as last time unless the app says go up']);
  },
  p3(pw, dow) {
    const taper = pw === 8;
    if (dow === 0) {
      if (taper) {
        return {
          tag: '10K', short: '10k', title: 'The 10K', km: 10,
          lines: ['10 km — the whole point of the block', 'Start slower than feels right; the last 2 km are the test', 'Roughly 75 min at 7:30/km'],
        };
      }
      const km = 6 + 0.5 * (pw - 1);
      return { ...longRun(km, ['Adds 0.5 km a week; 10 km lands Sun, Jan 17']), est: pw > 1 };
    }
    if (dow === 4) {
      const t = taper ? 15 : pw <= 4 ? 20 : 25;
      const segs = tempo(t);
      return {
        tag: 'Tempo', short: 'Tempo', title: 'Tempo run', minutes: segMin(segs), segments: segs, est: pw > 1 && !taper,
        lines: taper
          ? ['15 min tempo — cut short on purpose', 'Taper week: sharp legs, not tired ones']
          : [`${fmtMin(t)} tempo, “comfortably hard”`, '8-min easy warm-up, 5-min cool-down'],
      };
    }
    if (taper) {
      const segs = easyRun(20, 5, 5);
      return {
        tag: 'Shakeout', short: 'Easy', title: 'Shakeout jog', minutes: segMin(segs), segments: segs,
        lines: ['20 min very easy', 'Two days out from the 10K — stay loose, stay fresh'],
      };
    }
    if (pw % 2) {
      const n = pw <= 3 ? 8 : 10;
      const segs = rounds(n, 60, 120, 'Fast', 'Easy', 8);
      return {
        tag: 'Intervals', short: 'Intv', title: 'Intervals', minutes: segMin(segs), segments: segs, est: pw > 1,
        lines: [`${n} × 1 min fast / 2 min easy`, '8-min easy jog warm-up first'],
      };
    }
    // Even weeks keep the complex; odd weeks run intervals for 10K speed.
    return complex(['Alternates with running intervals through the 10K build']);
  },
};

const TRAVEL: Session = {
  kind: 'break', tag: 'Travel', short: 'Trip', title: 'Travel day',
  lines: ['No program session — you’re in Vietnam', 'Walk everywhere; do the travel circuit if you can', 'Keep protein high — about 180 g — to hold onto progress'],
};

function buildSession(phase: Phase, pw: number, week: number, dow: number): Session {
  if (phase.id === 'brk') {
    return {
      kind: 'break', tag: 'Break', short: 'Off', title: 'Break week',
      lines: ['No structured training this week', 'Keep walking if you can', 'Keep protein high — about 180 g — to hold onto progress'],
    };
  }
  if (dow === 2) {
    return {
      kind: 'rest', tag: 'Rest', short: 'Rest', title: 'Rest + easy walk', minutes: 45,
      lines: ['45-min easy treadmill walk', 'Nothing else — let the week’s work land'],
    };
  }
  // The 10K is the last day of week 16, so that Saturday's lifting day would land
  // the day before it. It becomes an easy walk instead.
  if (phase.id === 'p3' && pw === 8 && dow === 6) {
    return {
      kind: 'rest', tag: 'Rest', short: 'Rest', title: 'Rest before the 10K', minutes: 30,
      lines: ['30-min easy walk, nothing else', 'The 10K is tomorrow — legs stay fresh', 'Eat normally and get to bed early'],
    };
  }
  const L = LIFTS[dow];
  // The cut runs up to the Vietnam trip: the complex (Mon, Thu, Sat) alternates with
  // easy runs (Wed, Fri) for more work per week while the deficit is on.
  if (phase.id === 'p1' && (dow === 1 || dow === 4 || dow === 6)) {
    const extra = week === 1 && dow === 1
      ? [`First time: start around ${COMPLEX_START_LB} lb — the clean + thruster sets the limit`]
      : dow === 6
        ? ['Second complex in two days — keep the weight, keep every rep clean']
        : ['Same weight as last time unless the app says go up'];
    return { ...complex(extra), kind: 'strength', tag: 'Resistance', short: 'Cmplx', walk: true };
  }
  if (L && phase.id !== 'p1') {
    // First lifting week is the one after the break.
    const first = phase.id === 'p2' && pw === 1;
    return {
      kind: 'strength', tag: 'Resistance', short: L.short, title: L.title, minutes: 40, lifts: L.ids, sets: first ? 2 : 3, walk: true,
      lines: first
        ? ['2 sets per exercise', 'Pick weights that leave 2–3 reps in the tank']
        : ['3 sets of 8–15 reps', 'Hit 15 on every set → add 5 lb next session'],
    };
  }
  return { kind: 'cardio', ...CARDIO[phase.id as 'p1' | 'p2' | 'p3'](pw, dow) };
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
    const pw = week - phase.from + 1;
    r = { status: 'in', idx, week, dow, phase, pw, session: TRAVEL_DAYS.has(ds) ? TRAVEL : buildSession(phase, pw, week, dow) };
  }
  cache.set(ds, r);
  return r;
}
export const sessionOf = (ds: string) => {
  const p = programDay(ds);
  return p.status === 'in' ? p.session : null;
};
export const isTraining = (s: Session | null) => !!s && (s.kind === 'cardio' || s.kind === 'strength');
