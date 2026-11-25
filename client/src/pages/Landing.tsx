import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarCheck, Check, Compass, Layers, LayoutDashboard, Moon, PenTool, RotateCcw, Sparkles, Sun, UserRound } from 'lucide-react';
import { selectDb, useAppDispatch, useAppSelector } from '../store';
import { create, loadAll } from '../store/dataSlice';
import { pushToast, toggleTheme } from '../store/uiSlice';
import type { PropertyType } from '../domain/types';
import { img } from '../domain/display';
import { dayName, formatShort, today } from '../domain/dates';
import { CITIES } from '../domain/geo';
import { isValidPhone } from '../domain/rules';
import { quote, shekel, type Finish, type ServiceLevel } from '../domain/pricing';
import { suggestMeetingSlots } from '../domain/smart/availability';
import { QUIZ, scoreQuiz, STYLE_INFO } from '../domain/smart/styleQuiz';
import { Logo } from '../components/Layout';
import { Field } from '../components/ui';
import '../styles/landing.css';

function BeforeAfter({ image }: { image: string }) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const move = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    setPos(Math.min(100, Math.max(0, ((r.right - clientX) / r.width) * 100)));
  };
  return (
    <div className="ba" ref={ref} dir="rtl" onPointerMove={e => e.buttons === 1 && move(e.clientX)} onPointerDown={e => move(e.clientX)}>
      <img src={img(image)} alt="אחרי" />
      <div className="ba-before" style={{ clipPath: `inset(0 0 0 ${100 - pos}%)` }}><img src={img(image)} alt="לפני" /></div>
      <div className="ba-handle" style={{ right: `${pos}%` }}><span>⟷</span></div>
      <span className="ba-tag" style={{ right: 12 }}>לפני</span><span className="ba-tag" style={{ left: 12 }}>אחרי</span>
    </div>
  );
}

function StyleQuiz() {
  const [answers, setAnswers] = useState<number[]>([]);
  const db = useAppSelector(selectDb);
  const done = answers.length === QUIZ.length;
  const result = done ? scoreQuiz(answers) : [];
  const step = QUIZ[answers.length];
  if (done) {
    const top = result[0];
    const recs = db.inspirations.filter(i => i.style === top.style).slice(0, 3);
    return (
      <div className="quiz-result">
        <div>
          <span className="badge gold"><Sparkles size={13} />הפרופיל העיצובי שלכם</span>
          <h3 className="display">{top.style} <span className="gold-text num">{top.pct}%</span></h3>
          <p className="muted">{STYLE_INFO[top.style].text}</p>
          <div className="palette-strip big">{STYLE_INFO[top.style].palette.map(c => <i key={c} style={{ background: c }} />)}</div>
          {result.slice(0, 4).map(r => (
            <div key={r.style} className="hbar-row" style={{ gridTemplateColumns: '80px 1fr 40px' }}>
              <span className="muted">{r.style}</span><div className="hbar-track"><div className="hbar-fill" style={{ width: `${r.pct}%` }} /></div><b className="num">{r.pct}%</b>
            </div>
          ))}
          <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => setAnswers([])}><RotateCcw size={14} />שוב מההתחלה</button>
        </div>
        <div className="quiz-recs">{recs.map(r => <img key={r.id} src={img(r.image)} alt={r.title} />)}</div>
      </div>
    );
  }
  return (
    <div>
      <div className="row" style={{ marginBottom: 14 }}><b className="display" style={{ fontSize: 22 }}>{step.q}</b><span className="spacer" /><span className="faint num">{answers.length + 1}/{QUIZ.length}</span></div>
      <div className="quiz-options">
        {step.options.map((o, i) => (
          <button key={o.label} className="quiz-option" onClick={() => setAnswers([...answers, i])}>
            {o.image ? <img src={img(o.image)} alt="" /> : <div className="quiz-swatch" />}
            <span>{o.label}</span>
          </button>
        ))}
      </div>
      <div className="progress" style={{ marginTop: 16 }}><div style={{ width: `${(answers.length / QUIZ.length) * 100}%` }} /></div>
    </div>
  );
}

