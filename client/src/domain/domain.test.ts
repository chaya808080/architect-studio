import { describe, expect, it } from 'vitest';
import { createSeed } from '../api/seed';
import { addDays, today, weekStart } from './dates';
import { meetingConflicts, stageProblems, validatePayment, validateProject, RuleError } from './rules';
import { travelMinutes, distanceKm } from './geo';
import { quote, PAYMENT_PLAN } from './pricing';
import { suggestMeetingSlots } from './smart/availability';
import { cashFlow, funnel, leadScore, pipelineValue, projectHealth } from './smart/scoring';
import { colorName, contrast, kMeans, rule603010, toHex, type RGB } from './smart/palette';
import { estimate } from './smart/materials';
import { analyze, autoLayout, gap } from './smart/planner';
import { QUIZ, scoreQuiz } from './smart/styleQuiz';
import { ask } from './smart/assistant';
import { insights } from './smart/insights';
import type { Meeting } from './types';

const db = createSeed();
const sunday = addDays(weekStart(today()), 7);

describe('geo', () => {
  it('Tel Aviv - Jerusalem is about 55 km', () => expect(distanceKm('תל אביב', 'ירושלים')).toBeGreaterThan(50));
  it('same city needs a 15 minute buffer, far cities need more', () => {
    expect(travelMinutes('רמת גן', 'רמת גן')).toBe(15);
    expect(travelMinutes('רמת גן', 'ירושלים')).toBeGreaterThan(travelMinutes('רמת גן', 'גבעתיים'));
  });
});

describe('meeting rules', () => {
  const base: Meeting = { id: 1, clientId: 1, projectId: null, type: 'פגישת היכרות', date: sunday, from: '10:00', to: '11:00', city: 'תל אביב', status: 'מתוכנן', notes: '' };
  it('accepts a free slot in working hours', () => expect(meetingConflicts(base, [], db.workingHours)).toEqual([]));
  it('rejects outside working hours and on Saturday', () => {
    expect(meetingConflicts({ ...base, from: '19:00', to: '20:00' }, [], db.workingHours)).toContain('מחוץ לשעות העבודה של הסטודיו');
    expect(meetingConflicts({ ...base, date: addDays(sunday, 6) }, [], db.workingHours)).toContain('מחוץ לשעות העבודה של הסטודיו');
  });
  it('detects overlap and missing travel time', () => {
    expect(meetingConflicts({ ...base, id: 2, from: '10:30', to: '11:30' }, [base], db.workingHours)[0]).toMatch(/חופף/);
    const jlm = { ...base, id: 2, from: '11:15', to: '12:00', city: 'ירושלים' };
    expect(meetingConflicts(jlm, [base], db.workingHours)[0]).toMatch(/זמן נסיעה/);
  });
});

describe('seed integrity', () => {
  it('no seeded meeting breaks the scheduling rules', () => {
    for (const m of db.meetings.filter(x => x.status !== 'בוטל')) expect(meetingConflicts(m, db.meetings, db.workingHours)).toEqual([]);
  });
  it('every signed project has a 100% payment plan and valid data', () => {
    for (const p of db.projects) {
      expect(() => validateProject(p, db)).not.toThrow();
      if (['נחתם', 'תכנון', 'ביצוע', 'הושלם'].includes(p.stage)) expect(db.payments.filter(x => x.projectId === p.id).reduce((s, x) => s + x.percent, 0)).toBe(100);
    }
  });
});

describe('stage & payment rules', () => {
  it('blocks moving a lead to planning without a payment plan', () => {
    const lead = db.projects.find(p => p.stage === 'ליד')!;
    expect(stageProblems(lead, 'תכנון', db)[0]).toMatch(/לוח התשלומים/);
    expect(stageProblems(lead, 'פגישת היכרות', db)).toEqual([]);
  });
  it('payment milestones can not exceed 100%', () => {
    const signed = db.projects.find(p => p.stage === 'תכנון')!;
    expect(() => validatePayment({ id: 0, projectId: signed.id, label: 'נוסף', percent: 10, amount: 1, dueDate: today(), paidDate: null }, db)).toThrow(RuleError);
  });
});

describe('pricing', () => {
  it('bigger area costs more, but with economies of scale', () => {
    const a = quote({ type: 'דירה', area: 100, service: 'תכנון ועיצוב', finish: 'סטנדרט', rooms3d: 0 });
    const b = quote({ type: 'דירה', area: 200, service: 'תכנון ועיצוב', finish: 'סטנדרט', rooms3d: 0 });
    expect(b.subtotal).toBeGreaterThan(a.subtotal);
    expect(b.subtotal).toBeLessThan(a.subtotal * 2);
  });
  it('adds 18% VAT and the standard plan sums to 100%', () => {
    const q = quote({ type: 'בית פרטי', area: 180, service: 'ליווי מלא', finish: 'יוקרתי', rooms3d: 4, discountPct: 0.05 });
    expect(q.vat).toBe(Math.round((q.subtotal - q.discount) * 0.18));
    expect(PAYMENT_PLAN.reduce((s, x) => s + x.percent, 0)).toBe(100);
  });
});

