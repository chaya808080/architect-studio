import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Brain, CalendarDays, CheckCircle2, CircleAlert, FileSignature, FolderKanban, Home, Images, Info, KanbanSquare, LayoutDashboard,
  Menu, Moon, Palette, Ruler, RotateCcw, Search, Sofa, Sun, Users, Wallet,
} from 'lucide-react';
import { api } from '../api';
import { loadAll } from '../store/dataSlice';
import { dismissToast, setPalette, setSidebar, toggleTheme } from '../store/uiSlice';
import { selectLookups, useAppDispatch, useAppSelector } from '../store';
import { Avatar } from './ui';
import Assistant from './Assistant';

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="var(--text)" />
      <path d="M12 36 L24 11 L36 36" fill="none" stroke="var(--gold-2)" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M17 27 H31" stroke="var(--gold-2)" strokeWidth="3" />
    </svg>
  );
}

type NavItem = { section: string } | { to: string; label: string; icon: typeof Home; end?: boolean; count?: 'leads' | 'active' };
const NAV: NavItem[] = [
  { section: 'ראשי' },
  { to: '/studio', label: 'לוח בקרה', icon: LayoutDashboard, end: true },
  { to: '/studio/calendar', label: 'יומן פגישות', icon: CalendarDays },
  { to: '/studio/insights', label: 'תובנות חכמות', icon: Brain },
  { section: 'מכירות' },
  { to: '/studio/pipeline', label: 'צנרת מכירות', icon: KanbanSquare, count: 'leads' },
  { to: '/studio/proposal', label: 'הצעת מחיר', icon: FileSignature },
  { to: '/studio/clients', label: 'לקוחות', icon: Users },
  { section: 'פרויקטים' },
  { to: '/studio/projects', label: 'פרויקטים', icon: FolderKanban, count: 'active' },
  { to: '/studio/finance', label: 'כספים ותזרים', icon: Wallet },
  { section: 'כלי עיצוב' },
  { to: '/studio/planner', label: 'מתכנן חדרים', icon: Sofa },
  { to: '/studio/palette', label: 'פלטת צבעים', icon: Palette },
  { to: '/studio/materials', label: 'מחשבון חומרים', icon: Ruler },
  { to: '/studio/inspirations', label: 'השראות', icon: Images },
];

