import { useState } from 'react';
import { Car, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { selectDb, useAppSelector } from '../store';
import { addDays, formatShort, HEBREW_DAYS, today, weekStart } from '../domain/dates';
import { toMinutes, toTime } from '../domain/rules';
import { travelMinutes } from '../domain/geo';
import { clientName, dayTravel } from '../domain/smart/insights';
import type { Meeting } from '../domain/types';
import { MeetingForm } from './forms';

const START = 8 * 60;
const END = 19 * 60;
const PX = 1.1; // pixels per minute

const TYPE_COLOR: Record<Meeting['type'], string> = {
  'פגישת היכרות': 'var(--c1)', 'פגישת תכנון': 'var(--c7)', 'סיור באתר': 'var(--c3)', 'בחירת חומרים': 'var(--c4)', 'הצגת הדמיות': 'var(--c5)',
};

export default function Calendar() {
  const db = useAppSelector(selectDb);
  const [week, setWeek] = useState(weekStart(today()));
  const [form, setForm] = useState<{ meeting?: Meeting; preset?: Partial<Meeting> } | null>(null);
  const days = [0, 1, 2, 3, 4, 5].map(i => addDays(week, i));
  const hours = Array.from({ length: (END - START) / 60 }, (_, i) => START + i * 60);
  const weekTravel = days.reduce((s, d) => s + dayTravel(db, d), 0);

  return (
    <div className="page" style={{ maxWidth: 'none' }}>
      <div className="page-head">
        <div><h1>יומן פגישות</h1><p>זמני הנסיעה בין הפגישות מחושבים לפי מרחק בין הערים · השבוע: <b>{(weekTravel / 60).toFixed(1)} שעות נסיעה</b></p></div>
        <div className="row">
          <button className="btn icon-btn" onClick={() => setWeek(addDays(week, -7))} aria-label="שבוע קודם"><ChevronRight size={18} /></button>
          <button className="btn" onClick={() => setWeek(weekStart(today()))}>השבוע</button>
          <button className="btn icon-btn" onClick={() => setWeek(addDays(week, 7))} aria-label="שבוע הבא"><ChevronLeft size={18} /></button>
          <b className="num" style={{ marginInline: 8 }}>{formatShort(week)} – {formatShort(addDays(week, 5))}</b>
          <button className="btn btn-gold" onClick={() => setForm({})}><Sparkles size={16} />פגישה במועד חכם</button>
        </div>
      </div>

      <div className="calendar">
        <div className="cal-times">
          <div className="cal-head" />
          {hours.map(h => <div key={h} className="cal-hour num" style={{ height: 60 * PX }}>{toTime(h)}</div>)}
        </div>
        {days.map((date, i) => {
          const ms = db.meetings.filter(m => m.date === date).sort((a, b) => a.from.localeCompare(b.from));
          const live = ms.filter(m => m.status !== 'בוטל');
          const travel = dayTravel(db, date);
          const work = db.workingHours.find(w => w.dayOfWeek === i);
          return (
            <div key={date} className="cal-day">
              <div className={`cal-head ${date === today() ? 'today' : ''}`}>
                {HEBREW_DAYS[i]} <span className="faint num">{formatShort(date)}</span>
                {travel > 0 && <div className="faint" style={{ fontSize: 11 }}><Car size={11} /> {travel} דק׳ נסיעה</div>}
              </div>
              <div className="cal-body" style={{ height: (END - START) * PX }}
                onClick={e => {
                  if (e.target !== e.currentTarget) return;
                  const y = e.nativeEvent.offsetY / PX + START;
                  const from = Math.floor(y / 30) * 30;
                  setForm({ preset: { date, from: toTime(from), to: toTime(from + 60) } });
                }}>
                {work && <>
                  <div className="cal-off" style={{ top: 0, height: Math.max(0, (toMinutes(work.from) - START) * PX) }} />
                  <div className="cal-off" style={{ top: (toMinutes(work.to) - START) * PX, bottom: 0 }} />
                </>}
                {!work && <div className="cal-off" style={{ top: 0, bottom: 0 }} />}
                {live.slice(1).map((m, k) => {
                  const prev = live[k];
                  const gapTop = (toMinutes(prev.to) - START) * PX;
                  const need = travelMinutes(prev.city, m.city);
                  return (
                    <div key={`t${m.id}`} className="cal-travel" style={{ top: gapTop, height: Math.min(need, toMinutes(m.from) - toMinutes(prev.to)) * PX }}>
                      <span><Car size={10} /> {need}′</span>
                    </div>
                  );
                })}
                {ms.map(m => (
                  <button key={m.id} className={`cal-event ${m.status === 'בוטל' ? 'cancelled' : ''}`}
                    style={{ top: (toMinutes(m.from) - START) * PX, height: (toMinutes(m.to) - toMinutes(m.from)) * PX - 2, '--course': TYPE_COLOR[m.type] } as React.CSSProperties}
                    onClick={() => setForm({ meeting: m })}>
                    <b>{clientName(db, m.clientId)}</b>
                    <span>{m.from}–{m.to} · {m.city}</span>
                    <span className="faint">{m.type}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="legend" style={{ marginTop: 12 }}>
        {Object.entries(TYPE_COLOR).map(([t, c]) => <span key={t}><i className="swatch" style={{ background: c }} />{t}</span>)}
        <span><i className="swatch" style={{ background: 'repeating-linear-gradient(45deg, var(--text-3) 0 2px, transparent 2px 4px)' }} />זמן נסיעה</span>
      </div>
      {form && <MeetingForm meeting={form.meeting} preset={form.preset} onClose={() => setForm(null)} />}
    </div>
  );
}
