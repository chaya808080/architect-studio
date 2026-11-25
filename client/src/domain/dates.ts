export const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const HEBREW_MONTHS = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];

/** Local yyyy-mm-dd (never toISOString - that shifts the day across time zones). */
export function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parse(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const today = (): string => iso(new Date());

export function addDays(s: string, days: number): string {
  const d = parse(s);
  d.setDate(d.getDate() + days);
  return iso(d);
}

export function addMonths(s: string, months: number): string {
  const d = parse(s);
  d.setMonth(d.getMonth() + months);
  return iso(d);
}

/** Sunday of the week containing the date (Israeli week). */
export function weekStart(s: string): string {
  return addDays(s, -parse(s).getDay());
}

export const dayName = (s: string): string => HEBREW_DAYS[parse(s).getDay()];

export function ageOn(birth: string, on: string = today()): number {
  const b = parse(birth);
  const o = parse(on);
  let age = o.getFullYear() - b.getFullYear();
  if (o.getMonth() < b.getMonth() || (o.getMonth() === b.getMonth() && o.getDate() < b.getDate())) age--;
  return age;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000);
}

export function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  const d = parse(s);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

export function formatShort(s: string): string {
  const d = parse(s);
  return `${d.getDate()} ${HEBREW_MONTHS[d.getMonth()]}`;
}

export const inRange = (date: string, from: string, to: string | null): boolean => date >= from && date <= (to || from);
