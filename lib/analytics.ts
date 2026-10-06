/*
 * The site's one analytics channel. fish logs with Firebase Analytics; GA4 lands on the web in M8,
 * behind the cookie-consent banner (ROADMAP §7). Until then every event, with fish's exact name and
 * params, goes to both:
 *  - a `bluvi:analytics` CustomEvent on window ({ name, params }) — the one place the M8 consent
 *    layer listens, and what e2e specs collect;
 *  - `window.gtag('event', name, params)` when a page has gtag (none does before M8; specs stub it).
 * Each area keeps its typed event names next to its screens and calls `track`. Null / undefined
 * params are left out (fish passes `undefined`); a failure never reaches the page (fish `safely`).
 * TODO(M8): forward to GA4 behind the consent banner.
 */

export const ANALYTICS_EVENT = 'bluvi:analytics';

export type AnalyticsParam = string | number | boolean | null | undefined;
export type AnalyticsParams = Record<string, AnalyticsParam>;

type Gtag = (command: 'event', name: string, params?: Record<string, string | number | boolean>) => void;

export function track(name: string, params?: AnalyticsParams): void {
  if (typeof window === 'undefined') return;
  try {
    let clean: Record<string, string | number | boolean> | undefined;
    if (params) {
      clean = {};
      for (const [k, v] of Object.entries(params)) if (v != null) clean[k] = v;
    }
    window.dispatchEvent(new CustomEvent(ANALYTICS_EVENT, { detail: { name, params: clean ?? {} } }));
    (window as unknown as { gtag?: Gtag }).gtag?.('event', name, clean);
  } catch {
    // no-op: analytics never breaks a page
  }
}
