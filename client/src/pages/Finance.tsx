import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Download, Receipt } from 'lucide-react';
import { selectDb, useAction, useAppSelector } from '../store';
import { update } from '../store/dataSlice';
import { daysBetween, formatDate, today } from '../domain/dates';
import { shekel } from '../domain/pricing';
import { cashFlow } from '../domain/smart/scoring';
import { clientName } from '../domain/smart/insights';
import { StackedColumns } from '../components/charts';
import { exportCsv } from '../components/DataTable';
import { Tabs } from '../components/ui';

type View = 'open' | 'late' | 'paid';
const k = (v: number) => (v >= 1000 ? `₪${Math.round(v / 1000)}K` : shekel(v));

export default function Finance() {
  const db = useAppSelector(selectDb);
  const run = useAction();
  const [view, setView] = useState<View>('late');
  const now = today();
  const cf = useMemo(() => cashFlow(db, 6, now), [db, now]);
  const year = now.slice(0, 4);
  const paidThisYear = db.payments.filter(x => x.paidDate?.startsWith(year)).reduce((s, x) => s + x.amount, 0);
  const late = db.payments.filter(x => !x.paidDate && x.dueDate < now);
  const open = db.payments.filter(x => !x.paidDate && x.dueDate >= now);
  const rows = (view === 'late' ? late : view === 'open' ? open : db.payments.filter(x => x.paidDate)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const avgDelay = (() => { const paid = db.payments.filter(x => x.paidDate); return paid.length ? Math.round(paid.reduce((s, x) => s + Math.max(0, daysBetween(x.dueDate, x.paidDate!)), 0) / paid.length) : 0; })();

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>כספים ותזרים</h1><p>גבייה לפי אבני דרך, פיגורים ותחזית תזרים שמשלבת חוזים חתומים עם צנרת מכירות משוקללת</p></div>
        <button className="btn" onClick={() => exportCsv(`payments-${now}.csv`, ['פרויקט', 'לקוח', 'אבן דרך', 'סכום', 'מועד', 'שולם'], db.payments.map(x => { const p = db.projects.find(y => y.id === x.projectId)!; return [p.name, clientName(db, p.clientId), x.label, x.amount, x.dueDate, x.paidDate ?? '']; }))}><Download size={17} />ייצוא</button>
      </div>
      <div className="grid cols-4">
        <div className="card kpi"><div className="kpi-label"><span className="kpi-icon"><Receipt size={18} /></span>נגבה השנה</div><div className="kpi-value">{k(paidThisYear)}</div><div className="kpi-foot">{year}</div></div>
        <div className="card kpi"><div className="kpi-label">בפיגור</div><div className="kpi-value" style={{ color: late.length ? 'var(--bad)' : undefined }}>{k(late.reduce((s, x) => s + x.amount, 0))}</div><div className="kpi-foot">{late.length} אבני דרך</div></div>
        <div className="card kpi"><div className="kpi-label">צפוי ב-6 חודשים</div><div className="kpi-value">{k(cf.reduce((s, c) => s + c.contracted, 0))}</div><div className="kpi-foot">+ {k(cf.reduce((s, c) => s + c.pipeline, 0))} מצנרת המכירות</div></div>
        <div className="card kpi"><div className="kpi-label">ימי גבייה ממוצעים</div><div className="kpi-value">{avgDelay}</div><div className="kpi-foot">ימים מהמועד ועד התשלום בפועל</div></div>
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-title"><h3>תחזית תזרים</h3><span className="faint" style={{ fontSize: 12 }}>צנרת משוקללת = שכר טרחה × הסתברות השלב, מפוזר על פני החודשים שאחרי החתימה הצפויה</span></div>
        <StackedColumns format={k} height={260} data={cf.map(c => ({ label: c.label, overdue: c.overdue, contracted: c.contracted, pipeline: c.pipeline }))}
          series={[{ key: 'overdue', label: 'בפיגור', color: 'var(--c8)' }, { key: 'contracted', label: 'חוזים חתומים', color: 'var(--c3)' }, { key: 'pipeline', label: 'צנרת משוקללת', color: 'var(--c1)' }]} />
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <div className="toolbar"><Tabs<View> value={view} onChange={setView} options={[{ value: 'late', label: 'בפיגור', count: late.length }, { value: 'open', label: 'עתידיים', count: open.length }, { value: 'paid', label: 'שולמו' }]} /></div>
        <table className="table">
          <thead><tr><th>פרויקט</th><th>אבן דרך</th><th>מועד</th><th>סכום</th><th>מצב</th><th /></tr></thead>
          <tbody>
            {rows.slice(0, 40).map(x => {
              const p = db.projects.find(y => y.id === x.projectId)!;
              const days = daysBetween(x.dueDate, now);
              return (
                <tr key={x.id}>
                  <td><Link to={`/studio/projects/${p.id}`}><b>{clientName(db, p.clientId)}</b></Link><div className="faint" style={{ fontSize: 12 }}>{p.name}</div></td>
                  <td>{x.label} <span className="faint">({x.percent}%)</span></td>
                  <td className="num muted">{formatDate(x.dueDate)}</td>
                  <td><b className="num">{shekel(x.amount)}</b></td>
                  <td>{x.paidDate ? <span className="badge good">שולם {formatDate(x.paidDate)}</span> : days > 0 ? <span className="badge bad">באיחור {days} ימים</span> : <span className="badge">בעוד {-days} ימים</span>}</td>
                  <td>{!x.paidDate && <button className="btn btn-sm" onClick={() => run(update('payments', { ...x, paidDate: now }), 'התשלום סומן כהתקבל ✓')}><Check size={14} />התקבל</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
