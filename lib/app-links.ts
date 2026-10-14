/*
 * The Bluvi app from the web: its store listings and the universal links that open it on a phone.
 * They point at app.bluvi.ro, not bluvi.ro: iOS never opens the app for a link to the page's own
 * domain. This project serves that host's AASA (lib/app-site-association.ts); without the app,
 * proxy.ts sends a phone to its store and a computer to the same page on bluvi.ro.
 *
 * Owner 2026-10-08 (ROADMAP §4b rule 21): running a partidă is app-only on web — no start, join,
 * capture, rods, timer, finish or member actions here; every such entry point opens the app.
 */

export const APP_STORE = 'https://apps.apple.com/ro/app/bluvi-aplicatia-pescarilor/id6743083184';
export const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.tribustech.bluvi';

/** The host of the «Deschide în aplicație» links (owner 2026-10-14). */
export const APP_ORIGIN = 'https://app.bluvi.ro';

/** The host of the links people share (fish WEB_DOMAIN): the page itself, or the app where installed. */
export const SHARE_ORIGIN = 'https://bluvi.ro';

/** Universal links into the app's Partide screens (fish app/(app)/partide/*). */
export const appLinks = {
  /** fish (tabs)/partide — the hub, whose hero starts or joins a partidă. */
  partide: () => `${APP_ORIGIN}/partide`,
  /** fish partide/start?lakeId= | ?waterCode= — the start flow, the venue preselected. */
  startPartida: (at: { lakeId?: string; waterCode?: string } = {}) => {
    const q = new URLSearchParams();
    if (at.lakeId) q.set('lakeId', at.lakeId);
    else if (at.waterCode) q.set('waterCode', at.waterCode);
    const s = q.toString();
    return `${APP_ORIGIN}/partide/start${s ? `?${s}` : ''}`;
  },
  /**
   * fish partide/comunitate/[id] — keyed by the documentId; the app sends the viewer's own live
   * partidă on to its member screen (capture, rods, finish).
   */
  partida: (documentId: string) => `${APP_ORIGIN}/partide/comunitate/${encodeURIComponent(documentId)}`,
  /** fish competitions/[competitionId] — keyed by the documentId. */
  competition: (documentId: string) => `${APP_ORIGIN}/competitions/${encodeURIComponent(documentId)}`,
} as const;
