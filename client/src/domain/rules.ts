// Business rules - mirrored 1:1 by the .NET BL layer (same Hebrew messages).
import type { BudgetItem, Client, Db, Meeting, Payment, Project, Stage, WorkingHours } from './types';
import { STAGES } from './types';
import { parse } from './dates';
import { travelMinutes } from './geo';

export class RuleError extends Error {}
export function require(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RuleError(message);
}

export const isValidPhone = (p: string) => /^0\d{8,9}$/.test(p.replace(/[-\s]/g, ''));
export const isValidEmail = (m: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m.trim());
export const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function validateClient(c: Client) {
  require(c.firstName.trim() && c.lastName.trim(), 'שם פרטי ושם משפחה הם שדות חובה');
  require(isValidPhone(c.phone), 'מספר הטלפון אינו תקין');
  require(isValidEmail(c.email), 'כתובת המייל אינה תקינה');
}

/** Stages from 'נחתם' on represent a signed contract. */
export const isSigned = (s: Stage) => STAGES.indexOf(s) >= STAGES.indexOf('נחתם');

export function validateProject(p: Project, db: Db) {
  require(p.name.trim(), 'שם הפרויקט הוא שדה חובה');
  require(db.clients.some(c => c.id === p.clientId), 'הלקוח שנבחר אינו קיים');
  require(p.area > 0 && p.area <= 5000, 'שטח הנכס חייב להיות בין 1 ל-5,000 מ״ר');
  require(p.fee >= 0 && p.budget >= 0, 'סכומים לא יכולים להיות שליליים');
  require(!p.dueDate || !p.startDate || p.dueDate >= p.startDate, 'תאריך היעד חייב להיות אחרי תאריך ההתחלה');
  if (isSigned(p.stage) && p.stage !== 'הושלם') require(p.fee > 0, 'לפרויקט חתום חייב להיות שכר טרחה');
}

/** A project can't move past 'נחתם' while its payment plan doesn't add up to 100%. */
export function stageProblems(p: Project, to: Stage, db: Db): string[] {
  const problems: string[] = [];
  if (to === 'אבוד' || STAGES.indexOf(to) <= STAGES.indexOf('נחתם')) return problems;
  const plan = db.payments.filter(x => x.projectId === p.id).reduce((s, x) => s + x.percent, 0);
  if (Math.round(plan) !== 100) problems.push(`לוח התשלומים מסתכם ב-${plan}% ולא ב-100%`);
  if (p.fee <= 0) problems.push('לא הוגדר שכר טרחה');
  if (to === 'הושלם' && db.tasks.some(t => t.projectId === p.id && !t.done)) problems.push('יש משימות פתוחות בפרויקט');
  return problems;
}

export function validatePayment(x: Payment, db: Db) {
  require(x.label.trim(), 'יש לתת שם לאבן הדרך');
  require(x.percent > 0 && x.percent <= 100, 'האחוז חייב להיות בין 1 ל-100');
  const others = db.payments.filter(o => o.projectId === x.projectId && o.id !== x.id).reduce((s, o) => s + o.percent, 0);
  require(others + x.percent <= 100, `סך אבני הדרך יעבור את 100% (${others + x.percent}%)`);
}

export function validateBudgetItem(b: BudgetItem) {
  require(b.planned >= 0 && b.actual >= 0, 'סכומי התקציב לא יכולים להיות שליליים');
}

/**
 * Every reason a meeting can't take place in its slot: outside working hours, overlapping
 * another meeting, or not enough travel time from/to the neighbouring meetings that day.
 */
export function meetingConflicts(m: Meeting, meetings: Meeting[], hours: WorkingHours[]): string[] {
  const problems: string[] = [];
  const start = toMinutes(m.from);
  const end = toMinutes(m.to);
  if (end <= start) return ['שעת הסיום חייבת להיות אחרי שעת ההתחלה'];
  const day = parse(m.date).getDay();
  const windows = hours.filter(h => h.dayOfWeek === day);
  if (!windows.some(h => toMinutes(h.from) <= start && toMinutes(h.to) >= end)) problems.push('מחוץ לשעות העבודה של הסטודיו');

  const sameDay = meetings.filter(o => o.id !== m.id && o.date === m.date && o.status !== 'בוטל');
  const overlap = sameDay.find(o => toMinutes(o.from) < end && toMinutes(o.to) > start);
  if (overlap) problems.push(`חופף לפגישה אחרת (${overlap.from}–${overlap.to})`);

  const before = sameDay.filter(o => toMinutes(o.to) <= start).sort((a, b) => toMinutes(b.to) - toMinutes(a.to))[0];
  const after = sameDay.filter(o => toMinutes(o.from) >= end).sort((a, b) => toMinutes(a.from) - toMinutes(b.from))[0];
  if (before) {
    const need = travelMinutes(before.city, m.city);
    if (start - toMinutes(before.to) < need) problems.push(`אין מספיק זמן נסיעה מ${before.city} ל${m.city} (נדרשות ${need} דק׳)`);
  }
  if (after) {
    const need = travelMinutes(m.city, after.city);
    if (toMinutes(after.from) - end < need) problems.push(`אין מספיק זמן נסיעה מ${m.city} ל${after.city} (נדרשות ${need} דק׳)`);
  }
  return problems;
}
