import { collectConsoleErrors } from './helpers/console';
import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { qaJwt, signIn } from './helpers/session';

/*
 * Concursuri from 1024 — each tab's own layout (owner-approved prototype A2, ROADMAP §4b,
 * parity docs/parity/areas/competitions-list.yml competitions-list.index c30–c36, states s20–s23):
 * Viitoare = poster cards grouped by time (competitions-upcoming.spec.ts); Live = poster cards under «Cântăriri recente» (competitions-live.spec.ts); Rezultate
 * = result rows by day that open inline (competitions-results.spec.ts); Ale mele = my registrations led by my
 * status. Below 1024 (and in results mode) the cards of competitions-list.spec.ts. No Listă / Afiș
 * toggle (owner, 2026-10-06).
 * Local CMS on :1337 (live, upcoming and finished competitions, feeder ones among them).
 */

const DESKTOP = { width: 1280, height: 900 };


let jwt = '';
test.describe.configure({ timeout: 90_000 });
test.use({ trace: 'off' });
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

const list = (page: Page) => page.locator('#concursuri-lista');
const desktop = (page: Page) => list(page).locator('[data-desktop-tab]');

async function open(page: Page, path = '/concursuri/viitoare') {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: 'Concursuri' })).toBeVisible();
  await expect(page.locator('#concursuri-lista-titlu')).toBeVisible();
}

/** The rows rise in once (a staggered fade): axe reads the settled colours. */
async function settled(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity),
  );
}

test.describe('signed in', () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context, jwt);
  });

  test('competitions-list.index.c35 competitions-list.index.s23 — Ale mele: my registrations led by my real status, never sample rows', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: /Failed to load resource/ });
    await page.setViewportSize(DESKTOP);
    await open(page, '/concursuri?scope=registered');
    const view = desktop(page);
    await expect(view).toHaveAttribute('data-desktop-tab', 'mine');
    const rows = view.locator('[data-row]');
    await expect(rows.first()).toBeVisible();
    // The QA user's registration: a status pill once /my-status answers, and the next step.
    await expect(rows.first().getByText(/^(Înscris|În așteptare|Respins|Anulat|LIVE)$/).first()).toBeVisible();
    await expect(rows.first().getByText(/^(Acum|Rezultat|Pasul următor|Înscriere)$/)).toBeVisible();
    await expect(view.getByText('Exemplu')).toHaveCount(0);
    await settled(page);
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

});
