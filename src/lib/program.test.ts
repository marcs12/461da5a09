import { describe, expect, it } from 'vitest';
import { END, P1_END, START, phaseEnd, phaseStart, PHASES, programDay, sessionOf } from './program';

describe('program calendar', () => {
  it('runs Monday to Sunday, from Sep 28 to Jan 17', () => {
    expect(programDay('2026-09-27')).toEqual({ status: 'pre', daysUntil: 1 });
    expect(programDay(START)).toMatchObject({ status: 'in', week: 1, dow: 1 });
    expect(programDay(END)).toMatchObject({ status: 'in', week: 16, dow: 0 });
    expect(programDay('2027-01-18')).toEqual({ status: 'post' });
    expect(phaseEnd(PHASES[0])).toBe(P1_END);
  });
  it('puts the break on Oct 19–25 and Phase 2 on the first day of Build', () => {
    expect(phaseStart(PHASES[1])).toBe('2026-10-19');
    expect(phaseEnd(PHASES[1])).toBe('2026-10-25');
    expect(phaseStart(PHASES[2])).toBe('2026-10-26');
  });
  it('keeps each session on its weekday', () => {
    expect(sessionOf('2026-09-28')).toMatchObject({ kind: 'strength', title: 'Dumbbell complex' });
    expect(sessionOf('2026-09-29')).toMatchObject({ kind: 'rest' });
    expect(sessionOf('2026-09-30')).toMatchObject({ kind: 'cardio', title: 'Continuous easy run', minutes: 30 });
    expect(sessionOf('2026-10-01')).toMatchObject({ kind: 'strength', title: 'Dumbbell complex', amrap: 20 });
    expect(sessionOf('2026-10-02')).toMatchObject({ kind: 'cardio', title: 'Continuous easy run' });
    expect(sessionOf('2026-10-03')).toMatchObject({ kind: 'strength', title: 'Dumbbell complex' });
    expect(sessionOf('2026-10-04')).toMatchObject({ title: 'Long easy run', km: 3 });
    expect(sessionOf('2026-10-26')).toMatchObject({ title: 'Legs', sets: 2 });
  });
  it('turns the cut’s last weekend into travel days', () => {
    expect(sessionOf('2026-10-16')).toMatchObject({ title: 'Continuous easy run', minutes: 35 });
    expect(sessionOf('2026-10-17')).toMatchObject({ kind: 'break', title: 'Travel day' });
    expect(sessionOf('2026-10-18')).toMatchObject({ kind: 'break', title: 'Travel day' });
    expect(sessionOf('2026-10-19')).toMatchObject({ title: 'Break week' });
  });
  it('tapers into the 10K on the last day', () => {
    expect(sessionOf('2027-01-10')).toMatchObject({ km: 9 });
    expect(sessionOf('2027-01-14')).toMatchObject({ title: 'Tempo run', minutes: 28 });
    expect(sessionOf('2027-01-15')).toMatchObject({ title: 'Shakeout jog' });
    expect(sessionOf('2027-01-16')).toMatchObject({ title: 'Rest before the 10K' });
    expect(sessionOf('2027-01-17')).toMatchObject({ title: 'The 10K', km: 10 });
  });
});
