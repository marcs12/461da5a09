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
  /** On a training block: where "move" sends today's session. */
  move?: Slot;
}

type SeedBlock = { at?: string; until?: string; anchor?: string; onlyIf?: string; label: string; detail?: string; area: string; link?: string; onlyOn?: string };
export type Slot = 'morning' | 'evening';

const isClock = (t?: string | null) => !!t && /^\d\d:\d\d$/.test(t);
export const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const fromMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
const plus = (t: string, min: number) => fromMin(toMin(t) + min);
/** Morning sessions are planned as 45 minutes, which covers the longest one. */
const TRAIN_MIN = 45;

export const isWorkday = (s: Settings, ds: string) => s.workdays.includes(((parse(ds).getDay() + 6) % 7) + 1);

export function blocksFor(s: Settings, ds: string, slot: Slot = s.trainAt): Block[] {
  if (!isWorkday(s, ds)) {
    const sunday = parse(ds).getDay() === 0;
    return (SEED.schedule.dayOff as SeedBlock[])
      .filter(b => b.onlyOn !== 'sunday' || sunday)
      .map(b => ({ at: null, until: null, label: b.label, detail: b.detail, area: b.area, link: b.link }));
  }
  const sh = s.shift;
  const morning = slot === 'morning';
  const leave = sh?.leave ?? plus(s.wakeTime, 60);
  const out: Block[] = [];
  for (const b of SEED.schedule.workday as SeedBlock[]) {
    if (b.onlyIf === 'trainMorning' && !morning) continue;
    if (b.onlyIf === 'trainEvening' && morning) continue;
    let at: string | null = isClock(b.at) ? b.at! : null;
    let until: string | null = isClock(b.until) ? b.until! : null;
    switch (b.anchor) {
      case 'wake': at = s.wakeTime; until = morning && s.trainTime > s.wakeTime ? s.trainTime : plus(leave, -30); break;
      case 'trainMorning': at = s.trainTime; until = plus(s.trainTime, TRAIN_MIN); break;
      case 'breakfast': at = morning ? plus(s.trainTime, TRAIN_MIN) : plus(leave, -30); until = leave; break;
      case 'commute': if (!sh) continue; at = sh.leave; until = sh.start; break;
      case 'work': if (!sh) continue; at = sh.start; until = sh.end; break;
      case 'commuteHome': if (!sh) continue; at = sh.end; until = sh.home; break;
      case 'home': if (!sh) continue; at = sh.home; break;
      case 'windDown': at = fromMin(toMin(s.lightsOut) - 30); until = s.lightsOut; break;
      case 'lightsOut': at = s.lightsOut; until = null; break;
    }
    const when = !at && b.at ? b.at[0].toUpperCase() + b.at.slice(1) : undefined;
    const move: Slot | undefined = b.anchor === 'trainMorning' ? 'evening' : b.onlyIf === 'trainEvening' ? 'morning' : undefined;
    out.push({ at, until, label: b.label, detail: b.detail, area: b.area, link: b.link, when, move });
  }
  // Settings can put training before waking; keep the list in clock order either way.
  return out.sort((x, y) => (x.at && y.at ? toMin(x.at) - toMin(y.at) : 0));
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
