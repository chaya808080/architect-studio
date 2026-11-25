// Invented demo data, generated deterministically relative to "today" so the studio always looks alive.
// Every generated record passes the same business rules the app enforces (tested in seed.test.ts).
import type { Approval, BudgetItem, Client, Db, Inspiration, Meeting, MeetingType, Payment, Project, PropertyType, Stage, Task, WorkingHours } from '../domain/types';
import { CATEGORIES, PHASES, STYLES } from '../domain/types';
import { addDays, addMonths, daysBetween, parse, today } from '../domain/dates';
import { meetingConflicts, toMinutes, toTime } from '../domain/rules';
import { PAYMENT_PLAN, quote } from '../domain/pricing';
import { STYLE_INFO } from '../domain/smart/styleQuiz';
import { CITIES } from '../domain/geo';

function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}

export const PHOTOS: Omit<Inspiration, 'id' | 'likes'>[] = [
  { title: 'מטבח לבן עם אי', style: 'מודרני', room: 'מטבח', image: 'kitchen-white' },
  { title: 'סלון עם ספה כחולה', style: 'סקנדינבי', room: 'סלון', image: 'living-blue' },
  { title: 'מסדרון משרדים', style: 'תעשייתי', room: 'משרד', image: 'office-corridor' },
  { title: 'סלון ירוק ומואר', style: 'כפרי', room: 'סלון', image: 'living-plants' },
  { title: 'חדר שינה מפואר', style: 'קלאסי', room: 'חדר שינה', image: 'bedroom-classic' },
  { title: 'משרד פתוח בגווני עץ', style: 'סקנדינבי', room: 'משרד', image: 'office-scandi' },
  { title: 'חדר רחצה עם ריצוף שחמט', style: 'קלאסי', room: 'חדר רחצה', image: 'bath-checker' },
  { title: 'מטבח שף', style: 'מודרני', room: 'מטבח', image: 'kitchen-cooking' },
  { title: 'סלון פתוח לנוף', style: 'קלאסי', room: 'סלון', image: 'living-bright' },
  { title: 'מטבח עם אי אפור', style: 'מודרני', room: 'מטבח', image: 'kitchen-island' },
  { title: 'ספה כתומה', style: 'מודרני', room: 'ריהוט', image: 'sofa-orange' },
  { title: 'סלון פסטל', style: 'סקנדינבי', room: 'סלון', image: 'living-pastel' },
  { title: 'פינת קריאה צהובה', style: 'מודרני', room: 'פינת ישיבה', image: 'reading-corner' },
  { title: 'סלון קלאסי עם תקרה מעוצבת', style: 'קלאסי', room: 'סלון', image: 'living-classic' },
  { title: 'וילה עם חיפוי עץ', style: 'מודרני', room: 'חזית', image: 'house-wood' },
  { title: 'סלון בגווני אפור', style: 'מודרני', room: 'סלון', image: 'living-gray' },
  { title: 'סלון עם קיר גלריה', style: 'כפרי', room: 'סלון', image: 'living-gallery' },
  { title: 'חלל כפול עם מדרגות', style: 'מודרני', room: 'סלון', image: 'living-stairs' },
  { title: 'בית מודרני בלילה', style: 'מודרני', room: 'חזית', image: 'house-night' },
  { title: 'וילה עם בריכה', style: 'ים תיכוני', room: 'חזית', image: 'villa-pool' },
  { title: 'סלון עם קיר עץ', style: 'תעשייתי', room: 'סלון', image: 'living-wood-wall' },
  { title: 'חדר שינה בוהו', style: 'כפרי', room: 'חדר שינה', image: 'bedroom-boho' },
  { title: 'סלון בגווני שמנת', style: 'ים תיכוני', room: 'סלון', image: 'living-cream' },
  { title: 'פינת אוכל ירוקה', style: 'ים תיכוני', room: 'פינת אוכל', image: 'dining-green' },
  { title: 'סלון חמים', style: 'תעשייתי', room: 'סלון', image: 'living-warm' },
  { title: 'חדר רחצה לבן', style: 'מודרני', room: 'חדר רחצה', image: 'bath-white' },
  { title: 'סלון עם מראות קש', style: 'ים תיכוני', room: 'סלון', image: 'living-mirrors' },
  { title: 'בית כפרי כחול', style: 'כפרי', room: 'חזית', image: 'house-blue' },
  { title: 'בית מודרני כהה', style: 'מודרני', room: 'חזית', image: 'house-modern' },
  { title: 'פטיו מואר', style: 'ים תיכוני', room: 'חוץ', image: 'patio' },
  { title: 'חדר ילדים מעץ', style: 'כפרי', room: 'חדר ילדים', image: 'kids-room' },
];

