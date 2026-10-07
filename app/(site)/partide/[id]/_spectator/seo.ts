import type { Metadata } from 'next';
import { deriveSessionView, fmtKg, fullSource, type CommunitySessionDetailDTO } from '@/core/partide';
import { formatCount } from '@/core/realtime/chat/format';
import { breadcrumbListJsonLd } from '@/lib/json-ld';
import { absoluteUrl, routes } from '@/lib/routes';
import { dayMonthRo, longDateRo } from '@/components/partide/session/format';
import { venueImageOf, venueWebHref } from '@/components/partide/session/VenueCard';
import type { SessionLoad } from './load';

/*
 * The public partidă's metadata and JSON-LD (parity global.b.seo-*): built from the SAME cached
 * read the page shows, so neither ever says more than the HTML (owner rule 4): no kg when nothing
 * was weighed, counts with Romanian plurals. A private / unknown partidă (the CMS's 404) is
 * `noindex` with a neutral title — it never names the venue — and so is one the server could not
 * read (the browser shows it, or its error, on its own).
 */

/** «Partidă la Chita Lake» — the page's title (the venue name is its <h1>). */
export const partidaTitle = (d: Pick<CommunitySessionDetailDTO, 'venueName'>) => `Partidă la ${d.venueName}`;

/** «7 capturi · 24,74 kg cântărite · cea mai mare 8,69 kg» — what the page's total card and tiles say. */
export function partidaSummary(d: CommunitySessionDetailDTO): string {
  const view = deriveSessionView(d);
  const when = d.endedAt ? `încheiată, ${longDateRo(d.startedAt)}` : `în desfășurare din ${dayMonthRo(d.startedAt).toLowerCase()}`;
  const facts = [
    d.catchCount > 0 ? formatCount(d.catchCount, 'captură', 'capturi') : 'Nicio captură încă',
    view.totalKg != null ? `${fmtKg(view.totalKg)} kg cântărite` : null,
    d.maxKg != null ? `cea mai mare ${fmtKg(d.maxKg)} kg` : null,
  ].filter(Boolean);
  const place = [d.venueName, d.locality].filter(Boolean).join(', ');
  return `Partidă la ${place}, ${when}: ${facts.join(' · ')}.`;
}

/** The share picture: the top catch photo, else the venue's image. */
export function partidaPhoto(d: CommunitySessionDetailDTO): string | null {
  const top = d.photos[0];
  return (top ? fullSource(top) : null) ?? venueImageOf(d);
}

export function partidaMetadata(id: string, load: SessionLoad): Metadata {
  const canonical = routes.partida(id);
  if (load.kind !== 'ok') {
    const title = load.kind === 'missing' ? 'Partida nu a fost găsită' : 'Partidă';
    return { title, robots: { index: false, follow: false }, alternates: { canonical } };
  }
  const d = load.detail;
  const title = partidaTitle(d);
  const description = partidaSummary(d);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      title,
      description,
      url: absoluteUrl(canonical),
      siteName: 'Bluvi',
      locale: 'ro_RO',
      // No `images`: the segment's generated card (opengraph-image.tsx) is og:image.
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/**
 * A partidă as a schema.org SportsEvent (a fishing session at a place, with a start and — once
 * ended — an end), the venue as its Place (with the venue page's URL when the web has one), the
 * anglers as its competitors (names only), the top photo as its image; plus the breadcrumb.
 */
export function partidaJsonLd(d: CommunitySessionDetailDTO) {
  const path = routes.partida(d.documentId);
  const venuePath = venueWebHref(d);
  const photo = partidaPhoto(d);
  const event = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: partidaTitle(d),
    description: partidaSummary(d),
    url: absoluteUrl(path),
    sport: 'Pescuit',
    inLanguage: 'ro-RO',
    startDate: d.startedAt,
    ...(d.endedAt ? { endDate: d.endedAt } : {}),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: d.venueName,
      ...(d.locality ? { address: { '@type': 'PostalAddress', addressLocality: d.locality, addressCountry: 'RO' } } : {}),
      ...(venuePath ? { url: absoluteUrl(venuePath) } : {}),
    },
    ...(d.members.length
      ? { competitor: d.members.map(m => ({ '@type': 'Person', name: m.name?.trim() || 'Pescar' })) }
      : {}),
    ...(photo ? { image: [photo] } : {}),
  };
  const breadcrumb = breadcrumbListJsonLd([{ label: 'Partide', href: routes.partide() }, { label: d.venueName }], path);
  return [event, breadcrumb];
}
