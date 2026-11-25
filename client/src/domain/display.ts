import type { Stage } from './types';

/** Public asset URL (works under the GitHub Pages sub-path too). */
export const img = (name: string) => `${import.meta.env.BASE_URL}img/${name}.jpg`;

export const STAGE_TONE: Record<Stage, string> = {
  'ליד': 'info', 'פגישת היכרות': 'info', 'הצעת מחיר': 'warn', 'נחתם': 'gold', 'תכנון': 'gold', 'ביצוע': 'gold', 'הושלם': 'good', 'אבוד': 'bad',
};

/** Fixed colour per stage - follows the entity, never its rank. */
export const STAGE_COLOR: Record<Stage, string> = {
  'ליד': 'var(--c1)', 'פגישת היכרות': 'var(--c7)', 'הצעת מחיר': 'var(--c4)', 'נחתם': 'var(--c2)', 'תכנון': 'var(--c5)', 'ביצוע': 'var(--c3)', 'הושלם': 'var(--c6)', 'אבוד': 'var(--c8)',
};

export const HEALTH_TONE = { 'תקין': 'good', 'דורש תשומת לב': 'warn', 'בסיכון': 'bad' } as const;

export const pct = (v: number) => `${Math.round(v * 100)}%`;
