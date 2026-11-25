import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileSignature, Printer } from 'lucide-react';
import { selectDb, useAction, useAppSelector } from '../store';
import { signProposal } from '../store/dataSlice';
import { addMonths, formatDate, today } from '../domain/dates';
import { PAYMENT_PLAN, quote, shekel, VAT, type Finish, type ServiceLevel } from '../domain/pricing';
import { isSigned } from '../domain/rules';
import { clientName } from '../domain/smart/insights';
import { HBarList } from '../components/charts';
import { Field } from '../components/ui';
import SignaturePad from '../components/SignaturePad';
import { Logo } from '../components/Layout';

export default function Proposal() {
  const db = useAppSelector(selectDb);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const run = useAction();
  const open = db.projects.filter(p => !isSigned(p.stage) && p.stage !== 'אבוד');
  const projectId = Number(params.get('project')) || open[0]?.id;
  const p = db.projects.find(x => x.id === projectId);
  const [service, setService] = useState<ServiceLevel>('תכנון ועיצוב');
  const [finish, setFinish] = useState<Finish>('סטנדרט');
  const [rooms3d, setRooms3d] = useState(3);
  const [discount, setDiscount] = useState(0);
  const [start, setStart] = useState(today());
  const [plan, setPlan] = useState(PAYMENT_PLAN.map(x => ({ ...x })));
  const [signed, setSigned] = useState(false);
  const q = useMemo(() => (p ? quote({ type: p.type, area: p.area, service, finish, rooms3d, discountPct: discount / 100 }) : null), [p, service, finish, rooms3d, discount]);

  if (!p || !q) return <div className="page"><h1>הצעת מחיר</h1><p className="muted">אין לידים פתוחים.</p></div>;
  const planSum = plan.reduce((s, x) => s + x.percent, 0);
  const fee = q.subtotal - q.discount;
  const due = addMonths(start, q.months);
  const overBudget = q.renovationTotal > p.budget;

  const sign = async () => {
    const ok = await run(signProposal({ projectId: p.id, fee, startDate: start, dueDate: due, plan }), 'ההצעה נחתמה! הפרויקט עבר לשלב "נחתם" ולוח התשלומים נוצר 🎉');
    if (ok) navigate(`/studio/projects/${p.id}`);
  };

  return (
    <div className="page">
      <div className="page-head no-print">
        <div><h1>בונה הצעות מחיר</h1><p>התמחור מחושב אוטומטית לפי סוג הנכס, השטח, היקף השירות ורמת הגימור. בחתימה הפרויקט עובר לשלב "נחתם" ולוח התשלומים נוצר.</p></div>
        <button className="btn" onClick={() => window.print()}><Printer size={17} />הדפסה / PDF</button>
      </div>

      <div className="grid proposal-grid">
        <div className="card no-print">
          <div className="stack">
            <Field label="ליד / פרויקט">
              <select className="select" value={p.id} onChange={e => setParams({ project: e.target.value })}>
                {open.map(x => <option key={x.id} value={x.id}>{clientName(db, x.clientId)} · {x.type} {x.area} מ״ר</option>)}
              </select>
            </Field>
            <Field label="היקף השירות">
              <div className="tabs" style={{ width: '100%' }}>{(['תכנון בלבד', 'תכנון ועיצוב', 'ליווי מלא'] as ServiceLevel[]).map(s => <button key={s} type="button" className={`tab ${service === s ? 'active' : ''}`} style={{ flex: 1 }} onClick={() => setService(s)}>{s}</button>)}</div>
            </Field>
            <Field label="רמת גימור (לתקציב השיפוץ)">
              <div className="tabs" style={{ width: '100%' }}>{(['בסיסי', 'סטנדרט', 'יוקרתי', 'פרימיום'] as Finish[]).map(s => <button key={s} type="button" className={`tab ${finish === s ? 'active' : ''}`} style={{ flex: 1 }} onClick={() => setFinish(s)}>{s}</button>)}</div>
            </Field>
            <div className="form-grid">
              <Field label={`הדמיות תלת-ממד: ${rooms3d} חללים`}><input type="range" min={0} max={8} value={rooms3d} onChange={e => setRooms3d(Number(e.target.value))} /></Field>
              <Field label={`הנחה: ${discount}%`}><input type="range" min={0} max={15} value={discount} onChange={e => setDiscount(Number(e.target.value))} /></Field>
              <Field label="תאריך התחלה"><input className="input" type="date" value={start} onChange={e => setStart(e.target.value)} /></Field>
              <Field label="משך משוער"><input className="input" disabled value={`${q.months} חודשים · עד ${formatDate(due)}`} /></Field>
            </div>
            <div className="divider" />
            <b>לוח תשלומים</b>
            {plan.map((x, i) => (
              <div key={i} className="row">
                <input className="input" value={x.label} onChange={e => setPlan(plan.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} />
                <input className="input num" style={{ width: 80 }} type="number" min={0} max={100} value={x.percent} onChange={e => setPlan(plan.map((y, j) => (j === i ? { ...y, percent: Number(e.target.value) } : y)))} />
                <span className="num faint" style={{ width: 80 }}>{shekel(fee * x.percent / 100)}</span>
              </div>
            ))}
            <div className={`alert ${planSum === 100 ? 'good' : 'bad'}`}>סה״כ {planSum}%{planSum !== 100 && ' – חייב להסתכם ב-100%'}</div>
            <div className="divider" />
            <b>הערכת תקציב שיפוץ ({finish})</b>
            <HBarList data={Object.entries(q.renovation).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)} format={shekel} unit="" />
            <div className={`alert ${overBudget ? 'warn' : 'good'}`}>
              {overBudget ? `הערכת השיפוץ (${shekel(q.renovationTotal)}) גבוהה מתקציב הלקוח (${shekel(p.budget)}). כדאי לשקול רמת גימור נמוכה יותר.` : `הערכת השיפוץ (${shekel(q.renovationTotal)}) בתוך תקציב הלקוח (${shekel(p.budget)}).`}
            </div>
          </div>
        </div>

        <div className="card proposal-doc">
          <div className="row" style={{ marginBottom: 20 }}>
            <Logo size={44} />
            <div><div className="brand-name" style={{ fontSize: 24 }}>אטלייה</div><div className="faint" style={{ fontSize: 12 }}>אדריכלות ועיצוב פנים</div></div>
            <span className="spacer" />
            <div style={{ textAlign: 'left', fontSize: 13 }} className="muted">הצעה מס׳ {2026000 + p.id}<br />{formatDate(today())}</div>
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 26 }}>הצעת מחיר לתכנון ועיצוב</h2>
          <p className="muted">לכבוד {clientName(db, p.clientId)} · {p.type} בשטח {p.area} מ״ר ב{p.city} · סגנון {p.style}</p>
          <table className="table" style={{ marginTop: 16 }}>
            <thead><tr><th>פריט</th><th style={{ textAlign: 'left' }}>סכום</th></tr></thead>
            <tbody>
              {q.lines.map(l => <tr key={l.label}><td>{l.label}{l.note && <div className="faint" style={{ fontSize: 12 }}>{l.note}</div>}</td><td className="num" style={{ textAlign: 'left' }}>{shekel(l.amount)}</td></tr>)}
              {q.discount > 0 && <tr><td>הנחה ({discount}%)</td><td className="num" style={{ textAlign: 'left', color: 'var(--good)' }}>−{shekel(q.discount)}</td></tr>}
              <tr><td>מע״מ ({VAT * 100}%)</td><td className="num" style={{ textAlign: 'left' }}>{shekel(q.vat)}</td></tr>
              <tr className="total-row"><td><b>סה״כ לתשלום</b></td><td className="num" style={{ textAlign: 'left' }}><b>{shekel(q.total)}</b></td></tr>
            </tbody>
          </table>
          <h3 style={{ margin: '22px 0 8px' }}>לוח תשלומים</h3>
          {plan.map((x, i) => <div key={i} className="row" style={{ padding: '4px 0', fontSize: 14 }}><span>{i + 1}. {x.label}</span><span className="spacer" /><span className="num">{x.percent}% · {shekel((fee * x.percent / 100) * (1 + VAT))}</span></div>)}
          <h3 style={{ margin: '22px 0 8px' }}>לוח זמנים</h3>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>תחילת עבודה {formatDate(start)}, סיום משוער {formatDate(due)} ({q.months} חודשים).</p>
          <div style={{ marginTop: 26 }}><SignaturePad onChange={setSigned} /></div>
          <button className="btn btn-gold no-print" style={{ width: '100%', marginTop: 14, padding: 13 }} disabled={!signed || planSum !== 100} onClick={sign}>
            <FileSignature size={17} />{signed ? 'חתימה ואישור ההצעה' : 'יש לחתום למעלה כדי לאשר'}
          </button>
        </div>
      </div>
    </div>
  );
}
