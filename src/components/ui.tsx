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
};

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
