import { useEffect, useRef, useState, type ReactNode } from 'react';
import { diff, fmtShort } from '../lib/dates';

/**
 * Small, quiet charts for the Progress tab: one series each (so no legend; the
 * card title names it), 2px lines, hairline grid, an emphasised endpoint, and a
 * crosshair tooltip on hover or touch. Colours come from the theme tokens.
 */
function useWidth(min = 280) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(min, Math.round(el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);
  return [ref, w] as const;
}

const niceStep = (span: number) => {
  const raw = span / 4, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
};

export interface Ref { y: number; label: string; tone?: 'goal' | 'mark' }
interface LineProps {
  points: { date: string; y: number }[];
  /** Horizontal reference lines: a goal, a checkpoint. */
  refs?: Ref[];
  /** Where the x axis ends, so the goal date shows even before the data reaches it. */
  until?: string;
  fmt: (y: number) => string;
  /** Lower is better (weight, 10K time, resting HR): the y axis still runs up, but the area fills from the top. */
  label: string;
  color?: string;
  height?: number;
  domain?: [number, number];
  /** Tick in multiples of this (60 for times in seconds, so ticks land on whole minutes). */
  unit?: number;
}

export function LineChart({ points, refs = [], until, fmt, label, color = 'var(--accent)', height, domain, unit = 1 }: LineProps) {
  const [ref, W] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <div className="empty chart-empty">Not enough data yet. This fills in as you log and sync.</div>;
  const H = height ?? (W < 520 ? 190 : 230);
  const m = { l: 40, r: 52, t: 14, b: 24 };
  const x0 = points[0].date;
  let x1 = points.at(-1)!.date;
  if (until && until > x1) x1 = until;
  const span = Math.max(1, diff(x1, x0));
  const vals = [...points.map(p => p.y), ...refs.map(r => r.y)];
  let lo = domain?.[0] ?? Math.min(...vals), hi = domain?.[1] ?? Math.max(...vals);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const step = niceStep((hi - lo) / unit) * unit;
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const X = (ds: string) => m.l + (diff(ds, x0) / span) * (W - m.l - m.r);
  const Y = (v: number) => m.t + ((hi - v) / (hi - lo)) * (H - m.t - m.b);
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  const xt = [x0, ...(span > 40 ? [new Date(new Date(`${x0}T12:00:00`).getTime() + (span / 2) * 864e5).toISOString().slice(0, 10)] : []), x1];
  const path = 'M' + points.map(p => `${X(p.date).toFixed(1)},${Y(p.y).toFixed(1)}`).join('L');
  const area = `${path}L${X(points.at(-1)!.date).toFixed(1)},${H - m.b}L${X(x0).toFixed(1)},${H - m.b}Z`;
  const last = points.at(-1)!;
  const h = hover != null ? points[hover] : null;

  const pick = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect(), px = ((clientX - r.left) / r.width) * W;
    let best = 0, bd = Infinity;
    points.forEach((p, i) => { const dd = Math.abs(X(p.date) - px); if (dd < bd) { bd = dd; best = i; } });
    setHover(best);
  };

  return (
    <div ref={ref} className="chart lc">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${label}: latest ${fmt(last.y)} on ${fmtShort(last.date)}`}
        onPointerMove={e => pick(e.clientX, e.currentTarget)} onPointerDown={e => pick(e.clientX, e.currentTarget)} onPointerLeave={() => setHover(null)}>
        {ticks.map(v => (
          <g key={v}>
            <line className="gl" x1={m.l} x2={W - m.r} y1={Y(v)} y2={Y(v)} />
            <text className="tx" x={m.l - 6} y={Y(v) + 4} textAnchor="end">{fmt(v)}</text>
          </g>
        ))}
        {xt.map((ds, i) => <text key={ds} className="tx" x={X(ds)} y={H - 6} textAnchor={i === 0 ? 'start' : i === xt.length - 1 ? 'end' : 'middle'}>{fmtShort(ds)}</text>)}
        {refs.map(r => (
          <g key={r.label} className={`ref ${r.tone ?? 'mark'}`}>
            <line x1={m.l} x2={W - m.r} y1={Y(r.y)} y2={Y(r.y)} />
            <text x={W - m.r + 6} y={Y(r.y) + 4}>{r.label}</text>
          </g>
        ))}
        <path d={area} fill={color} opacity={0.1} />
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={X(last.date)} cy={Y(last.y)} r={5} fill={color} className="ringed" />
        {!h && <text className="endl" x={X(last.date)} y={Y(last.y) - 11} textAnchor={X(last.date) > W - m.r - 40 ? 'end' : 'middle'}>{fmt(last.y)}</text>}
        {h && (
          <g className="hover">
            <line x1={X(h.date)} x2={X(h.date)} y1={m.t} y2={H - m.b} />
            <circle cx={X(h.date)} cy={Y(h.y)} r={5} fill={color} className="ringed" />
          </g>
        )}
      </svg>
      {h && (
        <div className="tip" style={{ left: `${(X(h.date) / W) * 100}%` }}>
          <b>{fmt(h.y)}</b><span>{fmtShort(h.date)}</span>
        </div>
      )}
    </div>
  );
}

/** Weekly columns, one series, with the current week emphasised. */
export function Columns({ bars, fmt, label, current }: { bars: { date: string; y: number }[]; fmt: (y: number) => string; label: string; current?: string }) {
  const [ref, W] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  if (!bars.length) return <div className="empty chart-empty">Weekly totals appear once your watch syncs a run.</div>;
  const H = W < 520 ? 160 : 190;
  const m = { l: 32, r: 8, t: 18, b: 22 };
  const hi = Math.max(5, ...bars.map(b => b.y));
  const step = niceStep(hi), top = Math.ceil(hi / step) * step;
  const slot = (W - m.l - m.r) / bars.length, bw = Math.min(24, slot - 2);
  const Y = (v: number) => m.t + ((top - v) / top) * (H - m.t - m.b);
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
  const h = hover != null ? bars[hover] : null;
  return (
    <div ref={ref} className="chart lc">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label} onPointerLeave={() => setHover(null)}>
        {ticks.map(v => (
          <g key={v}>
            <line className="gl" x1={m.l} x2={W - m.r} y1={Y(v)} y2={Y(v)} />
            <text className="tx" x={m.l - 6} y={Y(v) + 4} textAnchor="end">{fmt(v)}</text>
          </g>
        ))}
        {bars.map((b, i) => {
          const x = m.l + i * slot + (slot - bw) / 2, y = Y(b.y), h0 = H - m.b - y;
          const r = Math.min(4, h0);
          const d = h0 > 0 ? `M${x},${H - m.b}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${H - m.b}Z` : '';
          return (
            <g key={b.date} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
              <rect x={m.l + i * slot} y={m.t} width={slot} height={H - m.t - m.b} fill="transparent" />
              {d && <path d={d} className={`col ${b.date === current ? 'cur' : ''} ${hover === i ? 'on' : ''}`} />}
              {(i === 0 || i === bars.length - 1 || i % Math.ceil(bars.length / 6) === 0) && (
                <text className="tx" x={x + bw / 2} y={H - 6} textAnchor="middle">W{i + 1}</text>
              )}
            </g>
          );
        })}
        {h == null && bars.length > 0 && (() => {
          const i = bars.length - 1, b = bars[i], x = m.l + i * slot + slot / 2;
          return <text className="endl" x={x} y={Y(b.y) - 6} textAnchor={x > W - 30 ? 'end' : 'middle'}>{fmt(b.y)}</text>;
        })()}
      </svg>
      {h && (
        <div className="tip" style={{ left: `${((m.l + hover! * slot + slot / 2) / W) * 100}%` }}>
          <b>{fmt(h.y)}</b><span>Week {hover! + 1} · {fmtShort(h.date)}</span>
        </div>
      )}
    </div>
  );
}

/** The WinterArc gauge: one arc, filled to `pct`. */
export function Arc({ pct, children }: { pct: number; children?: ReactNode }) {
  const R = 100, C = Math.PI * R, sw = 16;
  return (
    <div className="arc">
      <svg viewBox="-120 -120 240 132" aria-hidden="true">
        <path d={`M${-R},0 A${R},${R} 0 0 1 ${R},0`} className="arc-track" strokeWidth={sw} fill="none" strokeLinecap="round" />
        <path d={`M${-R},0 A${R},${R} 0 0 1 ${R},0`} className="arc-fill" strokeWidth={sw} fill="none" strokeLinecap="round"
          strokeDasharray={`${Math.max(0.001, pct) * C} ${C}`} />
        {[0.25, 0.5, 0.75].map(f => {
          const a = Math.PI * (1 - f), x = Math.cos(a), y = -Math.sin(a);
          return <line key={f} className="arc-tick" x1={x * (R - 12)} y1={y * (R - 12)} x2={x * (R + 12)} y2={y * (R + 12)} />;
        })}
      </svg>
      <div className="arc-in">{children}</div>
    </div>
  );
}

/** A labelled progress bar with optional markers along it. */
export function Bar({ pct, marks = [], tone = '' }: { pct: number; marks?: { at: number; label: string; hit?: boolean }[]; tone?: string }) {
  return (
    <div className={`pbar ${tone}`}>
      <div className="pbar-track"><i style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%` }} /></div>
      {marks.length > 0 && (
        <div className="pbar-marks">
          {marks.map(m => <span key={m.label} className={m.hit ? 'hit' : ''} style={{ left: `${Math.max(0, Math.min(1, m.at)) * 100}%` }}><b />{m.label}</span>)}
        </div>
      )}
    </div>
  );
}
