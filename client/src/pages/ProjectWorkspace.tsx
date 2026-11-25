import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Check, CheckCircle2, Circle, FileSignature, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { selectDb, useAction, useAppDispatch, useAppSelector } from '../store';
import { create, remove, update } from '../store/dataSlice';
import { pushToast } from '../store/uiSlice';
import type { BudgetCategory, Phase, Project, Stage } from '../domain/types';
import { CATEGORIES, PHASES, STAGES } from '../domain/types';
import { addDays, daysBetween, formatDate, formatShort, parse, today } from '../domain/dates';
import { shekel } from '../domain/pricing';
import { HEALTH_TONE, img, STAGE_TONE } from '../domain/display';
import { isSigned, stageProblems } from '../domain/rules';
import { projectHealth } from '../domain/smart/scoring';
import { colorName, fromHex } from '../domain/smart/palette';
import { Empty, Field, Modal, Tabs, useConfirm } from '../components/ui';
import { coverOf, HealthRing } from './Projects';
import { MeetingForm, ProjectForm } from './forms';

type Tab = 'overview' | 'tasks' | 'budget' | 'payments' | 'approvals' | 'meetings';

function Gantt({ project }: { project: Project }) {
  const db = useAppSelector(selectDb);
  const tasks = db.tasks.filter(t => t.projectId === project.id);
  const start = project.startDate;
  const total = Math.max(30, daysBetween(start, project.dueDate));
  const pos = (d: string) => Math.min(100, Math.max(0, (daysBetween(start, d) / total) * 100));
  let prevEnd = start;
  const rows = PHASES.map(phase => {
    const ts = tasks.filter(t => t.phase === phase);
    const end = ts.reduce((m, t) => (t.dueDate > m ? t.dueDate : m), prevEnd);
    const row = { phase, from: prevEnd, to: end, done: ts.filter(t => t.done).length, total: ts.length };
    prevEnd = end;
    return row;
  });
  const now = today();
  return (
    <div className="gantt">
      {rows.map(r => {
        const late = r.to < now && r.done < r.total;
        return (
          <div key={r.phase} className="gantt-row">
            <span className="gantt-label">{r.phase}</span>
            <div className="gantt-track">
              <div className={`gantt-bar ${late ? 'late' : ''}`} style={{ right: `${pos(r.from)}%`, width: `${Math.max(2, pos(r.to) - pos(r.from))}%` }}
                title={`${formatShort(r.from)} – ${formatShort(r.to)} · ${r.done}/${r.total} משימות`}>
                <div className="gantt-fill" style={{ width: `${r.total ? (r.done / r.total) * 100 : 0}%` }} />
              </div>
              {now >= start && now <= project.dueDate && <div className="gantt-today" style={{ right: `${pos(now)}%` }} />}
            </div>
            <span className="faint num" style={{ fontSize: 12, width: 44 }}>{r.done}/{r.total}</span>
          </div>
        );
      })}
      <div className="row faint" style={{ fontSize: 11, justifyContent: 'space-between', paddingInlineStart: 120 }}>
        <span>{formatDate(start)}</span><span>היום</span><span>{formatDate(project.dueDate)}</span>
      </div>
    </div>
  );
}

