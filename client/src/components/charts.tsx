// Small hand-built SVG charts: thin rounded marks, recessive grid, hover tooltips on every mark,
// selective direct labels (max + latest only) and text in ink tokens, never in the series color.
import { useEffect, useRef, useState } from 'react';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(200, e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export interface Datum { label: string; value: number; detail?: string; projected?: boolean }

/** Vertical columns for a single series (e.g. new students per month). */
export function ColumnChart({ data, height = 220, format = (v: number) => String(v), unit }: {
  data: Datum[]; height?: number; format?: (v: number) => string; unit: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 22, bottom: 26, side: 8 };
  const max = Math.max(1, ...data.map(d => d.value));
  const nice = Math.ceil(max / 5) * 5 || 5;
  const innerH = height - pad.top - pad.bottom;
  const slot = (width - pad.side * 2) / data.length;
  const barW = Math.min(34, slot * 0.56);
  const y = (v: number) => pad.top + innerH - (v / nice) * innerH;
  const maxIdx = data.findIndex(d => d.value === max);
  const ticks = [0, nice / 2, nice];

  return (
    <div className="chart" ref={ref}>
      <svg height={height} role="img" aria-label={`תרשים עמודות: ${unit}`}>
        {ticks.map(t => (
          <g key={t}>
            <line className="grid-line" x1={0} x2={width} y1={y(t)} y2={y(t)} />
            <text className="axis-label" x={width - 2} y={y(t) - 4} textAnchor="end">{format(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          // RTL: first item on the right
          const cx = width - pad.side - slot * i - slot / 2;
          const h = Math.max(d.value > 0 ? 3 : 0, (d.value / nice) * innerH);
          const top = pad.top + innerH - h;
          const r = Math.min(4, barW / 2, h);
          const showLabel = i === maxIdx || i === data.length - 1;
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="chart-hit">
              <rect x={cx - slot / 2} y={pad.top} width={slot} height={innerH} fill="transparent" />
              <path className="bar" opacity={(hover == null || hover === i ? 1 : 0.45) * (d.projected ? 0.45 : 1)} fill="url(#goldGrad)"
                stroke={d.projected ? 'var(--gold)' : 'none'} strokeDasharray={d.projected ? '4 3' : undefined} strokeWidth={1.5}
                d={`M${cx - barW / 2},${pad.top + innerH} V${top + r} Q${cx - barW / 2},${top} ${cx - barW / 2 + r},${top}
                    H${cx + barW / 2 - r} Q${cx + barW / 2},${top} ${cx + barW / 2},${top + r} V${pad.top + innerH} Z`} />
              {showLabel && d.value > 0 && <text className="value-label" x={cx} y={top - 6} textAnchor="middle">{format(d.value)}</text>}
              <text className="axis-label" x={cx} y={height - 8} textAnchor="middle">{d.label}</text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--gold-2)" />
            <stop offset="1" stopColor="var(--gold)" />
          </linearGradient>
        </defs>
      </svg>
      {hover != null && (
        <div className="tooltip" style={{ right: pad.side + slot * hover + slot / 2, top: y(data[hover].value) }}>
          <b className="num">{format(data[hover].value)} {unit}</b>
          {data[hover].detail ?? data[hover].label}{data[hover].projected ? ' · תחזית' : ''}
        </div>
      )}
      {data.some(d => d.projected) && (
        <div className="legend">
          <span><i className="swatch" style={{ background: 'var(--gold)' }} />בפועל</span>
          <span><i className="swatch" style={{ background: 'var(--gold)', opacity: 0.4, outline: '1px dashed var(--gold)' }} />תחזית</span>
        </div>
      )}
    </div>
  );
}

/** Horizontal bars for a ranked single-series breakdown (e.g. students per course). */
export function HBarList({ data, format = (v: number) => String(v), unit }: { data: Datum[]; format?: (v: number) => string; unit: string }) {
  const max = Math.max(1, ...data.map(d => d.value));
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div role="list">
      {data.map((d, i) => (
        <div key={d.label} className="hbar-row" role="listitem" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
          <span className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
          <div className="hbar-track"><div className="hbar-fill" style={{ width: `${(d.value / max) * 100}%`, animationDelay: `${i * 60}ms`, opacity: hover == null || hover === i ? 1 : 0.5 }} /></div>
          <b className="num" style={{ textAlign: 'left' }}>{format(d.value)}</b>
          {hover === i && <div className="tooltip" style={{ right: '50%', top: 0 }}><b>{d.label}</b>{d.detail ?? `${format(d.value)} ${unit}`}</div>}
        </div>
      ))}
    </div>
  );
}

/** Part-to-whole bar with a 2px surface gap between segments and a legend (identity never by color alone). */
export function StackedBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="chart">
      <div className="stacked" role="img" aria-label={parts.map(p => `${p.label} ${p.value}`).join(', ')}>
        {parts.map((p, i) => (
          <div key={p.label} style={{ flex: p.value, background: p.color, opacity: hover == null || hover === i ? 1 : 0.5 }}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
      </div>
      <div className="legend">
        {parts.map(p => (
          <span key={p.label}><i className="swatch" style={{ background: p.color }} />{p.label} <b className="num">{p.value}</b> <span className="faint">({Math.round((p.value / total) * 100)}%)</span></span>
        ))}
      </div>
    </div>
  );
}

export interface Series { key: string; label: string; color: string }

/** Stacked columns (2-3 series) with a 2px surface gap between segments, legend and per-column tooltip. */
export function StackedColumns({ data, series, height = 230, format = (v: number) => String(v) }: {
  data: ({ label: string } & Record<string, number | string>)[]; series: Series[]; height?: number; format?: (v: number) => string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 16, bottom: 26, side: 8 };
  const totals = data.map(d => series.reduce((s, x) => s + Number(d[x.key] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const innerH = height - pad.top - pad.bottom;
  const slot = (width - pad.side * 2) / data.length;
  const barW = Math.min(40, slot * 0.55);
  return (
    <div className="chart" ref={ref}>
      <svg height={height} role="img" aria-label={series.map(s => s.label).join(', ')}>
        {[0, 0.5, 1].map(t => (
          <g key={t}>
            <line className="grid-line" x1={0} x2={width} y1={pad.top + innerH * (1 - t)} y2={pad.top + innerH * (1 - t)} />
            <text className="axis-label" x={width - 2} y={pad.top + innerH * (1 - t) - 4} textAnchor="end">{format(max * t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = width - pad.side - slot * i - slot / 2;
          let y = pad.top + innerH;
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="chart-hit" opacity={hover == null || hover === i ? 1 : 0.5}>
              <rect x={cx - slot / 2} y={pad.top} width={slot} height={innerH} fill="transparent" />
              {series.map((s, si) => {
                const h = (Number(d[s.key] ?? 0) / max) * innerH;
                if (h <= 0) return null;
                y -= h;
                const top = si === series.length - 1 || series.slice(si + 1).every(n => !Number(d[n.key])) ;
                return <rect key={s.key} x={cx - barW / 2} y={y + (si ? 0 : 0)} width={barW} height={Math.max(0, h - 2)} rx={top ? 4 : 0} fill={s.color} />;
              })}
              <text className="axis-label" x={cx} y={height - 8} textAnchor="middle">{d.label}</text>
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div className="tooltip" style={{ right: pad.side + slot * hover + slot / 2, top: pad.top }}>
          <b>{data[hover].label} · {format(totals[hover])}</b>
          {series.map(s => <div key={s.key} className="row" style={{ gap: 6 }}><i className="swatch" style={{ background: s.color }} />{s.label}: {format(Number(data[hover][s.key] ?? 0))}</div>)}
        </div>
      )}
      <div className="legend">{series.map(s => <span key={s.key}><i className="swatch" style={{ background: s.color }} />{s.label}</span>)}</div>
    </div>
  );
}
