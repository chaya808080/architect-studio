import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Palette, X } from 'lucide-react';
import { useAction, useAppSelector } from '../store';
import { update } from '../store/dataSlice';
import type { Inspiration, Style } from '../domain/types';
import { STYLES } from '../domain/types';
import { img } from '../domain/display';

export default function Inspirations() {
  const items = useAppSelector(s => s.data.inspirations);
  const run = useAction();
  const [style, setStyle] = useState<Style | 'הכול'>('הכול');
  const [room, setRoom] = useState('הכול');
  const [open, setOpen] = useState<Inspiration | null>(null);
  const rooms = ['הכול', ...new Set(items.map(i => i.room))];
  const rows = items.filter(i => (style === 'הכול' || i.style === style) && (room === 'הכול' || i.room === room)).sort((a, b) => b.likes - a.likes);

  return (
    <div className="page" style={{ maxWidth: 'none' }}>
      <div className="page-head"><div><h1>גלריית השראות</h1><p>{items.length} תמונות לפי סגנון וחלל · ❤ מסמן מועדפים ללקוחות</p></div></div>
      <div className="toolbar">
        <div className="tabs">{(['הכול', ...STYLES] as const).map(s => <button key={s} className={`tab ${style === s ? 'active' : ''}`} onClick={() => setStyle(s)}>{s}</button>)}</div>
        <select className="select" style={{ width: 160 }} value={room} onChange={e => setRoom(e.target.value)}>{rooms.map(r => <option key={r}>{r}</option>)}</select>
      </div>
      <div className="masonry">
        {rows.map(i => (
          <figure key={i.id} className="masonry-item" onClick={() => setOpen(i)}>
            <img src={img(i.image)} alt={i.title} loading="lazy" />
            <figcaption>
              <b>{i.title}</b><span>{i.style} · {i.room}</span>
              <button className="like" onClick={e => { e.stopPropagation(); void run(update('inspirations', { ...i, likes: i.likes + 1 })); }}><Heart size={14} /> {i.likes}</button>
            </figcaption>
          </figure>
        ))}
      </div>
      {open && (
        <div className="overlay" onMouseDown={e => e.target === e.currentTarget && setOpen(null)}>
          <div className="lightbox">
            <img src={img(open.image)} alt={open.title} />
            <div className="row" style={{ padding: 14 }}>
              <div><b>{open.title}</b><div className="faint" style={{ fontSize: 13 }}>{open.style} · {open.room}</div></div>
              <span className="spacer" />
              <Link className="btn" to="/studio/palette"><Palette size={15} />חילוץ פלטה</Link>
              <button className="btn btn-ghost icon-btn" onClick={() => setOpen(null)} aria-label="סגירה"><X size={18} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
