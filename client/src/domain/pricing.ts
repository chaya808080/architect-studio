// Pricing engine shared by the public cost calculator and the studio's proposal builder.
import type { BudgetCategory, PropertyType } from './types';

export type ServiceLevel = 'תכנון בלבד' | 'תכנון ועיצוב' | 'ליווי מלא';
export type Finish = 'בסיסי' | 'סטנדרט' | 'יוקרתי' | 'פרימיום';

export const VAT = 0.18;

/** Studio fee per m² by property type. */
const FEE_PER_M2: Record<PropertyType, number> = { 'דירה': 180, 'פנטהאוז': 240, 'בית פרטי': 220, 'משרד': 150, 'מסחרי': 170 };
const SERVICE_FACTOR: Record<ServiceLevel, number> = { 'תכנון בלבד': 0.55, 'תכנון ועיצוב': 1, 'ליווי מלא': 1.45 };
const FINISH_FACTOR: Record<Finish, number> = { 'בסיסי': 0.75, 'סטנדרט': 1, 'יוקרתי': 1.45, 'פרימיום': 2.1 };

/** Renovation cost per m² (standard finish), split by category - used for the client budget estimate. */
export const RENOVATION_PER_M2: Record<BudgetCategory, number> = {
  'ריצוף': 420, 'מטבח': 380, 'נגרות': 520, 'תאורה': 210, 'אינסטלציה': 260, 'צבע וגבס': 190, 'ריהוט': 640, 'חיפויים': 230,
};

export interface QuoteLine { label: string; amount: number; note?: string }
export interface Quote { lines: QuoteLine[]; subtotal: number; discount: number; vat: number; total: number; months: number; renovation: Record<BudgetCategory, number>; renovationTotal: number }

export function quote(input: { type: PropertyType; area: number; service: ServiceLevel; finish: Finish; rooms3d: number; discountPct?: number }): Quote {
  const { type, area, service, finish, rooms3d, discountPct = 0 } = input;
  // economies of scale: every m² above 120 costs 25% less
  const effectiveArea = Math.min(area, 120) + Math.max(0, area - 120) * 0.75;
  const design = Math.round(effectiveArea * FEE_PER_M2[type] * SERVICE_FACTOR[service] * (finish === 'פרימיום' ? 1.2 : 1));
  const lines: QuoteLine[] = [
    { label: 'מדידות ותוכנית מצב קיים', amount: Math.round(900 + area * 6) },
    { label: `תכנון ועיצוב (${service})`, amount: design, note: `${area} מ״ר · ${type}` },
  ];
  if (rooms3d > 0) lines.push({ label: `הדמיות תלת-ממד (${rooms3d} חללים)`, amount: rooms3d * 1400 });
  if (service === 'ליווי מלא') lines.push({ label: 'פיקוח עליון וליווי ספקים', amount: Math.round(area * 45) });
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const discount = Math.round(subtotal * discountPct);
  const vat = Math.round((subtotal - discount) * VAT);
  const renovation = Object.fromEntries(
    Object.entries(RENOVATION_PER_M2).map(([k, v]) => [k, Math.round(v * area * FINISH_FACTOR[finish] / 100) * 100]),
  ) as Record<BudgetCategory, number>;
  const months = Math.max(2, Math.round((area / 40) * (service === 'ליווי מלא' ? 1.6 : 1) * (finish === 'פרימיום' ? 1.3 : 1)));
  return {
    lines, subtotal, discount, vat, total: subtotal - discount + vat, months,
    renovation, renovationTotal: Object.values(renovation).reduce((s, v) => s + v, 0),
  };
}

/** Standard payment schedule attached to every proposal. */
export const PAYMENT_PLAN = [
  { label: 'מקדמה בחתימה', percent: 30 },
  { label: 'אישור תוכנית העמדה', percent: 30 },
  { label: 'מסירת תיק עיצוב והדמיות', percent: 25 },
  { label: 'סיום פיקוח ומסירה', percent: 15 },
];

export const shekel = (n: number) => `₪${Math.round(n).toLocaleString('he-IL')}`;
