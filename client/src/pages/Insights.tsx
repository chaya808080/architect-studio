import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Brain } from 'lucide-react';
import { selectDb, useAppSelector } from '../store';
import { addDays, HEBREW_DAYS, today, weekStart } from '../domain/dates';
import { HEALTH_TONE } from '../domain/display';
import { isSigned } from '../domain/rules';
import { shekel } from '../domain/pricing';
import { funnel, leadScore, projectHealth } from '../domain/smart/scoring';
import { clientName, dayTravel, insights } from '../domain/smart/insights';
import { ColumnChart } from '../components/charts';
import InsightCard from '../components/InsightCard';
import { HealthRing } from './Projects';

export default function Insights() {
  const db = useAppSelector(selectDb);
  const now = today();
  const all = useMemo(() => insights(db, now), [db, now]);
  const f = useMemo(() => funnel(db), [db]);
  const leads = useMemo(() => db.projects.filter(p => !isSigned(p.stage) && p.stage !== 'אבוד').map(p => ({ p, s: leadScore(p, db, now) })).sort((a, b) => b.s.value - a.s.value), [db, now]);
  const health = useMemo(() => db.projects.filter(p => ['נחתם', 'תכנון', 'ביצוע'].includes(p.stage)).map(p => ({ p, h: projectHealth(p, db, now) })).sort((a, b) => a.h.score - b.h.score), [db, now]);
  const nextWeek = addDays(weekStart(now), 7);
  const travel = [0, 1, 2, 3, 4].map(d => ({ label: HEBREW_DAYS[d], value: dayTravel(db, addDays(nextWeek, d)), detail: `יום ${HEBREW_DAYS[d]} בשבוע הבא` }));
  const top = f[0].count || 1;

  return (
    <div className="page">
      <div className="page-head"><div><h1><Brain size={28} style={{ verticalAlign: -4, color: 'var(--gold)' }} /> תובנות חכמות</h1><p>ניתוח אוטומטי של המכירות, הפרויקטים, הכספים והיומן. מתעדכן בכל שינוי.</p></div></div>
      <div className="grid cols-3">{all.map((i, n) => <InsightCard key={n} insight={i} />)}</div>

      <div className="grid cols-3" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-title"><h3>משפך המרה</h3></div>
          <div className="funnel">
            {f.map((s, i) => (
              <div key={s.stage} className="funnel-step" style={{ width: `${40 + (s.count / top) * 60}%` }}>
                <b>{s.stage}</b><span className="num">{s.count}</span>
                {i > 0 && <small className="num">{Math.round((s.count / Math.max(1, f[i - 1].count)) * 100)}% מהשלב הקודם</small>}
              </div>
            ))}
          </div>
        </div>
        <div className="card span-2">
          <div className="card-title"><h3>דירוג לידים</h3><span className="faint" style={{ fontSize: 12 }}>תקציב למ״ר · גודל · סוג נכס · מקור · פגישה שהתקיימה · זמן ללא התקדמות</span></div>
          <table className="table">
            <thead><tr><th>ציון</th><th>לקוח</th><th>נכס</th><th>שלב</th><th>גורמים</th></tr></thead>
            <tbody>{leads.map(({ p, s }) => (
              <tr key={p.id}>
                <td><span className={`lead-score ${s.label === 'חם' ? 'hot' : s.label === 'פושר' ? 'warm' : 'cold'}`}>{s.value}</span></td>
                <td><Link to={`/studio/projects/${p.id}`}><b>{clientName(db, p.clientId)}</b></Link></td>
                <td className="muted">{p.type} · {p.area} מ״ר · {shekel(p.budget)}</td>
                <td><span className="badge">{p.stage}</span></td>
                <td className="faint" style={{ fontSize: 12 }}>{s.factors.map(x => `${x.label} (${x.points > 0 ? '+' : ''}${x.points})`).join(' · ')}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      <div className="grid cols-3" style={{ marginTop: 18 }}>
        <div className="card span-2">
          <div className="card-title"><h3>בריאות פרויקטים פעילים</h3></div>
          {health.map(({ p, h }) => (
            <Link key={p.id} to={`/studio/projects/${p.id}`} className="list-item">
              <HealthRing score={h.score} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{p.name}</b>
                <div className="faint" style={{ fontSize: 12 }}>התקדמות {Math.round(h.progress * 100)}% · זמן שחלף {Math.round(h.timeProgress * 100)}% · תקציב {h.budgetVariance >= 0 ? '+' : ''}{Math.round(h.budgetVariance * 100)}%</div>
              </div>
              <span className={`badge ${HEALTH_TONE[h.status]}`} style={{ maxWidth: 260, whiteSpace: 'normal' }}>{h.issues[0] ?? 'תקין'}</span>
            </Link>
          ))}
        </div>
        <div className="card">
          <div className="card-title"><h3>זמן נסיעה צפוי – השבוע הבא</h3></div>
          <ColumnChart data={travel} unit="דקות" />
          <p className="faint" style={{ fontSize: 12 }}>מחושב מהמרחק בין ערי הפגישות לפי סדרן, כולל יציאה מהסטודיו וחזרה אליו.</p>
        </div>
      </div>
    </div>
  );
}
