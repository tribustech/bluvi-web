'use client';

import { createContext, useContext, type ReactNode } from 'react';

/*
 * The competition's URL segment (`/concursuri/<slug>`, lib/routes.ts competitionUrlId) for the links
 * of the competition page and its public subpages (the lake page's _sub/lake-url.tsx, same rule).
 * The screens keep the documentId for their reads (the route param, once proxy.ts has rewritten a
 * slug URL) and take their links from here, so a link goes straight to the slug URL instead of
 * through proxy.ts's 308, and a tab switched with pushState keeps the URL the reader opened.
 * Outside a provider the documentId is the URL (it redirects).
 */
const CompetitionUrlContext = createContext<{ documentId: string; urlId: string } | null>(null);

/** `urlId`: competitionUrlId(competition), for `documentId`'s links only. */
export function CompetitionUrlProvider({ documentId, urlId, children }: { documentId: string; urlId: string; children: ReactNode }) {
  return <CompetitionUrlContext.Provider value={{ documentId, urlId }}>{children}</CompetitionUrlContext.Provider>;
}

/** The URL segment for `competitionId`'s links: the provided slug, or `competitionId` itself. */
export function useCompetitionUrlId(competitionId: string): string {
  const provided = useContext(CompetitionUrlContext);
  return provided && provided.documentId === competitionId ? provided.urlId : competitionId;
}
