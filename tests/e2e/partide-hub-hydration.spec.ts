import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { routes } from '@/lib/routes';
import { BASE_URL } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';
import { LEADERBOARD, OVERVIEW_LIVE, mockActivePartida, mockCommunity } from './partide-comunitate.fixtures';

/*
 * The Partide hub hydrates cleanly (ROADMAP: no console errors; M8 follow-up «/partide hydration
 * mismatch», parity partide.comunitate): real data from the local CMS, signed out and signed in, at
 * 375 and 1280. Real page loads (not client navigations), so the server HTML is what React hydrates.
 *
 * The defect (React #418 in production, signed in): on a repeat visit the cached JS hydrates the
 * shell before the community boundary has streamed; the header's «Începe» pill starts the live
 * probe, and when it answered first the boundary hydrated the hero (NoActiveCta) over the server's
 * skeleton. usePartideViewer now reads the probe as pending while its caller hydrates
 * (_hub/activePartida.ts).
 *
 * The regression guard for that race is deterministic and runs in the unit suite
 * (app/(site)/partide/_hub/activePartida.test.ts: the server HTML from a cache without the probe,
 * hydrateRoot over it with the probe already answered — it fails with «Hydration failed» without
 * the gate). `next dev` cannot force it end to end: the dev-only cookie `bluvi-e2e-partide=hold:<ms>`
 * (_comunitate/e2e-faults.ts) does make the probe answer seconds before the Comunitate boundary
 * streams (asserted below), but the live layer's context update (LivePartideProvider) reaches the
 * still-pending boundary first, so React client-renders it instead of hydrating it. The «hold»
 * tests therefore cover the late-boundary path itself (no console error, the hero after it lands,
 * c15's server-rendered self row); the real-timing loops stay as the extra manual check against
 * `next start` (BASE_URL pointed at the prod build).
 */

const WIDTHS = [375, 1280] as const;
const HYDRATION = /hydrat|didn't match|did not match|server rendered|Text content does not match|Minified React error #(418|423|425)/i;

