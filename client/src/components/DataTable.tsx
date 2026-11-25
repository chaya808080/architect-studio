import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Value used for sorting; omit to make the column unsortable. */
  sort?: (row: T) => string | number;
  width?: number | string;
}

/** Sortable, paginated table. Filtering is done by the caller so it can be combined with tabs and search. */
export function DataTable<T extends { id: number }>({ rows, columns, onRowClick, pageSize = 12, initialSort }: {
  rows: T[]; columns: Column<T>[]; onRowClick?: (row: T) => void; pageSize?: number; initialSort?: { key: string; dir: 1 | -1 };
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const col = columns.find(c => c.key === sort?.key);
    if (!col?.sort || !sort) return rows;
    const get = col.sort;
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'he')) * sort.dir;
    });
  }, [rows, columns, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = sorted.slice(current * pageSize, current * pageSize + pageSize);

  const toggle = (key: string) => setSort(s => (s?.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {columns.map(c => (
                <th key={c.key} style={{ width: c.width }} className={c.sort ? 'sortable' : ''} onClick={() => c.sort && toggle(c.key)}
                  aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                  <span className="row" style={{ gap: 4 }}>
                    {c.header}
                    {sort?.key === c.key && (sort.dir === 1 ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map(row => (
              <tr key={row.id} className={onRowClick ? 'clickable' : ''} onClick={() => onRowClick?.(row)}>
                {columns.map(c => <td key={c.key}>{c.render(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > pageSize && (
        <div className="table-foot">
          <span>מציג {current * pageSize + 1}–{Math.min(sorted.length, (current + 1) * pageSize)} מתוך {sorted.length}</span>
          <div className="row">
            <button className="btn btn-sm" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="הקודם"><ChevronRight size={16} /></button>
            <span className="num">{current + 1} / {pages}</span>
            <button className="btn btn-sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label="הבא"><ChevronLeft size={16} /></button>
          </div>
        </div>
      )}
    </>
  );
}

/** Downloads rows as a UTF-8 CSV (with BOM so Excel shows Hebrew correctly). */
export function exportCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = '﻿' + [header, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
