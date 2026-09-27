import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SCHEMA_VERSION, merge, migrate, publicData, recs, stable, type Data } from './schema';

/** Shaped like a real v1 export: days keyed by date, a few settings. */
const v1 = {
  days: {
    '2026-09-27': { weight: 214.2, done: true, walk: true, rpe: 8, ex: { complex: [{ w: 25, r: 7 }] }, _u: 1790000000000 },
    '2026-09-28': { weight: 213.6, cal: 2250, pro: 176, sleep: 7.5, note: 'Felt fine', _u: 1790090000000 },
  },
  settings: { calTarget: 2100, proTarget: 180, cutWeek: 2, _u: 1790000000500 },
};

const withCols = (d: Data, cols: Data['cols'], priv: Data['priv'] = {}): Data => ({ ...d, cols, priv });

describe('migrate', () => {
  it('rejects things that are not app data', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate({ foo: 1 })).toBeNull();
    expect(migrate([])).toBeNull();
  });

  it('upgrades v1 without touching days or existing settings', () => {
    const d = migrate(structuredClone(v1))!;
    expect(d.schemaVersion).toBe(SCHEMA_VERSION);
    expect(d.days).toEqual(v1.days);
    expect(d.settings.calTarget).toBe(2100);
    expect(d.settings.cutWeek).toBe(2);
    expect(d.settings._u).toBe(1790000000500);
    expect(d.settings.planStart).toBe(DEFAULT_SETTINGS.planStart);
    expect(d.settings.onboarded).toBeUndefined();
    expect(d.cols).toEqual({});
    expect(d.priv).toEqual({});
  });

  it('is idempotent', () => {
    const once = migrate(structuredClone(v1))!;
    expect(stable(migrate(structuredClone(once)))).toBe(stable(once));
  });
});

describe('merge', () => {
  const base = migrate(structuredClone(v1))!;

  it('keeps records a v1 remote knows nothing about', () => {
    const local = withCols(base, { jobs: { j1: { id: 'j1', _u: 5 } } }, { checkIns: { c1: { id: 'c1', _u: 5 } } });
    const remoteV1 = migrate(structuredClone(v1))!;
    const m = merge(local, remoteV1);
    expect(m.cols.jobs.j1).toBeDefined();
    expect(m.priv.checkIns.c1).toBeDefined();
  });

  it('is last-writer-wins per record, including deletes', () => {
    const a = withCols(base, { jobs: { j1: { id: 'j1', _u: 5 }, j2: { id: 'j2', _u: 9 } } });
    const b = withCols(base, { jobs: { j1: { id: 'j1', _u: 7, _del: true }, j2: { id: 'j2', _u: 3, _del: true } } });
    const m = merge(a, b);
    expect(m.cols.jobs.j1._del).toBe(true);
    expect(m.cols.jobs.j2._del).toBeUndefined();
    expect(recs(m, 'jobs').map(r => r.id)).toEqual(['j2']);
  });

  it('is last-writer-wins per day and for settings', () => {
    const b: Data = {
      ...base,
      days: { ...base.days, '2026-09-28': { weight: 213.0, _u: 1790099999999 } },
      settings: { ...base.settings, calTarget: 2000, _u: 1 },
    };
    const m = merge(base, b);
    expect(m.days['2026-09-28'].weight).toBe(213.0);
    expect(m.settings.calTarget).toBe(2100);
  });
});

describe('privacy', () => {
  it('never puts private collections in the synced copy', () => {
    const d = withCols(migrate(structuredClone(v1))!, { jobs: {} }, { checkIns: { c1: { id: 'c1', _u: 1 } }, tripSpend: {} });
    const pub = JSON.stringify(publicData(d));
    expect(pub).not.toContain('checkIns');
    expect(pub).not.toContain('priv');
    expect(pub).toContain('jobs');
  });

  it('reads private collections from the private side', () => {
    const d = withCols(migrate(structuredClone(v1))!, {}, { checkIns: { c1: { id: 'c1', _u: 1 } } });
    expect(recs(d, 'checkIns')).toHaveLength(1);
  });
});

describe('export / import', () => {
  it('round-trips everything, private data included', () => {
    const d = withCols(migrate(structuredClone(v1))!, { jobs: { j1: { id: 'j1', _u: 2 } } }, { checkIns: { c1: { id: 'c1', _u: 3 } } });
    const file = JSON.stringify(d, null, 1);
    const back = migrate(JSON.parse(file))!;
    expect(stable(back)).toBe(stable(d));
    // Importing into an empty device restores it all.
    expect(stable(merge(migrate({ days: {} })!, back))).toBe(stable({ ...d, settings: { ...d.settings } }));
  });
});
