export const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
/** Whole days from b to a (DST-safe). */
export const diff = (a: string, b: string) => Math.round((parse(a).getTime() - parse(b).getTime()) / 864e5);

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WDS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const fmtShort = (s: string) => {
  const d = parse(s);
  return `${MON[d.getMonth()]} ${d.getDate()}`;
};
export const fmtDay = (s: string) => {
  const d = parse(s);
  return `${WDS[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
};
export const today = () => iso(new Date());

export const num = (v: unknown): number | null => {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
export const r1 = (n: number) => Math.round(n * 10) / 10;
export const sgn = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(r1(n)).toFixed(1);
export const fmtMin = (m: number) => (Number.isInteger(m) ? m : m.toFixed(1)) + ' min';
export const clock = (sec: number) => {
  sec = Math.max(0, Math.round(sec));
  return `${Math.floor(sec / 60)}:${pad(sec % 60)}`;
};
export const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
