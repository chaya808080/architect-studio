import { useState } from 'react';
import { CalendarPlus, Check, CircleSlash, FolderPlus, Sparkles, UserPlus } from 'lucide-react';
import type { Client, LeadSource, Meeting, MeetingType, Project, PropertyType, Style } from '../domain/types';
import { STYLES } from '../domain/types';
import { CITIES } from '../domain/geo';
import { isValidEmail, isValidPhone, meetingConflicts, toMinutes, toTime } from '../domain/rules';
import { addMonths, dayName, formatShort, today } from '../domain/dates';
import { quote } from '../domain/pricing';
import { suggestMeetingSlots } from '../domain/smart/availability';
import { create, update } from '../store/dataSlice';
import { selectDb, useAction, useAppSelector } from '../store';
import { Field, Modal } from '../components/ui';

type Draft<T extends { id: number }> = Omit<T, 'id'> & { id?: number };
const CITY_LIST = Object.keys(CITIES);

function Footer({ onClose, saving, label, disabled }: { onClose: () => void; saving: boolean; label: string; disabled?: boolean }) {
  return <>
    <button type="submit" form="entity-form" className="btn btn-gold" disabled={saving || disabled}>{saving ? 'שומר…' : label}</button>
    <button type="button" className="btn btn-ghost" onClick={onClose}>ביטול</button>
  </>;
}

