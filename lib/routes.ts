/**
 * Public URL scheme — the one place page paths are built, so the sitemap, OpenGraph, links in
 * notifications and the future pages agree. Slugs are a UI decision still open (see the spec);
 * until then the documentId is the stable identifier. Romanian segments, as in the app copy.
 */
export const routes = {
  home: () => '/',
  lakes: () => '/balti',
  lake: (documentId: string) => `/balti/${encodeURIComponent(documentId)}`,
  competitions: () => '/concursuri',
  competition: (documentId: string) => `/concursuri/${encodeURIComponent(documentId)}`,
  competitionRanking: (documentId: string) => `/concursuri/${encodeURIComponent(documentId)}/clasament`,
  news: () => '/stiri',
  newsItem: (documentId: string) => `/stiri/${encodeURIComponent(documentId)}`,
  angler: (documentId: string) => `/pescari/${encodeURIComponent(documentId)}`,
  partida: (documentId: string) => `/partide/${encodeURIComponent(documentId)}`,
} as const;

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

export const absoluteUrl = (path: string) => `${siteUrl()}${path}`;
