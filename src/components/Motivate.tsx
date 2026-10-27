import { useEffect, useMemo, useRef, useState } from 'react';
import { diff, fmtShort, r1 } from '../lib/dates';
import { END, START } from '../lib/program';
import { arc, sessionCount, sessionStreak, upcoming } from '../lib/motivation';
import { milestones, type Milestone } from '../lib/progress';
import type { Data } from '../lib/schema';
import { Icon } from './ui';

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

/** The arc as a slice of a circle through both ends and the top, sized to the real width so nothing stretches. */
function geometry(W: number, H: number) {
  const pad = 12, top = 12, base = H - 8;
  const c = W / 2 - pad, sag = base - top;
  const R = (c * c + sag * sag) / (2 * sag), cx = W / 2, cy = top + R;
  const a0 = Math.atan2(base - cy, -c), a1 = Math.atan2(base - cy, c);
  const at = (p: number) => { const a = a0 + (a1 - a0) * p; return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }; };
  return { path: `M${cx - c},${base} A${R},${R} 0 0 1 ${cx + c},${base}`, len: R * (a1 - a0), at };
}
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(200, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Where you started, where you are now and where Apr 18 is, on one arc. */
export function ArcCard({ data, today }: { data: Data; today: string }) {
  const A = useMemo(() => arc(data, today), [data, today]);
  const streak = sessionStreak(data, today), count = sessionCount(data, today);
  const next = upcoming(today);
  const p = Math.max(0, Math.min(1, A.pct));
  const [vref, VW] = useWidth();
  const VH = VW < 500 ? 70 : 92;
  const G = geometry(VW, VH), dot = G.at(p), s0 = G.at(0), s1 = G.at(1);
  const w = (v?: number) => (v == null ? '—' : Number.isInteger(r1(v)) ? String(r1(v)) : r1(v).toFixed(1));
  const avgNote = A.now.w != null && A.now.avg != null && Math.abs(A.now.avg - A.now.w) >= 0.3 ? ` · avg ${r1(A.now.avg).toFixed(1)}` : '';

  return (
    <article className="arccard" aria-label="Your arc">
      <div className="arc-top">
        <div>
          <div className="eyebrow">Your arc{A.status !== 'pre' && ` · ${count.done} of ${count.total} sessions`}</div>
          <b className="arc-day">{A.status === 'pre' ? (diff(START, today) === 1 ? 'Day 1 is tomorrow' : `Day 1 in ${diff(START, today)} days`) : A.status === 'post' ? 'All 175 days' : `Day ${A.day} of ${A.days}`}</b>
        </div>
        <div className="arc-pills">
          {A.status !== 'pre' && streak > 0 && <span className={`pill flame ${streak >= 3 ? 'hot' : ''}`} title="Planned sessions done in a row; rest days don't break it"><Icon.flame />{streak} in a row</span>}
        </div>
      </div>

      <div className="arc-viz" ref={vref} style={{ height: VH }}>
        <svg width={VW} height={VH} viewBox={`0 0 ${VW} ${VH}`} aria-hidden="true">
          <path d={G.path} className="arc-t" />
          {p >= 0.005 && <path d={G.path} className="arc-f" strokeDasharray={`${p * G.len} ${G.len + 10}`} style={{ ['--len' as string]: `${G.len + 10}px` }} />}
          <circle cx={s0.x} cy={s0.y} r={4.5} className="arc-end s" />
          <circle cx={s1.x} cy={s1.y} r={6} className="arc-end g" />
        </svg>
        <span className="arc-dot" style={{ left: dot.x, top: dot.y }}>
          <em>{Math.round(p * 100)}%</em>
        </span>
      </div>

      <div className="arc-cols">
        <div><small>Start</small><b>{w(A.start.w)}<u>lb</u></b><span>{clock(A.start.tenK)} 10K</span></div>
        <div className="now"><small title="Your latest weigh-in. The percentages use the 7-day average, which smooths out water weight.">Now{avgNote}</small><b>{w(A.now.w ?? (A.status === 'pre' ? A.start.w : undefined))}<u>lb</u></b><span>{A.now.tenK != null ? `${clock(A.now.tenK)} 10K` : 'first trial Dec 20'}</span></div>
        <div className="goal"><small>{fmtShort(END)}</small><b>{A.goal.w}<u>lb</u></b><span>{clock(A.goal.tenK)} 10K</span></div>
      </div>

      <p className="arc-fore">{A.forecast}</p>
      {next.length > 0 && (
        <div className="arc-next">
          {next.map(n => (
            <span key={n.date} className={n.days <= 7 ? 'soon' : ''}>
              <b>{n.days === 0 ? 'Today' : n.days === 1 ? 'Tomorrow' : `${n.days} days`}</b>{n.date === END ? 'Sun Run, then Hawaii' : `${n.title.replace('time trial', 'trial')} · ${fmtShort(n.date)}`}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

/** Shown once the day's session is done: what it added up to. Celebrates when it turns done while you watch. */
export function DoneBanner({ data, date }: { data: Data; date: string }) {
  const count = sessionCount(data, date), streak = sessionStreak(data, date);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !el.dataset.fresh) return;
    try { sessionStorage.removeItem('wa-just-done'); } catch { /* ignore */ }
    el.classList.add('pop');
    const id = setTimeout(() => el.classList.remove('pop'), 1600);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="donebanner" ref={ref} data-fresh={justDone() === date ? '1' : undefined} role="status">
      <span className="burst" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ ['--a' as string]: `${i * 36}deg` }} />)}</span>
      <span className="db-check"><Icon.trophy /></span>
      <div>
        <b>Session {count.done} of {count.total} done</b>
        <span>{streak > 1 ? `${streak} in a row. Keep the chain going.` : 'Banked. The next one is easier to start.'}</span>
      </div>
    </div>
  );
}

const justDone = () => { try { return sessionStorage.getItem('wa-just-done'); } catch { return null; } };
/** Mark a day as just finished, so its banner celebrates when it appears. */
export const markJustDone = (date: string) => { try { sessionStorage.setItem('wa-just-done', date); } catch { /* ignore */ } };

const SEEN = 'winterarc-milestones-seen';
const readSeen = (): string[] | null => { try { const v = localStorage.getItem(SEEN); return v ? JSON.parse(v) : null; } catch { return null; } };
const writeSeen = (ids: string[]) => { try { localStorage.setItem(SEEN, JSON.stringify(ids)); } catch { /* private mode: the toast just shows again */ } };

/** A milestone reached since you last opened the app. The first time, everything already reached counts as seen. */
export function MilestoneToast({ data, today, onOpen }: { data: Data; today: string; onOpen: () => void }) {
  const unlocked = useMemo(() => milestones(data, today).filter(m => m.at), [data, today]);
  const [seen, setSeen] = useState<string[] | null>(readSeen);
  useEffect(() => {
    if (seen == null) { const ids = unlocked.map(m => m.id); writeSeen(ids); setSeen(ids); }
  }, [seen, unlocked]);
  const fresh: Milestone | undefined = seen ? unlocked.find(m => !seen.includes(m.id)) : undefined;
  if (!fresh) return null;
  const close = () => { const ids = [...(seen ?? []), fresh.id]; writeSeen(ids); setSeen(ids); };
  return (
    <div className="toast" role="status">
      <span className="toast-ic"><Icon.trophy /></span>
      <div className="grow">
        <small>Milestone unlocked</small>
        <b>{fresh.title}</b>
        <span>{fresh.detail}</span>
      </div>
      <button className="btn sm" onClick={() => { close(); onOpen(); }}>See it</button>
      <button className="iconbtn sm" onClick={close} aria-label="Dismiss"><Icon.close /></button>
    </div>
  );
}