describe('smart availability', () => {
  it('every suggested slot is conflict-free, at most one per day', () => {
    const slots = suggestMeetingSlots(db, { city: 'הרצליה', duration: 60, limit: 6 });
    expect(slots.length).toBeGreaterThan(0);
    expect(new Set(slots.map(s => s.date)).size).toBe(slots.length);
    for (const s of slots) {
      const m: Meeting = { id: -1, clientId: 1, projectId: null, type: 'פגישת היכרות', date: s.date, from: s.from, to: s.to, city: 'הרצליה', status: 'מתוכנן', notes: '' };
      expect(meetingConflicts(m, db.meetings, db.workingHours)).toEqual([]);
    }
  });
});

describe('scoring', () => {
  it('lead scores are bounded and explained', () => {
    for (const p of db.projects.filter(x => x.stage === 'ליד')) {
      const s = leadScore(p, db);
      expect(s.value).toBeGreaterThanOrEqual(0);
      expect(s.value).toBeLessThanOrEqual(100);
      expect(s.factors.length).toBeGreaterThan(0);
    }
  });
  it('health flags overdue payments', () => {
    const late = db.payments.find(x => !x.paidDate && x.dueDate < today());
    if (late) expect(projectHealth(db.projects.find(p => p.id === late.projectId)!, db).issues.join()).toMatch(/תשלומים/);
  });
  it('funnel is monotonically decreasing and pipeline weighted < raw', () => {
    const f = funnel(db);
    for (let i = 1; i < f.length; i++) expect(f[i].count).toBeLessThanOrEqual(f[i - 1].count);
    const pv = pipelineValue(db);
    expect(pv.weighted).toBeLessThan(pv.raw);
    expect(cashFlow(db, 6)).toHaveLength(6);
  });
});

describe('palette', () => {
  it('k-means finds the two colours of a two-colour image', () => {
    const px: RGB[] = [...Array(300).fill([240, 240, 235]), ...Array(100).fill([30, 60, 120])];
    const res = kMeans(px, 3);
    expect(toHex(res[0].color)).toBe('#f0f0eb');
    expect(res[0].share).toBeCloseTo(0.75, 1);
    expect(colorName([30, 60, 120])).toBe('כחול');
  });
  it('contrast & 60-30-10', () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21);
    expect(rule603010([[250, 250, 250], [120, 110, 100], [200, 80, 40]]).map(r => r.pct)).toEqual([60, 30, 10]);
  });
});

describe('materials & planner', () => {
  it('estimates paint and tiles', () => {
    const e = estimate({ length: 5, width: 4, height: 2.7, doors: 1, windows: 2 }, { tileCm: 60, tilesPerBox: 4, diagonal: false, ceiling: true });
    expect(e.floorArea).toBe(20);
    expect(e.floorM2).toBe(22);
    expect(e.tiles).toBe(Math.ceil(22 / 0.36));
    expect(e.paintLiters).toBeGreaterThan(10);
  });
  it('auto layout produces no collisions and stays in the room', () => {
    for (const kind of ['סלון', 'חדר שינה', 'משרד ביתי', 'פינת אוכל'] as const) {
      const res = analyze(autoLayout(kind, 500, 420), 500, 420);
      expect(res.issues.filter(i => i.level === 'error')).toEqual([]);
    }
  });
  it('gap between rectangles', () => expect(gap({ x: 0, y: 0, w: 10, h: 10 }, { x: 40, y: 0, w: 10, h: 10 })).toBe(30));
});

describe('style quiz, assistant, insights', () => {
  it('quiz percentages sum to ~100 and the top style matches the answers', () => {
    const res = scoreQuiz(QUIZ.map((_, i) => (i === 0 ? 3 : i === 1 ? 1 : i === 2 ? 0 : i === 3 ? 3 : 3)));
    expect(res[0].style).toBe('קלאסי');
    expect(res.reduce((s, r) => s + r.pct, 0)).toBeGreaterThanOrEqual(98);
  });
  it('assistant estimates a price and finds slots', () => {
    expect(ask('כמה תעלה דירה של 120 מ״ר?', db).text).toMatch(/₪/);
    expect(ask('מתי אפשר לקבוע פגישה בהרצליה?', db).text).toMatch(/הרצליה/);
    expect(ask('מי הלידים החמים?', db).links?.[0].to).toBe('/studio/pipeline');
  });
  it('insights are produced with actions', () => {
    const list = insights(db);
    expect(list.length).toBeGreaterThan(3);
    expect(list.every(i => i.action)).toBe(true);
  });
});
