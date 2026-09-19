import { addDays, diff, fmtMin } from './dates';

export const START = '2026-09-19';
export const END = '2027-02-12';
export const P1_END = '2026-10-16';
export const TOTAL_DAYS = 147;
/** Program weeks run Saturday → Friday. */
export const DOW = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

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
  { id: 'p2', name: 'Phase 2', label: 'Walk–run', from: 6, to: 9 },
  { id: 'p3', name: 'Phase 3', label: 'Build to 10K', from: 10, to: 21 },
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

/** n jog blocks spread evenly through a walk. */
function spread(total: number, n: number, jog: number) {
  const w = (total - n * jog) / (n + 1);
  const out: Segment[] = [];
  for (let i = 0; i < n; i++) out.push(seg('Walk', w, 'easy'), seg('Jog', jog, 'work'));
  out.push(seg('Walk', w, 'easy'));
  return out;
}
/** Repeat a pattern until `total` minutes are filled. */
function cycle(total: number, pattern: [string, number, Tone][]) {
  const out: Segment[] = [];
  let t = 0;
  while (t < total - 0.01) {
    for (const [label, m, tone] of pattern) {
      if (t >= total - 0.01) break;
      const d = Math.min(m, total - t);
      out.push(seg(label, d, tone));
      t += d;
    }
  }
  return out;
}
function rounds(n: number, on: number, off: number, onL = 'Hard', offL = 'Easy', warm = 3) {
  const out: Segment[] = warm ? [seg('Warm-up', warm, 'warm')] : [];
  for (let i = 0; i < n; i++) out.push(seg(onL, on / 60, 'work'), seg(offL, off / 60, 'easy'));
  return out;
}

export const EST_NOTE = 'The source plan gives this phase’s start and end points; weeks in between are filled in evenly.';
type CardioSession = Omit<Session, 'kind'>;

const CARDIO: Record<'p1' | 'p2' | 'p3', (pw: number, dow: number) => CardioSession> = {
  p1(pw, dow) {
    if (dow === 0) {
      const [T, n, j] = [[60, 4, 1], [60, 6, 1], [65, 8, 1], [70, 8, 2]][pw - 1];
      return {
        tag: 'Long cardio', short: `${T}m`, title: 'Long cardio', minutes: T, segments: spread(T, n, j),
        lines: [`${T}-min walk with ${n} × ${j}-min jog${j > 1 ? 's' : ''}`, 'Jogs spread evenly — the timer paces them for you'],
      };
    }
    if (dow === 4) {
      const [j, w] = [[1, 2], [1.5, 1.5], [2, 1], [3, 1]][pw - 1];
      return {
        tag: 'Medium cardio', short: '30m', title: 'Medium cardio', minutes: 30,
        segments: cycle(30, [['Jog', j, 'work'], ['Walk', w, 'easy']]),
        lines: [`30 min alternating ${fmtMin(j)} jog / ${fmtMin(w)} walk`],
      };
    }
    const [n, on, off] = [[8, 20, 40], [10, 20, 40], [12, 20, 40], [12, 30, 30]][pw - 1];
    const segs = rounds(n, on, off);
    return {
      tag: 'Hard cardio', short: 'Hard', title: 'Short, hard cardio', minutes: segMin(segs), segments: segs,
      lines: [`${n} rounds · ${on}s hard / ${off}s easy`, 'Body Combat, uphill walks, or dumbbell thrusters & swings', 'Timer adds a 3-min easy warm-up'],
    };
  },
  p2(pw, dow) {
    if (dow === 0) {
      const [T, n, j] = [[70, 8, 3], [70, 6, 5], [75, 5, 8], [75, 3, 12]][pw - 1];
      return {
        tag: 'Long cardio', short: `${T}m`, title: 'Long walk–run', minutes: T, segments: spread(T, n, j), est: true,
        lines: [`${T} min · walk with ${n} × ${j}-min jogs`, 'More jogging mixed in each week'],
      };
    }
    if (dow === 4) {
      const plan = [
        { l: '4 min jog / 1 min walk × 6', s: cycle(30, [['Jog', 4, 'work'], ['Walk', 1, 'easy']]) },
        { l: '6 min jog / 1 min walk × 4, then walk', s: cycle(30, [['Jog', 6, 'work'], ['Walk', 1, 'easy']]) },
        { l: '9 min jog / 1 min walk × 3', s: cycle(30, [['Jog', 9, 'work'], ['Walk', 1, 'easy']]) },
        { l: '20+ min continuous easy jog', s: [seg('Walk', 5, 'warm'), seg('Jog', 22, 'work'), seg('Walk', 3, 'easy')] },
      ][pw - 1];
      return {
        tag: 'Medium cardio', short: pw === 4 ? '20m+' : 'Run', title: 'Walk–run', minutes: segMin(plan.s), segments: plan.s,
        est: pw === 2 || pw === 3, lines: [plan.l, 'Builds to 20+ min of continuous jogging by Nov 20'],
      };
    }
    const n = pw <= 2 ? 12 : 14;
    const segs = rounds(n, 30, 30);
    return {
      tag: 'Hard cardio', short: 'Hard', title: 'Short, hard cardio', minutes: segMin(segs), segments: segs, est: true,
      lines: [`${n} rounds · 30s hard / 30s easy`, 'Body Combat, uphill walks, or dumbbell thrusters & swings'],
    };
  },
  p3(pw, dow) {
    if (dow === 0) {
      const km = 4.5 + 0.5 * (pw - 1);
      return {
        tag: 'Long run', short: `${km}k`, title: 'Long easy run', km, est: true,
        lines: [`${km} km easy, conversational pace`, 'Adds 0.5–1 km a week; 10 km lands late Jan – early Feb'],
      };
    }
    if (dow === 4) {
      const t = pw <= 6 ? 25 : 30;
      const segs = [seg('Warm-up', 8, 'warm'), seg('Tempo', t, 'work'), seg('Cool-down', 5, 'easy')];
      return {
        tag: 'Tempo', short: 'Tempo', title: 'Tempo run', minutes: segMin(segs), segments: segs,
        lines: [`${t} min tempo, “comfortably hard”`, '8-min easy warm-up, 5-min cool-down'],
      };
    }
    if (pw % 2) {
      const segs = rounds(6, 60, 120, 'Fast', 'Easy', 8);
      return {
        tag: 'Intervals', short: 'Intv', title: 'Intervals', minutes: segMin(segs), segments: segs,
        lines: ['6 × 1 min fast / 2 min easy', '8-min easy jog warm-up first'],
      };
    }
    const segs = rounds(6, 45, 90, 'Uphill', 'Down easy', 8);
    return {
      tag: 'Intervals', short: 'Hills', title: 'Hill repeats', minutes: segMin(segs), segments: segs, est: true,
      lines: ['6 × 45s hard uphill, easy jog or walk down', '8-min easy jog warm-up first'],
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