function Calculator() {
  const [type, setType] = useState<PropertyType>('דירה');
  const [area, setArea] = useState(110);
  const [service, setService] = useState<ServiceLevel>('תכנון ועיצוב');
  const [finish, setFinish] = useState<Finish>('סטנדרט');
  const q = quote({ type, area, service, finish, rooms3d: 3 });
  return (
    <div className="grid cols-2" style={{ alignItems: 'start' }}>
      <div className="stack">
        <Field label="סוג הנכס"><div className="tabs" style={{ width: '100%' }}>{(['דירה', 'בית פרטי', 'פנטהאוז', 'משרד'] as PropertyType[]).map(t => <button key={t} className={`tab ${type === t ? 'active' : ''}`} style={{ flex: 1 }} onClick={() => setType(t)}>{t}</button>)}</div></Field>
        <Field label={`שטח: ${area} מ״ר`}><input type="range" min={40} max={400} step={5} value={area} onChange={e => setArea(Number(e.target.value))} /></Field>
        <Field label="היקף השירות"><div className="tabs" style={{ width: '100%' }}>{(['תכנון בלבד', 'תכנון ועיצוב', 'ליווי מלא'] as ServiceLevel[]).map(t => <button key={t} className={`tab ${service === t ? 'active' : ''}`} style={{ flex: 1 }} onClick={() => setService(t)}>{t}</button>)}</div></Field>
        <Field label="רמת גימור"><div className="tabs" style={{ width: '100%' }}>{(['בסיסי', 'סטנדרט', 'יוקרתי', 'פרימיום'] as Finish[]).map(t => <button key={t} className={`tab ${finish === t ? 'active' : ''}`} style={{ flex: 1 }} onClick={() => setFinish(t)}>{t}</button>)}</div></Field>
      </div>
      <div className="calc-result">
        <span className="faint">שכר טרחה משוער</span>
        <b className="display num" style={{ fontSize: 34 }}>בין {shekel(q.subtotal * 0.92)} ל-{shekel(q.subtotal * 1.08)}</b>
        <span className="faint">+ מע״מ · משך משוער {q.months} חודשים</span>
        <div className="divider" />
        <span className="faint">תקציב שיפוץ משוער ({finish})</span>
        <b className="num" style={{ fontSize: 24 }}>{shekel(q.renovationTotal)}</b>
        <div className="calc-split">{Object.entries(q.renovation).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => <span key={k}>{k}<b className="num">{shekel(v)}</b></span>)}</div>
        <a href="#book" className="btn btn-gold" style={{ marginTop: 14 }}>לתיאום פגישת היכרות<ArrowLeft size={16} /></a>
      </div>
    </div>
  );
}

