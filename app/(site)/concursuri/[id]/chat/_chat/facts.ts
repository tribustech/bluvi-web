import type { CompetitionDetail } from '@/core/competitions';

/*
 * What the server hands the chat about the competition (the cached public read, lib/server
 * public-get under the competition's CMS tag): enough for the header's first paint (c1 — name and
 * banner, no placeholder bars for a known id) and the desktop columns, before the browser's own
 * competition query (with the viewer's isFollowing) lands.
 */
export type ChatCompetitionFacts = {
  documentId: string;
  name: string;
  /** The round header image (fish: thumbnail → small → original). */
  bannerThumb: string | null;
  /** The viewer's large rendition (fish: large → original). */
  bannerLarge: string | null;
  bannerWidth: number | null;
  bannerHeight: number | null;
  competitionStatus: CompetitionDetail['competitionStatus'];
  startDate: string;
  endDate: string;
  lakeName: string | null;
  authorId: string | null;
  /** competition.viewers (the followers count fish shows). */
  viewers: number;
  /** Registrations with status `registered`. */
  registered: number;
};

type FactsSource = Pick<CompetitionDetail, 'documentId' | 'name' | 'banner' | 'competitionStatus' | 'startDate' | 'endDate' | 'lake' | 'author' | 'viewers' | 'registrations'>;

export function chatFactsOf(c: FactsSource): ChatCompetitionFacts {
  const b = c.banner;
  return {
    documentId: c.documentId,
    name: c.name,
    bannerThumb: b ? (b.formats.small?.url ?? b.url) : null,
    bannerLarge: b ? (b.formats.large?.url ?? b.url) : null,
    bannerWidth: b?.width ?? null,
    bannerHeight: b?.height ?? null,
    competitionStatus: c.competitionStatus,
    startDate: c.startDate,
    endDate: c.endDate,
    lakeName: c.lake?.name ?? null,
    authorId: c.author?.documentId ?? null,
    viewers: Math.max(0, c.viewers ?? 0),
    registered: c.registrations.filter(r => r.registrationStatus === 'registered').length,
  };
}
