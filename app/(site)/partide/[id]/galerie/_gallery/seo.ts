import type { Metadata } from 'next';
import type { CommunitySessionDetailDTO, SessionCatchesPage } from '@/core/partide';
import { formatCount } from '@/core/realtime/chat/format';
import { breadcrumbListJsonLd } from '@/lib/json-ld';
import { absoluteUrl, routes } from '@/lib/routes';
import { longDateRo } from '@/components/partide/session/format';
import { partidaTitle } from '../../_spectator/seo';
import type { SessionLoad } from '../../_spectator/load';
import { galleryPhotos, gallerySubtitle, photoCaption } from './view';

/*
 * The gallery's metadata and JSON-LD (parity global.b.seo-*), from the same cached reads the page
 * shows (owner rule 4: never more than the HTML). A private / unknown partidă (the CMS's 404) is
 * `noindex` with a neutral title — it never names the venue (invariant 15) — and so is one the
 * server could not read, and a gallery with no photo (an empty page is not a search result).
 */

export const GALLERY_LABEL = 'Galerie';

/** «Partide › Partidă la Chita Lake › Galerie» — the band's trail and the JSON-LD breadcrumb. */
export function galleryTrail(d: Pick<CommunitySessionDetailDTO, 'venueName' | 'documentId'>) {
  return [
    { label: 'Partide', href: routes.partide() },
    { label: partidaTitle(d), href: routes.partida(d.documentId) },
    { label: GALLERY_LABEL },
  ];
}

export function galleryDescription(d: CommunitySessionDetailDTO): string {
  const who = gallerySubtitle(d.members, null);
  const photos = d.photoCount > 0 ? formatCount(d.photoCount, 'fotografie', 'fotografii') : 'Nicio fotografie încă';
  return `${photos} din partida de la ${d.venueName}${d.locality && d.locality !== d.venueName ? `, ${d.locality}` : ''}, ${longDateRo(d.startedAt)}${who ? ` — ${who}` : ''}.`;
}

export function galleryMetadata(id: string, load: SessionLoad): Metadata {
  const canonical = routes.partidaGallery(id);
  if (load.kind !== 'ok') {
    const title = load.kind === 'missing' ? 'Partida nu a fost găsită' : GALLERY_LABEL;
    return { title, robots: { index: false, follow: false }, alternates: { canonical } };
  }
  const d = load.detail;
  const title = `${GALLERY_LABEL} · ${partidaTitle(d)}`;
  const description = galleryDescription(d);
  return {
    title,
    description,
    alternates: { canonical },
    ...(d.photoCount > 0 ? {} : { robots: { index: false, follow: true } }),
    openGraph: { type: 'website', title, description, url: absoluteUrl(canonical), siteName: 'Bluvi', locale: 'ro_RO' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/** schema.org ImageGallery (the first page of photos) + the breadcrumb. */
export function galleryJsonLd(d: CommunitySessionDetailDTO, firstPage: SessionCatchesPage | null) {
  const path = routes.partidaGallery(d.documentId);
  const photos = galleryPhotos(firstPage ? [firstPage] : []);
  const gallery = {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: `${GALLERY_LABEL} · ${partidaTitle(d)}`,
    description: galleryDescription(d),
    url: absoluteUrl(path),
    isPartOf: absoluteUrl(routes.partida(d.documentId)),
    image: photos.map(p => ({ '@type': 'ImageObject', contentUrl: p.full, thumbnailUrl: p.grid, caption: photoCaption(p) ?? 'Captură', uploadDate: p.occurredAt })),
  };
  return [gallery, breadcrumbListJsonLd(galleryTrail(d), path)];
}
