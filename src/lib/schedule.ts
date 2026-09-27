import { parse } from './dates';
import type { Settings } from './schema';
import { SEED } from '../data/seed';

/** Today's time blocks: the workday or day-off list from the seed, with anchored times from Settings. */
export interface Block {
  at: string | null;
  until: string | null;
  label: string;
  detail?: string;
  area: string;
  link?: string;
  /** For untimed workday blocks: the seed's plain-language time ("Lunch"). */
  when?: string;
}

type SeedBlock = { at?: string; until?: string; anchor?: string; label: string; detail?: string; area: string; link?: string; onlyOn?: string };

const isClock = (t?: string | null) => !!t && /^\d\d:\d\d$/.test(t);
export const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const fromMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

export const isWorkday = (s: Settings, ds: string) => s.workdays.includes(((parse(ds).getDay() + 6) % 7) + 1);

export function blocksFor(s: Settings, ds: string): Block[] {
  if (!isWorkday(s, ds)) {
    const sunday = parse(ds).getDay() === 0;
    return (SEED.schedule.dayOff as SeedBlock[])
      .filter(b => b.onlyOn !== 'sunday' || sunday)
      .map(b => ({ at: null, until: null, label: b.label, detail: b.detail, area: b.area, link: b.link }));
  }
  const sh = s.shift;
  return (SEED.schedule.workday as SeedBlock[]).map(b => {
    let at: string | null = isClock(b.at) ? b.at! : null;
    let until: string | null = isClock(b.until) ? b.until! : null;
    switch (b.anchor) {
      case 'wake': at = s.wakeTime; until = sh ? sh.leave : until; break;
      case 'commute': if (sh) { at = sh.leave; until = sh.start; } break;
      case 'home': if (sh) at = sh.home; break;
      case 'windDown': at = fromMin(toMin(s.lightsOut) - 30); until = s.lightsOut; break;
      case 'lightsOut': at = s.lightsOut; until = null; break;
    }
    const when = !at && b.at ? b.at[0].toUpperCase() + b.at.slice(1) : undefined;
    return { at, until, label: b.label, detail: b.detail, area: b.area, link: b.link, when };
  });
}

/** Index of the block happening at `now` (HH:MM), or -1. Untimed blocks are never current. */
export function currentBlock(blocks: Block[], now: string): number {
  const n = toMin(now);
  let cur = -1;
  blocks.forEach((b, i) => { if (b.at && toMin(b.at) <= n) cur = i; });
  if (cur < 0) return -1;
  const u = blocks[cur].until;
  return u && n >= toMin(u) ? -1 : cur;
}
