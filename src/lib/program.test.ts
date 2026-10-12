import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { END, KB_COMPLEX_REPS, PHASES, RACE_PACE, START, WEEKS, bridgeSession, isTraining, phaseEnd, phaseStart, programDay, segTotal, sessionFor, sessionOf, weekStart } from './program';

describe('program calendar', () => {
  it('runs Monday to Sunday, from Oct 26 to race day on Apr 18', () => {
    expect(programDay('2026-10-25')).toEqual({ status: 'pre', daysUntil: 1 });
    expect(programDay(START)).toMatchObject({ status: 'in', week: 1, dow: 1 });
    expect(programDay(END)).toMatchObject({ status: 'in', week: WEEKS, dow: 0 });
    expect(programDay('2027-04-19')).toEqual({ status: 'post' });
  });
  it('covers every week with a phase, back to back', () => {
    expect(PHASES[0].from).toBe(1);
    expect(PHASES[PHASES.length - 1].to).toBe(WEEKS);
    PHASES.slice(1).forEach((p, i) => expect(p.from).toBe(PHASES[i].to + 1));
    expect(phaseStart(PHASES[1])).toBe('2026-12-07');
    expect(phaseStart(PHASES[2])).toBe('2027-02-15');
    expect(phaseEnd(PHASES[2])).toBe('2027-04-04');
  });
  it('keeps each session on its weekday', () => {
    expect(sessionOf('2026-10-26')).toMatchObject({ kind: 'strength', title: 'Strength A', sets: 3 });
    expect(sessionOf('2026-10-27')).toMatchObject({ kind: 'cardio', tag: 'Run/walk' });
    expect(sessionOf('2026-10-28')).toMatchObject({ kind: 'cardio', tag: 'Low impact', minutes: 30 });
    expect(sessionOf('2026-10-29')).toMatchObject({ kind: 'cardio', tag: 'Run/walk' });
    expect(sessionOf('2026-10-30')).toMatchObject({ kind: 'strength', title: 'Strength B' });
    expect(sessionOf('2026-10-31')).toMatchObject({ kind: 'rest' });
    expect(sessionOf('2026-11-01')).toMatchObject({ kind: 'cardio', tag: 'Run/walk' });
  });
  it('plans six sessions a week, and five in race week', () => {
    const count = (w: number) => Array.from({ length: 7 }, (_, i) => sessionOf(addDays(weekStart(w), i))).filter(isTraining).length;
    for (let w = 1; w < WEEKS; w++) expect(count(w)).toBe(6);
    expect(count(WEEKS)).toBe(5);
  });
});

describe('runs', () => {
  it('week 1 is 6 × 2 min run, 2 min walk, with 5 minutes of walking either side', () => {
    const s = sessionOf('2026-10-27')!;
    expect(s.segments!.filter(x => x.label === 'Run')).toHaveLength(6);
    expect(s.segments!.filter(x => x.label === 'Run').every(x => x.sec === 120)).toBe(true);
    // 5 + 6×2 + 5×2 + 5
    expect(segTotal(s.segments!)).toBe(32 * 60);
    expect(sessionOf('2026-11-01')!.segments!.filter(x => x.label === 'Run')).toHaveLength(7);
  });
  it('reaches 30 minutes non-stop at the end of week 6', () => {
    expect(sessionOf('2026-12-01')).toMatchObject({ title: '25 min easy' });
    expect(sessionOf('2026-12-06')).toMatchObject({ title: '30 min easy' });
  });
  it('builds the long run from 5 km to 12 km', () => {
    expect(sessionOf('2026-12-13')).toMatchObject({ tag: 'Long run', km: 5 });
    expect(sessionOf('2027-01-31')).toMatchObject({ km: 8 });
    expect(sessionOf('2027-03-28')).toMatchObject({ km: 12 });
    expect(sessionOf('2027-04-11')).toMatchObject({ km: 8 });
  });
  it('puts the 5K time trials in weeks 12 and 20', () => {
    expect(sessionOf('2027-01-17')).toMatchObject({ title: '5K time trial', km: 5 });
    expect(sessionOf('2027-03-14')).toMatchObject({ title: '5K time trial' });
  });
  it('starts Thursday workouts in week 17 and times repeats by pace', () => {
    expect(sessionOf('2027-02-11')).toMatchObject({ tag: 'Easy run' });
    const s = sessionOf('2027-02-18')!;
    expect(s).toMatchObject({ tag: 'Intervals', title: '4 × 1 km at 6:00/km' });
    const work = s.segments!.filter(x => x.label.startsWith('1 km'));
    expect(work).toHaveLength(4);
    expect(work[0].sec).toBe(360);
    expect(sessionOf('2027-02-25')).toMatchObject({ tag: 'Tempo', title: '20 min tempo at 6:15/km' });
    // 3 × 2 km at 5:58/km is 11:56 a repeat.
    expect(sessionOf('2027-04-01')!.segments!.filter(x => x.tone === 'work' && x.sec === 716)).toHaveLength(3);
  });
  it('adds four strides on stride days', () => {
    expect(sessionOf('2026-12-15')!.segments!.filter(x => x.label === 'Stride')).toHaveLength(4);
    expect(sessionOf('2026-12-08')!.segments!.filter(x => x.label === 'Stride')).toHaveLength(0);
  });
});

describe('race week', () => {
  it('has one strength session, rest on Friday and Saturday, and the 10K on Sunday', () => {
    expect(sessionOf('2027-04-12')).toMatchObject({ title: 'Strength A' });
    expect(sessionOf('2027-04-15')).toMatchObject({ title: '20 min easy with 3 × 2 min at race pace', minutes: 30 });
    expect(sessionOf('2027-04-16')).toMatchObject({ kind: 'rest' });
    expect(sessionOf('2027-04-17')).toMatchObject({ kind: 'rest', title: 'Rest before the race' });
    expect(sessionOf(END)).toMatchObject({ title: 'Sun Run 10K', km: 10 });
  });
  it('race pace finishes 10 km under the hour', () => {
    expect(RACE_PACE * 10).toBeLessThan(3600);
  });
});

describe('before Vietnam', () => {
  it('puts the kettlebell complex on Oct 12 and 14, with a walk between', () => {
    expect(sessionFor('2026-10-11')).toBeNull();
    expect(sessionFor('2026-10-12')).toMatchObject({ title: 'Kettlebell complex', amrap: 20, logAs: 'kbcomplex' });
    expect(sessionFor('2026-10-13')).toMatchObject({ title: 'Brisk walk', minutes: 30 });
    expect(sessionFor('2026-10-14')).toMatchObject({ title: 'Kettlebell complex' });
    expect(sessionFor('2026-10-15')).toBeNull();
    expect(sessionFor(START)).toMatchObject({ title: 'Strength A' });
  });
  it('is a 20-minute AMRAP of six moves, 73 reps a round', () => {
    const s = bridgeSession('2026-10-12')!;
    expect(s.moves!.map(m => m.reps)).toEqual([10, 15, 8, 10, 20, 10]);
    expect(KB_COMPLEX_REPS).toBe(73);
    expect(s.segments!.find(x => x.tone === 'work')!.sec).toBe(20 * 60);
  });
});
