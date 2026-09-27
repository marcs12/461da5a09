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
  timer: () => svg(<><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></>),
  income: () => svg(<><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></>),
  body: () => svg(<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />),
  mind: () => svg(<><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5s1.2 1.5 3.5 1.5 3.5-1.5 3.5-1.5M9 9.5h.01M15 9.5h.01" /></>),
  money: () => svg(<><rect x="2.5" y="6" width="19" height="13" rx="2" /><path d="M2.5 10h19M16 15h2" /></>),
  map: () => svg(<><path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z" /><path d="M9 4v13M15 6.5v13" /></>),
  review: () => svg(<><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 12l2 2 4-4" /></>),
  settings: () => svg(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>, 1.8),
  back: () => svg(<path d="M15 18l-6-6 6-6" />, 2.2),
  phone: () => svg(<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />),
};

/** The Quarter mark: Income, Body, Mind and Money as a ring, one quarter in red. */
export const Mark = () => (
  <svg className="mark" viewBox="0 0 512 512" aria-hidden="true">
    <rect width="512" height="512" rx="112" fill="#0A0A0B" />
    <g fill="none" strokeWidth="58">
      <path d="M270 110A146 146 0 0 1 402 242" stroke="#EF3B50" />
      <path d="M402 270A146 146 0 0 1 270 402" stroke="#F2F2F3" />
      <path d="M242 402A146 146 0 0 1 110 270" stroke="#F2F2F3" />
      <path d="M110 242A146 146 0 0 1 242 110" stroke="#F2F2F3" />
    </g>
  </svg>
);

type NumFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number | undefined;
  onCommit: (v: number | undefined) => void;
};
/** Text input for numbers: keeps what you type ("201.") while committing the parsed value. */
export function NumField({ value, onCommit, onFocus, onBlur, ...rest }: NumFieldProps) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(value == null ? '' : String(value)); }, [value]);
  return (
    <input
      {...rest}
      value={text}
      onFocus={e => { focused.current = true; onFocus?.(e); }}
      onBlur={e => { focused.current = false; setText(value == null ? '' : String(value)); onBlur?.(e); }}
      onChange={e => { setText(e.target.value); onCommit(num(e.target.value) ?? undefined); }}
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