async function visit(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(routes.partide());
  await expect(page.getByRole('heading', { level: 1, name: 'Partide' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

for (const width of WIDTHS) {
  test(`partide.comunitate hydration — signed out at ${width}: no console error, no hydration mismatch`, async ({ page }) => {
    const errors = collectConsoleErrors(page, { warnings: true });
    await visit(page, width);
    expect(errors.filter(e => HYDRATION.test(e))).toEqual([]);
    expect(errors.filter(e => e.startsWith('error: ') || e.startsWith('pageerror'))).toEqual([]);
  });

  test(`partide.comunitate hydration — signed in at ${width}: no console error, no hydration mismatch`, async ({ context, page }) => {
    test.setTimeout(150_000);
    await signIn(context, await qaJwt(page.request));
    const errors = collectConsoleErrors(page, { warnings: true });
    // The first visit, then repeat visits with the JS in the cache (where the race lived).
    for (let i = 0; i < 4; i++) {
      await visit(page, width);
      await page.goto('/');
    }
    expect(errors.filter(e => HYDRATION.test(e))).toEqual([]);
    expect(errors.filter(e => e.startsWith('error: ') || e.startsWith('pageerror'))).toEqual([]);
  });
}

/* ------------------------------------------------------------------------------------------------
 * The race, deterministic on the dev server (dev-only fault switch; skipped against a prod build)
 * ---------------------------------------------------------------------------------------------- */

const HOLD_MS = 5000;

async function signedInUid(context: BrowserContext, page: Page) {
  const jwt = await qaJwt(page.request);
  await signIn(context, jwt);
  const me = await (await page.request.get(`${CMS}/users/me`, { headers: { authorization: `Bearer ${jwt}` } })).json();
  return me.documentId as string;
}

async function setFaults(context: BrowserContext, value: string) {
  await context.addCookies([{ name: 'bluvi-e2e-partide', value, url: BASE_URL }]);
}

test.describe('the boundary streams late (hold)', () => {
  test.beforeEach(async ({ request }) => {
    // The switch exists on `next dev` only (its HTML loads the dev tools); a prod build ignores it.
    const html = await (await request.get(routes.partide())).text();
    test.skip(!html.includes('next-devtools'), 'the fault switch exists on a dev server only');
  });

  for (const width of WIDTHS) {
    test(`partide.comunitate hydration — the probe answers before the held boundary streams at ${width}: no mismatch, then the hero`, async ({ context, page }) => {
      test.setTimeout(120_000);
      await signedInUid(context, page);
      await setFaults(context, `hold:${HOLD_MS}`);
      // The probe: «no live partidă», answered at once (the hero is what a stale read would render).
      let probeAt = 0;
      await page.route('**/api/cms/feed/sessions/active*', route => {
        probeAt ||= Date.now();
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: null }) });
      });
      const errors = collectConsoleErrors(page, { warnings: true });
      await page.setViewportSize({ width, height: 900 });
      const start = Date.now();
      await page.goto(routes.partide(), { waitUntil: 'commit' });
      // The shell is up and the community boundary has not streamed yet: its skeleton is the screen.
      await expect(page.getByRole('heading', { level: 1, name: 'Partide' })).toBeVisible();
      await expect.poll(() => probeAt, { message: 'the live probe ran while the boundary was held' }).toBeGreaterThan(0);
      expect(probeAt - start, 'the probe answered before the held boundary streamed').toBeLessThan(HOLD_MS);
      await expect(page.getByTestId('comunitate-skeleton').first()).toBeAttached();
      // Then the boundary streams and hydrates: the hero after hydration, no mismatch.
      await expect(page.getByTestId('partida-cta').locator('visible=true').first()).toBeVisible({ timeout: HOLD_MS + 30_000 });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      expect(errors.filter(e => HYDRATION.test(e))).toEqual([]);
      expect(errors.filter(e => e.startsWith('error: ') || e.startsWith('pageerror'))).toEqual([]);
    });
  }

  test('partide.comunitate.c15 hydration — a server-rendered (hydrated) live venue holding the QA user: the self row is marked, no mismatch', async ({ context, page }) => {
    test.setTimeout(120_000);
    const uid = await signedInUid(context, page);
    // `selfvenue`: the server's overview has one live venue with the viewer on its board. No hold: the
    // boundary is in the HTML when React gets to it, so it is hydrated, not client-rendered.
    await setFaults(context, 'selfvenue');
    await mockActivePartida(page, null);
    // The browser's later refetch of the overview gets the same picture (the viewer on a board).
    await mockCommunity(page, {
      overview: { ...OVERVIEW_LIVE, activeVenues: [{ ...LEADERBOARD, sessions: LEADERBOARD.sessions.map(s => ({ ...s, members: s.members.map(m => (m.uid === 'VIEWER' ? { ...m, uid } : m)) })) }] },
      history: [],
    });
    const errors = collectConsoleErrors(page, { warnings: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    const html = await (await page.request.get(routes.partide())).text();
    expect(html, 'the self row is in the server render').toContain('data-self="true"');
    await page.goto(routes.partide());
    const self = page.locator('[data-testid=leaderboard-row][data-self=true]');
    await expect(self).toHaveCount(1);
    await expect(self).toContainText('(partida ta)');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    expect(errors.filter(e => HYDRATION.test(e))).toEqual([]);
    expect(errors.filter(e => e.startsWith('error: ') || e.startsWith('pageerror'))).toEqual([]);
  });
});

/* ------------------------------------------------------------------------------------------------
 * The hub's skeleton wraps /partide only (M8 follow-up: (hub) route group)
 * ---------------------------------------------------------------------------------------------- */

test('partide.comunitate.c25 — JS off, signed in: /partide/ale-mele and /partide/[id] never paint the hub skeleton or «Comunitate» as the current tab', async ({ browser, request }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  try {
    await signIn(ctx, await qaJwt(request));
    const page = await ctx.newPage();
    for (const path of ['/partide/ale-mele', '/partide/yzea0wawocxmngza5fgrlmn0', '/partide/statistici']) {
      await page.goto(path);
      await expect(page.locator('[data-testid=tab-comunitate][aria-current=page]'), path).toHaveCount(0);
      expect(await page.content(), path).not.toContain('Se încarcă partidele comunității');
    }
    // /partide itself keeps its own skeleton under the chrome.
    await page.goto(routes.partide());
    await expect(page.locator('[data-testid=tab-comunitate][aria-current=page]').first()).toBeAttached();
  } finally {
    await ctx.close();
  }
});
