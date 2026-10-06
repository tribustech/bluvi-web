import 'server-only';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type {
  LatLngBounds,
  PublicWaterCentroid,
  PublicWaterCounty,
  PublicWaterDetail,
  PublicWaterGeometry,
  PublicWaterListItem,
  PublicWaterMarker,
  PublicWatersSource,
  PublicWaterType,
  PublicWaterViewportRow,
  ViewportOptions,
} from '@/core/lakes';
import { publicWaterTypeSchema } from '@/core/lakes';
import { byRomanianName, countyDisplayName, stripDiacritics } from './countyNames';

/*
 * The public-waters dataset on the server — fish features/public-waters/{db,queries}.ts over the
 * SAME bundled SQLite file (ANAR «Hidrografie», CC-BY 4.0; fish assets/db/public-waters.sqlite3,
 * DB_VERSION 4), copied to data/public-waters/. Read-only, opened once per server process with
 * Node's built-in SQLite. Same SQL as fish, so ids, ordering and limits match the app exactly.
 */

/** Keep in sync with fish `features/public-waters/db.ts#DB_VERSION`. */
export const PUBLIC_WATERS_DB_VERSION = 4;

function dbPath(): string {
  return process.env.PUBLIC_WATERS_DB ?? path.join(process.cwd(), 'data', 'public-waters', `public-waters.v${PUBLIC_WATERS_DB_VERSION}.sqlite3`);
}

let db: DatabaseSync | null = null;
function open(): DatabaseSync {
  db ??= new DatabaseSync(dbPath(), { readOnly: true });
  return db;
}

function all<T>(sql: string, params: SQLInputValue[] = []): T[] {
  return open().prepare(sql).all(...params) as T[];
}
function first<T>(sql: string, params: SQLInputValue[] = []): T | undefined {
  return open().prepare(sql).get(...params) as T | undefined;
}

interface LightRow {
  id: number;
  name: string | null;
  type: string;
  county: string | null;
  county_id: number | null;
  county_ids: string | null;
  center_lat: number;
  center_lng: number;
  link_code: string | null;
  area_km2: number | null;
}
interface DetailRow extends LightRow {
  geo_json: string;
  name_en: string | null;
  eu_code: string | null;
  anar_code: string | null;
  basin: string | null;
  volume_mil_m3: number | null;
  elevation_m: number | null;
  source: string;
}

const LIGHT_COLUMNS = 'id, name, type, county, county_id, county_ids, center_lat, center_lng, link_code, area_km2';

function waterType(t: string): PublicWaterType {
  const parsed = publicWaterTypeSchema.safeParse(t);
  return parsed.success ? parsed.data : 'natural_lake';
}

