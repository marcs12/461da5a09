import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, emptyData, type Data } from './schema';
import { foodOutThisWeek, isPayday, monthlyCost, nextPaydayFrom, orderStep, paydays, raise, runway, subscriptionUnused, transferDue, tripDays, tripStats, waitHoursLeft, type Snapshot } from './money';

const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  id: 's', _u: 1, date: '2026-09-30', accounts: [{ name: 'Chequing', balance: 1500 }], debts: [], fixedCosts: [{ name: 'Phone', monthly: 60 }], monthlyCost: 2000, ...over,
});
const money = (priv: Data['priv']): Data => ({ ...emptyData(), priv });
const fund = (balance: number, date = '2026-10-01') => ({ f: { id: 'f', _u: 1, date, balance } as never });

describe('snapshot and runway', () => {
  it('adds fixed costs to a month of the 3-month spending', () => {
    expect(monthlyCost([{ monthly: 60 }, { monthly: 1200 }], { needs: 1500, wants: 900, foodOut: 600 })).toBe(2260);
    expect(monthlyCost([{ monthly: 60 }])).toBe(60);
  });

  it('divides the Freedom Fund by the monthly cost, to one decimal', () => {
    expect(runway(money({ snapshots: { s: snap() }, fund: fund(5000) }))).toBe(2.5);
    expect(runway(money({ snapshots: { s: snap() } }))).toBeNull();
    expect(runway(money({ fund: fund(5000) }))).toBeNull();
  });
});

describe('order of operations', () => {
  it('needs a snapshot first', () => {
    expect(orderStep(emptyData())).toBeNull();
  });
  it('walks buffer → debt → 3 months → 6 months → invest', () => {
    expect(orderStep(money({ snapshots: { s: snap() }, fund: fund(800) }))).toBe(1);
    expect(orderStep(money({ snapshots: { s: snap({ debts: [{ name: 'Visa', balance: 900, ratePct: 20.99 }] }) }, fund: fund(1200) }))).toBe(2);
    expect(orderStep(money({ snapshots: { s: snap({ debts: [{ name: 'Car', balance: 9000, ratePct: 5.5 }] }) }, fund: fund(4000) }))).toBe(3);
    expect(orderStep(money({ snapshots: { s: snap() }, fund: fund(8000) }))).toBe(4);
    expect(orderStep(money({ snapshots: { s: snap() }, fund: fund(12000) }))).toBe(5);
  });
  it('uses account balances as the buffer before any fund entry', () => {
    expect(orderStep(money({ snapshots: { s: snap({ accounts: [{ name: 'A', balance: 400 }] }) } }))).toBe(1);
  });
});

describe('paydays', () => {
  const S = { ...DEFAULT_SETTINGS };
  it('runs every two weeks from the known payday, both directions', () => {
    expect(paydays(S, '2026-09-20', '2026-11-10')).toEqual(['2026-09-25', '2026-10-09', '2026-10-23', '2026-11-06']);
    expect(isPayday(S, '2026-10-09')).toBe(true);
    expect(isPayday(S, '2026-10-16')).toBe(false);
    expect(nextPaydayFrom(S, '2026-10-10')).toBe('2026-10-23');
  });
  it('handles weekly and twice-a-month pay', () => {
    expect(paydays({ ...S, paySchedule: { cadence: 'weekly', nextPayday: '2026-10-09' } }, '2026-10-01', '2026-10-17')).toEqual(['2026-10-02', '2026-10-09', '2026-10-16']);
    expect(paydays({ ...S, paySchedule: { cadence: 'semimonthly', nextPayday: '2026-10-15' } }, '2026-10-01', '2026-11-16')).toEqual(['2026-10-15', '2026-10-31', '2026-11-15']);
  });
  it('asks for the transfer for 3 days after payday, until one is logged', () => {
    expect(transferDue(emptyData(), '2026-10-09')).toBe('2026-10-09');
    expect(transferDue(emptyData(), '2026-10-11')).toBe('2026-10-09');
    expect(transferDue(emptyData(), '2026-10-12')).toBeNull();
    expect(transferDue(money({ transfers: { t: { id: 't', _u: 1, date: '2026-10-10', amount: 300 } as never } }), '2026-10-11')).toBeNull();
  });
  it('suggests saving half of a raise', () => {
    const t = (id: string, date: string, takeHome: number) => ({ id, _u: 1, date, amount: 300, takeHome });
    expect(raise(money({ transfers: { a: t('a', '2026-10-09', 1500), b: t('b', '2026-10-23', 1700) } as never }))).toEqual({ amount: 200, save: 100 });
    expect(raise(money({ transfers: { a: t('a', '2026-10-09', 1500), b: t('b', '2026-10-23', 1500) } as never }))).toBeNull();
  });
});

describe('trip budget', () => {
  const d = money({
    tripBudget: { trip: { id: 'trip', _u: 1, total: 1600, dailyCap: 200 } as never },
    tripSpend: {
      a: { id: 'a', _u: 1, date: '2026-10-16', amountCad: 250 } as never,
      b: { id: 'b', _u: 1, date: '2026-10-17', amountCad: 150 } as never,
      c: { id: 'c', _u: 1, date: '2026-10-18', amountCad: 40 } as never,
    },
  });
  it('covers departure to the day before you’re home', () => {
    expect(tripDays(DEFAULT_SETTINGS)).toEqual({ from: '2026-10-16', to: '2026-10-23', days: 8 });
  });
  it('spreads what’s left over the remaining days', () => {
    const s = tripStats(d, '2026-10-18');
    expect(s).toMatchObject({ spent: 440, spentToday: 40, daysLeft: 6, onBudget: true });
    expect(s.perDayLeft).toBe(200); // (1600 - 400) / 6
  });
});

describe('spending rules', () => {
  it('flags subscriptions unused for 30 days', () => {
    const s = { id: 's', _u: 1, name: 'Netflix', monthly: 18, lastUsed: '2026-09-01' };
    expect(subscriptionUnused(s, '2026-09-30')).toBe(false);
    expect(subscriptionUnused(s, '2026-10-01')).toBe(true);
    expect(subscriptionUnused({ ...s, cancel: true }, '2026-10-01')).toBe(false);
  });
  it('unlocks the 48-hour list after 48 hours', () => {
    const w = { id: 'w', _u: 1, item: 'Headphones', price: 300, addedAt: new Date(2026, 9, 1, 20, 0).toISOString() };
    expect(waitHoursLeft(w, new Date(2026, 9, 2, 20, 0))).toBe(24);
    expect(waitHoursLeft(w, new Date(2026, 9, 3, 20, 0))).toBe(0);
    expect(waitHoursLeft(w, new Date(2026, 9, 1, 19, 59, 40))).toBe(48); // a clock a few seconds behind
  });
  it('counts meals out Monday to Sunday', () => {
    const d: Data = { ...emptyData(), days: { '2026-09-28': { foodOut: 1 }, '2026-10-03': { foodOut: 2 }, '2026-10-05': { foodOut: 1 } } };
    expect(foodOutThisWeek(d, '2026-10-01')).toBe(3);
  });
});
