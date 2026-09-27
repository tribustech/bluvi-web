/**
 * Public waters (rivers, lakes, reservoirs) sourced from ANAR "Hidrografie" (data.gov.ro, CC-BY 4.0).
 * fish ships them as a read-only bundled SQLite DB; these are the model types and the pure helpers
 * from fish `models/publicWater.type.ts` + `features/public-waters/helpers/waterDistance.ts`.
 * Distinct from the private, bookable `Lake` model — these are never bookable.
 */

export type PublicWaterType = 'river' | 'natural_lake' | 'reservoir_lake' | 'coastal_lake' | 'transitional_lake';

/** GeoJSON geometry as stored in the DB (WGS84, simplified @5m). */
export type PublicWaterGeometry =
  | { type: 'LineString'; coordinates: [number, number][] }
  | { type: 'MultiLineString'; coordinates: [number, number][][] }
  | { type: 'Polygon'; coordinates: [number, number][][] }
  | { type: 'MultiPolygon'; coordinates: [number, number][][][] };

export interface PublicWater {
  id: number;
  name: string | null;
  type: PublicWaterType;
  county: string | null;
  countyId: number | null;
  /** All counties this water touches (rivers span many); used for the location label + filter. */
  countyIds: number[];
  centerLat: number;
  centerLng: number;
  /** ANAR's stable, type-prefixed code (e.g. `R:<guid>`), the key a private Lake links to. */
  linkCode: string | null;
  /** Surface area in km² (lakes/reservoirs); null for rivers. */
  areaKm2: number | null;
  geometry: PublicWaterGeometry;
  bboxSpanLat?: number;
  bboxSpanLng?: number;
}

/** A public water WITHOUT its geometry — everything a list row, search result or recent needs. */
export type PublicWaterListItem = Omit<PublicWater, 'geometry'>;

/** Full row for the read-only detail sheet. */
export interface PublicWaterDetail extends PublicWater {
  nameEn: string | null;
  euCode: string | null;
  anarCode: string | null;
  basin: string | null;
  volumeMilM3: number | null;
  elevationM: number | null;
  source: string;
}

/** UI filter for the Ape-publice mode (header chips). One type at a time to avoid clutter. */
export type PublicWaterFilter = 'river' | 'lake';

const LAKE_TYPES: PublicWaterType[] = ['natural_lake', 'reservoir_lake', 'coastal_lake', 'transitional_lake'];

/** Map a UI filter to the concrete water types. */
export function publicWaterFilterToTypes(filter: PublicWaterFilter): PublicWaterType[] {
  return filter === 'river' ? ['river'] : LAKE_TYPES;
}

/**
 * Compact location label. Rivers spanning multiple counties show "N județe" instead of one
 * arbitrary name (Dunărea/Olt); lakes and single-county waters show the county name.
 */
export function publicWaterLocationLabel(water: {
  type: PublicWaterType;
  county: string | null;
  countyIds: number[];
}): string | null {
  if (water.type === 'river' && water.countyIds.length > 1) {
    return `${water.countyIds.length} județe`;
  }
  return water.county;
}

/** Surface-area label in hectares (1 km² = 100 ha), e.g. 5.75 km² → "575 ha". Rivers → null. */
export function publicWaterAreaHaLabel(areaKm2: number | null): string | null {
  if (areaKm2 == null || areaKm2 <= 0) return null;
  return `${Math.round(areaKm2 * 100).toLocaleString('ro-RO')} ha`;
}

/**
 * Distance (km) from a point to a water's centroid, equirectangular approximation (accurate enough
 * at city/region scale, and cheap).
 */
export function waterDistanceKm(lat: number, lng: number, water: { centerLat: number; centerLng: number }): number {
  const R = 6371; // km
  const dLat = ((water.centerLat - lat) * Math.PI) / 180;
  const dLng = ((water.centerLng - lng) * Math.PI) / 180;
  const midLat = (((water.centerLat + lat) / 2) * Math.PI) / 180;
  const x = dLng * Math.cos(midLat);
  return Math.sqrt(dLat * dLat + x * x) * R;
}

/** Human-readable distance: "420 m" under 1 km, "3.2 km" under 10 km, "13 km" above. */
export function formatWaterDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
