import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { num } from '../lib/dates';

const svg = (children: ReactNode, sw = 2) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
export const Icon = {
  today: () => svg(<><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M8 2v4M16 2v4M3 10h18M9 15l2 2 4-4" /></>),
  plan: () => svg(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>),
  progress: () => svg(<><path d="M3 3v18h18" /><path d="M7 15l4-5 3 3 5-7" /></>),
  prev: () => svg(<path d="M15 18l-6-6 6-6" />, 2.2),
  next: () => svg(<path d="M9 18l6-6-6-6" />, 2.2),
  guide: () => svg(<><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z" /><path d="M9 9h6M9 13h4" /></>),
  timer: () => svg(<><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></>),
  settings: () => svg(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>, 1.8),
};

/** The WinterArc mark: one arc, its last stretch in red. */
export const Mark = () => (
  <svg className="mark" viewBox="0 0 512 512" aria-hidden="true">
    <rect width="512" height="512" rx="112" fill="#0A0A0B" />
    <g fill="none" strokeWidth="58">
      <path d="M110 330A146 146 0 0 1 338 209" stroke="#F2F2F3" />
      <path d="M357 224A146 146 0 0 1 402 330" stroke="#EF3B50" />
    </g>
  </svg>
);

type NumFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number | undefined;
  onCommit: (v: number | undefined) => void;
  /** Whole numbers only: "10,400" is 10400, not 10.4. */
  integer?: boolean;
};
/** Text input for numbers: keeps what you type ("201.") while committing the parsed value. */
export function NumField({ value, onCommit, onFocus, onBlur, integer, ...rest }: NumFieldProps) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(value == null ? '' : String(value)); }, [value]);
  return (
    <input
      {...rest}
      value={text}
      onFocus={e => { focused.current = true; onFocus?.(e); }}
      onBlur={e => { focused.current = false; setText(value == null ? '' : String(value)); onBlur?.(e); }}
      onChange={e => { setText(e.target.value); onCommit(num(integer ? e.target.value.replace(/\D/g, '') : e.target.value) ?? undefined); }}
    />
  );
}

export function Check({ id, checked, onChange, label }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="check pill" htmlFor={id}>
      <input type="checkbox" id={id} checked={checked} onChange={e => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
