import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './schema';
import { blocksFor, currentBlock, isWorkday } from './schedule';

const S = { ...DEFAULT_SETTINGS };

describe('time blocks', () => {
  it('uses the workday list Mon–Fri and the day-off list otherwise', () => {
    expect(isWorkday(S, '2026-09-28')).toBe(true);
    expect(isWorkday(S, '2026-10-03')).toBe(false);
    expect(blocksFor(S, '2026-10-03').every(b => b.at === null)).toBe(true);
  });

  it('adds the Sunday review only on Sundays', () => {
    const has = (ds: string) => blocksFor(S, ds).some(b => b.label.startsWith('Sunday'));
    expect(has('2026-10-04')).toBe(true);
    expect(has('2026-10-03')).toBe(false);
  });

  it('trains in the morning by default', () => {
    const b = blocksFor(S, '2026-09-28');
    const at = (label: string) => b.find(x => x.label.startsWith(label))!;
    expect(at('Wake')).toMatchObject({ at: '05:00', until: '05:15' });
    expect(at('Train')).toMatchObject({ at: '05:15', until: '06:00', move: 'evening' });
    expect(at('Breakfast')).toMatchObject({ at: '06:00', until: '06:30' });
    expect(at('Commute:')).toMatchObject({ at: '06:30', until: '08:00' });
    expect(at('At work')).toMatchObject({ at: '08:00', until: '16:20' });
    expect(at('Commute home')).toMatchObject({ at: '16:20', until: '17:45' });
    expect(at('Walk')).toMatchObject({ at: '17:45' });
    expect(b.filter(x => x.label === 'Train')).toHaveLength(1);
  });

  it('moves training to the evening when asked', () => {
    const b = blocksFor(S, '2026-09-28', 'evening');
    const train = b.filter(x => x.label === 'Train');
    expect(train).toEqual([expect.objectContaining({ at: '17:45', move: 'morning' })]);
    expect(b.find(x => x.label.startsWith('Wake'))).toMatchObject({ at: '05:00', until: '06:00' });
    expect(b.find(x => x.label.startsWith('Breakfast'))).toMatchObject({ at: '06:00', until: '06:30' });
    expect(b.some(x => x.label === 'Walk')).toBe(false);
  });

  it('takes anchored times from Settings', () => {
    const b = blocksFor({ ...S, wakeTime: '05:30', trainTime: '05:40', lightsOut: '22:30', shift: { leave: '06:45', start: '08:00', end: '16:20', home: '18:00' } }, '2026-09-28');
    const at = (label: string) => b.find(x => x.label.startsWith(label))!;
    expect(at('Wake')).toMatchObject({ at: '05:30', until: '05:40' });
    expect(at('Train')).toMatchObject({ at: '05:40', until: '06:25' });
    expect(at('Commute:')).toMatchObject({ at: '06:45', until: '08:00' });
    expect(at('Walk')).toMatchObject({ at: '18:00' });
    expect(at('Wind-down')).toMatchObject({ at: '22:00', until: '22:30' });
    expect(at('Free time')).toMatchObject({ at: '20:30', until: '22:00' });
    expect(at('Lights out')).toMatchObject({ at: '22:30' });
    expect(at('Career hour')).toMatchObject({ at: '19:30', until: '20:30' });
  });

  it('finds the block happening now', () => {
    const b = blocksFor(S, '2026-09-28');
    const name = (t: string) => { const i = currentBlock(b, t); return i < 0 ? null : b[i].label; };
    expect(name('04:59')).toBeNull();
    expect(name('05:20')).toBe('Train');
    expect(name('07:00')).toMatch(/^Commute:/);
    expect(name('12:00')).toBe('At work');
    expect(name('17:00')).toBe('Commute home');
    expect(name('19:45')).toBe('Career hour');
    expect(name('21:40')).toBe('Free time');
    expect(name('22:10')).toBe('Wind-down');
    expect(name('23:00')).toBe('Lights out');
  });
});

describe('odd settings', () => {
  it('keeps clock order when training is set before waking', () => {
    const b = blocksFor({ ...S, wakeTime: '06:00' }, '2026-09-28');
    expect(b.slice(0, 3).map(x => x.label)).toEqual(['Train', 'Wake + lights on', 'Breakfast + get ready']);
    expect(b[1]).toMatchObject({ at: '06:00', until: '06:00' });
  });
});
