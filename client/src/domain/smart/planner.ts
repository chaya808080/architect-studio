// Room planner geometry: furniture catalogue, collision & clearance checks and rule-based auto layout.
// Units: centimetres. Origin: top-left corner of the room.

export interface FurnitureType { key: string; label: string; w: number; d: number; color: string; floor?: boolean }

export const CATALOG: FurnitureType[] = [
  { key: 'sofa', label: 'ספה תלת', w: 220, d: 90, color: '#8a9a8b' },
  { key: 'armchair', label: 'כורסה', w: 85, d: 85, color: '#b08d6e' },
  { key: 'coffee', label: 'שולחן סלון', w: 120, d: 60, color: '#c9a77c' },
  { key: 'tv', label: 'מזנון TV', w: 180, d: 45, color: '#5d5a55' },
  { key: 'dining', label: 'שולחן אוכל', w: 180, d: 90, color: '#a07a52' },
  { key: 'chair', label: 'כיסא', w: 45, d: 50, color: '#d3b48c' },
  { key: 'bed', label: 'מיטה זוגית', w: 160, d: 200, color: '#9fb2c2' },
  { key: 'nightstand', label: 'שידה', w: 50, d: 40, color: '#c9a77c' },
  { key: 'wardrobe', label: 'ארון', w: 200, d: 60, color: '#7d6b5a' },
  { key: 'desk', label: 'שולחן עבודה', w: 140, d: 70, color: '#a07a52' },
  { key: 'island', label: 'אי מטבח', w: 200, d: 100, color: '#d9d4cc' },
  { key: 'plant', label: 'עציץ', w: 50, d: 50, color: '#6f9a6a' },
  { key: 'rug', label: 'שטיח', w: 240, d: 170, color: '#e6dccb', floor: true },
];
export const byKey = (k: string) => CATALOG.find(c => c.key === k)!;

export interface Item { id: number; key: string; x: number; y: number; rot: 0 | 90 }
export interface Rect { x: number; y: number; w: number; h: number }

/** Minimum comfortable walkway between furniture (Neufert-style rule of thumb). */
export const WALKWAY = 60;
export const GRID = 10;

export function rect(it: Item): Rect {
  const t = byKey(it.key);
  return it.rot === 90 ? { x: it.x, y: it.y, w: t.d, h: t.w } : { x: it.x, y: it.y, w: t.w, h: t.d };
}

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Shortest gap between two rectangles (0 when touching or overlapping). */
export function gap(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
  return Math.hypot(dx, dy);
}

export const snap = (v: number) => Math.round(v / GRID) * GRID;

export interface Issue { ids: number[]; level: 'error' | 'warn'; text: string }

export function analyze(items: Item[], roomW: number, roomH: number): { issues: Issue[]; coverage: number; verdict: string } {
  const issues: Issue[] = [];
  const solid = items.filter(i => !byKey(i.key).floor);
  for (const it of items) {
    const r = rect(it);
    if (r.x < 0 || r.y < 0 || r.x + r.w > roomW || r.y + r.h > roomH) issues.push({ ids: [it.id], level: 'error', text: `${byKey(it.key).label} חורג/ת מגבולות החדר` });
  }
  for (let i = 0; i < solid.length; i++) {
    for (let j = i + 1; j < solid.length; j++) {
      const a = rect(solid[i]), b = rect(solid[j]);
      const la = byKey(solid[i].key).label, lb = byKey(solid[j].key).label;
      if (overlap(a, b)) { issues.push({ ids: [solid[i].id, solid[j].id], level: 'error', text: `${la} ו${lb} חופפים` }); continue; }
      const g = gap(a, b);
      // chairs and nightstands are meant to sit close to their table / bed
      const intimate = ['chair', 'nightstand', 'coffee'].includes(solid[i].key) || ['chair', 'nightstand', 'coffee'].includes(solid[j].key);
      if (g > 0 && g < WALKWAY && !intimate) issues.push({ ids: [solid[i].id, solid[j].id], level: 'warn', text: `מעבר צר (${Math.round(g)} ס״מ) בין ${la} ל${lb} – מומלץ לפחות ${WALKWAY}` });
    }
  }
  const used = solid.reduce((s, it) => { const r = rect(it); return s + r.w * r.h; }, 0);
  const coverage = used / (roomW * roomH);
  const verdict = coverage > 0.45 ? 'החלל צפוף – מומלץ לוותר על פריט' : coverage < 0.15 ? 'החלל ריק יחסית – יש מקום לפריטים נוספים' : 'יחס מאוזן בין ריהוט לחלל פתוח';
  return { issues, coverage, verdict };
}

export type RoomKind = 'סלון' | 'חדר שינה' | 'משרד ביתי' | 'פינת אוכל';

/** Rule-based layout: anchor piece on the long wall, everything else placed relative to it. */
export function autoLayout(kind: RoomKind, W: number, H: number): Item[] {
  const items: Item[] = [];
  let id = 1;
  const put = (key: string, x: number, y: number, rot: 0 | 90 = 0) => items.push({ id: id++, key, x: snap(x), y: snap(y), rot });
  const cx = W / 2;
  if (kind === 'סלון') {
    put('rug', cx - 120, H / 2 - 85);
    put('sofa', cx - 110, H - 90 - 10);                 // against the bottom wall
    put('coffee', cx - 60, H - 100 - 45 - 60);          // 45cm in front of the sofa
    put('tv', cx - 90, 10);                             // facing wall
    if (W >= 420) { put('armchair', cx - 110 - 85 - 70, H / 2 - 40); put('armchair', cx + 110 + 70, H / 2 - 40); }
    put('plant', W - 60, 10);
  } else if (kind === 'חדר שינה') {
    put('bed', cx - 80, 10);
    put('nightstand', cx - 80 - 50 - 10, 10);
    put('nightstand', cx + 80 + 10, 10);
    put('wardrobe', cx - 100, H - 60 - 10);
    put('rug', cx - 120, 160);
  } else if (kind === 'משרד ביתי') {
    put('desk', cx - 70, 10);
    put('chair', cx - 22, 90);
    put('wardrobe', 10, H - 60 - 10);
    put('armchair', W - 95, H - 95);
    put('plant', W - 60, 10);
  } else {
    put('rug', cx - 120, H / 2 - 85);
    put('dining', cx - 90, H / 2 - 45);
    for (let i = 0; i < 3; i++) { put('chair', cx - 80 + i * 60, H / 2 - 45 - 55); put('chair', cx - 80 + i * 60, H / 2 + 45 + 5); }
    put('plant', 10, 10);
  }
  // keep everything inside the room even when it is small (snap first, then clamp down to the grid)
  const fit = (v: number, max: number) => Math.max(0, Math.min(snap(v), Math.floor(max / GRID) * GRID));
  return items.map(it => {
    const r = rect(it);
    return { ...it, x: fit(it.x, W - r.w), y: fit(it.y, H - r.h) };
  });
}
