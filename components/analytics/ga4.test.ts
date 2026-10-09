// @vitest-environment jsdom
/*
 * m8.ga4 «on» path (NEXT_PUBLIC_GA4_ID set): the shared dev server runs without an id, so the e2e
 * (tests/e2e/analytics-ga4.spec.ts) proves the «off» path and this file proves the rest in jsdom —
 * Ga4 rendered for real (next/script), lib/analytics, the page_view tracker's dedupe and the
 * data-analytics-* listener. Nothing reaches Google: the loader <script> is never fetched by jsdom.
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A new id per test: next/script remembers each loaded src for the life of the module (not reset here).
let n = 1000;
let ID = 'G-TEST1000';

type W = Window & { dataLayer?: IArguments[]; gtag?: unknown } & Record<string, unknown>;
const w = () => window as unknown as W;
const calls = () => (w().dataLayer ?? []).map((a) => Array.from(a));
const events = (name: string) => calls().filter((c) => c[0] === 'event' && c[1] === name);
const scripts = () => document.querySelectorAll('script[src^="https://www.googletagmanager.com/gtag/js"]');

let root: Root | null = null;
let container: HTMLElement;

async function load() {
  vi.resetModules();
  const analytics = await import('@/lib/analytics');
  const consent = await import('@/lib/consent/store');
  const { Ga4 } = await import('./Ga4');
  const tracker = await import('./ScreenViewTracker');
  const links = await import('./AnalyticsLinkListener');
  return { analytics, consent, Ga4, tracker, links };
}

async function render(el: ReturnType<typeof createElement>) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(el));
}

function clearCookies() {
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  ID = `G-TEST${++n}`;
  vi.stubEnv('NEXT_PUBLIC_GA4_ID', ID);
  // jsdom is a «local» deployment: GA runs there only with the developer's debug opt-in (fish isCollectionEnabled).
  vi.stubEnv('NEXT_PUBLIC_ANALYTICS_DEBUG', '1');
  clearCookies();
  delete w().dataLayer;
  delete w().gtag;
  delete w()[`ga-disable-${ID}`];
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  vi.unstubAllEnvs();
});

describe('GA4 behind consent (NEXT_PUBLIC_GA4_ID set)', () => {
  it('no consent: no script, no gtag, events stay on the page channel only', async () => {
    const { analytics, Ga4 } = await load();
    await render(createElement(Ga4));
    const seen: unknown[] = [];
    window.addEventListener(analytics.ANALYTICS_EVENT, (e) => seen.push((e as CustomEvent).detail));
    analytics.track('share_competition', { competition_id: 'c1', competition_name: 'Cupa' });
    expect(scripts()).toHaveLength(0);
    expect(w().gtag).toBeUndefined();
    expect(w().dataLayer).toBeUndefined();
    expect(seen).toEqual([{ name: 'share_competition', params: { competition_id: 'c1', competition_name: 'Cupa' } }]);
  });

  it('refused: still nothing', async () => {
    const { consent, Ga4 } = await load();
    consent.setConsent({ analytics: false });
    await render(createElement(Ga4));
    expect(scripts()).toHaveLength(0);
    expect(w().gtag).toBeUndefined();
  });

  it('accept: the loader once, consent defaults denied then analytics granted, config without page_view / signals', async () => {
    const { consent, Ga4 } = await load();
    await render(createElement(Ga4));
    await act(async () => void consent.setConsent({ analytics: true }));
    expect(scripts()).toHaveLength(1);
    expect(scripts()[0]!.getAttribute('src')).toBe(`https://www.googletagmanager.com/gtag/js?id=${ID}`);
    const c = calls();
    const iDefault = c.findIndex((x) => x[0] === 'consent' && x[1] === 'default');
    const iUpdate = c.findIndex((x) => x[0] === 'consent' && x[1] === 'update');
    const iConfig = c.findIndex((x) => x[0] === 'config');
    expect(c[iDefault]![2]).toEqual({ analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    expect(c[iUpdate]![2]).toEqual({ analytics_storage: 'granted' });
    expect(iDefault).toBeLessThan(iUpdate);
    expect(iUpdate).toBeLessThan(iConfig);
    expect(c[iConfig]).toEqual(['config', ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, app_env: 'local', debug_mode: true }]);
    // A later decision (or a re-render) loads nothing more.
    await act(async () => void consent.setConsent({ analytics: true }));
    await act(async () => root!.render(createElement(Ga4)));
    expect(scripts()).toHaveLength(1);
  });

  it('already accepted on arrival: loads on mount', async () => {
    const { consent, Ga4 } = await load();
    consent.setConsent({ analytics: true });
    await render(createElement(Ga4));
    expect(scripts()).toHaveLength(1);
  });

  it('events before the opt-in are dropped, never queued', async () => {
    const { analytics, consent, Ga4 } = await load();
    await render(createElement(Ga4));
    analytics.track('share_competition', { competition_id: 'early' });
    await act(async () => void consent.setConsent({ analytics: true }));
    expect(events('share_competition')).toEqual([]);
  });

  it('page_view: the page of the opt-in once, then once per navigation (lake A → lake B = 2); a re-render logs nothing', async () => {
    const { consent, Ga4, tracker } = await load();
    await render(createElement(Ga4));
    tracker.logScreenView('/balti/A', { id: 'A' });
    tracker.logScreenView('/balti/A', { id: 'A' }); // re-render
    expect(events('page_view')).toEqual([]); // before consent: nothing
    await act(async () => void consent.setConsent({ analytics: true }));
    tracker.logScreenView('/balti/A', { id: 'A' }); // re-render after
    tracker.logScreenView('/balti/B', { id: 'B' });
    tracker.logScreenView('/balti/B', { id: 'B' });
    const views = events('page_view').map((c) => c[2] as Record<string, string>);
    expect(views.map((v) => v.lake_id)).toEqual(['A', 'B']);
    expect(views[1]).toEqual({
      screen_name: 'Lake Page',
      screen_class: 'Lake Page',
      page_path: '/balti/B',
      lake_id: 'B',
      page_location: 'http://localhost:3000/balti/B',
      page_title: 'Lake Page',
    });
    // page_location / page_title are set for the events that follow (no query string, no names).
    expect(calls().filter((c) => c[0] === 'set').at(-1)).toEqual(['set', { page_location: 'http://localhost:3000/balti/B', page_title: 'Lake Page' }]);
  });

  it("an angler's id never reaches GA (page_path keeps the pattern, no entity param)", async () => {
    const { consent, Ga4, tracker } = await load();
    consent.setConsent({ analytics: true });
    await render(createElement(Ga4));
    tracker.logScreenView('/pescari/p1', { id: 'p1' });
    expect(events('page_view').at(-1)![2]).toMatchObject({ screen_name: 'Angler Profile', page_path: '/pescari/[id]' });
    expect(JSON.stringify(calls())).not.toContain('p1');
  });

  it('a screen event (share_competition) reaches gtag with fish params', async () => {
    const { analytics, consent, Ga4 } = await load();
    consent.setConsent({ analytics: true });
    await render(createElement(Ga4));
    analytics.track('share_competition', { competition_id: 'c1', competition_name: 'Cupa Chita', extra: undefined });
    expect(events('share_competition')).toEqual([['event', 'share_competition', { competition_id: 'c1', competition_name: 'Cupa Chita' }]]);
  });

  it('refuse after accept: disable flag, consent denied, _ga cookies removed, nothing sent; a new opt-in resumes without a second script', async () => {
    const { analytics, consent, Ga4 } = await load();
    consent.setConsent({ analytics: true });
    await render(createElement(Ga4));
    document.cookie = '_ga=GA1.1.123.456; Path=/';
    document.cookie = '_ga_TEST1234=GS1.1.1; Path=/';
    await act(async () => void consent.setConsent({ analytics: false }));
    expect(w()[`ga-disable-${ID}`]).toBe(true);
    expect(calls().at(-1)).toEqual(['consent', 'update', { analytics_storage: 'denied' }]);
    expect(document.cookie).not.toMatch(/_ga/);
    const before = calls().length;
    analytics.track('share_competition', { competition_id: 'c1' });
    analytics.trackPageView({ screen_name: 'Dashboard', page_path: '/' });
    expect(calls().length).toBe(before);
    await act(async () => void consent.setConsent({ analytics: true }));
    expect(w()[`ga-disable-${ID}`]).toBe(false);
    expect(scripts()).toHaveLength(1);
    analytics.track('share_competition', { competition_id: 'c2' });
    expect(events('share_competition').map((c) => (c[2] as { competition_id: string }).competition_id)).toEqual(['c2']);
  });

  it('a withdrawal in another tab (cookie only, no event here) stops gtag when this tab is shown again', async () => {
    const { consent, Ga4 } = await load();
    consent.setConsent({ analytics: true });
    await render(createElement(Ga4));
    expect(w()[`ga-disable-${ID}`]).toBe(false);
    // Tab B refuses: same cookie jar, but its CONSENT_EVENT never reaches this window.
    document.cookie = `bluvi_consent=${encodeURIComponent(JSON.stringify({ v: 1, analytics: false, errors: false, at: '2026-10-09T00:00:00.000Z' }))}; Path=/`;
    document.cookie = '_ga=GA1.1.9.9; Path=/';
    expect(w()[`ga-disable-${ID}`]).toBe(false);
    await act(async () => void document.dispatchEvent(new Event('visibilitychange')));
    expect(w()[`ga-disable-${ID}`]).toBe(true);
    expect(calls().at(-1)).toEqual(['consent', 'update', { analytics_storage: 'denied' }]);
    expect(document.cookie).not.toMatch(/_ga=/);
  });

  it('competition tabs are one screen: clasament → cantare → informatii on C = 1 page_view, C → D = 2; list tabs = 1', async () => {
    const { consent, Ga4, tracker } = await load();
    consent.setConsent({ analytics: true });
    await render(createElement(Ga4));
    const before = events('page_view').length;
    tracker.logScreenView('/concursuri/C/clasament');
    tracker.logScreenView('/concursuri/C/cantare');
    tracker.logScreenView('/concursuri/C/informatii');
    tracker.logScreenView('/concursuri/C');
    expect(events('page_view').slice(before).map((c) => (c[2] as Record<string, string>).competition_id)).toEqual(['C']);
    tracker.logScreenView('/concursuri/D/clasament');
    expect(events('page_view').slice(before).map((c) => (c[2] as Record<string, string>).competition_id)).toEqual(['C', 'D']);
    tracker.logScreenView('/concursuri/viitoare');
    tracker.logScreenView('/concursuri/live');
    tracker.logScreenView('/concursuri/rezultate');
    const names = events('page_view').slice(before).map((c) => (c[2] as Record<string, string>).screen_name);
    expect(names).toEqual(['Competition Page', 'Competition Page', 'Competitions List']);
  });

  it('a data-analytics link click is tracked (news_link_clicked) — page channel and gtag', async () => {
    const { analytics, consent, Ga4, links } = await load();
    consent.setConsent({ analytics: true });
    await render(createElement('div', null, createElement(Ga4), createElement(links.AnalyticsLinkListener)));
    const seen: unknown[] = [];
    window.addEventListener(analytics.ANALYTICS_EVENT, (e) => seen.push((e as CustomEvent).detail));
    const a = document.createElement('a');
    a.href = '#x';
    a.dataset.analyticsEvent = 'news_link_clicked';
    a.dataset.analyticsParams = JSON.stringify({ newsId: 'n1', url: 'https://example.ro' });
    a.innerHTML = '<span>Citește</span>';
    document.body.appendChild(a);
    a.querySelector('span')!.click();
    expect(seen).toEqual([{ name: 'news_link_clicked', params: { newsId: 'n1', url: 'https://example.ro' } }]);
    expect(events('news_link_clicked')).toEqual([['event', 'news_link_clicked', { newsId: 'n1', url: 'https://example.ro' }]]);
  });
});

describe('GA4 off (NEXT_PUBLIC_GA4_ID unset or not a G- id, or not production without the debug opt-in)', () => {
  it('a local / preview deployment with an id but no NEXT_PUBLIC_ANALYTICS_DEBUG: accepting loads nothing', async () => {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS_DEBUG', '');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://bluvi-web-git-x.vercel.app');
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'preview');
    const { consent, Ga4 } = await load();
    consent.setConsent({ analytics: true });
    await render(createElement(Ga4));
    expect(scripts()).toHaveLength(0);
    expect(w().gtag).toBeUndefined();
  });

  for (const value of ['', 'UA-123-1', 'G-<script>']) {
    it(`«${value}»: accepting loads nothing`, async () => {
      vi.stubEnv('NEXT_PUBLIC_GA4_ID', value);
      const { consent, Ga4 } = await load();
      consent.setConsent({ analytics: true });
      await render(createElement(Ga4));
      expect(scripts()).toHaveLength(0);
      expect(w().gtag).toBeUndefined();
    });
  }
});
