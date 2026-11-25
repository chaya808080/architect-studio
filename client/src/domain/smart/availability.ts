// Smart booking: proposes meeting slots that fit working hours, don't overlap, leave enough
// travel time between cities - and prefers days when the architect is already in that area.
import type { Db, Meeting } from '../types';
import { addDays, parse, today } from '../dates';
import { meetingConflicts, toMinutes, toTime } from '../rules';
import { distanceKm, travelMinutes } from '../geo';

export interface SlotOption { date: string; from: string; to: string; score: number; reasons: string[] }

export function suggestMeetingSlots(db: Db, opts: { city: string; duration: number; fromDate?: string; days?: number; limit?: number; step?: number }): SlotOption[] {
  const { city, duration, fromDate = addDays(today(), 1), days = 14, limit = 6, step = 30 } = opts;
  const out: SlotOption[] = [];
  for (let d = 0; d < days; d++) {
    const date = addDays(fromDate, d);
    const dow = parse(date).getDay();
    const dayMeetings = db.meetings.filter(m => m.date === date && m.status !== 'בוטל');
    for (const w of db.workingHours.filter(h => h.dayOfWeek === dow)) {
      for (let t = toMinutes(w.from); t + duration <= toMinutes(w.to); t += step) {
        const probe: Meeting = { id: -1, clientId: 0, projectId: null, type: 'פגישת היכרות', date, from: toTime(t), to: toTime(t + duration), city, status: 'מתוכנן', notes: '' };
        if (meetingConflicts(probe, db.meetings, db.workingHours).length) continue;

        let score = 60 - d * 2;
        const reasons: string[] = [];
        const nearby = dayMeetings.filter(m => distanceKm(m.city, city) < 8);
        if (dayMeetings.some(m => m.city === city)) { score += 25; reasons.push(`ביום הזה כבר יש פגישה ב${city}`); }
        else if (nearby.length) { score += 12; reasons.push('ביום הזה יש פגישה באזור קרוב'); }
        const adjacent = dayMeetings.find(m => Math.abs(toMinutes(m.to) - t) <= travelMinutes(m.city, city) + 15 || Math.abs(toMinutes(m.from) - (t + duration)) <= travelMinutes(city, m.city) + 15);
        if (adjacent) { score += 10; reasons.push('נצמד לפגישה קיימת, בלי זמן מת'); }
        if (!dayMeetings.length) reasons.push('יום פנוי');
        if (t >= 16 * 60) { score -= 4; reasons.push('שעת אחר הצהריים'); }
        if (d === 0) reasons.push('המועד הקרוב ביותר');
        out.push({ date, from: toTime(t), to: toTime(t + duration), score, reasons });
      }
    }
  }
  // best per day first, so suggestions are spread over different days
  const bestPerDay = new Map<string, SlotOption>();
  for (const s of out.sort((a, b) => b.score - a.score)) if (!bestPerDay.has(s.date)) bestPerDay.set(s.date, s);
  return [...bestPerDay.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
