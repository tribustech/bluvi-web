import { parseLakeCoordinates, type LakeDetail } from '@/core/lakes';
import { absoluteUrl, lakeUrlId, routes } from '@/lib/routes';

/*
 * The lake as a schema.org place, the same on its page and on its Recenzii page (owner 2026-10-13:
 * review stars in Google). Google shows review stars only for some types — LocalBusiness among
 * them, TouristAttraction not — so a lake is both: a TouristAttraction (what it is to an angler)
 * and a SportsActivityLocation (a LocalBusiness subtype), as an array (Google: several types go in
 * an array; `additionalType` is not read). LocalBusiness requires `address`: always emitted, with
 * the country at least. Bluvi collects the reviews from anglers, not the lake's operator, which is
 * the case Google allows («sites that capture reviews about other local businesses»).
 * https://developers.google.com/search/docs/appearance/structured-data/review-snippet
 * https://developers.google.com/search/docs/appearance/structured-data/local-business
 */

export const LAKE_PLACE_TYPES = ['TouristAttraction', 'SportsActivityLocation'] as const;

type PlaceLake = Pick<LakeDetail, 'documentId' | 'name'> &
  Partial<Pick<LakeDetail, 'slug' | 'address' | 'county' | 'countyRef' | 'cityRef' | 'coordinates' | 'contact' | 'images'>>;

/**
 * `@type`, name, url, address, geo, telephone, the lead photo and the price range of a lake — only
 * facts the CMS has. `priceFrom`: the «de la X RON» the lake page shows (its priceFrom.ts — the
 * server's quote for the shortest tour, else the cheapest legacy price row), as `priceRange`.
 */
export function lakePlaceJsonLd(lake: PlaceLake, priceFrom?: { price: number } | null): Record<string, unknown> {
  const coords = lake.coordinates ? parseLakeCoordinates(lake.coordinates) : null;
  const phone = lake.contact?.find(c => c.phone?.trim())?.phone?.trim();
  const region = lake.countyRef?.name || lake.county || null;
  const lead = lake.images?.[0];
  const image = lead ? lead.url || lead.mediumUrl || lead.smallUrl || null : null;
  return {
    '@type': [...LAKE_PLACE_TYPES],
    name: lake.name,
    url: absoluteUrl(routes.lake(lakeUrlId(lake))),
    address: {
      '@type': 'PostalAddress',
      ...(lake.address?.trim() ? { streetAddress: lake.address.trim() } : {}),
      ...(lake.cityRef?.name ? { addressLocality: lake.cityRef.name } : {}),
      ...(region ? { addressRegion: region } : {}),
      addressCountry: 'RO',
    },
    ...(coords ? { geo: { '@type': 'GeoCoordinates', latitude: coords.lat, longitude: coords.lng } } : {}),
    ...(phone ? { telephone: phone } : {}),
    ...(image ? { image } : {}),
    ...(priceFrom && priceFrom.price > 0 ? { priceRange: `de la ${priceFrom.price} RON` } : {}),
  };
}
