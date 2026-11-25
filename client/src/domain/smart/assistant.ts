// Hebrew natural-language assistant: intent classification + entity recognition (client names,
// cities, numbers such as "120 מ״ר") answered from live data.
import type { Db, PropertyType } from '../types';
import { daysBetween, formatShort, today } from '../dates';
import { CITIES } from '../geo';
import { isSigned } from '../rules';
import { quote, shekel } from '../pricing';
import { suggestMeetingSlots } from './availability';
import { cashFlow, leadScore, pipelineValue, projectHealth } from './scoring';
import { clientName } from './insights';

export interface Answer { text: string; links?: { label: string; to: string }[] }

export const SUGGESTIONS = [
  'מה המצב הכספי החודש?',
  'מי הלידים החמים?',
  'איזה פרויקט בסיכון?',
  'מתי אפשר לקבוע פגישה בהרצליה?',
  'כמה תעלה דירה של 120 מ״ר?',
  'מה הפגישה הבאה?',
  'מי חייב לנו כסף?',
  'כמה פרויקטים פעילים יש?',
];

const norm = (s: string) => s.replace(/[?!.,״"׳']/g, ' ').replace(/\s+/g, ' ').trim();
const has = (q: string, ...w: string[]) => w.some(x => q.includes(x));

export function ask(question: string, db: Db, now = today()): Answer {
  const q = norm(question);
  if (!q) return { text: 'שאלו אותי על פרויקטים, לידים, פגישות, תשלומים או הערכת מחיר.' };
  const city = Object.keys(CITIES).find(c => q.includes(c));
  const client = db.clients.find(c => q.includes(c.lastName) && (q.includes(c.firstName) || has(q, 'משפחת', 'פרויקט', 'של')));
  const area = Number(/(\d{2,4})\s*(מ|מטר|מר)/.exec(q)?.[1]);

  if (area && has(q, 'עול', 'מחיר', 'יעלה', 'תעלה', 'הצעה', 'כמה')) {
    const type: PropertyType = q.includes('בית') ? 'בית פרטי' : q.includes('פנטהאוז') ? 'פנטהאוז' : q.includes('משרד') ? 'משרד' : 'דירה';
    const service = q.includes('ליווי') ? 'ליווי מלא' : 'תכנון ועיצוב';
    const qt = quote({ type, area, service, finish: 'סטנדרט', rooms3d: 3 });
    return { text: `הערכה ל${type} של ${area} מ״ר (${service}): שכר טרחה ${shekel(qt.subtotal)} + מע״מ = ${shekel(qt.total)}. תקציב שיפוץ משוער ברמת גימור סטנדרט: ${shekel(qt.renovationTotal)}. משך משוער: ${qt.months} חודשים.`, links: [{ label: 'לבניית הצעת מחיר', to: '/studio/proposal' }] };
  }

  if (city && has(q, 'פגישה', 'פנוי', 'לקבוע', 'מתי', 'זמין')) {
    const slots = suggestMeetingSlots(db, { city, duration: 60, limit: 3 });
    return slots.length
      ? { text: `המועדים המומלצים לפגישה ב${city}: ${slots.map(s => `${formatShort(s.date)} ${s.from} (${s.reasons[0]})`).join(' · ')}.`, links: [{ label: 'ליומן', to: '/studio/calendar' }] }
      : { text: `אין מועד פנוי ב${city} בשבועיים הקרובים.` };
  }

  if (client) {
    const projects = db.projects.filter(p => p.clientId === client.id);
    const p = projects[0];
    if (p) {
      const h = isSigned(p.stage) ? projectHealth(p, db, now) : null;
      return { text: `${p.name}: שלב "${p.stage}"${h ? `, התקדמות ${Math.round(h.progress * 100)}%, מצב ${h.status}${h.issues[0] ? ` (${h.issues[0]})` : ''}` : ''}.`, links: [{ label: 'לפרויקט', to: `/studio/projects/${p.id}` }] };
    }
  }

  if (has(q, 'כסף', 'כספי', 'הכנס', 'תזרים', 'גביי')) {
    const cf = cashFlow(db, 2, now);
    const pv = pipelineValue(db);
    return { text: `החודש צפויים להיכנס ${shekel(cf[0].contracted)} לפי לוחות תשלומים, ועוד ${shekel(cf[0].overdue)} בפיגור. בחודש הבא: ${shekel(cf[1].contracted)}. בצנרת המכירות ${pv.count} עסקאות פתוחות בשווי משוקלל של ${shekel(pv.weighted)}.`, links: [{ label: 'לכספים', to: '/studio/finance' }] };
  }

  if (has(q, 'חייב', 'חוב', 'פיגור', 'לא שילם', 'לא שולם')) {
    const late = db.payments.filter(x => !x.paidDate && x.dueDate < now).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    if (!late.length) return { text: 'אין תשלומים בפיגור 🎉' };
    return { text: `תשלומים בפיגור: ${late.slice(0, 4).map(x => { const p = db.projects.find(y => y.id === x.projectId)!; return `${clientName(db, p.clientId)} ${shekel(x.amount)} (${daysBetween(x.dueDate, now)} ימים)`; }).join(' · ')}.`, links: [{ label: 'לכספים', to: '/studio/finance' }] };
  }

  if (has(q, 'ליד', 'חמים', 'פניות')) {
    const hot = db.projects.filter(p => !isSigned(p.stage) && p.stage !== 'אבוד').map(p => ({ p, s: leadScore(p, db, now) })).sort((a, b) => b.s.value - a.s.value).slice(0, 4);
    return { text: `הלידים המובילים: ${hot.map(x => `${clientName(db, x.p.clientId)} (${x.s.value}, ${x.p.type} ${x.p.area} מ״ר)`).join(' · ')}.`, links: [{ label: 'לצנרת המכירות', to: '/studio/pipeline' }] };
  }

  if (has(q, 'סיכון', 'בעיה', 'מאחר', 'חריגה')) {
    const list = db.projects.filter(p => ['נחתם', 'תכנון', 'ביצוע'].includes(p.stage)).map(p => ({ p, h: projectHealth(p, db, now) })).sort((a, b) => a.h.score - b.h.score).slice(0, 3);
    return { text: list.map(x => `${x.p.name}: ${x.h.score} (${x.h.issues[0] ?? 'תקין'})`).join(' · '), links: [{ label: 'לפרויקטים', to: '/studio/projects' }] };
  }

  if (has(q, 'פגישה הבאה', 'הפגישה הבאה', 'פגישות היום', 'היום')) {
    const next = db.meetings.filter(m => m.date >= now && m.status === 'מתוכנן').sort((a, b) => (a.date + a.from).localeCompare(b.date + b.from))[0];
    return next ? { text: `הפגישה הבאה: ${next.type} עם ${clientName(db, next.clientId)}, ${formatShort(next.date)} בשעה ${next.from} ב${next.city}.`, links: [{ label: 'ליומן', to: '/studio/calendar' }] } : { text: 'אין פגישות מתוכננות.' };
  }

  if (has(q, 'כמה') && has(q, 'פרויקט')) {
    const by = (s: string[]) => db.projects.filter(p => s.includes(p.stage)).length;
    return { text: `${by(['נחתם', 'תכנון', 'ביצוע'])} פרויקטים פעילים (${by(['תכנון'])} בתכנון, ${by(['ביצוע'])} בביצוע), ${by(['ליד', 'פגישת היכרות', 'הצעת מחיר'])} בשלבי מכירה ו-${by(['הושלם'])} הושלמו.`, links: [{ label: 'לפרויקטים', to: '/studio/projects' }] };
  }

  return { text: 'לא בטוח שהבנתי 🤔 נסו למשל: ' + SUGGESTIONS.slice(0, 3).join(' / ') };
}
