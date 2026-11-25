import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, CalendarDays, Check, LogOut, MessageSquare, Wallet } from 'lucide-react';
import { selectDb, useAction, useAppDispatch, useAppSelector } from '../store';
import { loadAll, update } from '../store/dataSlice';
import type { Approval } from '../domain/types';
import { PHASES } from '../domain/types';
import { formatDate, formatShort, today } from '../domain/dates';
import { shekel } from '../domain/pricing';
import { img } from '../domain/display';
import { projectHealth } from '../domain/smart/scoring';
import { Logo } from '../components/Layout';
import { Modal } from '../components/ui';
import { coverOf } from './Projects';
import '../styles/landing.css';

function ChangesModal({ approval, onClose }: { approval: Approval; onClose: () => void }) {
  const run = useAction();
  const [text, setText] = useState('');
  return (
    <Modal title={`בקשת שינויים: ${approval.title}`} icon={<MessageSquare size={18} />} onClose={onClose} footer={<>
      <button className="btn btn-gold" disabled={!text.trim()} onClick={async () => { if (await run(update('approvals', { ...approval, status: 'נדרשים שינויים', comment: text, date: today() }), 'ההערות נשלחו לאדריכלית')) onClose(); }}>שליחה</button>
      <button className="btn btn-ghost" onClick={onClose}>ביטול</button>
    </>}>
      <textarea className="textarea" rows={4} autoFocus placeholder="מה תרצו לשנות?" value={text} onChange={e => setText(e.target.value)} />
    </Modal>
  );
}