function BudgetModal({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const run = useAction();
  const [b, setB] = useState({ category: 'ריצוף' as BudgetCategory, planned: 20000, actual: 0 });
  return (
    <Modal title="סעיף תקציב" onClose={onClose} footer={<><button className="btn btn-gold" onClick={async () => { if (await run(create('budgetItems', { ...b, projectId }), 'הסעיף נוסף')) onClose(); }}>הוספה</button><button className="btn btn-ghost" onClick={onClose}>ביטול</button></>}>
      <div className="form-grid">
        <Field label="קטגוריה"><select className="select" value={b.category} onChange={e => setB({ ...b, category: e.target.value as BudgetCategory })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field label="מתוכנן (₪)"><input className="input num" type="number" value={b.planned} onChange={e => setB({ ...b, planned: Number(e.target.value) })} /></Field>
        <Field label="בפועל (₪)"><input className="input num" type="number" value={b.actual} onChange={e => setB({ ...b, actual: Number(e.target.value) })} /></Field>
      </div>
    </Modal>
  );
}

export default function ProjectWorkspace() {
  const id = Number(useParams().id);
  const db = useAppSelector(selectDb);
  const status = useAppSelector(s => s.data.status);
  const run = useAction();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [confirm, dialog] = useConfirm();
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);
  const [addingBudget, setAddingBudget] = useState(false);
  const [meeting, setMeeting] = useState(false);
  const [newTask, setNewTask] = useState<{ phase: Phase; title: string }>({ phase: 'תכנון', title: '' });
  const p = db.projects.find(x => x.id === id);
  const health = useMemo(() => (p ? projectHealth(p, db) : null), [p, db]);
  if (status !== 'ready') return <div className="page" />;
  if (!p || !health) return <div className="page"><Empty title="הפרויקט לא נמצא" action={<Link className="btn" to="/studio/projects">לכל הפרויקטים</Link>} /></div>;

  const client = db.clients.find(c => c.id === p.clientId)!;
  const tasks = db.tasks.filter(t => t.projectId === p.id);
  const budget = db.budgetItems.filter(b => b.projectId === p.id);
  const payments = db.payments.filter(x => x.projectId === p.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const approvals = db.approvals.filter(a => a.projectId === p.id).sort((a, b) => b.date.localeCompare(a.date));
  const meetings = db.meetings.filter(m => m.projectId === p.id).sort((a, b) => (b.date + b.from).localeCompare(a.date + a.from));
  const planned = budget.reduce((s, b) => s + b.planned, 0);
  const actual = budget.reduce((s, b) => s + b.actual, 0);
  const paid = payments.filter(x => x.paidDate).reduce((s, x) => s + x.amount, 0);
  const now = today();

  const changeStage = async (to: Stage) => {
    if (to === 'נחתם' && !isSigned(p.stage)) { navigate(`/studio/proposal?project=${p.id}`); return; }
    const problems = stageProblems(p, to, db);
    if (problems.length) { dispatch(pushToast('error', problems[0])); return; }
    await run(update('projects', { ...p, stage: to }), `השלב עודכן ל"${to}"`);
  };

  return (
    <div className="page">
      <Link to="/studio/projects" className="btn btn-ghost btn-sm" style={{ marginBottom: 14 }}><ArrowRight size={16} />כל הפרויקטים</Link>
      <div className="card workspace-hero" style={{ backgroundImage: `linear-gradient(90deg, transparent, var(--surface-solid) 62%), url(${img(coverOf(p.style, p.id))})` }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="row wrap"><span className={`badge ${STAGE_TONE[p.stage]}`}>{p.stage}</span><span className="badge">{p.style}</span><span className="badge">{p.type} · {p.area} מ״ר</span></div>
          <h1 style={{ marginTop: 10 }}>{p.name}</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>{client.firstName} {client.lastName} · <span className="ltr num">{client.phone}</span> · {p.city}</p>
          <div className="row wrap" style={{ marginTop: 14 }}>
            <select className="select" style={{ width: 170 }} value={p.stage} onChange={e => changeStage(e.target.value as Stage)}>
              {[...STAGES, 'אבוד' as Stage].map(s => <option key={s}>{s}</option>)}
            </select>
            <button className="btn" onClick={() => setEditing(true)}><Pencil size={15} />עריכה</button>
            {!isSigned(p.stage) && <Link to={`/studio/proposal?project=${p.id}`} className="btn btn-gold"><FileSignature size={15} />הצעת מחיר</Link>}
            <button className="btn btn-danger icon-btn" aria-label="מחיקה" onClick={async () => { if (await confirm(`למחוק את ${p.name} וכל הנתונים שלו?`)) { if (await run(remove('projects', p.id), 'הפרויקט נמחק')) navigate('/studio/projects'); } }}><Trash2 size={15} /></button>
          </div>
        </div>
        {isSigned(p.stage) && (
          <div className="hero-stats-mini">
            <div><HealthRing score={health.score} size={64} /><span>בריאות</span></div>
            <div><b className="num">{Math.round(health.progress * 100)}%</b><span>התקדמות</span></div>
            <div><b className="num">{shekel(paid)}</b><span>מתוך {shekel(p.fee)}</span></div>
          </div>
        )}
      </div>

      {isSigned(p.stage) && health.issues.length > 0 && (
        <div className={`alert ${HEALTH_TONE[health.status]}`} style={{ marginTop: 14 }}><AlertTriangle size={16} />{health.issues.join(' · ')}</div>
      )}

      <div className="toolbar" style={{ marginTop: 18 }}>
        <Tabs<Tab> value={tab} onChange={setTab} options={[
          { value: 'overview', label: 'סקירה' }, { value: 'tasks', label: 'משימות', count: tasks.filter(t => !t.done).length },
          { value: 'budget', label: 'תקציב' }, { value: 'payments', label: 'תשלומים', count: payments.length },
          { value: 'approvals', label: 'אישורי לקוח', count: approvals.filter(a => a.status !== 'אושר').length }, { value: 'meetings', label: 'פגישות', count: meetings.length },
        ]} />
      </div>

      {tab === 'overview' && (
        <div className="grid cols-3">
          <div className="card span-2">
            <div className="card-title"><h3>לוח זמנים</h3><span className="faint" style={{ fontSize: 12 }}>{daysBetween(now, p.dueDate) >= 0 ? `${daysBetween(now, p.dueDate)} ימים ליעד` : `${-daysBetween(now, p.dueDate)} ימים אחרי היעד`}</span></div>
            {tasks.length ? <Gantt project={p} /> : <Empty title="אין עדיין לוח זמנים" text="לוח הזמנים נוצר כשהפרויקט נחתם" />}
          </div>
          <div className="card">
            <div className="card-title"><h3>פלטת הפרויקט</h3><Link to={`/studio/palette?project=${p.id}`} className="btn btn-sm btn-ghost">עריכה</Link></div>
            <div className="palette-big">{p.palette.map(c => <div key={c} style={{ background: c }}><span>{c}</span></div>)}</div>
            <p className="faint" style={{ fontSize: 13 }}>{[...new Set(p.palette.map(c => colorName(fromHex(c))))].join(' · ')}</p>
            <div className="divider" />
            <dl className="kv">
              <dt>תקציב לקוח</dt><dd className="num">{shekel(p.budget)}</dd>
              <dt>שכר טרחה</dt><dd className="num">{shekel(p.fee)}</dd>
              <dt>התחלה</dt><dd>{formatDate(p.startDate)}</dd>
              <dt>יעד</dt><dd>{formatDate(p.dueDate)}</dd>
            </dl>
          </div>
        </div>
      )}

      {tab === 'tasks' && (
        <div className="card">
          <form className="row wrap" style={{ marginBottom: 14 }} onSubmit={async e => {
            e.preventDefault();
            if (!newTask.title.trim()) return;
            if (await run(create('tasks', { projectId: p.id, phase: newTask.phase, title: newTask.title, dueDate: addDays(now, 14), done: false }), 'המשימה נוספה')) setNewTask({ ...newTask, title: '' });
          }}>
            <select className="select" style={{ width: 160 }} value={newTask.phase} onChange={e => setNewTask({ ...newTask, phase: e.target.value as Phase })}>{PHASES.map(ph => <option key={ph}>{ph}</option>)}</select>
            <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="משימה חדשה…" value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} />
            <button className="btn btn-gold"><Plus size={16} />הוספה</button>
          </form>
          {PHASES.map(ph => {
            const ts = tasks.filter(t => t.phase === ph);
            if (!ts.length) return null;
            return (
              <div key={ph} style={{ marginBottom: 14 }}>
                <div className="row"><b>{ph}</b><span className="faint num" style={{ fontSize: 12 }}>{ts.filter(t => t.done).length}/{ts.length}</span></div>
                {ts.map(t => (
                  <div key={t.id} className={`task ${t.done ? 'done' : ''}`}>
                    <button className="btn btn-ghost icon-btn" aria-label="סימון" onClick={() => run(update('tasks', { ...t, done: !t.done }))}>{t.done ? <CheckCircle2 size={19} style={{ color: 'var(--good)' }} /> : <Circle size={19} />}</button>
                    <span style={{ flex: 1 }}>{t.title}</span>
                    <span className={`badge ${!t.done && t.dueDate < now ? 'bad' : ''}`}>{formatShort(t.dueDate)}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'budget' && (
        <div className="card">
          <div className="card-title">
            <h3>תקציב שיפוץ: מתוכנן מול בפועל</h3>
            <div className="row"><span className={`badge ${actual > planned ? 'bad' : 'good'}`}>{shekel(actual)} / {shekel(planned)}</span><button className="btn btn-sm" onClick={() => setAddingBudget(true)}><Plus size={14} />סעיף</button></div>
          </div>
          {budget.map(b => {
            const ratio = b.planned ? b.actual / b.planned : 0;
            return (
              <div key={b.id} className="budget-row">
                <span>{b.category}</span>
                <div className="budget-track">
                  <div className="budget-plan" />
                  <div className={`budget-actual ${ratio > 1.1 ? 'over' : ratio > 1 ? 'warn' : ''}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
                </div>
                <span className="num" style={{ fontSize: 13 }}>{shekel(b.actual)} <span className="faint">/ {shekel(b.planned)}</span></span>
                <input className="input num" style={{ width: 110, padding: '6px 8px' }} type="number" defaultValue={b.actual} aria-label="בפועל"
                  onBlur={e => Number(e.target.value) !== b.actual && run(update('budgetItems', { ...b, actual: Number(e.target.value) }), 'התקציב עודכן')} />
                {ratio > 1.1 && <span className="badge bad">+{Math.round((ratio - 1) * 100)}%</span>}
              </div>
            );
          })}
          {!budget.length && <Empty title="אין סעיפי תקציב" />}
        </div>
      )}

      {tab === 'payments' && (
        <div className="card">
          {payments.length === 0 && <Empty title="אין לוח תשלומים" text="לוח התשלומים נוצר בחתימה על הצעת המחיר" action={<Link className="btn btn-gold" to={`/studio/proposal?project=${p.id}`}>להצעת מחיר</Link>} />}
          {payments.map(x => {
            const late = !x.paidDate && x.dueDate < now;
            return (
              <div key={x.id} className="list-item">
                <span className={`badge ${x.paidDate ? 'good' : late ? 'bad' : ''}`}>{x.paidDate ? 'שולם' : late ? `באיחור ${daysBetween(x.dueDate, now)} ימים` : 'עתידי'}</span>
                <b style={{ flex: 1 }}>{x.label} <span className="faint">({x.percent}%)</span></b>
                <span className="num muted">{formatDate(x.dueDate)}</span>
                <b className="num" style={{ width: 90 }}>{shekel(x.amount)}</b>
                {!x.paidDate && <button className="btn btn-sm" onClick={() => run(update('payments', { ...x, paidDate: now }), 'התשלום סומן כהתקבל ✓')}><Check size={14} />התקבל</button>}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'approvals' && (
        <div className="card">
          <div className="card-title"><h3>גרסאות לאישור הלקוח</h3>
            <button className="btn btn-sm btn-gold" onClick={() => run(create('approvals', { projectId: p.id, title: 'הדמיה חדשה', version: 1, status: 'ממתין לאישור', comment: '', date: now }), 'נשלח ללקוח לאישור 📨')}><Send size={14} />שליחה לאישור</button></div>
          {approvals.map(a => (
            <div key={a.id} className="list-item">
              <span className={`badge ${a.status === 'אושר' ? 'good' : a.status === 'נדרשים שינויים' ? 'bad' : 'warn'}`}>{a.status}</span>
              <div style={{ flex: 1 }}><b>{a.title}</b> <span className="faint">· גרסה {a.version}</span>{a.comment && <div className="muted" style={{ fontSize: 13 }}>💬 "{a.comment}"</div>}</div>
              <span className="faint num">{formatShort(a.date)}</span>
              {a.status === 'נדרשים שינויים' && <button className="btn btn-sm" onClick={() => run(update('approvals', { ...a, version: a.version + 1, status: 'ממתין לאישור', comment: '', date: now }), `גרסה ${a.version + 1} נשלחה`)}>שליחת גרסה {a.version + 1}</button>}
            </div>
          ))}
          {!approvals.length && <Empty title="אין גרסאות לאישור" />}
          <p className="faint" style={{ fontSize: 12, marginBottom: 0 }}>הלקוח מאשר או מבקש שינויים מתוך <Link to="/portal" style={{ textDecoration: 'underline' }}>פורטל הלקוחות</Link>.</p>
        </div>
      )}

      {tab === 'meetings' && (
        <div className="card">
          <div className="card-title"><h3>פגישות</h3><button className="btn btn-sm btn-gold" onClick={() => setMeeting(true)}><Plus size={14} />קביעת פגישה</button></div>
          {meetings.map(m => (
            <div key={m.id} className="list-item">
              <span className="time-pill num">{m.from}</span>
              <div style={{ flex: 1 }}><b>{m.type}</b><div className="faint" style={{ fontSize: 12 }}>{parse(m.date).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })} · {m.city}</div></div>
              <span className={`badge ${m.status === 'התקיים' ? 'good' : m.status === 'בוטל' ? 'bad' : 'gold'}`}>{m.status}</span>
            </div>
          ))}
          {!meetings.length && <Empty title="אין פגישות" />}
        </div>
      )}

      {editing && <ProjectForm project={p} onClose={() => setEditing(false)} />}
      {addingBudget && <BudgetModal projectId={p.id} onClose={() => setAddingBudget(false)} />}
      {meeting && <MeetingForm preset={{ projectId: p.id, clientId: p.clientId, city: p.city, type: 'פגישת תכנון' }} onClose={() => setMeeting(false)} />}
      {dialog}
    </div>
  );
}
