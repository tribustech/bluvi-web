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
