import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, Save, Upload } from 'lucide-react';
import { selectDb, useAction, useAppDispatch, useAppSelector } from '../store';
import { update } from '../store/dataSlice';
import { pushToast } from '../store/uiSlice';
import { img } from '../domain/display';
import { colorName, contrast, harmonies, kMeans, rule603010, samplePixels, toHex, type RGB } from '../domain/smart/palette';
import { Field } from '../components/ui';

/** Draws the image to an off-screen canvas (max 220px) and runs k-means on sampled pixels. */
function extract(src: string, k: number): Promise<{ color: RGB; share: number }[]> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      const scale = Math.min(1, 220 / Math.max(im.width, im.height));
      const c = document.createElement('canvas');
      c.width = Math.round(im.width * scale); c.height = Math.round(im.height * scale);
      const ctx = c.getContext('2d')!;
      ctx.drawImage(im, 0, 0, c.width, c.height);
      resolve(kMeans(samplePixels(ctx.getImageData(0, 0, c.width, c.height).data, 3), k));
    };
    im.onerror = reject;
    im.src = src;
  });
}

const PRESETS = ['living-cream', 'dining-green', 'living-warm', 'bedroom-boho', 'kitchen-island', 'living-blue', 'living-mirrors', 'patio'];

export default function PaletteStudio() {
  const db = useAppSelector(selectDb);
  const run = useAction();
  const dispatch = useAppDispatch();
  const [params] = useSearchParams();
  const [src, setSrc] = useState(img(PRESETS[0]));
  const [k, setK] = useState(6);
  const [colors, setColors] = useState<{ color: RGB; share: number }[]>([]);
  const [projectId, setProjectId] = useState(Number(params.get('project')) || db.projects.find(p => ['תכנון', 'ביצוע'].includes(p.stage))?.id || 0);

  useEffect(() => { extract(src, k).then(setColors).catch(() => dispatch(pushToast('error', 'לא ניתן לקרוא את התמונה'))); }, [src, k, dispatch]);

  const palette = colors.map(c => c.color);
  const roles = palette.length >= 3 ? rule603010(palette) : [];
  const project = db.projects.find(p => p.id === projectId);
  const bg = roles[0]?.color ?? [255, 255, 255];
  const darkest = [...palette].sort((a, b) => contrast(b, bg) - contrast(a, bg))[0] ?? [0, 0, 0];
  const ratio = contrast(darkest, bg);

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>פלטת צבעים חכמה</h1><p>חילוץ הצבעים הדומיננטיים מתמונה (אלגוריתם k-means על פיקסלים), חלוקת 60-30-10, הרמוניות ובדיקת ניגודיות. הכול מחושב בדפדפן.</p></div>
        <label className="btn btn-gold"><Upload size={16} />העלאת תמונה
          <input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) setSrc(URL.createObjectURL(f)); }} />
        </label>
      </div>
      <div className="grid cols-3">
        <div className="card span-2">
          <div className="palette-hero">
            <img src={src} alt="תמונת מקור" />
            <div className="palette-bars">
              {colors.map(c => (
                <button key={toHex(c.color)} className="palette-bar" style={{ background: toHex(c.color), flex: Math.max(0.6, c.share * 10) }}
                  onClick={() => { void navigator.clipboard.writeText(toHex(c.color)); dispatch(pushToast('success', `${toHex(c.color)} הועתק`)); }}>
                  <span style={{ color: contrast(c.color, [255, 255, 255]) > 3 ? '#fff' : '#1c1b19' }}>
                    <b>{colorName(c.color)}</b><br /><span className="num">{toHex(c.color)} · {Math.round(c.share * 100)}%</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="row wrap" style={{ marginTop: 14 }}>
            {PRESETS.map(p => <button key={p} className={`thumb ${src === img(p) ? 'active' : ''}`} style={{ backgroundImage: `url(${img(p)})` }} onClick={() => setSrc(img(p))} aria-label={p} />)}
          </div>
          <div style={{ marginTop: 14, maxWidth: 320 }}><Field label={`מספר צבעים: ${k}`}><input type="range" min={3} max={8} value={k} onChange={e => setK(Number(e.target.value))} /></Field></div>
        </div>

        <div className="card">
          <div className="card-title"><h3>חלוקת 60-30-10</h3></div>
          {roles.map(r => (
            <div key={r.role} className="list-item">
              <span className="swatch-lg" style={{ background: toHex(r.color) }} />
              <div style={{ flex: 1 }}><b>{r.pct}% · {colorName(r.color)}</b><div className="faint" style={{ fontSize: 12 }}>{r.role}</div></div>
            </div>
          ))}
          <div className="divider" />
          <div className="card-title" style={{ marginBottom: 8 }}><h3>הרמוניות מוצעות</h3></div>
          {harmonies(palette).map(h => (
            <div key={h.label} className="row" style={{ marginBottom: 8 }}>
              <span style={{ width: 60 }} className="muted">{h.label}</span>
              {h.colors.map(c => <span key={toHex(c)} className="swatch-lg" title={toHex(c)} style={{ background: toHex(c) }} />)}
            </div>
          ))}
          <div className="divider" />
          <div className="contrast-demo" style={{ background: toHex(bg), color: toHex(darkest) }}>
            <b>טקסט על הקיר הדומיננטי</b>
            <span>יחס ניגודיות {ratio.toFixed(1)}:1 · {ratio >= 4.5 ? 'עומד בתקן נגישות AA ✓' : 'נמוך מתקן AA – לשלט/טקסט כדאי גוון כהה יותר'}</span>
          </div>
          <div className="divider" />
          <Field label="שמירה כפלטת פרויקט">
            <select className="select" value={projectId} onChange={e => setProjectId(Number(e.target.value))}>
              {db.projects.filter(p => p.stage !== 'אבוד').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn btn-gold" disabled={!project || !palette.length} onClick={() => project && run(update('projects', { ...project, palette: palette.slice(0, 5).map(toHex) }), `הפלטה נשמרה ל${project.name}`)}><Save size={15} />שמירה</button>
            <button className="btn" onClick={() => { void navigator.clipboard.writeText(palette.map(toHex).join(', ')); dispatch(pushToast('success', 'הפלטה הועתקה')); }}><Copy size={15} />העתקה</button>
          </div>
        </div>
      </div>
    </div>
  );
}