function parseCountyIds(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

/** Stored as a GeoJSON Feature (fish geometryCache: «we only need its geometry»). */
function parseGeometry(raw: string): PublicWaterGeometry {
  try {
    const parsed = JSON.parse(raw) as { type?: string; geometry?: PublicWaterGeometry };
    return parsed.type === 'Feature' && parsed.geometry ? parsed.geometry : (parsed as PublicWaterGeometry);
  } catch {
    return { type: 'LineString', coordinates: [] };
  }
}

function toListItem(r: LightRow): PublicWaterListItem {
  return {
    id: r.id,
    name: r.name,
    type: waterType(r.type),
    county: countyDisplayName(r.county),
    countyId: r.county_id,
    countyIds: parseCountyIds(r.county_ids),
    centerLat: r.center_lat,
    centerLng: r.center_lng,
    linkCode: r.link_code,
    areaKm2: r.area_km2,
  };
}

function toDetail(r: DetailRow): PublicWaterDetail {
  return {
    ...toListItem(r),
    geometry: parseGeometry(r.geo_json),
    nameEn: r.name_en,
    euCode: r.eu_code,
    anarCode: r.anar_code,
    basin: r.basin,
    volumeMilM3: r.volume_mil_m3,
    elevationM: r.elevation_m,
    source: r.source,
  };
}

function inClause(values: ReadonlyArray<SQLInputValue> | undefined, column: string): { sql: string; params: SQLInputValue[] } {
  if (!values || values.length === 0) return { sql: '', params: [] };
  return { sql: ` AND ${column} IN (${values.map(() => '?').join(',')})`, params: [...values] };
}

const ID_CHUNK = 900;

export const sqlitePublicWatersSource: PublicWatersSource = {
  async getWaterRowsInViewport(bounds: LatLngBounds, options: ViewportOptions = {}): Promise<PublicWaterViewportRow[]> {
    const { types, counties, minSpanDeg = 0, limit = 1500 } = options;
    const params: SQLInputValue[] = [bounds.minLat, bounds.maxLat, bounds.minLng, bounds.maxLng];
    let sql = `SELECT ${LIGHT_COLUMNS},
        (bounds_ne_lat - bounds_sw_lat) AS span_lat, (bounds_ne_lng - bounds_sw_lng) AS span_lng
      FROM fishing_waters
      WHERE bounds_ne_lat >= ? AND bounds_sw_lat <= ? AND bounds_ne_lng >= ? AND bounds_sw_lng <= ?`;
    if (minSpanDeg > 0) {
      sql += ' AND ((bounds_ne_lat - bounds_sw_lat) >= ? OR (bounds_ne_lng - bounds_sw_lng) >= ?)';
      params.push(minSpanDeg, minSpanDeg);
    }
    const t = inClause(types, 'type');
    const c = inClause(counties, 'county_id');
    sql += t.sql + c.sql + ' LIMIT ?';
    params.push(...t.params, ...c.params, limit);
    return all<LightRow & { span_lat: number; span_lng: number }>(sql, params).map((r) => ({
      ...toListItem(r),
      bboxSpanLat: r.span_lat,
      bboxSpanLng: r.span_lng,
    }));
  },

  async getGeometriesByIds(ids) {
    const out: { id: number; geometry: PublicWaterGeometry }[] = [];
    for (let i = 0; i < ids.length; i += ID_CHUNK) {
      const chunk = ids.slice(i, i + ID_CHUNK);
      const rows = all<{ id: number; geo_json: string }>(`SELECT id, geo_json FROM fishing_waters WHERE id IN (${chunk.map(() => '?').join(',')})`, chunk);
      for (const r of rows) out.push({ id: r.id, geometry: parseGeometry(r.geo_json) });
    }
    return out;
  },

  async getMarkerWatersInViewport(bounds, options = {}): Promise<PublicWaterMarker[]> {
    const { types, counties, limit = 150 } = options;
    const params: SQLInputValue[] = [bounds.minLat, bounds.maxLat, bounds.minLng, bounds.maxLng];
    let sql = `SELECT id, name, type, county, county_ids, center_lat, center_lng, link_code, area_km2
      FROM fishing_waters
      WHERE bounds_ne_lat >= ? AND bounds_sw_lat <= ? AND bounds_ne_lng >= ? AND bounds_sw_lng <= ?`;
    const t = inClause(types, 'type');
    const c = inClause(counties, 'county_id');
    sql += t.sql + c.sql + ' ORDER BY (bounds_ne_lat - bounds_sw_lat) * (bounds_ne_lng - bounds_sw_lng) DESC LIMIT ?';
    params.push(...t.params, ...c.params, limit);
    return all<Omit<LightRow, 'county_id'>>(sql, params).map((r) => ({
      id: r.id,
      name: r.name,
      type: waterType(r.type),
      county: countyDisplayName(r.county),
      countyIds: parseCountyIds(r.county_ids),
      centerLat: r.center_lat,
      centerLng: r.center_lng,
      linkCode: r.link_code,
      areaKm2: r.area_km2,
    }));
  },

  async getPublicWaterById(id) {
    const row = first<DetailRow>('SELECT * FROM fishing_waters WHERE id = ?', [id]);
    return row ? toDetail(row) : null;
  },

  async getPublicWaterByLinkCode(code) {
    const row = first<DetailRow>('SELECT * FROM fishing_waters WHERE link_code = ?', [code]);
    return row ? toDetail(row) : null;
  },

  async searchPublicWaters(term, limit = 40) {
    const q = term.trim();
    if (q.length < 2) return [];
    const like = `%${q}%`;
    // The dataset mostly spells names and counties without diacritics («Dunarea», «Constanta»):
    // «Dunărea» / «Constanța» must find them too.
    const plain = stripDiacritics(q);
    return all<LightRow>(
      `SELECT ${LIGHT_COLUMNS} FROM fishing_waters
       WHERE name LIKE ? COLLATE NOCASE OR name LIKE ? COLLATE NOCASE OR county LIKE ? COLLATE NOCASE
       ORDER BY (CASE WHEN name LIKE ? COLLATE NOCASE OR name LIKE ? COLLATE NOCASE THEN 0 ELSE 1 END), length(name), name
       LIMIT ?`,
      [like, `%${plain}%`, `%${plain}%`, `${q}%`, `${plain}%`, limit],
    ).map(toListItem);
  },

  async nearestWatersTo(lat, lng, limit = 5) {
    const cosLat = Math.cos((lat * Math.PI) / 180);
    return all<LightRow>(
      `SELECT ${LIGHT_COLUMNS} FROM fishing_waters
       WHERE link_code IS NOT NULL
       ORDER BY (center_lat - ?) * (center_lat - ?) + ((center_lng - ?) * ?) * ((center_lng - ?) * ?)
       LIMIT ?`,
      [lat, lat, lng, cosLat, lng, cosLat, limit],
    ).map(toListItem);
  },

  async getCountyNamesByIds(ids) {
    if (!ids.length) return [];
    return all<{ name: string | null }>(`SELECT name FROM counties WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY name`, ids)
      .map((r) => countyDisplayName(r.name))
      .filter((n): n is string => Boolean(n))
      .sort(byRomanianName);
  },

  async getCounties(): Promise<PublicWaterCounty[]> {
    return all<{ id: number; name: string | null; abbreviation: string | null; fishing_waters_count: number }>(
      'SELECT id, name, abbreviation, fishing_waters_count FROM counties ORDER BY name',
    )
      .map((r) => ({ id: r.id, name: countyDisplayName(r.name), abbreviation: r.abbreviation, fishingWatersCount: r.fishing_waters_count }))
      .sort((a, b) => byRomanianName(a.name ?? '', b.name ?? ''));
  },

  async getAttribution() {
    return first<{ value: string }>("SELECT value FROM meta WHERE key = 'attribution'")?.value ?? null;
  },

  async getAllCentroids(): Promise<PublicWaterCentroid[]> {
    return all<{ id: number; type: string; county_id: number | null; center_lat: number; center_lng: number }>(
      'SELECT id, type, county_id, center_lat, center_lng FROM fishing_waters',
    ).map((r) => ({ id: r.id, type: waterType(r.type), countyId: r.county_id, lat: r.center_lat, lng: r.center_lng }));
  },
};

/** Every water's canonical key (its stable linkCode, else the row id) — the sitemap's list. */
export function allPublicWaterKeys(): (string | number)[] {
  return all<{ id: number; link_code: string | null }>('SELECT id, link_code FROM fishing_waters ORDER BY id').map((r) => r.link_code ?? r.id);
}
