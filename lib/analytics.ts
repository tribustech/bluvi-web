/*
 * The site's one analytics channel (m8.ga4). fish logs with Firebase Analytics; the web sends the
 * same event names and params to GA4 (gtag), behind the cookie consent (lib/consent):
 *  - every event goes to a `bluvi:analytics` CustomEvent on window ({ name, params }) — what e2e
 *    specs collect, always, consent or not (it never leaves the page);
 *  - it reaches GA4 (`window.gtag('event', …)`) only when GA is on for this deployment (ga4Id():
 *    NEXT_PUBLIC_GA4_ID set AND production, or a developer's NEXT_PUBLIC_ANALYTICS_DEBUG opt-in — fish
 *    isCollectionEnabled), the visitor opted in to «Analiză» and components/analytics/Ga4.tsx
 *    initialised gtag (enableGa4). Nothing is queued before the opt-in: events before it are dropped
 *    (GDPR). With GA off there is no GA at all (no script, no cookie); a `window.gtag` a test stubs
 *    still receives the events.
 *  - GA4's «enhanced measurement» must be off in the web stream for history page changes and site
 *    search (docs/RUNBOOK.md, launch blocker): gtag.js would otherwise send its own page_view with
 *    the real URL (people's ids, ?q= free text) next to ours.
 *  - page views (components/analytics/ScreenViewTracker.tsx → trackPageView) go to their own
 *    `bluvi:page-view` CustomEvent, so the screens' event lists stay what fish logs.
 * Each area keeps its typed event names next to its screens and calls `track`. Null / undefined
 * params are left out (fish passes `undefined`); a failure never reaches the page (fish `safely`).
 */

import { clearAnalyticsCookies, readConsent } from '@/lib/consent/store';

export const ANALYTICS_EVENT = 'bluvi:analytics';
/** Fired on window for every page view ({ name: 'page_view', params }), consent or not. */
export const PAGE_VIEW_EVENT = 'bluvi:page-view';

export type AnalyticsParam = string | number | boolean | null | undefined;
export type AnalyticsParams = Record<string, AnalyticsParam>;
type Clean = Record<string, string | number | boolean>;

type GtagWindow = Window & { gtag?: (...args: unknown[]) => void; dataLayer?: unknown[] } & Record<string, unknown>;

export type AppEnv = 'local' | 'staging' | 'production';

/**
 * fish analytics/appEnv.ts on the web: the deployment from Vercel's environment and the site URL.
 * Anything unrecognised is `local` — a build is never accidentally labelled production.
 */
