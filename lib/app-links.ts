/*
 * The Bluvi app from the web: its store listings and the universal links that open it on a phone
 * (bluvi-redirect-stores serves the AASA — `/partide/*` opens the app — and falls back to the
 * stores when the app is not installed).
 *
 * Owner 2026-10-08 (ROADMAP §4b rule 21): running a partidă is app-only on web — no start, join,
 * capture, rods, timer, finish or member actions here; every such entry point opens the app.
 */

export const APP_STORE = 'https://apps.apple.com/ro/app/bluvi-aplicatia-pescarilor/id6743083184';
export const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.tribustech.bluvi';

const APP_ORIGIN = 'https://bluvi-app.wearetribus.com';

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
} as const;
