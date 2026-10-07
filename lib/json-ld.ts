import { absoluteUrl } from '@/lib/routes';

/*
 * schema.org JSON-LD — the one serializer and the one BreadcrumbList builder every public page
 * uses (render: `<script type="application/ld+json" dangerouslySetInnerHTML={jsonLdHtml(data)} />`,
 * or components/seo/JsonLd).
 */

/** A JSON-LD payload with `<` escaped, so no string can close the script element. */
export const jsonLdHtml = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, '\\u003c') });

/**
 * A BreadcrumbList from a trail («Bălți › Lacul Chita › Galerie»). Each step links its `href`; the
 * last step without one takes `currentPath` (the page itself), and a step with neither is listed
 * without an `item`.
 */
export function breadcrumbListJsonLd(trail: { label: string; href?: string }[], currentPath?: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((c, i) => {
      const href = c.href ?? (i === trail.length - 1 ? currentPath : undefined);
      return { '@type': 'ListItem', position: i + 1, name: c.label, ...(href ? { item: absoluteUrl(href) } : {}) };
    }),
  };
}

/**
 * A page that is a collection (a ranking, a feed of partide, a statistics view): schema.org
 * CollectionPage at the page's canonical `path`, `about` the venue / competition it belongs to and,
 * when the page lists ranked rows, those rows as its ItemList `mainEntity`. Only what the page shows
 * goes in (rule 4): no list without rows.
 */
export function collectionPageJsonLd({
  name,
  description,
  path,
  about,
  list,
}: {
  name: string;
  description?: string;
  path: string;
  about?: { type: string; name: string; path: string };
  list?: { name: string; items: { name: string; description?: string; path?: string }[]; order?: ItemListOrder };
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    ...(description ? { description } : {}),
    url: absoluteUrl(path),
    inLanguage: 'ro-RO',
    ...(about ? { about: { '@type': about.type, name: about.name, url: absoluteUrl(about.path) } } : {}),
    ...(list && list.items.length ? { mainEntity: itemListJsonLd(list.name, list.items, list.order) } : {}),
  };
}

/** How an ItemList is ordered: a ranking descends (the default); a timeline ascends. */
export type ItemListOrder = 'descending' | 'ascending';

/** An ItemList (positions 1..n, in the page's order; a ranking by default). Without `@context`: it is nested. */
export function itemListJsonLd(name: string, items: { name: string; description?: string; path?: string }[], order: ItemListOrder = 'descending') {
  return {
    '@type': 'ItemList',
    name,
    itemListOrder: order === 'ascending' ? 'https://schema.org/ItemListOrderAscending' : 'https://schema.org/ItemListOrderDescending',
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      ...(it.description ? { description: it.description } : {}),
      ...(it.path ? { url: absoluteUrl(it.path) } : {}),
    })),
  };
}

/** schema.org AggregateRating on the 1–5 scale (one decimal, as the pages show a score), or null when nothing was rated (never a 0 score). */
export function aggregateRatingJsonLd(value: number | null | undefined, count: number | null | undefined) {
  if (!count || count <= 0 || !value || !Number.isFinite(value)) return null;
  return { '@type': 'AggregateRating', ratingValue: Math.round(value * 10) / 10, ratingCount: count, bestRating: 5, worstRating: 1 };
}

/** A map page: schema.org Map `about` the place it shows, with its coordinates when the page has them. */
export function mapJsonLd({ name, path, place }: { name: string; path: string; place: { type: string; name: string; path: string; lat?: number; lng?: number } }) {
  const geo = place.lat != null && place.lng != null ? { geo: { '@type': 'GeoCoordinates', latitude: place.lat, longitude: place.lng } } : {};
  return {
    '@context': 'https://schema.org',
    '@type': 'Map',
    name,
    url: absoluteUrl(path),
    inLanguage: 'ro-RO',
    about: { '@type': place.type, name: place.name, url: absoluteUrl(place.path), ...geo },
  };
}
