import { describe, expect, it } from 'vitest';
import { emptyData, type Data, type DayLog } from './schema';
import { isComplete, isOpen, lastClosedDay, minItems, streak } from './minday';

const full: DayLog = { career: true, walkMin: 25, proMeals: 3, lightsOut: true, checkedIn: true };
const withDays = (days: Record<string, DayLog>, extra: Partial<Data> = {}): Data => ({ ...emptyData(), days, ...extra });

describe('minimum day', () => {
  it('needs all five items at home', () => {
    expect(isComplete(withDays({ '2026-10-01': full }), '2026-10-01')).toBe(true);
    expect(isComplete(withDays({ '2026-10-01': { ...full, lightsOut: false } }), '2026-10-01')).toBe(false);
    expect(minItems(withDays({}), '2026-10-01')).toHaveLength(5);
  });

  it('needs only walk, protein and check-in while travelling', () => {
    const d = withDays({ '2026-10-20': { walkMin: 40, proMeals: 3, checkedIn: true } });
    expect(minItems(d, '2026-10-20').map(i => i.id)).toEqual(['walk', 'protein', 'checkIn']);
    expect(isComplete(d, '2026-10-20')).toBe(true);
  });

  it('counts existing logs: the 45-min walk, protein grams, an application', () => {
    const d = withDays(
      { '2026-10-01': { walk: true, pro: 185, lightsOut: true, checkedIn: true } },
      { cols: { jobs: { j: { id: 'j', _u: 1, appliedAt: '2026-10-01' } as never } } },
    );
    expect(isComplete(d, '2026-10-01')).toBe(true);
    expect(minItems(d, '2026-10-01').find(i => i.id === 'walk')!.done).toBe(true);
  });

  it('counts an outreach message as the career action', () => {
    const d = withDays({ '2026-10-01': { ...full, career: undefined } }, { cols: { outreach: { o: { id: 'o', _u: 1, date: '2026-10-01' } as never } } });
    expect(isComplete(d, '2026-10-01')).toBe(true);
  });

  it('does not count a short walk or 2 protein meals', () => {
    const d = withDays({ '2026-10-01': { ...full, walkMin: 15 } });
    expect(isComplete(d, '2026-10-01')).toBe(false);
    expect(isComplete(withDays({ '2026-10-01': { ...full, proMeals: 2 } }), '2026-10-01')).toBe(false);
  });
});

describe('edit window', () => {
  it('keeps yesterday open until noon', () => {
    expect(lastClosedDay(new Date(2026, 9, 5, 11, 59))).toBe('2026-10-03');
    expect(lastClosedDay(new Date(2026, 9, 5, 12, 0))).toBe('2026-10-04');
    expect(isOpen('2026-10-04', new Date(2026, 9, 5, 9))).toBe(true);
    expect(isOpen('2026-10-04', new Date(2026, 9, 5, 13))).toBe(false);
    expect(isOpen('2026-10-05', new Date(2026, 9, 5, 23))).toBe(true);
  });
});

describe('never miss twice', () => {
  const run = (pattern: string, start = '2026-10-01') => {
    // pattern: one char per day from start; x = done, . = missed
    const done = new Set([...pattern].map((c, i) => (c === 'x' ? i : -1)).filter(i => i >= 0)
      .map(i => { const d = new Date(2026, 9, 1 + i); return `2026-10-${String(d.getDate()).padStart(2, '0')}`; }));
    const last = `2026-10-${String(pattern.length).padStart(2, '0')}`;
    return streak(ds => done.has(ds), start, last);
  };

  it('counts completed days', () => {
    expect(run('xxxx')).toMatchObject({ current: 4, best: 4, graceUsed: false });
  });
  it('survives one miss', () => {
    expect(run('xx.xx')).toMatchObject({ current: 4, best: 4 });
  });
  it('shows the grace in use right after a miss', () => {
    expect(run('xxx.')).toMatchObject({ current: 3, graceUsed: true });
  });
  it('ends after two misses in a row', () => {
    expect(run('xxx..x')).toMatchObject({ current: 1, best: 3 });
    expect(run('xxx..')).toMatchObject({ current: 0, best: 3, graceUsed: false });
  });
  it('keeps alternating misses alive', () => {
    expect(run('x.x.x')).toMatchObject({ current: 3, best: 3 });
  });
  it('is zero before the plan starts', () => {
    expect(streak(() => true, '2026-09-28', '2026-09-26')).toMatchObject({ current: 0, best: 0 });
  });
});
