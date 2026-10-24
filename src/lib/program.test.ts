import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { END, KB_COMPLEX_REPS, PHASES, RACE_PACE, START, SUB60_PACE, TT_DATE, TT_RETRY, WEEKS, bridgeSession, isTraining, phaseEnd, phaseStart, programDay, segTotal, sessionFor, sessionOf, weekStart } from './program';

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
    expect(phaseEnd(PHASES[0])).toBe('2026-11-15');
    expect(phaseStart(PHASES[2])).toBe('2026-12-21');
    expect(phaseEnd(PHASES.find(p => p.id === 'tt')!)).toBe(TT_DATE);
  });
  it('ends both strength sessions with core work', () => {
    expect(sessionOf('2026-10-26')!.lifts).toEqual(['goblet', 'swing', 'row', 'pushup', 'deadbug', 'plank']);
    expect(sessionOf('2026-10-30')!.lifts).toContain('crunch');
    expect(sessionOf('2026-10-30')!.lifts).toContain('floor');
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
  it('plans six sessions a week, and five in time trial week and race week', () => {
    const count = (w: number) => Array.from({ length: 7 }, (_, i) => sessionOf(addDays(weekStart(w), i))).filter(isTraining).length;
    for (let w = 1; w <= WEEKS; w++) expect(count(w)).toBe(w === 14 || w === WEEKS ? 5 : 6);
  });
});

describe('runs', () => {
  it('week 1 starts at 6 × 3 min run, 2 min walk', () => {
    const s = sessionOf('2026-10-27')!;
    const runs = s.segments!.filter(x => x.label === 'Run');
    expect(runs).toHaveLength(6);
    expect(runs.every(x => x.sec === 180)).toBe(true);
    // 5 + 6×3 + 5×2 + 5
    expect(segTotal(s.segments!)).toBe(38 * 60);
  });
  it('reaches 30 minutes non-stop at the end of week 3', () => {
    expect(sessionOf('2026-11-10')).toMatchObject({ title: '20 min easy' });
    expect(sessionOf('2026-11-15')).toMatchObject({ title: '30 min easy' });
  });
  it('turns Wednesday into a run from week 6', () => {
    expect(sessionOf('2026-11-25')).toMatchObject({ tag: 'Low impact' });
    expect(sessionOf('2026-12-02')).toMatchObject({ tag: 'Easy run', title: '20 min easy' });
    expect(sessionOf('2027-04-14')).toMatchObject({ tag: 'Low impact' });
  });
  it('starts Thursday workouts in week 7 and times repeats by pace', () => {
    expect(sessionOf('2026-12-03')).toMatchObject({ tag: 'Easy run' });
    const s = sessionOf('2026-12-10')!;
    expect(s).toMatchObject({ tag: 'Intervals', title: '4 × 1 km at 6:20/km' });
    expect(s.segments!.filter(x => x.label.startsWith('1 km')).map(x => x.sec)).toEqual([380, 380, 380, 380]);
    expect(sessionOf('2026-12-17')).toMatchObject({ tag: 'Tempo', title: '20 min tempo at 6:30/km' });
  });
  it('builds the long run to 11 km before the time trial and 14 km before the race', () => {
    expect(sessionOf('2026-11-22')).toMatchObject({ tag: 'Long run', km: 5 });
    expect(sessionOf('2027-01-24')).toMatchObject({ km: 11 });
    expect(sessionOf('2027-03-28')).toMatchObject({ km: 14 });
    expect(sessionOf('2027-04-11')).toMatchObject({ km: 8 });
  });
  it('puts the 5K time trials on Dec 20, Jan 17 and Mar 14', () => {
    expect(sessionOf('2026-12-20')).toMatchObject({ title: '5K time trial', km: 5 });
    expect(sessionOf('2027-01-17')!.lines[0]).toContain('28:45');
    expect(sessionOf('2027-03-14')!.lines[0]).toContain('26:30');
  });
});

describe('sub-60 week', () => {
  it('drops Friday strength and ends with the 10K time trial on Jan 31', () => {
    expect(sessionOf('2027-01-25')).toMatchObject({ title: 'Strength A' });
    expect(sessionOf('2027-01-28')!.segments!.filter(x => x.label.startsWith('Goal pace'))).toHaveLength(4);
    expect(sessionOf('2027-01-29')).toMatchObject({ kind: 'rest' });
    expect(sessionOf('2027-01-30')).toMatchObject({ kind: 'rest', title: 'Rest before the time trial' });
    expect(sessionOf(TT_DATE)).toMatchObject({ title: 'Sub-60 10K time trial', km: 10 });
  });
  it('sub-60 pace finishes 10 km under the hour', () => {
    expect(SUB60_PACE * 10).toBeLessThan(3600);
  });
  it('keeps Feb 28 as the fallback attempt', () => {
    expect(sessionOf(TT_RETRY)!.lines.join(' ')).toContain('10K time trial');
  });
});

describe('race week', () => {
  it('has one strength session, rest on Friday and Saturday, and the 10K on Sunday', () => {
    expect(sessionOf('2027-04-12')).toMatchObject({ title: 'Strength A' });
    expect(sessionOf('2027-04-15')).toMatchObject({ title: '20 min easy with 3 × 2 min at 5:30/km', minutes: 30 });
    expect(sessionOf('2027-04-16')).toMatchObject({ kind: 'rest' });
    expect(sessionOf('2027-04-17')).toMatchObject({ kind: 'rest', title: 'Rest before the race' });
    expect(sessionOf(END)).toMatchObject({ title: 'Sun Run 10K', km: 10 });
  });
  it('goal pace finishes 10 km in 55 minutes', () => {
    expect(RACE_PACE * 10).toBe(55 * 60);
  });
});

describe('before Vietnam', () => {
  it('puts the kettlebell complex on Oct 12, 14 and 15, with a walk on the 13th', () => {
    expect(sessionFor('2026-10-11')).toBeNull();
    expect(sessionFor('2026-10-12')).toMatchObject({ title: 'Kettlebell complex', amrap: 20, logAs: 'kbcomplex' });
    expect(sessionFor('2026-10-13')).toMatchObject({ title: 'Brisk walk', minutes: 30 });
    expect(sessionFor('2026-10-14')).toMatchObject({ title: 'Kettlebell complex' });
    expect(sessionFor('2026-10-15')).toMatchObject({ title: 'Kettlebell complex' });
    expect(sessionFor('2026-10-16')).toBeNull();
    expect(sessionFor(START)).toMatchObject({ title: 'Strength A' });
  });
  it('is a 20-minute AMRAP of six moves, 73 reps a round', () => {
    const s = bridgeSession('2026-10-12')!;
    expect(s.moves!.map(m => m.reps)).toEqual([10, 15, 8, 10, 20, 10]);
    expect(KB_COMPLEX_REPS).toBe(73);
    expect(s.segments!.find(x => x.tone === 'work')!.sec).toBe(20 * 60);
  });
});
