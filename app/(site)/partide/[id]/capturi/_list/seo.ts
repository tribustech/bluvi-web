import type { Metadata } from 'next';
import { fmtKg, fullSource, type CommunitySessionDetailDTO, type SessionCatchesPage } from '@/core/partide';
import { formatCount } from '@/core/realtime/chat/format';
import { breadcrumbListJsonLd } from '@/lib/json-ld';
import { absoluteUrl, routes } from '@/lib/routes';
import { catchCaption, longDateRo } from '@/components/partide/session/format';
import type { SessionLoad } from '../../_spectator/load';
import { partidaTitle } from '../../_spectator/seo';

/*
 * /partide/[id]/capturi metadata and JSON-LD (parity global.b.seo-*), built from the same cached
 * reads the page shows (owner rule 4: never more than the HTML says). A private / unknown partidă
 * (the CMS's 404) is `noindex` with a neutral title — it never names the venue — and so is one the
 * server could not read; a partidă without a catch is `noindex, follow` (a page with nothing of its
 * own, as the lake subpages).
 */

export const CATCHES_LABEL = 'Capturi';

/** «Capturi · Partidă la Chita Lake». */
export const catchesTitle = (d: Pick<CommunitySessionDetailDTO, 'venueName'>) => `${CATCHES_LABEL} · ${partidaTitle(d)}`;

/** «Toate cele 7 capturi din partida de la Chita Lake, Giurgiu (12 octombrie 2026): …». */
export function catchesDescription(d: CommunitySessionDetailDTO): string {
  const place = [d.venueName, d.locality].filter(Boolean).join(', ');
  const when = longDateRo(d.startedAt);
  if (d.catchCount === 0) return `Partida de la ${place} (${when}) nu are nicio captură încă.`;
  const count = d.catchCount === 1 ? 'Captura' : `Toate cele ${formatCount(d.catchCount, 'captură', 'capturi')}`;
  const max = d.maxKg != null ? `, cea mai mare de ${fmtKg(d.maxKg)} kg` : '';
  return `${count} din partida de la ${place} (${when})${max}: specia, greutatea, ora și fotografia.`;
}

export function catchesMetadata(id: string, load: SessionLoad): Metadata {
  const canonical = routes.partidaCatches(id);
  if (load.kind !== 'ok') {
    const title = load.kind === 'missing' ? 'Partida nu a fost găsită' : CATCHES_LABEL;
    return { title, robots: { index: false, follow: false }, alternates: { canonical } };
  }
  const d = load.detail;
  const title = catchesTitle(d);
  const description = catchesDescription(d);
  return {
    title,
    description,
    alternates: { canonical },
    ...(d.catchCount === 0 ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: 'website', title, description, url: absoluteUrl(canonical), siteName: 'Bluvi', locale: 'ro_RO' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/**
 * The first page as a schema.org ImageGallery of its photographed catches (captioned as the
 * lightbox: «Crap · 3,4 kg · 14:30»), plus the breadcrumb Partide › {venue} › Capturi.
 */
export function catchesJsonLd(d: CommunitySessionDetailDTO, firstPage: SessionCatchesPage | null) {
  const path = routes.partidaCatches(d.documentId);
  const images = (firstPage?.data ?? [])
    .map(c => ({ c, src: fullSource(c) }))
    .filter((x): x is { c: (typeof x)['c']; src: string } => !!x.src)
    .map(({ c, src }) => ({ '@type': 'ImageObject', contentUrl: src, caption: catchCaption(c) || 'Captură', uploadDate: c.occurredAt }));
  const gallery = {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: catchesTitle(d),
    description: catchesDescription(d),
    url: absoluteUrl(path),
    inLanguage: 'ro-RO',
    isPartOf: { '@type': 'WebPage', url: absoluteUrl(routes.partida(d.documentId)), name: partidaTitle(d) },
    ...(images.length ? { image: images } : {}),
  };
  const breadcrumb = breadcrumbListJsonLd(
    [
      { label: 'Partide', href: routes.partide() },
      { label: d.venueName, href: routes.partida(d.documentId) },
      { label: CATCHES_LABEL },
    ],
    path,
  );
  return [gallery, breadcrumb];
}
