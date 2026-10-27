import { describe, expect, it } from 'vitest';
import { QUICK, addFood, removeFood, repeatFood } from './meals';
import type { DayLog } from './schema';

describe('food entries', () => {
  it('add to and take back off the day totals', () => {
    const d: DayLog = {};
    addFood(d, { name: 'Scramble', cal: 310, pro: 43 }, 1);
    addFood(d, { name: 'Bulgogi bowl', cal: 475, pro: 47 }, 2);
    expect([d.cal, d.pro, d.food?.length]).toEqual([785, 90, 2]);
    removeFood(d, 0);
    expect([d.cal, d.pro, d.food?.map(e => e.name)]).toEqual([475, 47, ['Bulgogi bowl']]);
    removeFood(d, 0);
    expect(d).toEqual({});
  });
  it('add on top of a total typed by hand', () => {
    const d: DayLog = { cal: 600, pro: 40 };
    addFood(d, { name: 'Shake', cal: 120, pro: 27 }, 1);
    expect([d.cal, d.pro]).toEqual([720, 67]);
  });
  it('repeat yesterday', () => {
    const y: DayLog = {};
    for (const m of QUICK.slice(0, 4)) addFood(y, { name: m.name, cal: m.kcal, pro: m.pro }, 1);
    const d: DayLog = {};
    repeatFood(d, y, 5);
    expect([d.cal, d.pro]).toEqual([1460, 198]);
    expect(d.food?.every(e => e.at === 5)).toBe(true);
  });
});
