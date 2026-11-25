import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Inbox, Search, X } from 'lucide-react';

export function Modal({ title, icon, onClose, children, footer, wide }: {
  title: ReactNode; icon?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          {icon && <div className="kpi-icon">{icon}</div>}
          <h2>{title}</h2>
          <span className="spacer" />
          <button className="btn btn-ghost icon-btn" onClick={onClose} aria-label="סגירה"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Field({ label, hint, error, ok, children, full }: {
  label: string; hint?: string; error?: string | null; ok?: string | null; children: ReactNode; full?: boolean;
}) {
  return (
    <label className={`field ${full ? 'full' : ''}`}>
      {label}
      {children}
      {error ? <span className="error-text">{error}</span> : ok ? <span className="ok-text">{ok}</span> : hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}

const GRADIENTS = [['#3987e5', '#6250d6'], ['#d95926', '#e3b54a'], ['#199e70', '#3987e5'], ['#d55181', '#9085e9'], ['#c98500', '#d95926'], ['#6250d6', '#d55181']];
export function Avatar({ name, id, size }: { name: string; id: number; size?: 'lg' }) {
  const [a1, a2] = GRADIENTS[id % GRADIENTS.length];
  const initials = name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('');
  return <div className={`avatar ${size ?? ''}`} style={{ '--a1': a1, '--a2': a2 } as React.CSSProperties}>{initials}</div>;
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <Inbox size={40} />
      <h3>{title}</h3>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="search">
      <Search size={16} />
      <input className="input" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="tabs" role="tablist">
      {options.map(o => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={`tab ${value === o.value ? 'active' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}{o.count != null && <span className="count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Imperative confirm dialog: `const [confirm, dialog] = useConfirm(); if (await confirm('...')) ...` */
export function useConfirm(): [(text: string, title?: string) => Promise<boolean>, ReactNode] {
  const [state, setState] = useState<{ text: string; title: string; resolve: (v: boolean) => void } | null>(null);
  const ask = (text: string, title = 'אישור פעולה') => new Promise<boolean>(resolve => setState({ text, title, resolve }));
  const close = (v: boolean) => { state?.resolve(v); setState(null); };
  const dialog = state && (
    <Modal title={state.title} onClose={() => close(false)} footer={<>
      <button className="btn btn-danger" onClick={() => close(true)}>אישור</button>
      <button className="btn btn-ghost" onClick={() => close(false)}>ביטול</button>
    </>}>
      <p style={{ margin: 0 }}>{state.text}</p>
    </Modal>
  );
  return [ask, dialog];
}

export const Skeleton = ({ h = 18, w = '100%' }: { h?: number; w?: number | string }) => <div className="skeleton" style={{ height: h, width: w }} />;
