import { describe, expect, it } from 'vitest';
import { emptyData, type Data } from './schema';
import { gates, nextGate } from './gates';

const job = (id: string, appliedAt: string) => ({ id, _u: 1, company: 'c', role: 'r', tier: 'bridge', stage: 'applied', savedAt: appliedAt, appliedAt });

describe('gates', () => {
  it('counts Sprint applications toward the 20', () => {
    const jobs = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`j${i}`, job(`j${i}`, '2026-10-02')]));
    jobs.late = job('late', '2026-10-17');
    const d: Data = { ...emptyData(), cols: { jobs } };
    const c = gates(d)[0].criteria.find(x => x.id === 'apps20')!;
    expect(c).toMatchObject({ done: true, progress: '20/20' });
    delete jobs.j0;
    expect(gates(d)[0].criteria.find(x => x.id === 'apps20')).toMatchObject({ done: false, progress: '19/20' });
  });

  it('checks the résumé and LinkedIn tasks, and lets you override', () => {
    const d: Data = { ...emptyData(), cols: {
      tasks: { 'resume-v2': { id: 'resume-v2', _u: 1, done: true, checklist: [] } as never },
      gates: { 'before-fly:trip-budget': { id: 'before-fly:trip-budget', _u: 1, done: true } as never },
    } };
    const g = gates(d)[0];
    expect(g.criteria.find(c => c.id === 'resume-linkedin')!.done).toBe(false);
    expect(g.criteria.find(c => c.id === 'trip-budget')).toMatchObject({ done: true, overridden: true, auto: false });
  });

  it('moves to the next gate after the flight', () => {
    const d = emptyData();
    expect(nextGate(d, '2026-10-15')!.id).toBe('before-fly');
    expect(nextGate(d, '2026-10-16')!.id).toBe('first-week-back');
    expect(gates(d)[1].due).toBe('2026-11-01');
    expect(nextGate(d, '2026-11-02')).toBeNull();
  });
});
