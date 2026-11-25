import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, Plus, XCircle } from 'lucide-react';
import { selectDb, useAction, useAppDispatch, useAppSelector } from '../store';
import { update } from '../store/dataSlice';
import { pushToast } from '../store/uiSlice';
import type { Project, Stage } from '../domain/types';
import { STAGES } from '../domain/types';
import { daysBetween, today } from '../domain/dates';
import { shekel } from '../domain/pricing';
import { STAGE_COLOR } from '../domain/display';
import { isSigned, stageProblems } from '../domain/rules';
import { leadScore, pipelineValue, STAGE_PROBABILITY } from '../domain/smart/scoring';
import { clientName } from '../domain/smart/insights';
import { ProjectForm } from './forms';

export default function Pipeline() {
  const db = useAppSelector(selectDb);
  const run = useAction();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const [adding, setAdding] = useState(false);
  const now = today();
  const scores = useMemo(() => new Map(db.projects.map(p => [p.id, leadScore(p, db, now)])), [db, now]);
  const pv = pipelineValue(db);

  const move = async (p: Project, to: Stage) => {
    if (p.stage === to) return;
    if (to === 'נחתם' && !isSigned(p.stage)) {
      dispatch(pushToast('info', 'חתימה נעשית דרך הצעת מחיר. פותח את בונה ההצעות…'));
      navigate(`/studio/proposal?project=${p.id}`);
      return;
    }
    const problems = stageProblems(p, to, db);
    if (problems.length) { dispatch(pushToast('error', problems[0])); return; }
    await run(update('projects', { ...p, stage: to }), `${p.name} הועבר/ה ל"${to}"`);
  };

  const columns: Stage[] = [...STAGES];
  return (
    <div className="page" style={{ maxWidth: 'none' }}>
      <div className="page-head">
        <div><h1>צנרת מכירות</h1><p>גררו כרטיס בין השלבים · ציון ליד מחושב לפי תקציב, גודל נכס, מקור הפנייה וזמן ללא התקדמות · שווי משוקלל: <b>{shekel(pv.weighted)}</b></p></div>
        <button className="btn btn-gold" onClick={() => setAdding(true)}><Plus size={17} />ליד חדש</button>
      </div>
      <div className="kanban">
        {columns.map(stage => {
          const cards = db.projects.filter(p => p.stage === stage).sort((a, b) => (scores.get(b.id)?.value ?? 0) - (scores.get(a.id)?.value ?? 0));
          const sum = cards.reduce((s, p) => s + p.fee, 0);
          return (
            <div key={stage} className={`kanban-col ${over === stage ? 'drop' : ''}`}
              onDragOver={e => { if (drag != null) { e.preventDefault(); setOver(stage); } }} onDragLeave={() => setOver(o => (o === stage ? null : o))}
              onDrop={() => { const p = db.projects.find(x => x.id === drag); setDrag(null); setOver(null); if (p) void move(p, stage); }}>
              <div className="kanban-head" style={{ borderTopColor: STAGE_COLOR[stage] }}>
                <b>{stage}</b><span className="count num">{cards.length}</span>
                <div className="faint num" style={{ fontSize: 12, width: '100%' }}>{shekel(sum)}{STAGE_PROBABILITY[stage] < 1 ? ` · סיכוי ${Math.round(STAGE_PROBABILITY[stage] * 100)}%` : ''}</div>
              </div>
              <div className="kanban-cards">
                {cards.map(p => {
                  const s = scores.get(p.id)!;
                  const idle = daysBetween(p.stageChangedAt, now);
                  return (
                    <div key={p.id} className="kanban-card" draggable onDragStart={() => setDrag(p.id)} onDragEnd={() => { setDrag(null); setOver(null); }}>
                      <div className="row" style={{ alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Link to={`/studio/projects/${p.id}`} onClick={e => e.stopPropagation()}><b>{clientName(db, p.clientId)}</b></Link>
                          <div className="faint" style={{ fontSize: 12 }}>{p.type} · {p.area} מ״ר · {p.city}</div>
                        </div>
                        {!isSigned(p.stage) && <span className={`lead-score ${s.label === 'חם' ? 'hot' : s.label === 'פושר' ? 'warm' : 'cold'}`} title={s.factors.map(f => `${f.label} (${f.points > 0 ? '+' : ''}${f.points})`).join('\n')}>{s.value}</span>}
                      </div>
                      <div className="row" style={{ marginTop: 8, fontSize: 12 }}>
                        <b className="num">{shekel(p.fee)}</b><span className="spacer" />
                        <span className={`row faint ${idle > 21 && !isSigned(p.stage) ? 'stale' : ''}`} style={{ gap: 4 }}><Clock size={12} />{idle} ימים</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className={`kanban-col lost ${over === 'אבוד' ? 'drop' : ''}`}
          onDragOver={e => { if (drag != null) { e.preventDefault(); setOver('אבוד'); } }} onDragLeave={() => setOver(null)}
          onDrop={() => { const p = db.projects.find(x => x.id === drag); setDrag(null); setOver(null); if (p) void move(p, 'אבוד'); }}>
          <div className="kanban-head" style={{ borderTopColor: STAGE_COLOR['אבוד'] }}><b><XCircle size={14} /> אבודים</b><span className="count num">{db.projects.filter(p => p.stage === 'אבוד').length}</span></div>
          <div className="faint" style={{ fontSize: 12, padding: 10 }}>גררו לכאן עסקה שלא נסגרה</div>
        </div>
      </div>
      {adding && <ProjectForm onClose={() => setAdding(false)} />}
    </div>
  );
}
