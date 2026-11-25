// Lead scoring, project health and cash-flow forecasting - transparent weighted models.
import type { Db, Project, Stage } from '../types';
import { STAGES } from '../types';
import { addDays, addMonths, daysBetween, HEBREW_MONTHS, today } from '../dates';
import { isSigned } from '../rules';

/* ---------------- Lead score ---------------- */
export interface Score { value: number; label: 'חם' | 'פושר' | 'קר'; factors: { label: string; points: number }[] }

const SOURCE_POINTS: Record<string, number> = { 'המלצה': 25, 'אתר הסטודיו': 15, 'אינסטגרם': 10, 'תערוכה': 12, 'גוגל': 8 };

export function leadScore(p: Project, db: Db, now = today()): Score {
  const client = db.clients.find(c => c.id === p.clientId);
  const factors: Score['factors'] = [];
  const perM2 = p.budget / Math.max(1, p.area);
  if (perM2 >= 6000) factors.push({ label: `תקציב גבוה (₪${Math.round(perM2).toLocaleString('he-IL')} למ״ר)`, points: 30 });
  else if (perM2 >= 3500) factors.push({ label: 'תקציב סביר למ״ר', points: 18 });
  else factors.push({ label: 'תקציב נמוך ביחס לשטח', points: 4 });
  if (p.area >= 150) factors.push({ label: `נכס גדול (${p.area} מ״ר)`, points: 15 });
  else if (p.area >= 90) factors.push({ label: 'נכס בינוני', points: 8 });
  if (['בית פרטי', 'פנטהאוז'].includes(p.type)) factors.push({ label: p.type, points: 10 });
  if (client) factors.push({ label: `מקור: ${client.source}`, points: SOURCE_POINTS[client.source] ?? 5 });
  const hadMeeting = db.meetings.some(m => m.clientId === p.clientId && m.status === 'התקיים');
  if (hadMeeting) factors.push({ label: 'התקיימה פגישה', points: 12 });
  const idle = daysBetween(p.stageChangedAt, now);
  if (idle > 21) factors.push({ label: `ללא התקדמות ${idle} ימים`, points: -Math.min(25, Math.round(idle / 3)) });
  const value = Math.max(0, Math.min(100, factors.reduce((s, f) => s + f.points, 0)));
  return { value, label: value >= 65 ? 'חם' : value >= 40 ? 'פושר' : 'קר', factors };
}

/* ---------------- Project health ---------------- */
export interface Health { score: number; status: 'תקין' | 'דורש תשומת לב' | 'בסיכון'; issues: string[]; progress: number; timeProgress: number; budgetVariance: number }

export function projectHealth(p: Project, db: Db, now = today()): Health {
  const tasks = db.tasks.filter(t => t.projectId === p.id);
  const progress = tasks.length ? tasks.filter(t => t.done).length / tasks.length : 0;
  const total = Math.max(1, daysBetween(p.startDate, p.dueDate));
  const timeProgress = Math.min(1, Math.max(0, daysBetween(p.startDate, now) / total));
  const items = db.budgetItems.filter(b => b.projectId === p.id);
  const planned = items.reduce((s, b) => s + b.planned, 0);
  const actual = items.reduce((s, b) => s + b.actual, 0);
  const budgetVariance = planned ? (actual - planned) / planned : 0;
  const issues: string[] = [];
  let score = 100;

  const overdue = tasks.filter(t => !t.done && t.dueDate < now).length;
  if (overdue) { score -= Math.min(30, overdue * 8); issues.push(`${overdue} משימות באיחור`); }
  if (timeProgress - progress > 0.2) { score -= 20; issues.push(`ההתקדמות (${Math.round(progress * 100)}%) מפגרת אחרי הזמן שחלף (${Math.round(timeProgress * 100)}%)`); }
  const over = items.filter(b => b.actual > b.planned * 1.1);
  if (over.length) { score -= Math.min(30, over.length * 10); issues.push(`חריגה בתקציב: ${over.map(b => b.category).join(', ')}`); }
  const late = db.payments.filter(x => x.projectId === p.id && !x.paidDate && x.dueDate < now);
  if (late.length) { score -= 15; issues.push(`${late.length} תשלומים שלא שולמו במועד`); }
  if (p.dueDate < now && p.stage !== 'הושלם') { score -= 15; issues.push('עבר תאריך היעד'); }

  score = Math.max(0, score);
  return { score, status: score >= 75 ? 'תקין' : score >= 50 ? 'דורש תשומת לב' : 'בסיכון', issues, progress, timeProgress, budgetVariance };
}

/* ---------------- Cash flow ---------------- */
export const STAGE_PROBABILITY: Record<Stage, number> = {
  'ליד': 0.1, 'פגישת היכרות': 0.25, 'הצעת מחיר': 0.5, 'נחתם': 1, 'תכנון': 1, 'ביצוע': 1, 'הושלם': 1, 'אבוד': 0,
};

export interface CashMonth { month: string; label: string; contracted: number; pipeline: number; overdue: number }

/**
 * Next N months of expected income: unpaid milestones of signed projects by due date
 * (overdue ones are counted in the current month) + the probability-weighted fee of open deals,
 * spread over the 6 months after their expected signing.
 */
export function cashFlow(db: Db, months = 6, now = today()): CashMonth[] {
  const start = now.slice(0, 8) + '01';
  const buckets: CashMonth[] = Array.from({ length: months }, (_, i) => {
    const m = addMonths(start, i);
    return { month: m.slice(0, 7), label: HEBREW_MONTHS[Number(m.slice(5, 7)) - 1], contracted: 0, pipeline: 0, overdue: 0 };
  });
  const idx = (date: string) => buckets.findIndex(b => b.month === date.slice(0, 7));
  for (const x of db.payments.filter(x => !x.paidDate)) {
    if (x.dueDate < now) buckets[0].overdue += x.amount;
    else { const i = idx(x.dueDate); if (i >= 0) buckets[i].contracted += x.amount; }
  }
  for (const p of db.projects.filter(p => !isSigned(p.stage) && p.stage !== 'אבוד')) {
    const expected = p.fee * STAGE_PROBABILITY[p.stage];
    const signAt = addDays(now, p.stage === 'הצעת מחיר' ? 14 : p.stage === 'פגישת היכרות' ? 35 : 60);
    const first = Math.max(0, idx(signAt));
    for (let i = first; i < months; i++) buckets[i].pipeline += expected / (months - first);
  }
  return buckets.map(b => ({ ...b, contracted: Math.round(b.contracted), pipeline: Math.round(b.pipeline), overdue: Math.round(b.overdue) }));
}

export function pipelineValue(db: Db) {
  const open = db.projects.filter(p => !isSigned(p.stage) && p.stage !== 'אבוד');
  return {
    raw: open.reduce((s, p) => s + p.fee, 0),
    weighted: Math.round(open.reduce((s, p) => s + p.fee * STAGE_PROBABILITY[p.stage], 0)),
    count: open.length,
  };
}

/** Conversion funnel: how many projects ever reached each stage (stage index >= i). */
export function funnel(db: Db) {
  const order: Stage[] = ['ליד', 'פגישת היכרות', 'הצעת מחיר', 'נחתם', 'הושלם'];
  // a lost deal is assumed to have reached the introduction meeting
  const level = (p: Project) => (p.stage === 'אבוד' ? STAGES.indexOf('פגישת היכרות') : STAGES.indexOf(p.stage));
  return order.map(s => ({ stage: s, count: db.projects.filter(p => level(p) >= STAGES.indexOf(s)).length }));
}