export function resolveAppEnv(siteUrl: string | undefined, vercelEnv: string | undefined): AppEnv {
  let host = '';
  try {
    host = siteUrl ? new URL(siteUrl).hostname : '';
  } catch {
    host = '';
  }
  if (!host || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return 'local';
  if (vercelEnv === 'production') return /(^|[.-])staging[.-]/.test(host) ? 'staging' : 'production';
  if (vercelEnv === 'preview') return 'staging';
  return 'local';
}

/**
 * fish analytics/appEnv.ts isCollectionEnabled: production always collects; any other deployment
 * (Vercel preview, staging, localhost) only when a developer opts in explicitly
 * (NEXT_PUBLIC_ANALYTICS_DEBUG = 1 / true), so previews and QA runs never reach the property.
 */
export function isCollectionEnabled(env: AppEnv, debugFlag: string | undefined): boolean {
  return env === 'production' || debugFlag === '1' || debugFlag === 'true';
}

function currentAppEnv(): AppEnv {
  return resolveAppEnv(process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXT_PUBLIC_VERCEL_ENV);
}

/**
 * The GA4 measurement id when GA is on for this deployment, else null: unset or not a G- id, or not
 * production without the debug opt-in (isCollectionEnabled). Inlined at build time.
 */
export function ga4Id(): string | null {
  const id = process.env.NEXT_PUBLIC_GA4_ID;
  if (!id || !/^G-[A-Z0-9]{4,20}$/.test(id)) return null;
  return isCollectionEnabled(currentAppEnv(), process.env.NEXT_PUBLIC_ANALYTICS_DEBUG) ? id : null;
}

/**
 * Sent with every GA4 event (gtag config). app_env is the web's own label (fish sends none: it only
 * gates collection, see isCollectionEnabled); debug_mode outside production, i.e. the debug opt-in,
 * so that traffic lands in DebugView (and the Developer-traffic filter, RUNBOOK).
 */
export function defaultEventParams(env: AppEnv = currentAppEnv()): Clean {
  // GA4 reads any debug_mode value as «on»: it is left out in production, never sent as false.
  return env === 'production' ? { app_env: env } : { app_env: env, debug_mode: true };
}

function clean(params?: AnalyticsParams): Clean {
  const out: Clean = {};
  if (params) for (const [k, v] of Object.entries(params)) if (v != null) out[k] = v;
  return out;
}

/** GA4 state for this page: null until the first opt-in initialises gtag. */
let ga: { id: string; enabled: boolean } | null = null;
/** The page on screen (for the page_view sent when the visitor opts in on it). */
let currentScreen: Clean | null = null;

function gtagWin(): GtagWindow {
  return window as unknown as GtagWindow;
}

/** Whether an event may go to GA4 now. */
function canSend(): boolean {
  return Boolean(ga?.enabled && readConsent()?.analytics === true);
}

function forward(name: string, params: Clean): void {
  const w = gtagWin();
  if (ga4Id()) {
    if (canSend()) w.gtag?.('event', name, params);
    return;
  }
  // No GA on this deployment: we never define gtag, so one present is a test's stub.
  w.gtag?.('event', name, params);
}

export function track(name: string, params?: AnalyticsParams): void {
  if (typeof window === 'undefined') return;
  try {
    const p = clean(params);
    window.dispatchEvent(new CustomEvent(ANALYTICS_EVENT, { detail: { name, params: p } }));
    forward(name, p);
  } catch {
    // no-op: analytics never breaks a page
  }
}

/** GA4 reads page_location / page_title from here for every later event (no query, no names). */
function sendPageView(screen: Clean): void {
  const w = gtagWin();
  const location = `${window.location.origin}${String(screen.page_path ?? '/')}`;
  const title = String(screen.screen_name ?? '');
  w.gtag?.('set', { page_location: location, page_title: title });
  w.gtag?.('event', 'page_view', { ...screen, page_location: location, page_title: title });
}

/**
 * One page view (ScreenViewTracker): screen_name / screen_class (fish names), page_path (the route
 * with only the reportable ids filled in) and the entity ids. To GA4 only with consent.
 */
export function trackPageView(params: AnalyticsParams): void {
  if (typeof window === 'undefined') return;
  try {
    const p = clean(params);
    currentScreen = p;
    window.dispatchEvent(new CustomEvent(PAGE_VIEW_EVENT, { detail: { name: 'page_view', params: p } }));
    // Not to a test's gtag stub (no GA id): the screens' stubbed event lists stay what they were.
    if (ga4Id() && canSend()) sendPageView(p);
  } catch {
    // no-op
  }
}

/**
 * The visitor opted in (Ga4.tsx): defines gtag (the loader script picks up dataLayer), consent
 * defaults all denied then analytics_storage granted, config without the automatic page_view and
 * without Google signals / ad personalisation; then the page on screen is counted once.
 */
export function enableGa4(id: string): void {
  if (typeof window === 'undefined') return;
  // Already on (a remount, React's dev double effect): no second consent update nor page_view.
  if (ga?.enabled && ga.id === id) return;
  try {
    const w = gtagWin();
    w[`ga-disable-${id}`] = false;
    if (!ga) {
      w.dataLayer = w.dataLayer ?? [];
      if (!w.gtag) {
        w.gtag = function gtag() {
          // gtag.js reads Arguments objects, not arrays.
          // eslint-disable-next-line prefer-rest-params
          w.dataLayer!.push(arguments);
        };
      }
      w.gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
      w.gtag('js', new Date());
      w.gtag('consent', 'update', { analytics_storage: 'granted' });
      // send_page_view:false only drops config's own hit: enhanced measurement's history / site-search
      // page_views are a stream setting the owner turns off (RUNBOOK, launch blocker).
      w.gtag('config', id, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        ...defaultEventParams(),
      });
    } else {
      w.gtag?.('consent', 'update', { analytics_storage: 'granted' });
    }
    ga = { id, enabled: true };
    if (currentScreen) sendPageView(currentScreen);
  } catch {
    // no-op
  }
}

/** The visitor withdrew: GA stops (disable flag + consent denied) and its cookies are deleted. */
export function disableGa4(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const w = gtagWin();
    w[`ga-disable-${id}`] = true;
    if (ga) {
      w.gtag?.('consent', 'update', { analytics_storage: 'denied' });
      ga = { ...ga, enabled: false };
    }
    clearAnalyticsCookies();
  } catch {
    // no-op
  }
}

/** Tests only: forget the GA state and the page on screen. */
export function resetAnalyticsForTests(): void {
  ga = null;
  currentScreen = null;
}
