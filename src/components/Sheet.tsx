import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A bottom sheet on phones, a centred dialog on wider screens. Escape or a tap
 * outside closes it. Focus moves into the sheet on open, stays inside while
 * tabbing, and returns to where it was on close.
 */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current!;
    if (!el.contains(document.activeElement)) el.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
      if (e.key !== 'Tab') return;
      const f = [...el.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')];
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    const body = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = body; prev?.focus?.(); };
  }, []);
  return (
    <div className="sheet-back" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        {children}
      </div>
    </div>
  );
}
