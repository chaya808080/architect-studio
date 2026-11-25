import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Plus } from 'lucide-react';
import { selectDb, useAppSelector } from '../store';
import type { Stage, Style } from '../domain/types';
import { formatDate, today } from '../domain/dates';
import { shekel } from '../domain/pricing';
import { HEALTH_TONE, img, STAGE_TONE } from '../domain/display';
import { isSigned } from '../domain/rules';
import { projectHealth } from '../domain/smart/scoring';
import { clientName } from '../domain/smart/insights';
import { SearchBox, Tabs } from '../components/ui';
import { ProjectForm } from './forms';

export const COVER: Record<Style, string[]> = {
  'מודרני': ['living-gray', 'kitchen-island', 'house-night', 'living-stairs'],
  'סקנדינבי': ['living-pastel', 'living-blue', 'office-scandi'],
  'כפרי': ['living-plants', 'bedroom-boho', 'living-gallery', 'house-blue'],
  'קלאסי': ['living-classic', 'bedroom-classic', 'living-bright'],
  'תעשייתי': ['living-warm', 'living-wood-wall', 'office-corridor'],
  'ים תיכוני': ['living-cream', 'dining-green', 'villa-pool', 'living-mirrors'],
};
export const coverOf = (style: Style, id: number) => COVER[style][id % COVER[style].length];

export function HealthRing({ score, size = 46 }: { score: number; size?: number }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const color = score >= 75 ? 'var(--good)' : score >= 50 ? 'var(--warn)' : 'var(--bad)';
  return (
    <svg width={size} height={size} className="ring" role="img" aria-label={`ציון בריאות ${score}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" fontSize={size / 3.4} fontWeight="700" fill="var(--text)">{score}</text>
    </svg>
  );
}

type Filter = 'active' | 'sales' | 'done' | 'all';
const GROUPS: Record<Filter, Stage[]> = {
  active: ['נחתם', 'תכנון', 'ביצוע'], sales: ['ליד', 'פגישת היכרות', 'הצעת מחיר'], done: ['הושלם'], all: ['ליד', 'פגישת היכרות', 'הצעת מחיר', 'נחתם', 'תכנון', 'ביצוע', 'הושלם', 'אבוד'],
};

export default function Projects() {
  const db = useAppSelector(selectDb);
  const [filter, setFilter] = useState<Filter>('active');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const health = useMemo(() => new Map(db.projects.map(p => [p.id, projectHealth(p, db, today())])), [db]);
  const rows = db.projects.filter(p => GROUPS[filter].includes(p.stage) && (!q.trim() || `${p.name} ${clientName(db, p.clientId)}`.includes(q.trim())));

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>פרויקטים</h1><p>כל פרויקט עם ציון בריאות: לוח זמנים, תקציב ותשלומים</p></div>
        <button className="btn btn-gold" onClick={() => setAdding(true)}><Plus size={17} />פרויקט חדש</button>
      </div>
      <div className="toolbar">
        <SearchBox value={q} onChange={setQ} placeholder="חיפוש פרויקט או לקוח" />
        <span className="spacer" />
        <Tabs<Filter> value={filter} onChange={setFilter} options={[
          { value: 'active', label: 'פעילים', count: db.projects.filter(p => GROUPS.active.includes(p.stage)).length },
          { value: 'sales', label: 'במכירה', count: db.projects.filter(p => GROUPS.sales.includes(p.stage)).length },
          { value: 'done', label: 'הושלמו', count: db.projects.filter(p => p.stage === 'הושלם').length },
          { value: 'all', label: 'הכול', count: db.projects.length },
        ]} />
      </div>
      <div className="grid cols-3">
        {rows.map(p => {
          const h = health.get(p.id)!;
          return (
            <Link key={p.id} to={`/studio/projects/${p.id}`} className="card project-card">
              <div className="project-cover" style={{ backgroundImage: `url(${img(coverOf(p.style, p.id))})` }}>
                <span className={`badge ${STAGE_TONE[p.stage]}`}>{p.stage}</span>
                <div className="palette-strip">{p.palette.map(c => <i key={c} style={{ background: c }} />)}</div>
              </div>
              <div className="row" style={{ alignItems: 'flex-start', marginTop: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 16 }}>{p.name}</b>
                  <div className="faint" style={{ fontSize: 13 }}>{clientName(db, p.clientId)} · {p.style} · {p.area} מ״ר</div>
                </div>
                {isSigned(p.stage) && <HealthRing score={h.score} />}
              </div>
              {isSigned(p.stage) && <>
                <div className="row" style={{ fontSize: 12, marginTop: 12 }}><span className="muted">התקדמות</span><span className="spacer" /><b className="num">{Math.round(h.progress * 100)}%</b></div>
                <div className="progress" style={{ marginTop: 4 }}><div style={{ width: `${h.progress * 100}%` }} /></div>
              </>}
              <div className="row faint" style={{ fontSize: 12, marginTop: 12 }}>
                <CalendarClock size={13} />{isSigned(p.stage) ? `יעד: ${formatDate(p.dueDate)}` : `נפתח ${formatDate(p.createdAt)}`}
                <span className="spacer" /><b className="num" style={{ color: 'var(--text)' }}>{shekel(p.fee)}</b>
              </div>
              {isSigned(p.stage) && h.issues[0] && <div className={`badge ${HEALTH_TONE[h.status]}`} style={{ marginTop: 10, whiteSpace: 'normal' }}>{h.issues[0]}</div>}
            </Link>
          );
        })}
      </div>
      {adding && <ProjectForm onClose={() => setAdding(false)} />}
    </div>
  );
}
