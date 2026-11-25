import { useState } from 'react';
import { Field } from '../components/ui';
import { estimate } from '../domain/smart/materials';
import { shekel } from '../domain/pricing';

const PRICES = { paintPerL: 42, floorPerM2: 189, skirtingPerM: 38, boardSheet: 65 };

export default function Materials() {
  const [room, setRoom] = useState({ length: 5.2, width: 4.1, height: 2.7, doors: 1, windows: 2 });
  const [opts, setOpts] = useState({ tileCm: 60, tilesPerBox: 4, diagonal: false, ceiling: true });
  const e = estimate(room, opts);
  const num = (k: keyof typeof room, label: string, step = 0.1) => (
    <Field label={label}><input className="input num" type="number" min={0} step={step} value={room[k]} onChange={ev => setRoom({ ...room, [k]: Number(ev.target.value) })} /></Field>
  );
  const cost = e.paintLiters * PRICES.paintPerL + e.floorM2 * PRICES.floorPerM2 + e.skirtingM * PRICES.skirtingPerM + e.plasterboardSheets * PRICES.boardSheet;

  return (
    <div className="page">
      <div className="page-head"><div><h1>מחשבון חומרים</h1><p>כמויות לחדר מלבני: צבע (2 שכבות, 10 מ״ר לליטר), ריצוף כולל פחת (10%, או 15% בהנחה אלכסונית), פנלים וגבס לתקרה</p></div></div>
      <div className="grid cols-3">
        <div className="card">
          <div className="form-grid">
            {num('length', 'אורך (מ׳)')}{num('width', 'רוחב (מ׳)')}{num('height', 'גובה (מ׳)')}
            {num('doors', 'דלתות', 1)}{num('windows', 'חלונות', 1)}
            <Field label="גודל אריח"><select className="select" value={opts.tileCm} onChange={ev => setOpts({ ...opts, tileCm: Number(ev.target.value) })}>{[30, 45, 60, 80, 120].map(t => <option key={t} value={t}>{t}×{t}</option>)}</select></Field>
            <Field label="אריחים בקרטון"><input className="input num" type="number" min={1} value={opts.tilesPerBox} onChange={ev => setOpts({ ...opts, tilesPerBox: Number(ev.target.value) })} /></Field>
            <label className="row full"><input type="checkbox" checked={opts.diagonal} onChange={ev => setOpts({ ...opts, diagonal: ev.target.checked })} /> הנחה אלכסונית</label>
            <label className="row full"><input type="checkbox" checked={opts.ceiling} onChange={ev => setOpts({ ...opts, ceiling: ev.target.checked })} /> כולל צביעת תקרה ותקרת גבס</label>
          </div>
        </div>
        <div className="card span-2">
          <div className="grid cols-3">
            {[
              ['שטח רצפה', `${e.floorArea} מ״ר`], ['שטח קירות נטו', `${e.wallArea} מ״ר`], ['צבע', `${e.paintLiters} ליטר · ${e.paintBuckets} דליים`],
              ['ריצוף כולל פחת', `${e.floorM2} מ״ר`], ['אריחים', `${e.tiles} יח׳ · ${e.tileBoxes} קרטונים`], ['פנלים', `${e.skirtingM} מ׳`],
              ['לוחות גבס לתקרה', `${e.plasterboardSheets} לוחות`], ['עלות חומרים משוערת', shekel(cost)],
            ].map(([label, value]) => (
              <div key={label} className="card" style={{ boxShadow: 'none', background: 'var(--surface-2)' }}>
                <div className="faint" style={{ fontSize: 13 }}>{label}</div><b className="num" style={{ fontSize: 22 }}>{value}</b>
              </div>
            ))}
          </div>
          <div className="room-3d">
            <div className="room-box" style={{ width: room.length * 60, height: room.width * 60 }}>
              <span>{room.length} מ׳</span><span className="side">{room.width} מ׳</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
