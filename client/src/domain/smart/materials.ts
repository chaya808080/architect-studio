// Material quantity estimator for a rectangular room.

export interface RoomInput { length: number; width: number; height: number; doors: number; windows: number }

export interface MaterialEstimate {
  floorArea: number;
  wallArea: number;
  paintLiters: number;
  paintBuckets: number;     // 18L buckets
  floorM2: number;          // incl. waste
  tiles: number;
  tileBoxes: number;
  skirtingM: number;
  plasterboardSheets: number;
}

const DOOR = 0.9 * 2.1;
const WINDOW = 1.4 * 1.3;

/**
 * Paint: 2 coats, 10 m²/L coverage. Flooring: +10% waste (+15% for diagonal laying).
 * Tiles are counted on the laid area, packed in boxes of `tilesPerBox`.
 */
export function estimate(room: RoomInput, opts: { tileCm: number; tilesPerBox: number; diagonal: boolean; ceiling: boolean }): MaterialEstimate {
  const floorArea = room.length * room.width;
  const perimeter = 2 * (room.length + room.width);
  const wallArea = Math.max(0, perimeter * room.height - room.doors * DOOR - room.windows * WINDOW);
  const paintArea = wallArea + (opts.ceiling ? floorArea : 0);
  const paintLiters = Math.ceil((paintArea * 2) / 10);
  const waste = opts.diagonal ? 1.15 : 1.1;
  const floorM2 = Math.ceil(floorArea * waste * 10) / 10;
  const tileArea = (opts.tileCm / 100) ** 2;
  const tiles = Math.ceil(floorM2 / tileArea);
  return {
    floorArea: Math.round(floorArea * 100) / 100,
    wallArea: Math.round(wallArea * 10) / 10,
    paintLiters,
    paintBuckets: Math.ceil(paintLiters / 18),
    floorM2,
    tiles,
    tileBoxes: Math.ceil(tiles / opts.tilesPerBox),
    skirtingM: Math.ceil(perimeter - room.doors * 0.9),
    plasterboardSheets: Math.ceil((opts.ceiling ? floorArea : 0) / (1.2 * 2.6)),
  };
}