function Booking() {
  const db = useAppSelector(selectDb);
  const dispatch = useAppDispatch();
  const [city, setCity] = useState('תל אביב');
  const [chosen, setChosen] = useState<{ date: string; from: string; to: string } | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', type: 'דירה' as PropertyType, area: 100 });
  const [done, setDone] = useState(false);
  const slots = useMemo(() => (db.workingHours.length ? suggestMeetingSlots(db, { city, duration: 60, limit: 6 }) : []), [db, city]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const [firstName, ...rest] = form.name.trim().split(' ');
    if (!firstName || !rest.length || !isValidPhone(form.phone) || !chosen) return dispatch(pushToast('error', 'נא למלא שם מלא, טלפון תקין ולבחור מועד'));
    const c = await dispatch(create('clients', { firstName, lastName: rest.join(' '), phone: form.phone, email: `${form.phone.replace(/\D/g, '')}@lead.demo`, city, source: 'אתר הסטודיו', createdAt: today(), notes: 'נקבע דרך האתר' }));
    if ('error' in c) return dispatch(pushToast('error', c.error.message ?? 'שגיאה'));
    const clientId = (c.payload as { item: { id: number } }).item.id;
    const p = await dispatch(create('projects', { clientId, name: `${form.type} ${rest.join(' ')} – ${city}`, type: form.type, stage: 'פגישת היכרות', style: 'מודרני', city, area: form.area, budget: form.area * 4000, fee: 0, startDate: today(), dueDate: today(), createdAt: today(), stageChangedAt: today(), palette: [], notes: '' }));
    if ('error' in p) return dispatch(pushToast('error', p.error.message ?? 'שגיאה'));
    const projectId = (p.payload as { item: { id: number } }).item.id;
    const m = await dispatch(create('meetings', { clientId, projectId, type: 'פגישת היכרות', ...chosen, city, status: 'מתוכנן', notes: 'נקבע דרך האתר' }));
    if ('error' in m) return dispatch(pushToast('error', m.error.message ?? 'המועד נתפס, בחרו מועד אחר'));
    setDone(true);
    dispatch(pushToast('success', 'הפגישה נקבעה! היא כבר מופיעה ביומן הסטודיו 🎉'));
  };

  if (done && chosen) return <div className="alert good" style={{ fontSize: 16 }}><CalendarCheck size={20} />נתראה ביום {dayName(chosen.date)}, {formatShort(chosen.date)} בשעה {chosen.from} ב{city}. הפגישה נוספה ליומן, הליד נפתח בצנרת המכירות. <Link to="/studio/calendar" style={{ textDecoration: 'underline' }}>לצפייה ביומן הסטודיו</Link></div>;
  return (
    <form className="grid cols-2" onSubmit={submit} style={{ alignItems: 'start' }}>
      <div className="stack">
        <Field label="איפה הנכס?"><select className="select" value={city} onChange={e => { setCity(e.target.value); setChosen(null); }}>{Object.keys(CITIES).map(c => <option key={c}>{c}</option>)}</select></Field>
        <div className="faint" style={{ fontSize: 13 }}>המועדים מחושבים לפי היומן של האדריכלית וזמני הנסיעה בין הפגישות</div>
        <div className="grid cols-2" style={{ gap: 8 }}>
          {slots.map(s => (
            <button type="button" key={s.date + s.from} className={`suggest-chip ${chosen?.date === s.date && chosen.from === s.from ? 'active' : ''}`} onClick={() => setChosen(s)}>
              <b>יום {dayName(s.date)} · {formatShort(s.date)}</b><span className="num">{s.from}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="stack">
        <Field label="שם מלא"><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="טלפון" error={form.phone.length > 3 && !isValidPhone(form.phone) ? 'מספר לא תקין' : null}><input className="input num" dir="ltr" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
        <div className="form-grid">
          <Field label="סוג נכס"><select className="select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as PropertyType })}>{['דירה', 'בית פרטי', 'פנטהאוז', 'משרד'].map(t => <option key={t}>{t}</option>)}</select></Field>
          <Field label="שטח (מ״ר)"><input className="input num" type="number" value={form.area} onChange={e => setForm({ ...form, area: Number(e.target.value) })} /></Field>
        </div>
        <button className="btn btn-gold" style={{ padding: 13 }} disabled={!chosen}>{chosen ? `קביעת פגישה ל-${formatShort(chosen.date)} ${chosen.from}` : 'בחרו מועד'}</button>
      </div>
    </form>
  );
}

export default function Landing() {
  const db = useAppSelector(selectDb);
  const status = useAppSelector(s => s.data.status);
  const theme = useAppSelector(s => s.ui.theme);
  const dispatch = useAppDispatch();
  useEffect(() => { if (status === 'idle') dispatch(loadAll()); }, [status, dispatch]);
  const completed = db.projects.filter(p => p.stage === 'הושלם').length;

  return (
    <div className="landing">
      <nav className="land-nav">
        <Link to="/" className="brand" style={{ padding: 0 }}><Logo size={40} /><span className="brand-name">אטלייה</span></Link>
        <div className="land-links"><a href="#work">עבודות</a><a href="#quiz">שאלון סגנון</a><a href="#calc">מחשבון</a><a href="#book">פגישת היכרות</a></div>
        <span className="spacer" />
        <button className="btn btn-ghost icon-btn" onClick={() => dispatch(toggleTheme())} aria-label="ערכת צבעים">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
        <Link to="/portal" className="btn hide-sm"><UserRound size={16} />אזור לקוחות</Link>
        <Link to="/studio" className="btn btn-gold"><LayoutDashboard size={16} />כניסה לסטודיו</Link>
      </nav>

      <header className="hero-arch">
        <div className="hero-text">
          <span className="eyebrow">אדריכלות · עיצוב פנים · ליווי פרויקטים</span>
          <h1 className="display hero-title">בתים שמספרים<br />את <span className="gold-text">הסיפור שלכם</span></h1>
          <p className="hero-sub">מתכננים חללים מדויקים, חמים ונכונים לאורח החיים שלכם, מהסקיצה הראשונה ועד הכנסת הריהוט.</p>
          <div className="row wrap"><a href="#book" className="btn btn-gold btn-lg">לפגישת היכרות<ArrowLeft size={18} /></a><a href="#quiz" className="btn btn-lg">✦ גלו את הסגנון שלכם</a></div>
          <div className="hero-stats-row">
            <div><b className="num">{completed + 120}+</b><span>פרויקטים</span></div>
            <div><b className="num">14</b><span>שנות ניסיון</span></div>
            <div><b className="num">4.9★</b><span>דירוג לקוחות</span></div>
          </div>
        </div>
        <div className="hero-collage">
          <img src={img('living-cream')} alt="סלון" className="c1" />
          <img src={img('villa-pool')} alt="וילה" className="c2" />
          <img src={img('dining-green')} alt="פינת אוכל" className="c3" />
        </div>
      </header>

      <section className="services">
        {[[Compass, 'תכנון אדריכלי', 'תוכניות העמדה, היתרים ותכנון שינויים פנימיים'], [PenTool, 'עיצוב פנים', 'חומרים, צבעים, תאורה ונגרות בהתאמה אישית'], [Layers, 'הדמיות תלת-ממד', 'רואים את הבית לפני שמתחילים לבנות'], [Check, 'ליווי ופיקוח', 'מול קבלנים וספקים, עד המפתח']].map(([I, t, d]) => {
          const Icon = I as typeof Compass;
          return <div key={t as string} className="service"><span className="kpi-icon"><Icon size={20} /></span><b>{t as string}</b><p className="muted">{d as string}</p></div>;
        })}
      </section>

      <section id="work" className="land-section">
        <div className="section-head"><h2 className="display">עבודות <span className="gold-text">נבחרות</span></h2><p>הצצה לפרויקטים מהשנים האחרונות</p></div>
        <div className="masonry">{db.inspirations.slice(0, 10).map(i => <figure key={i.id} className="masonry-item"><img src={img(i.image)} alt={i.title} loading="lazy" /><figcaption><b>{i.title}</b><span>{i.style}</span></figcaption></figure>)}</div>
      </section>

      <section className="land-section">
        <div className="section-head"><h2 className="display">לפני <span className="gold-text">ואחרי</span></h2><p>גררו את הקו כדי לראות את השינוי (המחשה)</p></div>
        <div className="grid cols-2"><BeforeAfter image="living-gray" /><BeforeAfter image="kitchen-white" /></div>
      </section>

      <section id="quiz" className="land-section">
        <div className="section-head"><h2 className="display">מה <span className="gold-text">הסגנון</span> שלכם?</h2><p>5 שאלות קצרות, ותקבלו פרופיל עיצובי עם פלטת צבעים והשראות מותאמות</p></div>
        <div className="card"><StyleQuiz /></div>
      </section>

      <section id="calc" className="land-section">
        <div className="section-head"><h2 className="display">כמה זה <span className="gold-text">עולה?</span></h2><p>הערכה ראשונית לפי סוג הנכס, השטח והיקף השירות</p></div>
        <div className="card"><Calculator /></div>
      </section>

      <section id="book" className="land-section">
        <div className="section-head"><h2 className="display">פגישת <span className="gold-text">היכרות</span></h2><p>בחרו מועד פנוי. הוא נכנס ישר ליומן של הסטודיו.</p></div>
        <div className="card">{status === 'ready' ? <Booking /> : <div className="skeleton" style={{ height: 200 }} />}</div>
      </section>

      <footer className="land-foot"><Logo size={28} /><span>אטלייה · אדריכלות ועיצוב פנים</span><span className="spacer" /><span className="faint">פרויקט הדגמה · כל הנתונים בדויים · תמונות: Unsplash</span></footer>
    </div>
  );
}
