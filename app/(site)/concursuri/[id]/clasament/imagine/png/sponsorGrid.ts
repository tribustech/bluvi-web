/**
 * The sponsor logo grid of the ranking image (fish helpers/sponsorGrid.ts, same numbers). A competition can
 * carry up to 50 sponsors (CMS 3.9.0 follow-ups): one row of 150 px squares made the sheet as wide as its
 * sponsors. The grid stays inside the sheet's minimum width, in 8:5 tiles (the logo aspect the app crops to),
 * as large as fits in two rows, shrinking to 144 px and only then adding rows; rows are balanced. Pure.
 */
export type SponsorGrid = { tileWidth: number; tileHeight: number; rows: number[]; width: number; height: number };

const EMPTY: SponsorGrid = { tileWidth: 0, tileHeight: 0, rows: [], width: 0, height: 0 };

export function sponsorGridLayout(
  count: number,
  opts: { maxWidth: number; gap?: number; maxTileWidth?: number; minTileWidth?: number; aspect?: number; maxRows?: number },
): SponsorGrid {
  const n = Math.max(0, Math.floor(count));
  const { maxWidth, gap = 16, maxTileWidth = 240, minTileWidth = 144, aspect = 8 / 5, maxRows = 2 } = opts;
  if (n === 0 || maxWidth <= 0) return EMPTY;
  const columnsAt = (tile: number) => Math.max(1, Math.floor((maxWidth + gap) / (tile + gap)));
  let tile = Math.min(maxTileWidth, maxWidth);
  while (tile > minTileWidth && Math.ceil(n / columnsAt(tile)) > maxRows) tile -= 2;
  tile = Math.max(Math.min(minTileWidth, maxWidth), tile);
  const columns = Math.min(n, columnsAt(tile));
  const rowCount = Math.ceil(n / columns);
  const base = Math.floor(n / rowCount);
  const extra = n % rowCount;
  const rows = Array.from({ length: rowCount }, (_, i) => base + (i < extra ? 1 : 0));
  const tileHeight = Math.round(tile / aspect);
  const widest = Math.max(...rows);
  return { tileWidth: tile, tileHeight, rows, width: widest * tile + (widest - 1) * gap, height: rows.length * tileHeight + (rows.length - 1) * gap };
}

/** `items` split into the grid's rows, in order. */
export function chunkByRows<T>(items: readonly T[], rows: readonly number[]): T[][] {
  const out: T[][] = [];
  let i = 0;
  for (const r of rows) {
    out.push(items.slice(i, i + r));
    i += r;
  }
  return out;
}
