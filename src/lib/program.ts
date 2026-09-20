import { addDays, diff, fmtMin } from './dates';

export const START = '2026-09-21';
export const END = '2027-01-10';
export const P1_END = '2026-10-18';
export const WEEKS = 16;
export const TOTAL_DAYS = WEEKS * 7;
/** Program weeks run Monday → Sunday. */
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
}
export interface Phase { id: 'p1' | 'brk' | 'p2' | 'p3'; name: string; label: string; from: number; to: number }
export type ProgramDay =
  | { status: 'pre'; daysUntil: number }
  | { status: 'post' }
  | { status: 'in'; idx: number; week: number; dow: number; phase: Phase; pw: number; session: Session };

export const PHASES: Phase[] = [
  { id: 'p1', name: 'Phase 1', label: 'Cut', from: 1, to: 4 },
  { id: 'brk', name: 'Break', label: 'Break', from: 5, to: 5 },
  { id: 'p2', name: 'Phase 2', label: 'Base', from: 6, to: 8 },
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
};
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

const longRun = (km: number, lines: string[]): CardioSession => ({
  tag: 'Long run', short: `${km}k`, title: 'Long easy run', km, lines: [`${km} km easy, conversational pace`, ...lines],
});

const CARDIO: Record<'p1' | 'p2' | 'p3', (pw: number, dow: number) => CardioSession> = {
  p1(pw, dow) {
    if (dow === 0) {
      const km = [3, 3.5, 4, 4.5][pw - 1];
      return {
        ...longRun(km, ['10-min walk to warm up, 5-min walk to finish', 'You are in a deficit — keep this one genuinely easy']),
        est: pw === 2 || pw === 3,
      };
    }
    if (dow === 4) {
      const j = [20, 22, 25, 28][pw - 1];
      const segs = easyRun(j);
      return {
        tag: 'Medium cardio', short: `${segMin(segs)}m`, title: 'Continuous easy run', minutes: segMin(segs), segments: segs,
        est: pw === 2 || pw === 3,
        lines: [`${j} min of continuous easy jogging`, '5-min walk either side', 'No walk breaks — you already hold this pace'],
      };
    }
    const [n, on, off] = [[10, 30, 60], [12, 30, 60], [10, 45, 75], [8, 60, 90]][pw - 1];
    const segs = rounds(n, on, off);
    return {
      tag: 'Hard cardio', short: 'Hard', title: 'Short, hard cardio', minutes: segMin(segs), segments: segs,
      lines: [`${n} rounds · ${on}s hard / ${off}s easy`, 'Body Combat, uphill runs, or dumbbell thrusters & swings', 'Timer adds a 5-min easy warm-up'],
    };
  },
  p2(pw, dow) {
    if (dow === 0) {
      const km = [4.5, 5, 5.5][pw - 1];
      return { ...longRun(km, ['Calories back to maintenance — this block buys distance', 'Adds 0.5 km a week']), est: pw === 2 };
    }
    if (dow === 4) {
      if (pw === 1) {
        const segs = easyRun(30);
        return {
          tag: 'Medium cardio', short: '30m', title: 'Continuous easy run', minutes: segMin(segs), segments: segs,
          lines: ['30 min of continuous easy jogging', 'First full half-hour with no walk breaks'],
        };
      }
      const t = pw === 2 ? 15 : 20;
      const segs = tempo(t);
      return {
        tag: 'Tempo', short: 'Tempo', title: 'Tempo run', minutes: segMin(segs), segments: segs, est: true,
        lines: [`${fmtMin(t)} tempo, “comfortably hard”`, 'Faster than your 7:30/km easy pace, not a sprint', '8-min easy warm-up, 5-min cool-down'],
      };
    }
    if (pw === 1) {
      const segs = rounds(12, 30, 30);
      return {
        tag: 'Hard cardio', short: 'Hard', title: 'Short, hard cardio', minutes: segMin(segs), segments: segs,
        lines: ['12 rounds · 30s hard / 30s easy', 'Body Combat, uphill runs, or dumbbell thrusters & swings'],
      };
    }
    const n = pw === 2 ? 6 : 8;
    const segs = rounds(n, 60, 120, 'Fast', 'Easy', 8);
    return {
      tag: 'Intervals', short: 'Intv', title: 'Intervals', minutes: segMin(segs), segments: segs, est: true,
      lines: [`${n} × 1 min fast / 2 min easy`, '8-min easy jog warm-up first'],
    };
  },
  p3(pw, dow) {
    const race = pw === 8;
    if (dow === 0) {
      if (race) {
        return {
          tag: '10K', short: '10k', title: 'The 10K', km: 10,
          lines: ['10 km — the whole point of the block', 'Start slower than feels right; the last 2 km are the test', 'Roughly 75 min at 7:30/km'],
        };
      }
      const km = 6 + 0.5 * (pw - 1);
      return { ...longRun(km, ['Adds 0.5 km a week; 10 km lands Mon, Jan 4']), est: pw > 1 };
    }
    if (dow === 4) {
      if (race) {
        const segs = easyRun(25, 5, 5);
        return {
          tag: 'Recovery', short: 'Easy', title: 'Recovery jog', minutes: segMin(segs), segments: segs,
          lines: ['25 min very easy', 'Four days after the 10K — nothing to prove'],
        };
      }
      const t = pw === 7 ? 15 : pw <= 4 ? 20 : 25;
      const segs = tempo(t);
      return {
        tag: 'Tempo', short: 'Tempo', title: 'Tempo run', minutes: segMin(segs), segments: segs, est: pw > 1 && pw < 7,
        lines: pw === 7
          ? ['15 min tempo — cut short on purpose', 'Taper week: sharp legs, not tired ones']
          : [`${fmtMin(t)} tempo, “comfortably hard”`, '8-min easy warm-up, 5-min cool-down'],
      };
    }
    if (race) {
      const segs = easyRun(30, 5, 5);
      return {
        tag: 'Recovery', short: 'Easy', title: 'Easy run', minutes: segMin(segs), segments: segs,
        lines: ['30 min easy — last session of the program', 'Whatever you build next starts from here'],
      };
    }
    if (pw === 7) {
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
    const n = pw <= 4 ? 6 : 8;
    const segs = rounds(n, 45, 90, 'Uphill', 'Down easy', 8);
    return {
      tag: 'Intervals', short: 'Hills', title: 'Hill repeats', minutes: segMin(segs), segments: segs, est: true,
      lines: [`${n} × 45s hard uphill, easy jog or walk down`, '8-min easy jog warm-up first'],
    };
  },
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
  const L = LIFTS[dow];
  if (L) {
    const first = week === 1;
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
    const dow = idx % 7;
    const phase = phaseOfWeek(week);
    const pw = week - phase.from + 1;
    r = { status: 'in', idx, week, dow, phase, pw, session: buildSession(phase, pw, week, dow) };
  }
  cache.set(ds, r);
  return r;
}
export const sessionOf = (ds: string) => {
  const p = programDay(ds);
  return p.status === 'in' ? p.session : null;
};
export const isTraining = (s: Session | null) => !!s && (s.kind === 'cardio' || s.kind === 'strength');
