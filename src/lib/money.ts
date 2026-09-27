import { addDays, diff, parse } from './dates';
import { mondayOf, travelEnd } from './life';
import { recs, type Data, type Rec, type Settings } from './schema';
import { SEED } from '../data/seed';

/**
 * Money: all of it lives in private collections and never syncs.
 * General budgeting maths, not investment advice.
 */
export interface Snapshot extends Rec {
  date: string;
  accounts: { name: string; balance: number }[];
  debts: { name: string; balance: number; ratePct: number }[];
  fixedCosts: { name: string; monthly: number }[];
  /** Spending over the last 3 months beyond the fixed costs. */
  spendSplit?: { needs: number; wants: number; foodOut: number };
  monthlyCost: number;
}
export interface FundEntry extends Rec { date: string; balance: number }
export interface Transfer extends Rec { date: string; amount: number; takeHome?: number }
export interface Subscription extends Rec { name: string; monthly: number; lastUsed?: string; cancel?: boolean }
export interface WaitItem extends Rec { item: string; price: number; addedAt: string; decision?: 'buy' | 'skip' }
export interface TripBudget extends Rec { total: number; dailyCap: number; vndPerCad?: number }
export interface TripSpend extends Rec { date: string; amountCad: number; amountVnd?: number; note?: string }
export interface MoneyPrefs extends Rec { runwayTarget?: number; takeHome?: number }

const M = SEED.money;
const byDate = <T extends { date: string }>(xs: T[]) => [...xs].sort((a, b) => a.date.localeCompare(b.date));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export const prefs = (d: Data) => recs<MoneyPrefs>(d, 'moneyPrefs').find(p => p.id === 'main') ?? { id: 'main', _u: 0 };
export const latestSnapshot = (d: Data) => byDate(recs<Snapshot>(d, 'snapshots')).at(-1) ?? null;
export const latestFund = (d: Data) => byDate(recs<FundEntry>(d, 'fund')).at(-1) ?? null;

/** Fixed costs plus a month's share of the 3-month spending. */
export function monthlyCost(fixed: { monthly: number }[], split?: Snapshot['spendSplit']) {
  const f = sum(fixed.map(x => x.monthly || 0));
  return Math.round(f + (split ? (split.needs + split.wants + split.foodOut) / 3 : 0));
}

/** Freedom Fund ÷ monthly cost of living, to one decimal. */
export function runway(d: Data): number | null {
  const s = latestSnapshot(d), f = latestFund(d);
  if (!s || !f || s.monthlyCost <= 0) return null;
  return Math.round((f.balance / s.monthlyCost) * 10) / 10;
}

/** Which of the five steps you're on (1-based), or null before the first snapshot. */
export function orderStep(d: Data): number | null {
  const s = latestSnapshot(d);
  if (!s) return null;
  const buffer = latestFund(d)?.balance ?? sum(s.accounts.map(a => a.balance));
  if (buffer < 1000) return 1;
  if (s.debts.some(x => x.balance > 0 && x.ratePct >= M.highInterestRatePct)) return 2;
  const r = runway(d) ?? 0;
  if (r < 3) return 3;
  if (r < 6) return 4;
  return 5;
}

/* ---------- paydays ---------- */

/** Paydays between `from` and `to` (inclusive). Twice-a-month pay lands on the 15th and the last day. */
export function paydays(s: Settings, from: string, to: string): string[] {
  const p = s.paySchedule;
  if (!p) return [];
  const out: string[] = [];
  if (p.cadence === 'semimonthly') {
    for (let ds = from; ds <= to; ds = addDays(ds, 1)) {
      const dt = parse(ds);
      if (dt.getDate() === 15 || parse(addDays(ds, 1)).getDate() === 1) out.push(ds);
    }
    return out;
  }
  const step = p.cadence === 'weekly' ? 7 : 14;
  const k = Math.ceil(diff(from, p.nextPayday) / step);
  for (let ds = addDays(p.nextPayday, k * step); ds <= to; ds = addDays(ds, step)) out.push(ds);
  return out;
}
export const isPayday = (s: Settings, ds: string) => paydays(s, ds, ds).length > 0;
export const nextPaydayFrom = (s: Settings, ds: string) => paydays(s, ds, addDays(ds, 31))[0] ?? null;

/** A payday in the last 3 days with no transfer logged since. Today nudges until one is. */
export function transferDue(d: Data, today: string): string | null {
  const pd = paydays(d.settings, addDays(today, -2), today).at(-1);
  if (!pd) return null;
  return recs<Transfer>(d, 'transfers').some(t => t.date >= pd) ? null : pd;
}

/** When take-home went up between the last two logged paycheques: send at least half the raise. */
export function raise(d: Data): { amount: number; save: number } | null {
  const t = byDate(recs<Transfer>(d, 'transfers')).filter(x => x.takeHome);
  if (t.length < 2) return null;
  const up = t.at(-1)!.takeHome! - t.at(-2)!.takeHome!;
  return up > 0 ? { amount: up, save: Math.ceil(up / 2) } : null;
}

/* ---------- trip ---------- */

export const tripBudget = (d: Data) => recs<TripBudget>(d, 'tripBudget').find(t => t.id === 'trip') ?? null;

/** Trip days run from departure to the day before you're home. */
export function tripDays(s: Settings): { from: string; to: string; days: number } | null {
  if (!s.departDate || !s.returnDate) return null;
  const to = addDays(s.returnDate, -1);
  return { from: s.departDate, to, days: diff(to, s.departDate) + 1 };
}

export function tripStats(d: Data, today: string) {
  const b = tripBudget(d), t = tripDays(d.settings);
  const spends = recs<TripSpend>(d, 'tripSpend');
  const spent = sum(spends.map(x => x.amountCad));
  const spentToday = sum(spends.filter(x => x.date === today).map(x => x.amountCad));
  const spentBefore = sum(spends.filter(x => x.date < today).map(x => x.amountCad));
  const daysLeft = t ? Math.max(0, Math.min(t.days, diff(t.to, today) + 1)) : null;
  const perDayLeft = b && daysLeft ? Math.max(0, Math.round(((b.total - spentBefore) / daysLeft) * 100) / 100) : null;
  return { budget: b, trip: t, spent, spentToday, daysLeft, perDayLeft, onBudget: b ? spent <= b.total : null };
}

/** Money cards that matter before and during the trip. After the Sunday you're back, it's history. */
export const tripActive = (d: Data, today: string) => {
  if (!d.settings.departDate) return false;
  const end = travelEnd(d.settings);
  return !end || today <= end;
};

/* ---------- spending rules ---------- */

export const subscriptionUnused = (s: Subscription, today: string) =>
  !s.cancel && !!s.lastUsed && diff(today, s.lastUsed) >= M.spendingRules.subscriptionUnusedDays;

/** Hours until buy/skip unlocks (0 = unlocked). */
export const waitHoursLeft = (w: WaitItem, now: Date) =>
  Math.min(M.spendingRules.waitHours, Math.max(0, Math.ceil((new Date(w.addedAt).getTime() + M.spendingRules.waitHours * 3600e3 - now.getTime()) / 3600e3)));

export function foodOutThisWeek(d: Data, today: string) {
  const m = mondayOf(today);
  let n = 0;
  for (let i = 0; i < 7; i++) n += d.days[addDays(m, i)]?.foodOut ?? 0;
  return n;
}
