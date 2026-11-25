// Auto-generated insights for the studio: each one is computed from the data and carries a next action.
import type { Db } from '../types';
import { addDays, daysBetween, today, weekStart } from '../dates';
import { shekel } from '../pricing';
import { travelMinutes, STUDIO_CITY } from '../geo';
import { cashFlow, funnel, leadScore, projectHealth } from './scoring';
import { isSigned } from '../rules';

export interface Insight { tone: 'good' | 'warn' | 'bad' | 'info'; title: string; text: string; action?: { label: string; to: string } }

export function clientName(db: Db, clientId: number) {
  const c = db.clients.find(x => x.id === clientId);
  return c ? `${c.firstName} ${c.lastName}` : '—';
}

/** Total driving minutes of a day's meetings, starting and ending at the studio. */
export function dayTravel(db: Db, date: string): number {
  const ms = db.meetings.filter(m => m.date === date && m.status !== 'בוטל').sort((a, b) => a.from.localeCompare(b.from));
  if (!ms.length) return 0;
  let total = travelMinutes(STUDIO_CITY, ms[0].city);
  for (let i = 1; i < ms.length; i++) total += travelMinutes(ms[i - 1].city, ms[i].city);
  return total + travelMinutes(ms[ms.length - 1].city, STUDIO_CITY);
}

export function insights(db: Db, now = today()): Insight[] {
  const out: Insight[] = [];
  const overdue = db.payments.filter(x => !x.paidDate && x.dueDate < now);
  if (overdue.length) out.push({
    tone: 'bad', title: `${shekel(overdue.reduce((s, x) => s + x.amount, 0))} בפיגור גבייה`,
    text: `${overdue.length} אבני דרך שמועד התשלום שלהן עבר. הוותיקה ביותר באיחור של ${Math.max(...overdue.map(x => daysBetween(x.dueDate, now)))} ימים.`,
    action: { label: 'לכספים', to: '/studio/finance' },
  });

  const risky = db.projects.filter(p => ['נחתם', 'תכנון', 'ביצוע'].includes(p.stage)).map(p => ({ p, h: projectHealth(p, db, now) })).filter(x => x.h.status === 'בסיכון');
  if (risky.length) out.push({
    tone: 'bad', title: `${risky.length} פרויקטים בסיכון`,
    text: `${risky[0].p.name}: ${risky[0].h.issues[0]}.`,
    action: { label: 'לפרויקט', to: `/studio/projects/${risky[0].p.id}` },
  });

  const waiting = db.approvals.filter(a => a.status === 'ממתין לאישור' && daysBetween(a.date, now) > 7);
  if (waiting.length) out.push({
    tone: 'warn', title: `${waiting.length} אישורי עיצוב ממתינים יותר משבוע`,
    text: 'עיכוב באישורים מעכב את כל לוח הזמנים. כדאי לשלוח תזכורת ללקוחות.',
    action: { label: 'לפרויקטים', to: '/studio/projects' },
  });

  const open = db.projects.filter(p => !isSigned(p.stage) && p.stage !== 'אבוד').map(p => ({ p, s: leadScore(p, db, now) }));
  const hot = open.filter(x => x.s.label === 'חם');
  if (hot.length) out.push({
    tone: 'good', title: `${hot.length} לידים חמים`,
    text: `${hot.slice(0, 3).map(x => clientName(db, x.p.clientId)).join(', ')}. כדאי לתעדף אותם השבוע.`,
    action: { label: 'לצנרת המכירות', to: '/studio/pipeline' },
  });
  const stale = open.filter(x => daysBetween(x.p.stageChangedAt, now) > 21);
  if (stale.length) out.push({
    tone: 'warn', title: `${stale.length} לידים תקועים יותר מ-3 שבועות`,
    text: 'בלי מעקב, הסיכוי לסגירה יורד משמעותית. מומלץ ליצור קשר או לסמן כאבוד.',
    action: { label: 'לצנרת המכירות', to: '/studio/pipeline' },
  });

  const over = db.budgetItems.filter(b => b.actual > b.planned * 1.1);
  if (over.length) {
    const sum = over.reduce((s, b) => s + b.actual - b.planned, 0);
    out.push({ tone: 'warn', title: `חריגת תקציב של ${shekel(sum)}`, text: `בעיקר ב${[...new Set(over.map(b => b.category))].slice(0, 3).join(', ')}.`, action: { label: 'לפרויקטים', to: '/studio/projects' } });
  }

  const nextWeek = addDays(weekStart(now), 7);
  const travel = [0, 1, 2, 3, 4].reduce((s, d) => s + dayTravel(db, addDays(nextWeek, d)), 0);
  if (travel > 0) out.push({
    tone: 'info', title: `${(travel / 60).toFixed(1)} שעות נסיעה בשבוע הבא`,
    text: 'קביעת פגישות חדשות דרך "הצעת מועדים חכמה" מצמידה פגישות לפי אזור וחוסכת נסיעות.',
    action: { label: 'ליומן', to: '/studio/calendar' },
  });

  const f = funnel(db);
  const leads = f[0].count || 1;
  const signed = f[3].count;
  out.push({ tone: 'info', title: `יחס המרה: ${Math.round((signed / leads) * 100)}%`, text: `${signed} מתוך ${leads} פניות הגיעו לחתימה. השלב עם הנשירה הגבוהה ביותר: ${worstStep(f)}.`, action: { label: 'לתובנות', to: '/studio/insights' } });

  const cf = cashFlow(db, 3, now);
  out.push({ tone: 'good', title: `${shekel(cf[0].contracted + cf[0].overdue)} צפויים להיכנס החודש`, text: `ועוד ${shekel(cf[1].contracted)} בחודש הבא לפי לוחות התשלומים החתומים.`, action: { label: 'לתזרים', to: '/studio/finance' } });

  const order = { bad: 0, warn: 1, good: 2, info: 3 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}

function worstStep(f: { stage: string; count: number }[]) {
  let worst = '', drop = -1;
  for (let i = 1; i < f.length - 1; i++) {
    const d = 1 - f[i].count / Math.max(1, f[i - 1].count);
    if (d > drop) { drop = d; worst = `${f[i - 1].stage} ← ${f[i].stage}`; }
  }
  return worst;
}
