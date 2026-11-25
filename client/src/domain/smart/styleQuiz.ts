// Style quiz: every answer adds weights to design styles; the result is a normalised style profile.
import type { Style } from '../types';
import { STYLES } from '../types';

export interface QuizOption { label: string; image?: string; weights: Partial<Record<Style, number>> }
export interface QuizQuestion { q: string; options: QuizOption[] }

export const QUIZ: QuizQuestion[] = [
  {
    q: 'איזה סלון הכי מדבר אליכם?',
    options: [
      { label: 'נקי ומינימליסטי', image: 'living-gray', weights: { 'מודרני': 3, 'סקנדינבי': 1 } },
      { label: 'בהיר, עץ וטקסטיל רך', image: 'living-pastel', weights: { 'סקנדינבי': 3, 'ים תיכוני': 1 } },
      { label: 'חמים עם עץ ובטון', image: 'living-warm', weights: { 'תעשייתי': 3, 'מודרני': 1 } },
      { label: 'מפואר עם פרטים', image: 'living-classic', weights: { 'קלאסי': 3 } },
    ],
  },
  {
    q: 'בחרו מטבח',
    options: [
      { label: 'לבן ונקי', image: 'kitchen-white', weights: { 'מודרני': 2, 'סקנדינבי': 2 } },
      { label: 'אי גדול ומרשים', image: 'kitchen-island', weights: { 'מודרני': 2, 'קלאסי': 1 } },
      { label: 'מטבח שף חי ושמח', image: 'kitchen-cooking', weights: { 'ים תיכוני': 2, 'כפרי': 2 } },
    ],
  },
  {
    q: 'איזה חדר שינה הייתם רוצים?',
    options: [
      { label: 'מלון בוטיק', image: 'bedroom-classic', weights: { 'קלאסי': 3 } },
      { label: 'בוהו ירוק', image: 'bedroom-boho', weights: { 'כפרי': 3, 'ים תיכוני': 1 } },
      { label: 'כפרי ועץ', image: 'kids-room', weights: { 'כפרי': 2, 'סקנדינבי': 1 } },
    ],
  },
  {
    q: 'מה הצבעים שלכם?',
    options: [
      { label: 'לבן, אפור ושחור', weights: { 'מודרני': 2, 'תעשייתי': 1 } },
      { label: 'שמנת, בז׳ ועץ בהיר', weights: { 'סקנדינבי': 2, 'ים תיכוני': 1 } },
      { label: 'ירוק זית, טרקוטה וחום', weights: { 'כפרי': 2, 'ים תיכוני': 2 } },
      { label: 'כחול עמוק וזהב', weights: { 'קלאסי': 2 } },
    ],
  },
  {
    q: 'מה הכי חשוב לכם בבית?',
    options: [
      { label: 'שקט וסדר', weights: { 'מודרני': 2, 'סקנדינבי': 1 } },
      { label: 'אווירה ונעימות', weights: { 'כפרי': 2, 'סקנדינבי': 1 } },
      { label: 'אופי וייחודיות', weights: { 'תעשייתי': 2, 'ים תיכוני': 1 } },
      { label: 'יוקרה ואירוח', weights: { 'קלאסי': 2, 'מודרני': 1 } },
    ],
  },
];

export const STYLE_INFO: Record<Style, { text: string; palette: string[] }> = {
  'מודרני': { text: 'קווים נקיים, משטחים חלקים ותאורה מדויקת. פחות זה יותר.', palette: ['#f2f1ee', '#c9c6c0', '#5b5a57', '#1f1f1f', '#b08d57'] },
  'סקנדינבי': { text: 'אור טבעי, עץ בהיר וטקסטיל רך. פונקציונלי, נעים ומזמין.', palette: ['#f7f4ee', '#e4dccf', '#c8b79e', '#8a9a8b', '#3e4a4f'] },
  'כפרי': { text: 'חומרים טבעיים, עץ ממוחזר וצמחייה. בית חם עם סיפור.', palette: ['#efe6d6', '#c9a77c', '#8b6b4a', '#6f8f5e', '#3f3428'] },
  'קלאסי': { text: 'פרופילים, סימטריה ובדים עשירים. אלגנטיות על-זמנית.', palette: ['#f6f1e7', '#d8c3a5', '#8e7a5c', '#2f3b52', '#b8975a'] },
  'תעשייתי': { text: 'בטון, ברזל ועץ גולמי. חללים פתוחים עם אופי של לופט.', palette: ['#d9d6d1', '#9a958d', '#5c5650', '#2b2a28', '#a8643c'] },
  'ים תיכוני': { text: 'קשתות, טקסטורות טבעיות וצבעי חול ושמש. רגוע ואוורירי.', palette: ['#f8f3ea', '#e8d5b7', '#c98b5e', '#7c9a8a', '#3b5b6b'] },
};

export function scoreQuiz(answers: number[]): { style: Style; pct: number }[] {
  const totals = Object.fromEntries(STYLES.map(s => [s, 0])) as Record<Style, number>;
  answers.forEach((a, qi) => {
    const opt = QUIZ[qi]?.options[a];
    if (opt) for (const [s, w] of Object.entries(opt.weights)) totals[s as Style] += w!;
  });
  const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  return STYLES.map(s => ({ style: s, pct: Math.round((totals[s] / sum) * 100) })).sort((a, b) => b.pct - a.pct);
}
