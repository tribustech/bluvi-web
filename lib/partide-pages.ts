import { ON_WEB, routes } from './routes';

/**
 * The M4 Partide pages the web has (docs/parity/areas/partide.yml), one switch per page or tab —
 * the same pattern as lib/routes.ts ON_WEB. Until the batch that ships a page flips its entry, every
 * link to it goes through the helpers below, which answer null: the caller hides the link or renders
 * its target as plain text — never a dead link to the catch-all 404.
 *
 * The partidă page, which lib/routes.ts already switches, is read from ON_WEB, so it keeps exactly
 * one switch. Starting, joining and running a partidă are app-only on web (owner 2026-10-08,
 * ROADMAP §4b rule 21): no page here — lib/app-links.ts opens the app. Flip an entry in the commit step of the screen
 * that ships it (one-line edit, serialised by the orchestrator).
 */
export const PARTIDE_PAGES_ON_WEB = {
  /** /partide/exploreaza — the hub's «Explorează» tab (partide.exploreaza). */
  explore: true,
  /** /partide/ale-mele — the hub's «Ale mele» tab (partide.ale-mele). */
  mine: true,
  /** /partide/istoric — the viewer's history (partide.istoric). */
  history: true,
  /** /partide/statistici — «Statistici comunitate» (partide.statistici). */
  stats: true,
  /** /partide/clasament — «Clasamente» (partide.clasament). */
  ranking: true,
  /** /partide/capturile-mele — the viewer's catches (partide.capturile-mele). */
  myCatches: true,
  /** /partide/[id] — the partidă page, own (read-only) or spectator view (lib/routes.ts ON_WEB.partida). */
  partida: ON_WEB.partida,
  /** /partide/[id]/capturi — every catch of a partidă (partide.spectator-capturi). */
  partidaCatches: true,
  /** /partide/[id]/galerie — the photos of a partidă (partide.spectator-galerie). */
  partidaGallery: true,
  /** /pescari — «Caută pescari» (partide.pescari). */
  anglersSearch: false,
} as const;

export type PartidePage = keyof typeof PARTIDE_PAGES_ON_WEB;

const on = (page: PartidePage) => PARTIDE_PAGES_ON_WEB[page];

/** The route when `page` is on the web, else null (hide the link or render plain text). */
export function partidePageHref(page: PartidePage, href: string): string | null {
  return on(page) ? href : null;
}

export const partideHrefs = {
  explore: () => partidePageHref('explore', routes.partideExplore()),
  mine: () => partidePageHref('mine', routes.partideMine()),
  history: (filters?: Parameters<typeof routes.partideHistory>[0]) => partidePageHref('history', routes.partideHistory(filters)),
  stats: (perioada?: 'week' | 'month' | 'year') => partidePageHref('stats', routes.partideStats(perioada)),
  ranking: (perioada?: 'week' | 'month' | 'year', tab?: string) => partidePageHref('ranking', routes.partideRanking(perioada, tab)),
  myCatches: () => partidePageHref('myCatches', routes.myCatches()),
  partida: (documentId: string) => partidePageHref('partida', routes.partida(documentId)),
  partidaCatches: (documentId: string) => partidePageHref('partidaCatches', routes.partidaCatches(documentId)),
  partidaGallery: (documentId: string) => partidePageHref('partidaGallery', routes.partidaGallery(documentId)),
  anglersSearch: () => partidePageHref('anglersSearch', routes.anglersSearch()),
} as const;

/**
 * A page that needs a signed-in viewer («Caută pescari»; parity partide.b.signin-gating):
 * the page itself for a viewer, sign-in returning to it for a guest — null while the page is off.
 */
export function signedInHref(href: string | null, signedIn: boolean): string | null {
  if (!href) return null;
  return signedIn ? href : routes.signIn(href);
}
