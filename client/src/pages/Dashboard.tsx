import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Car, FolderKanban, Plus, Sparkles, Target, Wallet } from 'lucide-react';
import { selectDb, useAppSelector } from '../store';
import { addDays, formatShort, parse, today, weekStart } from '../domain/dates';
import { shekel } from '../domain/pricing';
import { HEALTH_TONE, STAGE_TONE } from '../domain/display';
import { insights, clientName, dayTravel } from '../domain/smart/insights';
import { cashFlow, leadScore, pipelineValue, projectHealth } from '../domain/smart/scoring';
import { isSigned } from '../domain/rules';
import { StackedColumns } from '../components/charts';
import { Skeleton } from '../components/ui';
import InsightCard from '../components/InsightCard';
import { ProjectForm } from './forms';

const k = (v: number) => (v >= 1000 ? `₪${Math.round(v / 1000)}K` : shekel(v));

export default function Dashboard() {
  const db = useAppSelector(selectDb);
  const status = useAppSelector(s => s.data.status);
  const [adding, setAdding] = useState(false);
  const now = today();

  const m = useMemo(() => {
    const active = db.projects.filter(p => ['נחתם', 'תכנון', 'ביצוע'].includes(p.stage));
    const sunday = weekStart(now);
    const weekMeetings = db.meetings.filter(x => x.date >= sunday && x.date < addDays(sunday, 7) && x.status !== 'בוטל');
    const travel = [0, 1, 2, 3, 4, 5].reduce((s, d) => s + dayTravel(db, addDays(sunday, d)), 0);
    const cf = cashFlow(db, 6, now);
    const health = active.map(p => ({ p, h: projectHealth(p, db, now) })).sort((a, b) => a.h.score - b.h.score);
    const leads = db.projects.filter(p => !isSigned(p.stage) && p.stage !== 'אבוד').map(p => ({ p, s: leadScore(p, db, now) })).sort((a, b) => b.s.value - a.s.value);
    const upcoming = db.meetings.filter(x => x.date >= now && x.status === 'מתוכנן').sort((a, b) => (a.date + a.from).localeCompare(b.date + b.from)).slice(0, 6);
    return { active, weekMeetings, travel, cf, health, leads, upcoming, pv: pipelineValue(db), smart: insights(db, now).slice(0, 3) };
  }, [db, now]);

  if (status !== 'ready') {
    return <div className="page"><div className="grid cols-4">{[0, 1, 2, 3].map(i => <div key={i} className="card"><Skeleton h={90} /></div>)}</div><div className="card" style={{ marginTop: 18 }}><Skeleton h={240} /></div></div>;
  }

  const hour = new Date().getHours();
  const month = m.cf[0];
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{hour < 12 ? 'בוקר טוב' : hour < 17 ? 'צהריים טובים' : 'ערב טוב'} ✦</h1>
          <p>{parse(now).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {m.active.length} פרויקטים פעילים ו-{m.upcoming.length ? `הפגישה הבאה ב-${m.upcoming[0].from}` : 'אין פגישות קרובות'}</p>
        </div>
        <div className="row">
          <Link to="/studio/calendar" className="btn"><CalendarDays size={17} />ליומן</Link>
          <button className="btn btn-gold" onClick={() => setAdding(true)}><Plus size={17} />ליד חדש</button>
        </div>
      </div>

      <div className="grid cols-4">
        <div className="card kpi"><div className="kpi-label"><span className="kpi-icon"><FolderKanban size={18} /></span>פרויקטים פעילים</div><div className="kpi-value">{m.active.length}</div><div className="kpi-foot">{m.health.filter(x => x.h.status === 'בסיכון').length} בסיכון · {db.projects.filter(p => p.stage === 'הושלם').length} הושלמו</div></div>
        <div className="card kpi"><div className="kpi-label"><span className="kpi-icon"><Target size={18} /></span>צנרת מכירות משוקללת</div><div className="kpi-value">{k(m.pv.weighted)}</div><div className="kpi-foot">{m.pv.count} עסקאות פתוחות בשווי {k(m.pv.raw)}</div></div>
        <div className="card kpi"><div className="kpi-label"><span className="kpi-icon"><Wallet size={18} /></span>צפוי להיכנס החודש</div><div className="kpi-value">{k(month.contracted + month.overdue)}</div><div className="kpi-foot">{month.overdue ? <span style={{ color: 'var(--bad)' }}>{shekel(month.overdue)} מתוכם בפיגור</span> : 'אין פיגורים'}</div></div>
        <div className="card kpi"><div className="kpi-label"><span className="kpi-icon"><Car size={18} /></span>פגישות השבוע</div><div className="kpi-value">{m.weekMeetings.length}</div><div className="kpi-foot">{(m.travel / 60).toFixed(1)} שעות נסיעה משוערות</div></div>
      </div>

      <div className="row" style={{ margin: '26px 0 12px' }}><Sparkles size={18} style={{ color: 'var(--gold)' }} /><h3>תובנות חכמות</h3><span className="spacer" /><Link to="/studio/insights" className="btn btn-sm btn-ghost">לכל התובנות</Link></div>
      <div className="grid cols-3">{m.smart.map((i, n) => <InsightCard key={n} insight={i} />)}</div>

      <div className="grid cols-3" style={{ marginTop: 18 }}>
        <div className="card span-2">
          <div className="card-title"><h3>תחזית תזרים ל-6 חודשים</h3><Link to="/studio/finance" className="btn btn-sm btn-ghost">לכספים</Link></div>
          <StackedColumns format={k} data={m.cf.map(c => ({ label: c.label, overdue: c.overdue, contracted: c.contracted, pipeline: c.pipeline }))}
            series={[{ key: 'overdue', label: 'בפיגור', color: 'var(--c8)' }, { key: 'contracted', label: 'חוזים חתומים', color: 'var(--c3)' }, { key: 'pipeline', label: 'צנרת משוקללת', color: 'var(--c1)' }]} />
        </div>
        <div className="card">
          <div className="card-title"><h3>בריאות פרויקטים</h3></div>
          {m.health.slice(0, 6).map(({ p, h }) => (
            <Link key={p.id} to={`/studio/projects/${p.id}`} className="list-item">
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</b>
                <div className="progress" style={{ marginTop: 6 }}><div style={{ width: `${Math.round(h.progress * 100)}%` }} /></div>
              </div>
              <span className={`badge ${HEALTH_TONE[h.status]}`}>{h.score}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid cols-3" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-title"><h3>הפגישות הקרובות</h3></div>
          {m.upcoming.map(x => (
            <div key={x.id} className="list-item">
              <span className="time-pill num">{x.from}</span>
              <div style={{ flex: 1 }}><b>{clientName(db, x.clientId)}</b><div className="faint" style={{ fontSize: 12 }}>{x.type} · {x.city}</div></div>
              {x.date !== now && <span className="badge">{formatShort(x.date)}</span>}
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-title"><h3>לידים מובילים</h3><Link to="/studio/pipeline" className="btn btn-sm btn-ghost">לצנרת</Link></div>
          {m.leads.slice(0, 6).map(({ p, s }) => (
            <div key={p.id} className="list-item">
              <span className={`lead-score ${s.label === 'חם' ? 'hot' : s.label === 'פושר' ? 'warm' : 'cold'}`}>{s.value}</span>
              <div style={{ flex: 1 }}><b>{clientName(db, p.clientId)}</b><div className="faint" style={{ fontSize: 12 }}>{p.type} · {p.area} מ״ר · {p.city}</div></div>
              <span className={`badge ${STAGE_TONE[p.stage]}`}>{p.stage}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-title"><h3>ממתין לאישור לקוח</h3></div>
          {db.approvals.filter(a => a.status !== 'אושר').map(a => {
            const p = db.projects.find(x => x.id === a.projectId)!;
            return (
              <Link key={a.id} to={`/studio/projects/${p.id}`} className="list-item">
                <div style={{ flex: 1 }}><b>{a.title} · גרסה {a.version}</b><div className="faint" style={{ fontSize: 12 }}>{p.name}</div></div>
                <span className={`badge ${a.status === 'נדרשים שינויים' ? 'bad' : 'warn'}`}>{a.status}</span>
              </Link>
            );
          })}
        </div>
      </div>
      {adding && <ProjectForm onClose={() => setAdding(false)} />}
    </div>
  );
}