const MEETING_FOR_STAGE: Partial<Record<Stage, MeetingType[]>> = {
  'ליד': ['פגישת היכרות'], 'פגישת היכרות': ['פגישת היכרות'], 'הצעת מחיר': ['פגישת תכנון'],
  'נחתם': ['סיור באתר'], 'תכנון': ['פגישת תכנון', 'הצגת הדמיות'], 'ביצוע': ['סיור באתר', 'בחירת חומרים'],
};

export function createSeed(): Db {
  const r = rng(424242);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const now = today();

  const workingHours: WorkingHours[] = [0, 1, 2, 3, 4].map(d => ({ id: d + 1, dayOfWeek: d, from: '09:00', to: '18:00' }));
  workingHours.push({ id: 6, dayOfWeek: 5, from: '09:00', to: '13:00' });

  const first = ['מיכל', 'דניאל', 'נועה', 'יוסי', 'שירה', 'אבי', 'רונית', 'עומר', 'תמר', 'אלון', 'הדר', 'גיל', 'מאיה', 'רועי', 'ליאת', 'אורן', 'קרן', 'עידו', 'יעל', 'שחר'];
  const last = ['כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'אברהם', 'פרידמן', 'שפירא', 'דהן', 'קליין', 'אזולאי', 'רוזנברג', 'גולן', 'בר', 'שלום', 'נחום'];
  const cities = Object.keys(CITIES).filter(c => c !== 'חיפה');
  const sources = ['המלצה', 'המלצה', 'אינסטגרם', 'אינסטגרם', 'גוגל', 'אתר הסטודיו', 'תערוכה'] as const;

  const stagePlan: Stage[] = [
    ...Array(6).fill('ליד'), ...Array(5).fill('פגישת היכרות'), ...Array(5).fill('הצעת מחיר'), ...Array(3).fill('נחתם'),
    ...Array(6).fill('תכנון'), ...Array(5).fill('ביצוע'), ...Array(5).fill('הושלם'), ...Array(3).fill('אבוד'),
  ];
  const clients: Client[] = [];
  const projects: Project[] = [];
  const tasks: Task[] = [];
  const budgetItems: BudgetItem[] = [];
  const payments: Payment[] = [];
  const approvals: Approval[] = [];
  const types: PropertyType[] = ['דירה', 'דירה', 'דירה', 'בית פרטי', 'פנטהאוז', 'משרד', 'מסחרי'];

  stagePlan.forEach((stage, i) => {
    const city = pick(cities);
    const createdAt = addDays(now, -(stage === 'הושלם' ? 300 + Math.floor(r() * 200) : ['תכנון', 'ביצוע'].includes(stage) ? 120 + Math.floor(r() * 150) : Math.floor(r() * 90) + 3));
    const c: Client = {
      id: i + 1, firstName: pick(first), lastName: pick(last), phone: `05${i % 9}-${String(2000000 + i * 7919).slice(0, 7)}`,
      email: `client${i + 1}@demo.co.il`, city, source: pick(sources), createdAt, notes: '',
    };
    clients.push(c);

    const type = pick(types);
    const area = type === 'בית פרטי' ? 180 + Math.floor(r() * 140) : type === 'פנטהאוז' ? 140 + Math.floor(r() * 80) : type === 'משרד' ? 90 + Math.floor(r() * 200) : type === 'מסחרי' ? 60 + Math.floor(r() * 120) : 70 + Math.floor(r() * 70);
    const service = r() < 0.4 ? 'ליווי מלא' : 'תכנון ועיצוב';
    const fee = Math.round(quote({ type, area, service, finish: 'סטנדרט', rooms3d: 3 }).subtotal / 500) * 500;
    const style = pick(STYLES);
    const signed = ['נחתם', 'תכנון', 'ביצוע', 'הושלם'].includes(stage);
    const startDate = signed ? addDays(createdAt, 20 + Math.floor(r() * 20)) : addDays(now, 30);
    const months = Math.max(4, Math.round(area / 25));
    const dueDate = stage === 'הושלם' ? addDays(startDate, Math.min(months * 30, daysBetween(startDate, now) - 5)) : addMonths(startDate, months);
    const kind = type === 'משרד' ? 'משרדים' : type === 'מסחרי' ? 'חנות' : type;
    const p: Project = {
      id: i + 1, clientId: c.id, name: `${kind} ${c.lastName} – ${city}`, type, stage, style, city, area,
      budget: Math.round(area * (2800 + r() * 6500) / 1000) * 1000, fee, startDate, dueDate, createdAt,
      stageChangedAt: addDays(now, -Math.floor(r() * (stage === 'ליד' ? 40 : 25))), palette: STYLE_INFO[style].palette, notes: '',
    };
    projects.push(p);
    if (!signed) return;

    // tasks: 2 per phase, spread over the project timeline
    const span = Math.max(30, daysBetween(startDate, dueDate));
    PHASES.forEach((phase, pi) => {
      for (let k = 0; k < 2; k++) {
        const due = addDays(startDate, Math.round(span * ((pi + (k + 1) / 2) / PHASES.length)));
        const done = stage === 'הושלם' || (due < now && r() > 0.12) || (due < addDays(now, 10) && r() < 0.3);
        tasks.push({ id: tasks.length + 1, projectId: p.id, phase, title: TASKS[phase][k], dueDate: due, done });
      }
    });

    // budget: renovation estimate per category, actual spending follows progress (with some overruns)
    const progress = stage === 'הושלם' ? 1 : stage === 'ביצוע' ? 0.6 + r() * 0.3 : stage === 'תכנון' ? 0.15 : 0;
    const est = quote({ type, area, service, finish: 'סטנדרט', rooms3d: 0 }).renovation;
    for (const cat of CATEGORIES.filter(() => r() < 0.8)) {
      const planned = est[cat];
      const actual = Math.round((planned * progress * (r() < 0.2 ? 1.18 + r() * 0.15 : 0.85 + r() * 0.2)) / 100) * 100;
      budgetItems.push({ id: budgetItems.length + 1, projectId: p.id, category: cat, planned, actual });
    }

    PAYMENT_PLAN.forEach((step, k) => {
      const dueDate = addDays(startDate, Math.round(span * [0, 0.3, 0.65, 1][k]));
      const paid = stage === 'הושלם' || (dueDate < now && !(k === 1 && i % 4 === 0));
      payments.push({ id: payments.length + 1, projectId: p.id, label: step.label, percent: step.percent, amount: Math.round(fee * step.percent / 100), dueDate, paidDate: paid ? addDays(dueDate, Math.floor(r() * 6)) : null });
    });

    if (['תכנון', 'ביצוע'].includes(stage)) {
      ['תוכנית העמדה', 'הדמיות סלון ומטבח', 'פרט נגרות מטבח'].forEach((title, k) => {
        if (stage === 'תכנון' && k === 2) return;
        const status = k === 0 ? 'אושר' : stage === 'ביצוע' ? 'אושר' : k === 1 ? (i % 2 ? 'ממתין לאישור' : 'נדרשים שינויים') : 'ממתין לאישור';
        approvals.push({ id: approvals.length + 1, projectId: p.id, title, version: status === 'נדרשים שינויים' ? 2 : 1 + (k % 2), status, comment: status === 'נדרשים שינויים' ? 'אפשר להחליף את גוון החזיתות לעץ בהיר יותר?' : '', date: addDays(now, -(k * 9 + 3)) });
      });
    }
  });

  // meetings: 6 weeks back and 3 ahead, validated with the same conflict + travel rules as the app
  const meetings: Meeting[] = [];
  const active = projects.filter(p => !['הושלם', 'אבוד'].includes(p.stage));
  for (let d = -42; d <= 21; d++) {
    const date = addDays(now, d);
    const dow = parse(date).getDay();
    if (dow === 6) continue;
    const perDay = dow === 5 ? 1 : 1 + Math.floor(r() * 3);
    for (let k = 0; k < perDay; k++) {
      const p = pick(active);
      for (let attempt = 0; attempt < 12; attempt++) {
        const start = toMinutes('09:00') + Math.floor(r() * (dow === 5 ? 6 : 16)) * 30;
        const duration = pick([60, 90, 60]);
        const m: Meeting = {
          id: meetings.length + 1, clientId: p.clientId, projectId: p.id, type: pick(MEETING_FOR_STAGE[p.stage] ?? ['פגישת תכנון']),
          date, from: toTime(start), to: toTime(start + duration), city: p.city,
          status: d < 0 ? (r() < 0.08 ? 'בוטל' : 'התקיים') : 'מתוכנן', notes: '',
        };
        if (!meetingConflicts(m, meetings, workingHours).length) { meetings.push(m); break; }
      }
    }
  }

  const inspirations: Inspiration[] = PHOTOS.map((ph, i) => ({ ...ph, id: i + 1, likes: 8 + Math.floor(r() * 140) }));

  return { clients, projects, tasks, budgetItems, payments, meetings, workingHours, inspirations, approvals };
}

const TASKS: Record<string, [string, string]> = {
  'מדידות': ['מדידות ותיעוד מצב קיים', 'שרטוט תוכנית מצב קיים'],
  'תכנון': ['תוכנית העמדה', 'תוכניות חשמל ותאורה'],
  'עיצוב והדמיות': ['בחירת חומרים וגמרים', 'הדמיות תלת-ממד'],
  'מכרזים': ['הפקת כתב כמויות', 'השוואת הצעות קבלנים'],
  'ביצוע ופיקוח': ['פיקוח עליון – שלב שלד', 'פיקוח עליון – גמרים'],
  'מסירה': ['רשימת ליקויים', 'מסירת הבית ללקוח'],
};
