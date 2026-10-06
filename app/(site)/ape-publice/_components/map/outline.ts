import type { PublicWaterGeometry } from '@/core/lakes';

/*
 * A water's outline for the map list's card media (WaterRowCard): its geometry projected into a
 * 100×100 box as one SVG path, at most MAX_POINTS points per line, whole units. Computed on the
 * server (api `outlines`): the 150 listed waters' full geometries are ~5 MB, their outlines ~100 KB.
 */

/** `closed`: a polygon (filled); else lines (a river, stroked). */
export type WaterOutline = { d: string; closed: boolean };

/** About this many points for the whole outline: a 280px tile needs no more. */
const MAX_POINTS = 260;

/**
 * The geometry projected into a 100×100 box (equirectangular, corrected by cos(latitude), aspect
 * kept and centred): one SVG path. Polygons close their rings (filled), lines stay open.
 */
export function waterOutline(g: PublicWaterGeometry): WaterOutline | null {
  const lines: [number, number][][] =
    g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' || g.type === 'Polygon' ? g.coordinates : g.coordinates.flat();
  const closed = g.type === 'Polygon' || g.type === 'MultiPolygon';
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const line of lines)
    for (const [x, y] of line) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  if (!Number.isFinite(minX)) return null;
  const cos = Math.max(Math.cos((((minY + maxY) / 2) * Math.PI) / 180), 0.1);
  const w = (maxX - minX) * cos;
  const h = maxY - minY;
  const scale = 100 / Math.max(w, h, 1e-9);
  const ox = (100 - w * scale) / 2;
  const oy = (100 - h * scale) / 2;
  const parts: string[] = [];
  const total = lines.reduce((n, l) => n + l.length, 0);
  const step = Math.max(1, Math.ceil(total / MAX_POINTS));
  const px = ([x, y]: [number, number]): [number, number] => [Math.round(ox + (x - minX) * cos * scale), Math.round(oy + (maxY - y) * scale)];
  for (const line of lines) {
    if (line.length < 2) continue;
    const pts: [number, number][] = [];
    for (let i = 0; i < line.length; i += step) pts.push(px(line[i]));
    pts.push(px(line[line.length - 1]));
    // A part under ~2% of the box adds bytes, not shape (river side arms, islands).
    if (lines.length > 1) {
      const xs = pts.map(p => p[0]);
      const ys = pts.map(p => p[1]);
      if (Math.max(...xs) - Math.min(...xs) < 2 && Math.max(...ys) - Math.min(...ys) < 2) continue;
    }
    const kept = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
    if (kept.length < 2) continue;
    parts.push(`M${kept.map(p => `${p[0]} ${p[1]}`).join('L')}${closed ? 'Z' : ''}`);
  }
  return parts.length ? { d: parts.join(''), closed } : null;
}
