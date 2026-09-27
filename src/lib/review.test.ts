import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, emptyData, type Data } from './schema';
import { nextPlan, reviewText, reviewWeek, scoreRows, scoreboard, weekScores, type WeeklyReview } from './review';
import { phaseOn, phaseRanges, planDay } from './life';
import { gates } from './gates';
import { tripActive } from './money';

describe('which week', () => {
  it('reviews this week on Sunday and last week otherwise', () => {
    expect(reviewWeek('2026-10-04')).toBe('2026-09-28');
    expect(reviewWeek('2026-10-05')).toBe('2026-09-28');
    expect(reviewWeek('2026-10-10')).toBe('2026-09-28');
    expect(reviewWeek('2026-10-11')).toBe('2026-10-05');
  });
});

describe('auto-scored week', () => {
  const d: Data = {
    ...emptyData(),
    days: {
      '2026-10-05': { done: true, walkMin: 30, sleep: 7.5 }, // Mon: complex
      '2026-10-06': { done: true, sleep: 6.5 },              // Tue: rest walk counts as a walk day
      '2026-10-08': { done: true, walk: true, sleep: 7 },    // Thu: run
    },
    cols: { jobs: { a: { id: 'a', _u: 1, appliedAt: '2026-10-06' } as never, b: { id: 'b', _u: 1, appliedAt: '2026-10-12' } as never } },
    priv: {
      transfers: { t: { id: 't', _u: 1, date: '2026-10-09', amount: 300 } as never },
      checkIns: { c1: { id: 'c1', _u: 1, date: '2026-10-05', mood: 6 } as never, c2: { id: 'c2', _u: 1, date: '2026-10-07', mood: 7 } as never },
      weekLife: { '2026-10-05': { id: '2026-10-05', _u: 1, touchGrass: 'Climbing', noNewCardBalance: true } as never },
    },
  };
  it('pulls every number from the logs', () => {
    expect(weekScores(d, '2026-10-05')).toEqual({
      applications: 1, outreach: 0, workouts: 2, walkDays: 3, sleep7: 2, transfer: true, runway: null,
      touchGrass: true, socialPlan: false, mood: 6.5, noNewCardBalance: true,
    });
  });
  it('leaves the transfer blank in a week without a payday', () => {
    expect(weekScores(d, '2026-09-28').transfer).toBeNull();
  });
  it('uses Sprint targets before the flight', () => {
    const rows = scoreRows(d, '2026-10-05');
    expect(rows.find(r => r.id === 'applications')!.target).toBe(8);
    expect(rows.find(r => r.id === 'workouts')!.target).toBe(3);
  });
  it('writes the plan’s text template', () => {
    const r: WeeklyReview = { id: 'w', _u: 1, weekOf: '2026-10-05', scores: weekScores(d, '2026-10-05'), keep: 'Morning sessions', change: '', top3: ['resume-v2'], supportTriggered: false };
    const text = reviewText(r, id => (id === 'resume-v2' ? 'Résumé v2' : id));
    expect(text).toContain('Week of Oct 5');
    expect(text).toContain('Payday transfer done: yes   Runway: __ months');
    expect(text).toContain('Mood average: 6.5 / 10');
    expect(text).toContain('Keep: Morning sessions');
    expect(text).toContain('Change: ______');
    expect(text).toContain('Top 3 for next week: 1) Résumé v2 2) ____ 3) ____');
  });
});

describe('scoreboard', () => {
  it('measures every Day-90 target', () => {
    const d: Data = { ...emptyData(), days: { '2026-10-04': { done: true, km: 5.2 } } };
    const s = scoreboard(d, '2026-10-10');
    expect(s).toHaveLength(17);
    expect(s.find(x => x.id === '5k')).toMatchObject({ met: true });
    expect(s.find(x => x.id === 'workouts')).toMatchObject({ value: '1 / 36' });
    expect(s.find(x => x.id === 'transfers')).toMatchObject({ value: '0 / 1 paydays', met: false });
    expect(s.find(x => x.id === 'support')!.value).toBe('Not needed so far');
  });
});

describe('the next 90 days', () => {
  it('starts the Monday after this plan, with no trip', () => {
    expect(nextPlan(DEFAULT_SETTINGS, '2026-12-26')).toEqual({ planStart: '2026-12-28', departDate: null, returnDate: null });
    expect(nextPlan(DEFAULT_SETTINGS, '2027-01-06')).toMatchObject({ planStart: '2027-01-11' });
  });
  it('runs a trip-free plan as Build, with no gates or trip card', () => {
    const s = { ...DEFAULT_SETTINGS, ...nextPlan(DEFAULT_SETTINGS, '2026-12-26') };
    expect(phaseOn(s, '2027-01-05')).toBe('build');
    expect(planDay(s, '2027-01-04')).toMatchObject({ day: 8, buildWeek: 2 });
    expect(phaseRanges(s)).toEqual([{ id: 'build', from: '2026-12-28', to: '2027-03-27' }]);
    const d = { ...emptyData(), settings: s };
    expect(gates(d)).toEqual([]);
    expect(tripActive(d, '2027-01-05')).toBe(false);
  });
});
