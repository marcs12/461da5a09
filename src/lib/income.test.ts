import { describe, expect, it } from 'vitest';
import { emptyData, type Data, type Job } from './schema';
import { bragText, convertTime, followUpDue, incomeStats, stagePatch, tierMix, weekCounts, weekTargets } from './income';

const job = (id: string, over: Partial<Job> = {}): Job =>
  ({ id, _u: 1, company: 'Co', role: 'Role', tier: 'bridge', stage: 'applied', savedAt: '2026-09-28', appliedAt: '2026-09-28', followUpAt: '2026-10-05', ...over });
const withJobs = (js: Job[], extra: Partial<Data['cols']> = {}): Data =>
  ({ ...emptyData(), cols: { jobs: Object.fromEntries(js.map(j => [j.id, j])), ...extra } });

describe('follow-ups', () => {
  it('are due from 7 days after applying, while still Applied', () => {
    const j = job('a');
    expect(followUpDue(j, '2026-10-04')).toBe(false);
    expect(followUpDue(j, '2026-10-05')).toBe(true);
    expect(followUpDue({ ...j, stage: 'followup' }, '2026-10-09')).toBe(false);
  });

  it('get set when a saved job moves to Applied', () => {
    const saved = job('s', { stage: 'saved', appliedAt: undefined, followUpAt: undefined });
    expect(stagePatch(saved, 'applied', '2026-10-02')).toEqual({ stage: 'applied', appliedAt: '2026-10-02', followUpAt: '2026-10-09' });
    expect(stagePatch(job('a'), 'interview', '2026-10-10')).toEqual({ stage: 'interview' });
    expect(stagePatch(job('a'), 'saved', '2026-10-10')).toMatchObject({ stage: 'saved', appliedAt: undefined });
  });
});

describe('weekly targets', () => {
  it('uses 8 applications in Sprint, pauses in travel, 5 + 2 in Build', () => {
    const d = emptyData();
    expect(weekTargets(d, '2026-10-01')).toEqual({ applications: 8, outreach: 0, paused: false });
    expect(weekTargets(d, '2026-10-20').paused).toBe(true);
    expect(weekTargets(d, '2026-10-27')).toEqual({ applications: 5, outreach: 2, paused: false });
  });

  it('follows the travel-mode switch both ways', () => {
    const d = emptyData();
    expect(weekTargets({ ...d, settings: { ...d.settings, travelModeOverride: true } }, '2026-10-01').paused).toBe(true);
    expect(weekTargets({ ...d, settings: { ...d.settings, travelModeOverride: false } }, '2026-10-20')).toMatchObject({ paused: false, applications: 5 });
  });

  it('counts this Monday–Sunday week only', () => {
    const d = withJobs([job('a', { appliedAt: '2026-09-28' }), job('b', { appliedAt: '2026-10-04' }), job('c', { appliedAt: '2026-10-05' }), job('s', { stage: 'saved', appliedAt: undefined })],
      { outreach: { o: { id: 'o', _u: 1, date: '2026-10-01', name: 'N', channel: 'LinkedIn', replied: false } as never } });
    expect(weekCounts(d, '2026-10-02')).toEqual({ applications: 2, outreach: 1 });
    expect(weekCounts(d, '2026-10-05')).toEqual({ applications: 1, outreach: 0 });
  });
});

describe('tier mix and stats', () => {
  it('counts Best Buy toward Bridge and ignores saved jobs', () => {
    const d = withJobs([job('a'), job('b', { tier: 'bestbuy' }), job('c', { tier: 'stretch' }), job('d', { tier: 'creative', stage: 'saved', appliedAt: undefined })]);
    const m = tierMix(d);
    expect(m.total).toBe(3);
    expect(m.rows.map(r => r.n)).toEqual([2, 1, 0]);
    expect(m.rows.map(r => r.target)).toEqual([0.6, 0.2, 0.2]);
  });

  it('tracks applications against 60 and who replied', () => {
    const d = withJobs([job('a'), job('b', { stage: 'interview' }), job('c', { stage: 'closed' }), job('d', { appliedAt: '2026-09-20' })]);
    expect(incomeStats(d)).toEqual({ applied: 3, target: 60, interviews: 1, heardPct: 67 });
  });
});

describe('brag file', () => {
  it('copies wins as dated-order résumé bullets', () => {
    expect(bragText([
      { id: '2', _u: 1, date: '2026-10-02', text: 'Built the intake form', metric: '5 departments' },
      { id: '1', _u: 1, date: '2026-09-30', text: 'Automated laptop auctions' },
    ])).toBe('- Automated laptop auctions\n- Built the intake form (5 departments)');
  });
});

describe('time zones', () => {
  it('converts Vancouver to Ho Chi Minh City across the DST change', () => {
    expect(convertTime('2026-10-20', '16:00', 'America/Vancouver', 'Asia/Ho_Chi_Minh')).toEqual({ date: '2026-10-21', time: '06:00' });
    expect(convertTime('2026-11-03', '16:00', 'America/Vancouver', 'Asia/Ho_Chi_Minh')).toEqual({ date: '2026-11-04', time: '07:00' });
    expect(convertTime('2026-10-21', '09:00', 'Asia/Ho_Chi_Minh', 'America/Vancouver')).toEqual({ date: '2026-10-20', time: '19:00' });
  });
});