export default function Portal() {
  const db = useAppSelector(selectDb);
  const status = useAppSelector(s => s.data.status);
  const dispatch = useAppDispatch();
  const run = useAction();
  const navigate = useNavigate();
  const id = Number(useParams().projectId);
  const [changes, setChanges] = useState<Approval | null>(null);
  useEffect(() => { if (status === 'idle') dispatch(loadAll()); }, [status, dispatch]);

  const signed = db.projects.filter(p => ['נחתם', 'תכנון', 'ביצוע', 'הושלם'].includes(p.stage));
  const p = db.projects.find(x => x.id === id);

  if (!p) {
    return (
      <div className="portal-login">
        <div className="card" style={{ width: 'min(440px, 100%)' }}>
          <div className="row" style={{ marginBottom: 18 }}><Logo /><div><b className="brand-name" style={{ fontSize: 22 }}>אזור לקוחות</b><div className="faint" style={{ fontSize: 13 }}>מעקב אחרי הפרויקט שלכם</div></div></div>
          <p className="muted" style={{ marginTop: 0 }}>בגרסת ההדגמה בוחרים לקוח מהרשימה. במערכת אמיתית הכניסה היא עם קוד חד-פעמי ב-SMS.</p>
          <select className="select" defaultValue="" onChange={e => navigate(`/portal/${e.target.value}`)}>
            <option value="" disabled>בחרו לקוח…</option>
            {signed.map(x => { const c = db.clients.find(y => y.id === x.clientId); return <option key={x.id} value={x.id}>{c?.firstName} {c?.lastName} · {x.name}</option>; })}
          </select>
          <Link to="/" className="btn btn-ghost btn-sm" style={{ marginTop: 14 }}><ArrowRight size={15} />חזרה לאתר</Link>
        </div>
      </div>
    );
  }

  const client = db.clients.find(c => c.id === p.clientId)!;
  const h = projectHealth(p, db);
  const tasks = db.tasks.filter(t => t.projectId === p.id);
  const phaseIndex = Math.max(0, PHASES.findIndex(ph => tasks.some(t => t.phase === ph && !t.done)));
  const approvals = db.approvals.filter(a => a.projectId === p.id);
  const payments = db.payments.filter(x => x.projectId === p.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const next = db.meetings.filter(m => m.projectId === p.id && m.date >= today() && m.status === 'מתוכנן').sort((a, b) => (a.date + a.from).localeCompare(b.date + b.from))[0];

  return (
    <div className="portal">
      <nav className="land-nav">
        <Logo size={36} /><b className="brand-name" style={{ fontSize: 20 }}>אזור לקוחות</b>
        <span className="spacer" /><span className="muted">שלום, {client.firstName} 👋</span>
        <Link to="/portal" className="btn btn-sm"><LogOut size={14} />יציאה</Link>
      </nav>
      <div className="page">
        <div className="portal-hero" style={{ backgroundImage: `linear-gradient(0deg, rgba(20,18,15,.85), rgba(20,18,15,.15)), url(${img(coverOf(p.style, p.id))})` }}>
          <span className="badge gold">{p.stage}</span>
          <h1 className="display" style={{ color: '#fff' }}>{p.name}</h1>
          <p style={{ color: 'rgba(255,255,255,.8)', margin: 0 }}>התקדמות {Math.round(h.progress * 100)}% · סיום משוער {formatDate(p.dueDate)}</p>
        </div>

        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-title"><h3>איפה אנחנו עומדים</h3></div>
          <div className="steps">
            {PHASES.map((ph, i) => <div key={ph} className={`step ${i < phaseIndex || p.stage === 'הושלם' ? 'done' : i === phaseIndex ? 'current' : ''}`}><span>{i < phaseIndex || p.stage === 'הושלם' ? <Check size={14} /> : i + 1}</span>{ph}</div>)}
          </div>
        </div>

        <div className="grid cols-3" style={{ marginTop: 18 }}>
          <div className="card span-2">
            <div className="card-title"><h3>ממתין לאישורכם</h3></div>
            {approvals.length === 0 && <p className="muted">אין כרגע גרסאות לאישור.</p>}
            {approvals.map(a => (
              <div key={a.id} className="approval">
                <img src={img(coverOf(p.style, p.id + a.id))} alt="" />
                <div style={{ flex: 1 }}>
                  <b>{a.title}</b> <span className="faint">· גרסה {a.version} · {formatShort(a.date)}</span>
                  {a.comment && <div className="muted" style={{ fontSize: 13 }}>ההערה שלכם: "{a.comment}"</div>}
                  <div className="row" style={{ marginTop: 10 }}>
                    {a.status === 'ממתין לאישור' ? <>
                      <button className="btn btn-gold btn-sm" onClick={() => run(update('approvals', { ...a, status: 'אושר', date: today() }), 'תודה! האישור נשלח לאדריכלית ✓')}><Check size={14} />מאשר/ת</button>
                      <button className="btn btn-sm" onClick={() => setChanges(a)}><MessageSquare size={14} />בקשת שינויים</button>
                    </> : <span className={`badge ${a.status === 'אושר' ? 'good' : 'warn'}`}>{a.status}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="stack">
            <div className="card">
              <div className="card-title"><h3><CalendarDays size={16} style={{ verticalAlign: -3 }} /> הפגישה הבאה</h3></div>
              {next ? <p style={{ margin: 0 }}><b>{next.type}</b><br />{formatDate(next.date)} בשעה {next.from} · {next.city}</p> : <p className="muted" style={{ margin: 0 }}>אין פגישה מתוכננת</p>}
            </div>
            <div className="card">
              <div className="card-title"><h3><Wallet size={16} style={{ verticalAlign: -3 }} /> תשלומים</h3></div>
              {payments.map(x => (
                <div key={x.id} className="row" style={{ padding: '6px 0', fontSize: 14 }}>
                  <span style={{ flex: 1 }}>{x.label}</span><span className="num">{shekel(x.amount)}</span>
                  <span className={`badge ${x.paidDate ? 'good' : x.dueDate < today() ? 'bad' : ''}`}>{x.paidDate ? 'שולם' : formatShort(x.dueDate)}</span>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="card-title"><h3>פלטת הצבעים שלכם</h3></div>
              <div className="palette-strip big">{p.palette.map(c => <i key={c} style={{ background: c }} />)}</div>
            </div>
          </div>
        </div>
      </div>
      {changes && <ChangesModal approval={changes} onClose={() => setChanges(null)} />}
    </div>
  );
}
