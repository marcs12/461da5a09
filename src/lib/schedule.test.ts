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

  it('takes anchored times from Settings', () => {
    const b = blocksFor({ ...S, wakeTime: '05:30', lightsOut: '22:30', shift: { leave: '06:45', start: '08:00', end: '16:20', home: '18:00' } }, '2026-09-28');
    const at = (label: string) => b.find(x => x.label.startsWith(label))!;
    expect(at('Wake')).toMatchObject({ at: '05:30', until: '06:45' });
    expect(at('Commute')).toMatchObject({ at: '06:45', until: '08:00' });
    expect(at('Train')).toMatchObject({ at: '18:00' });
    expect(at('Wind-down')).toMatchObject({ at: '22:00', until: '22:30' });
    expect(at('Lights out')).toMatchObject({ at: '22:30' });
    expect(at('Career hour')).toMatchObject({ at: '19:30', until: '20:30' });
  });

  it('finds the block happening now', () => {
    const b = blocksFor(S, '2026-09-28');
    const name = (t: string) => { const i = currentBlock(b, t); return i < 0 ? null : b[i].label; };
    expect(name('05:59')).toBeNull();
    expect(name('06:10')).toMatch(/^Wake/);
    expect(name('07:00')).toMatch(/^Commute/);
    expect(name('12:00')).toBeNull();
    expect(name('19:45')).toBe('Career hour');
    expect(name('21:40')).toBe('Wind-down');
    expect(name('23:00')).toBe('Lights out');
  });
});
