import { addDays } from './dates';
import { isTravelMode, mondayOf, planDay, planEnd, targetsKey } from './life';
import { recs, type Data, type Job, type Rec, type Stage, type Tier } from './schema';
import { SEED } from '../data/seed';

export interface Outreach extends Rec { date: string; name: string; company?: string; channel: string; replied: boolean; nextStep?: string }
export interface Win extends Rec { date: string; text: string; metric?: string }
export interface Freelance extends Rec { pitches: number; intros: number; paidClient: boolean }

export const STAGES: { id: Stage; label: string }[] = [
  { id: 'saved', label: 'Saved' },
  { id: 'applied', label: 'Applied' },
  { id: 'followup', label: 'Follow up' },
  { id: 'interview', label: 'Interview' },
  { id: 'offer', label: 'Offer' },
  { id: 'closed', label: 'Closed' },
];

export const jobs = (d: Data) => recs<Job>(d, 'jobs');
export const outreach = (d: Data) => recs<Outreach>(d, 'outreach');

/** Still waiting on an application you sent a week or more ago. */
export const followUpDue = (j: Job, today: string) => j.stage === 'applied' && !!j.followUpAt && today >= j.followUpAt;

/** The fields that change when a job moves stage. Applying sets the date and the 7-day follow-up. */
export function stagePatch(j: Job, stage: Stage, today: string): Partial<Job> {
  if (stage === 'applied' && !j.appliedAt) return { stage, appliedAt: today, followUpAt: addDays(today, SEED.income.followUpDays) };
  if (stage === 'saved') return { stage, appliedAt: undefined, followUpAt: undefined };
  return { stage };
}

const inWeek = (ds: string | undefined, monday: string) => !!ds && ds >= monday && ds <= addDays(monday, 6);

export interface WeekTargets { applications: number; outreach: number; paused: boolean }
/** This week's application and outreach targets, from the phase. Paused in travel. */
export function weekTargets(d: Data, today: string): WeekTargets {
  const pd = planDay(d.settings, today);
  const key = isTravelMode(d.settings, today) ? 'travel' : targetsKey(pd) === 'travel' ? 'build1to4' : targetsKey(pd) ?? 'sprint';
  const t = SEED.weeklyTargets[key];
  return { applications: t.applications, outreach: t.outreach, paused: key === 'travel' };
}

export function weekCounts(d: Data, today: string) {
  const m = mondayOf(today);
  return {
    applications: jobs(d).filter(j => inWeek(j.appliedAt, m)).length,
    outreach: outreach(d).filter(o => inWeek(o.date, m)).length,
  };
}

/** Share of applications by tier. Inside Best Buy counts toward Bridge. */
export function tierMix(d: Data) {
  const applied = jobs(d).filter(j => j.appliedAt);
  const n = applied.length;
  const count = (t: Tier[]) => applied.filter(j => t.includes(j.tier)).length;
  const target = (id: string) => SEED.income.tiers.find(t => t.id === id)!.targetShare ?? 0;
  return {
    total: n,
    rows: [
      { id: 'bridge', label: 'Bridge + Best Buy', n: count(['bridge', 'bestbuy']), target: target('bridge') },
      { id: 'stretch', label: 'Stretch', n: count(['stretch']), target: target('stretch') },
      { id: 'creative', label: 'Front-end / creative', n: count(['creative']), target: target('creative') },
    ],
  };
}

/** Plan-wide numbers: applications against the 60, interviews, and how many you heard back from. */
export function incomeStats(d: Data) {
  const S = d.settings, end = planEnd(S);
  const applied = jobs(d).filter(j => j.appliedAt && j.appliedAt >= S.planStart && j.appliedAt <= end);
  const interviews = applied.filter(j => j.stage === 'interview' || j.stage === 'offer').length;
  const heard = applied.filter(j => ['interview', 'offer', 'closed'].includes(j.stage)).length;
  const target = SEED.scoreboard.find(s => s.id === 'apps')!.target as number;
  return { applied: applied.length, target, interviews, heardPct: applied.length ? Math.round((heard / applied.length) * 100) : null };
}

export const bragText = (wins: Win[]) =>
  [...wins].sort((a, b) => a.date.localeCompare(b.date)).map(w => `- ${w.text}${w.metric ? ` (${w.metric})` : ''}`).join('\n');

/* ---------- time zones (travel) ---------- */

function zoneOffsetMin(zone: string, utcMs: number) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(utcMs)).map(x => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return Math.round((asUtc - Math.floor(utcMs / 60000) * 60000) / 60000);
}

/** A wall-clock time on a date in one zone, as the date and time in another. */
export function convertTime(ds: string, hhmm: string, from: string, to: string): { date: string; time: string } {
  const [y, m, d] = ds.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let utc = guess - zoneOffsetMin(from, guess) * 60000;
  utc = guess - zoneOffsetMin(from, utc) * 60000; // second pass settles DST edges
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: to, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(utc)).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
