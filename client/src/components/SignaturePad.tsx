import { useEffect, useRef } from 'react';
import { Eraser } from 'lucide-react';

/** Canvas signature pad with smoothed strokes (quadratic curves between pointer samples). */
export default function SignaturePad({ onChange, height = 150 }: { onChange: (signed: boolean) => void; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    const c = ref.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.clientWidth * ratio;
    c.height = height * ratio;
    const ctx = c.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#1c1b19';
  }, [height]);

  const point = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const clear = () => {
    const c = ref.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    dirty.current = false;
    onChange(false);
  };

  return (
    <div className="signature">
      <canvas ref={ref} style={{ height }} aria-label="חתימה"
        onPointerDown={e => { drawing.current = true; last.current = point(e); ref.current!.setPointerCapture(e.pointerId); }}
        onPointerMove={e => {
          if (!drawing.current || !last.current) return;
          const p = point(e);
          const ctx = ref.current!.getContext('2d')!;
          const mid = { x: (last.current.x + p.x) / 2, y: (last.current.y + p.y) / 2 };
          ctx.beginPath();
          ctx.moveTo(last.current.x, last.current.y);
          ctx.quadraticCurveTo(last.current.x, last.current.y, mid.x, mid.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          last.current = p;
          if (!dirty.current) { dirty.current = true; onChange(true); }
        }}
        onPointerUp={() => { drawing.current = false; last.current = null; }} />
      <div className="signature-line">חתימת הלקוח/ה</div>
      <button type="button" className="btn btn-sm btn-ghost no-print" onClick={clear}><Eraser size={14} />ניקוי</button>
    </div>
  );
}