export function ClientForm({ client, onClose }: { client?: Client; onClose: () => void }) {
  const saving = useAppSelector(s => s.data.saving);
  const run = useAction();
  const [d, setD] = useState<Draft<Client>>(client ?? { firstName: '', lastName: '', phone: '', email: '', city: 'תל אביב', source: 'המלצה', createdAt: today(), notes: '' });
  const set = <K extends keyof Draft<Client>>(k: K, v: Draft<Client>[K]) => setD(x => ({ ...x, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = client ? await run(update('clients', { ...(d as Client), id: client.id }), 'פרטי הלקוח עודכנו') : await run(create('clients', d), `${d.firstName} ${d.lastName} נוסף/ה ללקוחות`);
    if (ok) onClose();
  };
  return (
    <Modal title={client ? `עריכת ${client.firstName} ${client.lastName}` : 'לקוח חדש'} icon={<UserPlus size={18} />} onClose={onClose} footer={<Footer onClose={onClose} saving={saving} label="שמירה" />}>
      <form id="entity-form" className="form-grid" onSubmit={submit}>
        <Field label="שם פרטי"><input className="input" required value={d.firstName} onChange={e => set('firstName', e.target.value)} /></Field>
        <Field label="שם משפחה"><input className="input" required value={d.lastName} onChange={e => set('lastName', e.target.value)} /></Field>
        <Field label="טלפון" error={d.phone && !isValidPhone(d.phone) ? 'מספר טלפון לא תקין' : null}><input className="input num" dir="ltr" value={d.phone} onChange={e => set('phone', e.target.value)} /></Field>
        <Field label="מייל" error={d.email && !isValidEmail(d.email) ? 'כתובת מייל לא תקינה' : null}><input className="input" dir="ltr" value={d.email} onChange={e => set('email', e.target.value)} /></Field>
        <Field label="עיר"><select className="select" value={d.city} onChange={e => set('city', e.target.value)}>{CITY_LIST.map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field label="מקור הפנייה"><select className="select" value={d.source} onChange={e => set('source', e.target.value as LeadSource)}>{['המלצה', 'אינסטגרם', 'גוגל', 'אתר הסטודיו', 'תערוכה'].map(s => <option key={s}>{s}</option>)}</select></Field>
        <Field label="הערות" full><textarea className="textarea" rows={2} value={d.notes} onChange={e => set('notes', e.target.value)} /></Field>
      </form>
    </Modal>
  );
}

export function ProjectForm({ project, clientId, onClose }: { project?: Project; clientId?: number; onClose: () => void }) {
  const clients = useAppSelector(s => s.data.clients);
  const saving = useAppSelector(s => s.data.saving);
  const run = useAction();
  const firstClient = clients.find(c => c.id === clientId) ?? clients[0];
  const [d, setD] = useState<Draft<Project>>(project ?? {
    clientId: firstClient?.id ?? 0, name: '', type: 'דירה', stage: 'ליד', style: 'מודרני', city: firstClient?.city ?? 'תל אביב', area: 110,
    budget: 450000, fee: 0, startDate: addMonths(today(), 1), dueDate: addMonths(today(), 7), createdAt: today(), stageChangedAt: today(), palette: [], notes: '',
  });
  const set = <K extends keyof Draft<Project>>(k: K, v: Draft<Project>[K]) => setD(x => ({ ...x, [k]: v }));
  const estimate = quote({ type: d.type, area: d.area, service: 'תכנון ועיצוב', finish: 'סטנדרט', rooms3d: 3 });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const item = { ...d, name: d.name.trim() || `${d.type} ${clients.find(c => c.id === d.clientId)?.lastName ?? ''} – ${d.city}` };
    const ok = project ? await run(update('projects', { ...(item as Project), id: project.id }), 'הפרויקט עודכן') : await run(create('projects', item), 'ליד חדש נוסף לצנרת 🎯');
    if (ok) onClose();
  };
  return (
    <Modal title={project ? `עריכת ${project.name}` : 'ליד / פרויקט חדש'} icon={<FolderPlus size={18} />} onClose={onClose} footer={<Footer onClose={onClose} saving={saving} label="שמירה" />}>
      <form id="entity-form" className="form-grid" onSubmit={submit}>
        <Field label="לקוח"><select className="select" value={d.clientId} onChange={e => { const c = clients.find(x => x.id === Number(e.target.value)); set('clientId', Number(e.target.value)); if (c) set('city', c.city); }}>
          {clients.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}</select></Field>
        <Field label="שם הפרויקט" hint="ריק = שם אוטומטי"><input className="input" value={d.name} onChange={e => set('name', e.target.value)} /></Field>
        <Field label="סוג נכס"><select className="select" value={d.type} onChange={e => set('type', e.target.value as PropertyType)}>{['דירה', 'בית פרטי', 'פנטהאוז', 'משרד', 'מסחרי'].map(t => <option key={t}>{t}</option>)}</select></Field>
        <Field label="סגנון"><select className="select" value={d.style} onChange={e => set('style', e.target.value as Style)}>{STYLES.map(s => <option key={s}>{s}</option>)}</select></Field>
        <Field label="שטח (מ״ר)"><input className="input num" type="number" min={1} value={d.area} onChange={e => set('area', Number(e.target.value))} /></Field>
        <Field label="עיר"><select className="select" value={d.city} onChange={e => set('city', e.target.value)}>{CITY_LIST.map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field label="תקציב שיפוץ של הלקוח (₪)" hint={`הערכה לגימור סטנדרט: ₪${estimate.renovationTotal.toLocaleString('he-IL')}`}><input className="input num" type="number" min={0} step={10000} value={d.budget} onChange={e => set('budget', Number(e.target.value))} /></Field>
        <Field label="שכר טרחה (₪)" hint={`מחשבון: ₪${estimate.subtotal.toLocaleString('he-IL')}`}><input className="input num" type="number" min={0} step={500} value={d.fee} onChange={e => set('fee', Number(e.target.value))} /></Field>
        <Field label="הערות" full><textarea className="textarea" rows={2} value={d.notes} onChange={e => set('notes', e.target.value)} /></Field>
      </form>
    </Modal>
  );
}

export function MeetingForm({ meeting, preset, onClose }: { meeting?: Meeting; preset?: Partial<Meeting>; onClose: () => void }) {
  const db = useAppSelector(selectDb);
  const saving = useAppSelector(s => s.data.saving);
  const run = useAction();
  const first = db.projects.find(p => !['הושלם', 'אבוד'].includes(p.stage));
  const [d, setD] = useState<Draft<Meeting>>(meeting ?? {
    clientId: first?.clientId ?? 0, projectId: first?.id ?? null, type: 'פגישת היכרות', date: today(), from: '10:00', to: '11:00',
    city: first?.city ?? 'תל אביב', status: 'מתוכנן', notes: '', ...preset,
  });
  const set = <K extends keyof Draft<Meeting>>(k: K, v: Draft<Meeting>[K]) => setD(x => ({ ...x, [k]: v }));
  const duration = toMinutes(d.to) - toMinutes(d.from);
  const problems = meetingConflicts({ ...(d as Meeting), id: meeting?.id ?? -1 }, db.meetings, db.workingHours);
  const suggestions = suggestMeetingSlots(db, { city: d.city, duration: Math.max(30, duration), limit: 4 });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = meeting ? await run(update('meetings', { ...(d as Meeting), id: meeting.id }), 'הפגישה עודכנה') : await run(create('meetings', d), 'הפגישה נקבעה ✓');
    if (ok) onClose();
  };

  return (
    <Modal title={meeting ? 'עריכת פגישה' : 'פגישה חדשה'} icon={<CalendarPlus size={18} />} onClose={onClose} wide footer={<Footer onClose={onClose} saving={saving} label="שמירה" disabled={problems.length > 0 && d.status !== 'בוטל'} />}>
      <form id="entity-form" className="form-grid" onSubmit={submit}>
        <Field label="פרויקט / לקוח">
          <select className="select" value={d.projectId ?? ''} onChange={e => { const p = db.projects.find(x => x.id === Number(e.target.value)); if (p) setD(x => ({ ...x, projectId: p.id, clientId: p.clientId, city: p.city })); }}>
            {db.projects.filter(p => p.stage !== 'אבוד').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="סוג פגישה"><select className="select" value={d.type} onChange={e => set('type', e.target.value as MeetingType)}>{['פגישת היכרות', 'פגישת תכנון', 'סיור באתר', 'בחירת חומרים', 'הצגת הדמיות'].map(t => <option key={t}>{t}</option>)}</select></Field>
        <Field label="תאריך"><input className="input" type="date" value={d.date} onChange={e => set('date', e.target.value)} /></Field>
        <Field label="עיר"><select className="select" value={d.city} onChange={e => set('city', e.target.value)}>{CITY_LIST.map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field label="משעה"><input className="input num" type="time" step={1800} value={d.from} onChange={e => { const len = duration > 0 ? duration : 60; setD(x => ({ ...x, from: e.target.value, to: toTime(toMinutes(e.target.value) + len) })); }} /></Field>
        <Field label="עד שעה"><input className="input num" type="time" step={1800} value={d.to} onChange={e => set('to', e.target.value)} /></Field>
        {meeting && <Field label="סטטוס"><select className="select" value={d.status} onChange={e => set('status', e.target.value as Meeting['status'])}><option>מתוכנן</option><option>התקיים</option><option>בוטל</option></select></Field>}
      </form>
      <div style={{ marginTop: 16 }}>
        <div className="row faint" style={{ fontSize: 13, marginBottom: 8 }}><Sparkles size={14} />מועדים מומלצים ב{d.city} (לפי זמני נסיעה ופגישות קיימות)</div>
        <div className="grid cols-2" style={{ gap: 8 }}>
          {suggestions.map(s => (
            <button key={s.date + s.from} type="button" className={`suggest-chip ${d.date === s.date && d.from === s.from ? 'active' : ''}`} onClick={() => setD(x => ({ ...x, date: s.date, from: s.from, to: s.to }))}>
              <span className="row"><b>יום {dayName(s.date)} {formatShort(s.date)} · {s.from}</b><span className="spacer" /><span className="score num">{s.score}</span></span>
              <span className="faint" style={{ fontSize: 12 }}>{s.reasons[0]}</span>
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        {problems.length && d.status !== 'בוטל'
          ? <div className="stack" style={{ gap: 8 }}>{problems.map(p => <div key={p} className="alert bad"><CircleSlash size={16} />{p}</div>)}</div>
          : <div className="alert good"><Check size={16} />המועד פנוי, כולל זמן נסיעה מהפגישה הקודמת ואל הפגישה הבאה</div>}
      </div>
    </Modal>
  );
}