function Sidebar() {
  const dispatch = useAppDispatch();
  const open = useAppSelector(s => s.ui.sidebarOpen);
  const leads = useAppSelector(s => s.data.projects.filter(p => ['ליד', 'פגישת היכרות', 'הצעת מחיר'].includes(p.stage)).length);
  const active = useAppSelector(s => s.data.projects.filter(p => ['נחתם', 'תכנון', 'ביצוע'].includes(p.stage)).length);
  const counts = { leads, active };
  const location = useLocation();
  useEffect(() => { dispatch(setSidebar(false)); }, [location.pathname, dispatch]);

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <NavLink to="/" className="brand">
        <Logo />
        <div>
          <div className="brand-name">אטלייה</div>
          <div className="brand-sub">אדריכלות ועיצוב פנים</div>
        </div>
      </NavLink>
      <nav style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map((item, i) => 'section' in item ? <div key={i} className="nav-section">{item.section}</div> : (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <item.icon size={18} />
            {item.label}
            {item.count && <span className="count num">{counts[item.count]}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-foot">
        {api.mode === 'demo' ? (
          <>
            <span className="badge gold">מצב הדגמה</span>
            <p className="faint" style={{ margin: '8px 0' }}>הנתונים בדויים ונשמרים בדפדפן בלבד.</p>
            <button className="btn btn-sm" style={{ width: '100%' }} onClick={() => { api.resetDemo?.(); dispatch(loadAll()); }}><RotateCcw size={14} />איפוס נתוני הדגמה</button>
          </>
        ) : <span className="badge good"><span className="dot" />מחובר לשרת</span>}
      </div>
    </aside>
  );
}

function Topbar() {
  const dispatch = useAppDispatch();
  const theme = useAppSelector(s => s.ui.theme);
  return (
    <header className="topbar">
      <button className="btn btn-ghost icon-btn menu-btn" onClick={() => dispatch(setSidebar(true))} aria-label="תפריט"><Menu size={20} /></button>
      <button className="search-trigger" onClick={() => dispatch(setPalette(true))}>
        <Search size={17} />
        <span className="search-text">חיפוש לקוח, פרויקט או עמוד…</span>
        <kbd>Ctrl K</kbd>
      </button>
      <span className="spacer" />
      <button className="btn btn-ghost icon-btn" onClick={() => dispatch(toggleTheme())} aria-label="החלפת ערכת צבעים">{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button>
      <NavLink to="/" className="btn btn-ghost icon-btn" aria-label="לאתר"><Home size={19} /></NavLink>
      <div className="row" style={{ gap: 10 }}>
        <Avatar name="האדריכלית" id={4} />
        <div className="user-meta" style={{ lineHeight: 1.2 }}><b style={{ fontSize: 14 }}>האדריכלית</b><div className="faint" style={{ fontSize: 12 }}>בעלת הסטודיו</div></div>
      </div>
    </header>
  );
}

export function Toasts() {
  const toasts = useAppSelector(s => s.ui.toasts);
  const dispatch = useAppDispatch();
  useEffect(() => {
    const timers = toasts.map(t => setTimeout(() => dispatch(dismissToast(t.id)), t.kind === 'error' ? 5500 : 3200));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dispatch]);
  const Icon = { success: CheckCircle2, error: CircleAlert, info: Info };
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map(t => { const I = Icon[t.kind]; return <div key={t.id} className={`toast ${t.kind}`} onClick={() => dispatch(dismissToast(t.id))}><I size={19} />{t.message}</div>; })}
    </div>
  );
}

function CommandPalette() {
  const open = useAppSelector(s => s.ui.paletteOpen);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { client } = useAppSelector(selectLookups);
  const projects = useAppSelector(s => s.data.projects);
  const clients = useAppSelector(s => s.data.clients);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); dispatch(setPalette(!open)); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dispatch]);
  useEffect(() => { if (open) { setQ(''); setActive(0); setTimeout(() => inputRef.current?.focus(), 10); } }, [open]);

  const items = useMemo(() => {
    const t = q.trim();
    const match = (s: string) => !t || s.includes(t);
    const pages = NAV.filter((n): n is Extract<NavItem, { to: string }> => 'to' in n).map(n => ({ group: 'עמודים', label: n.label, to: n.to, sub: '' }));
    return [
      ...pages.filter(p => match(p.label)),
      ...projects.filter(p => match(`${p.name} ${client.get(p.clientId)?.firstName ?? ''}`)).slice(0, 6).map(p => ({ group: 'פרויקטים', label: p.name, to: `/studio/projects/${p.id}`, sub: p.stage })),
      ...clients.filter(c => match(`${c.firstName} ${c.lastName} ${c.phone}`)).slice(0, 5).map(c => ({ group: 'לקוחות', label: `${c.firstName} ${c.lastName}`, to: '/studio/clients', sub: c.city })),
    ].slice(0, 14);
  }, [q, projects, clients, client]);

  if (!open) return null;
  const go = (to: string) => { dispatch(setPalette(false)); navigate(to); };
  return (
    <div className="overlay" onMouseDown={e => e.target === e.currentTarget && dispatch(setPalette(false))}>
      <div className="modal palette" role="dialog" aria-label="חיפוש מהיר">
        <div className="palette-input">
          <Search size={20} className="faint" />
          <input ref={inputRef} value={q} placeholder="הקלידו לחיפוש…" onChange={e => { setQ(e.target.value); setActive(0); }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(items.length - 1, a + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
              if (e.key === 'Enter' && items[active]) go(items[active].to);
              if (e.key === 'Escape') dispatch(setPalette(false));
            }} />
          <kbd>Esc</kbd>
        </div>
        <div className="palette-list">
          {items.length === 0 && <div className="empty">לא נמצאו תוצאות</div>}
          {items.map((it, i) => (
            <div key={it.group + it.label + i}>
              {(i === 0 || items[i - 1].group !== it.group) && <div className="palette-group">{it.group}</div>}
              <div className={`palette-item ${i === active ? 'active' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => go(it.to)}>{it.label}<small>{it.sub}</small></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const status = useAppSelector(s => s.data.status);
  const dispatch = useAppDispatch();
  useEffect(() => { if (status === 'idle') dispatch(loadAll()); }, [status, dispatch]);
  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <Topbar />
        {status === 'error' ? <div className="page"><div className="alert bad">לא ניתן לטעון נתונים מהשרת. ודאו שה-API פועל ונסו שוב.</div></div> : <Outlet />}
      </div>
      <CommandPalette />
      <Assistant />
    </div>
  );
}
