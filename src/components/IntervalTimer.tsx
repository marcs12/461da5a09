import { useEffect, useReducer, useRef } from 'react';
import { clock, fmtDay } from '../lib/dates';
import { segTotal, type Segment } from '../lib/program';

interface Props { title: string; date: string; segments: Segment[]; onClose: () => void; onDone: () => void }

/** Full-screen interval timer: color flips per segment, beeps + vibrates on change, keeps the screen awake. */
export function IntervalTimer({ title, date, segments: segs, onClose, onDone }: Props) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  const T = useRef({ i: 0, left: segs[0].sec * 1000, endAt: 0, run: false, finished: false, pip: '' });
  const ac = useRef<AudioContext | null>(null);
  const wake = useRef<WakeLockSentinel | null>(null);
  const int = useRef<ReturnType<typeof setInterval>>(undefined);
  const total = segTotal(segs);

  const beep = (f: number, dur: number, when = 0) => {
    const a = ac.current;
    if (!a) return;
    try {
      const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + when;
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.03);
    } catch { /* audio unavailable */ }
  };
  const vib = (p: number[]) => { try { navigator.vibrate?.(p); } catch { /* unsupported */ } };
  const cue = (k: 'pip' | 'change' | 'done') => {
    if (k === 'pip') beep(660, 0.12);
    else if (k === 'change') { beep(880, 0.18); beep(1175, 0.28, 0.2); vib([180, 80, 180]); }
    else { beep(784, 0.2); beep(988, 0.2, 0.22); beep(1319, 0.45, 0.44); vib([300, 100, 300]); }
  };
  const getWake = async () => {
    try { if ('wakeLock' in navigator && !wake.current) { wake.current = await navigator.wakeLock.request('screen'); wake.current.addEventListener('release', () => { wake.current = null; }); } } catch { /* denied */ }
  };
  const releaseWake = () => { try { wake.current?.release(); } catch { /* already released */ } wake.current = null; };

  const finish = () => {
    const t = T.current;
    t.run = false; t.finished = true; t.i = segs.length; t.left = 0;
    clearInterval(int.current); cue('done'); releaseWake(); force();
  };
  const tick = () => {
    const t = T.current;
    let rem = t.endAt - Date.now();
    while (rem <= 0) {
      t.i++;
      if (t.i >= segs.length) return finish();
      t.endAt += segs[t.i].sec * 1000;
      rem = t.endAt - Date.now();
      cue('change');
    }
    const s = Math.ceil(rem / 1000), key = `${t.i}:${s}`;
    if (s <= 3 && t.pip !== key) { t.pip = key; cue('pip'); }
    t.left = rem;
    force();
  };
  const start = () => {
    try { ac.current ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); ac.current.resume(); } catch { /* audio unavailable */ }
    const t = T.current;
    t.endAt = Date.now() + t.left; t.run = true;
    clearInterval(int.current); int.current = setInterval(tick, 200);
    getWake(); force();
  };
  const pause = () => {
    const t = T.current;
    if (t.run) t.left = Math.max(0, t.endAt - Date.now());
    t.run = false; clearInterval(int.current); force();
  };
  const toggle = () => {
    if (T.current.finished) { onDone(); close(); return; }
    T.current.run ? pause() : start();
  };
  const skip = (dir: 1 | -1) => {
    const t = T.current;
    if (t.finished) {
      if (dir < 0) { t.finished = false; t.i = segs.length - 1; t.left = segs[t.i].sec * 1000; force(); }
      return;
    }
    if (dir < 0) { if (segs[t.i].sec * 1000 - t.left < 3000 && t.i > 0) t.i--; }
    else { t.i++; if (t.i >= segs.length) return finish(); cue('change'); }
    t.left = segs[t.i].sec * 1000;
    if (t.run) t.endAt = Date.now() + t.left;
    force();
  };
  const close = () => { pause(); releaseWake(); onClose(); };

  const handlers = useRef({ toggle, skip, close });
  handlers.current = { toggle, skip, close };
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); handlers.current.toggle(); }
      else if (e.key === 'Escape') handlers.current.close();
      else if (e.key === 'ArrowRight') handlers.current.skip(1);
      else if (e.key === 'ArrowLeft') handlers.current.skip(-1);
    };
    const onVis = () => { if (document.visibilityState === 'visible' && T.current.run) getWake(); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(int.current);
      releaseWake();
    };
  }, []);

  const t = T.current;
  const seg = segs[Math.min(t.i, segs.length - 1)];
  // Rounds are the work segments that share a label ("Run", "Stride"), so a lone easy run before strides isn't counted as one.
  const isWork = (x: Segment) => x.tone === 'work';
  const group = isWork(seg) ? seg.label : (segs.slice(t.i).find(isWork) ?? segs.slice(0, t.i).reverse().find(isWork))?.label;
  const works = segs.filter(x => isWork(x) && x.label === group).length;
  const k = segs.slice(0, t.i + 1).filter(x => isWork(x) && x.label === group).length;
  const next = segs[t.i + 1];
  const rest = segs.slice(t.i + 1).reduce((a, x) => a + x.sec, 0) + t.left / 1000;

  return (
    <div className="timer" data-tone={t.finished ? 'done' : seg.tone} role="dialog" aria-modal="true" aria-labelledby="t-label">
      <div className="t-top"><span>{title} · {fmtDay(date)}</span><button className="t-x" onClick={close} aria-label="Close timer">✕</button></div>
      <div className="t-main">
        <div className="t-label" id="t-label">{t.finished ? 'Done' : seg.label}</div>
        <div className="t-clock" aria-live="off">{t.finished ? clock(total) : clock(Math.ceil(t.left / 1000))}</div>
        <div className="t-round">
          {t.finished ? 'Nice work' : works > 1 ? (seg.tone === 'work' ? `Round ${k} of ${works}` : k ? `${k} of ${works} done` : `${works} rounds ahead`) : ''}
        </div>
      </div>
      <div className="t-bar">
        {segs.map((x, j) => (
          <i key={j} style={{ flex: x.sec / total }} className={t.finished || j < t.i ? 'd' : j === t.i ? 'c' : x.tone === 'work' ? 'w' : ''} />
        ))}
      </div>
      <div className="t-info">
        <span>{t.finished ? '' : next ? `Next: ${next.label} ${clock(next.sec)}` : 'Last segment'}</span>
        <span>{t.finished ? '' : `${clock(rest)} left of ${clock(total)}`}</span>
      </div>
      <div className="t-ctrl">
        <button onClick={() => skip(-1)}>Back</button>
        <button className="t-play" onClick={toggle} autoFocus>
          {t.finished ? 'Mark session done' : t.run ? 'Pause' : t.i === 0 && t.left === segs[0].sec * 1000 ? 'Start' : 'Resume'}
        </button>
        <button onClick={() => skip(1)}>Skip</button>
      </div>
    </div>
  );
}
