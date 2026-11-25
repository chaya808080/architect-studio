import { useMemo, useRef, useState } from 'react';
import { Download, RotateCw, Trash2, Wand2 } from 'lucide-react';
import { analyze, autoLayout, byKey, CATALOG, GRID, rect, snap, WALKWAY, type Item, type RoomKind } from '../domain/smart/planner';
import { Field } from '../components/ui';

const KINDS: RoomKind[] = ['סלון', 'חדר שינה', 'משרד ביתי', 'פינת אוכל'];

export default function Planner() {
  const [room, setRoom] = useState({ w: 520, h: 420 });
  const [kind, setKind] = useState<RoomKind>('סלון');
  const [items, setItems] = useState<Item[]>(() => autoLayout('סלון', 520, 420));
  const [selected, setSelected] = useState<number | null>(null);
  const drag = useRef<{ id: number; dx: number; dy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const result = useMemo(() => analyze(items, room.w, room.h), [items, room]);
  const flagged = new Map<number, 'error' | 'warn'>();
  result.issues.forEach(i => i.ids.forEach(id => { if (flagged.get(id) !== 'error') flagged.set(id, i.level); }));

  const toRoom = (e: React.PointerEvent) => {
    const pt = svgRef.current!.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svgRef.current!.getScreenCTM()!.inverse());
    return { x: p.x, y: p.y };
  };
  const add = (key: string) => {
    const t = byKey(key);
    const id = Math.max(0, ...items.map(i => i.id)) + 1;
    setItems([...items, { id, key, x: snap(room.w / 2 - t.w / 2), y: snap(room.h / 2 - t.d / 2), rot: 0 }]);
    setSelected(id);
  };
  const rotate = (id: number) => setItems(items.map(i => (i.id === id ? { ...i, rot: i.rot ? 0 : 90 } : i)));
  const del = (id: number) => { setItems(items.filter(i => i.id !== id)); setSelected(null); };

  const exportPng = () => {
    const svg = new XMLSerializer().serializeToString(svgRef.current!);
    const image = new Image();
    image.onload = () => {
      const c = document.createElement('canvas');
      c.width = room.w * 2 + 80; c.height = room.h * 2 + 80;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(image, 0, 0, c.width, c.height);
      Object.assign(document.createElement('a'), { href: c.toDataURL('image/png'), download: `plan-${kind}.png` }).click();
    };
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };

  // solid furniture first so rugs render below
  const ordered = [...items].sort((a, b) => Number(!byKey(a.key).floor) - Number(!byKey(b.key).floor));
  const sel = items.find(i => i.id === selected);

  return (
    <div className="page" style={{ maxWidth: 'none' }}>
      <div className="page-head">
        <div><h1>מתכנן חדרים</h1><p>גררו רהיטים על התוכנית (הצמדה לרשת של {GRID} ס״מ) · לחיצה כפולה מסובבת · המערכת בודקת חפיפות, חריגה מהקירות ומעברים צרים מ-{WALKWAY} ס״מ</p></div>
        <div className="row">
          <button className="btn" onClick={exportPng}><Download size={16} />ייצוא PNG</button>
          <button className="btn btn-gold" onClick={() => { setItems(autoLayout(kind, room.w, room.h)); setSelected(null); }}><Wand2 size={16} />סידור אוטומטי</button>
        </div>
      </div>
      <div className="planner">
        <div className="card planner-side">
          <div className="form-grid">
            <Field label="רוחב החדר (ס״מ)"><input className="input num" type="number" min={200} max={1200} step={10} value={room.w} onChange={e => setRoom({ ...room, w: Number(e.target.value) })} /></Field>
            <Field label="עומק החדר (ס״מ)"><input className="input num" type="number" min={200} max={1200} step={10} value={room.h} onChange={e => setRoom({ ...room, h: Number(e.target.value) })} /></Field>
            <Field label="סוג חלל" full><select className="select" value={kind} onChange={e => setKind(e.target.value as RoomKind)}>{KINDS.map(k => <option key={k}>{k}</option>)}</select></Field>
          </div>
          <div className="divider" />
          <b style={{ fontSize: 13 }}>הוספת רהיט</b>
          <div className="catalog">
            {CATALOG.map(c => (
              <button key={c.key} className="catalog-item" onClick={() => add(c.key)}>
                <i style={{ background: c.color, aspectRatio: `${c.w}/${c.d}` }} />
                <span>{c.label}</span><small className="faint num">{c.w}×{c.d}</small>
              </button>
            ))}
          </div>
          {sel && <>
            <div className="divider" />
            <div className="row"><b>{byKey(sel.key).label}</b><span className="spacer" />
              <button className="btn btn-sm" onClick={() => rotate(sel.id)}><RotateCw size={14} />סיבוב</button>
              <button className="btn btn-sm btn-danger" onClick={() => del(sel.id)}><Trash2 size={14} /></button>
            </div>
          </>}
        </div>

        <div className="card planner-canvas">
          <svg ref={svgRef} viewBox={`-40 -40 ${room.w + 80} ${room.h + 80}`} xmlns="http://www.w3.org/2000/svg" style={{ touchAction: 'none' }}
            onPointerMove={e => {
              if (!drag.current) return;
              const p = toRoom(e);
              setItems(its => its.map(i => (i.id === drag.current!.id ? { ...i, x: snap(p.x - drag.current!.dx), y: snap(p.y - drag.current!.dy) } : i)));
            }}
            onPointerUp={() => { drag.current = null; }}
            onPointerLeave={() => { drag.current = null; }}
            onPointerDown={e => { if (e.target === e.currentTarget) setSelected(null); }}>
            <defs>
              <pattern id="grid" width={GRID * 5} height={GRID * 5} patternUnits="userSpaceOnUse"><path d={`M ${GRID * 5} 0 L 0 0 0 ${GRID * 5}`} fill="none" stroke="#c9c2b6" strokeWidth="0.6" /></pattern>
            </defs>
            <rect x={0} y={0} width={room.w} height={room.h} fill="#fbf9f5" />
            <rect x={0} y={0} width={room.w} height={room.h} fill="url(#grid)" />
            <rect x={-8} y={-8} width={room.w + 16} height={room.h + 16} fill="none" stroke="#2b2a27" strokeWidth={16} />
            {/* door opening + swing on the right wall */}
            <rect x={room.w - 10} y={room.h - 130} width={16} height={90} fill="#fbf9f5" />
            <path d={`M ${room.w} ${room.h - 40} A 90 90 0 0 1 ${room.w - 90} ${room.h - 130}`} fill="none" stroke="#9c7a4f" strokeDasharray="4 4" />
            <text x={room.w / 2} y={-18} textAnchor="middle" fontSize="16" fill="#5b5852">{room.w} ס״מ</text>
            <text x={-22} y={room.h / 2} textAnchor="middle" fontSize="16" fill="#5b5852" transform={`rotate(-90 -22 ${room.h / 2})`}>{room.h} ס״מ</text>
            {ordered.map(it => {
              const r = rect(it);
              const t = byKey(it.key);
              const flag = flagged.get(it.id);
              return (
                <g key={it.id} style={{ cursor: 'grab' }}
                  onPointerDown={e => { e.stopPropagation(); const p = toRoom(e); drag.current = { id: it.id, dx: p.x - it.x, dy: p.y - it.y }; setSelected(it.id); }}
                  onDoubleClick={() => rotate(it.id)}>
                  <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={t.floor ? 6 : 8} fill={t.color} opacity={t.floor ? 0.55 : 0.92}
                    stroke={flag === 'error' ? '#c0392b' : flag === 'warn' ? '#d68910' : selected === it.id ? '#1c1b19' : 'rgba(0,0,0,.25)'}
                    strokeWidth={flag || selected === it.id ? 4 : 1.5} strokeDasharray={flag === 'warn' ? '8 5' : undefined} />
                  {!t.floor && <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 5} textAnchor="middle" fontSize={Math.min(16, r.w / 5)} fill="#fff" style={{ pointerEvents: 'none', fontWeight: 600 }}>{t.label}</text>}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="card planner-side">
          <div className="card-title"><h3>ניתוח התוכנית</h3></div>
          <div className="stat-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div><b className="num">{((room.w * room.h) / 10000).toFixed(1)}</b><span>מ״ר</span></div>
            <div><b className="num">{Math.round(result.coverage * 100)}%</b><span>תפוסת ריהוט</span></div>
          </div>
          <div className={`alert ${result.coverage > 0.45 ? 'warn' : 'info'}`} style={{ marginTop: 12 }}>{result.verdict}</div>
          <div className="stack" style={{ gap: 8, marginTop: 12 }}>
            {result.issues.length === 0 && <div className="alert good">אין חפיפות או מעברים צרים ✓</div>}
            {result.issues.map((i, n) => <div key={n} className={`alert ${i.level === 'error' ? 'bad' : 'warn'}`} style={{ padding: '8px 10px' }}>{i.text}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
