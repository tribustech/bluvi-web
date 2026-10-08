import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { fakeRaffle, SESSION_PRIZES, SESSION_ID, TYPES } from './helpers/fake-raffle';

/*
 * participant.raffle-winners — /tombola/castigatori «Câștigători» (T6; fish app/(app)/raffle/winners.tsx).
 *
 * Public page, opened as a GUEST (no cookie) everywhere: c7 is the whole spec. Nothing is written:
 * the active session is route-mocked — helpers/fake-raffle.ts for the stock states (open, ended
 * without winners, none), and `winners()` below for the drawn shapes this page needs (several
 * types, anonymous winners, avatars, winners flagged with no group, no session prizes).
 */

const SHOTS = '.shots/tombola-castigatori';
mkdirSync(SHOTS, { recursive: true });

type Winner = { documentId: string; username: string | null; avatarUrl: string | null };

const WINNERS: Record<string, Winner[]> = {
  crap: [
    { documentId: 'w1', username: 'Ion Pescarul', avatarUrl: null },
    { documentId: 'w2', username: null, avatarUrl: null },
  ],
  feeder: [{ documentId: 'w3', username: 'Maria Feeder', avatarUrl: '/uploads/e2e_avatar.jpg' }],
  rapitor: [{ documentId: 'w4', username: '  ', avatarUrl: null }],
};

/** A drawn session (ended + hasWinners) answered on /api/cms/raffle-sessions/active. */
async function winners(page: Page, o: { winnersByTypeKey?: Record<string, Winner[]>; noPrizes?: boolean } = {}) {
  await page.route('**/api/cms/raffle-sessions/active', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          session: {
            documentId: SESSION_ID,
            startDate: '2026-10-01T00:00:00.000Z',
            endDate: '2026-10-05T21:00:00.000Z',
            prizes: o.noPrizes ? [] : SESSION_PRIZES,
            types: TYPES,
            registrationCutoffMinutesBeforeEnd: 0,
            regulationSections: [],
          },
          registrationsByType: { crap: 4, feeder: 1 },
          isRegistrationOpen: false,
          isEnded: true,
          hasWinners: true,
          winnersByTypeKey: o.winnersByTypeKey ?? WINNERS,
        },
      }),
    }),
  );
  // The feeder winner's relative avatar is made absolute (CMS origin): answer it with a tiny image.
  await page.route('**/uploads/e2e_avatar.jpg', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
    }),
  );
}

async function guest(page: Page, width = 1280) {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await page.context().clearCookies();
}

const cards = (page: Page) => page.getByTestId('winners-type');
const card = (page: Page, label: string) => page.getByRole('region', { name: `Categoria ${label}` });

test.describe('participant.raffle-winners', () => {
  test('c7 — a guest can open it (no sign-in redirect); c1 not ended → home', async ({ page }) => {
    await guest(page);
    const res = await page.request.get('/tombola/castigatori', { maxRedirects: 0 });
    expect(res.status()).toBe(200); // not proxy.ts's 307 to /intra
    const fake = await fakeRaffle(page, { session: 'active' });
    await page.goto('/tombola/castigatori');
    await expect(page).toHaveURL(/\/$/, { timeout: 25_000 });
    expect(fake.reads.active).toBeGreaterThan(0);
    expect(fake.reads.participation).toBe(0); // public: no per-user read
  });

  test('c1 — ended without winners → home; no session → home', async ({ page }) => {
    await guest(page);
    await fakeRaffle(page, { session: 'ended-empty' });
    await page.goto('/tombola/castigatori');
    await expect(page).toHaveURL(/\/$/, { timeout: 25_000 });
    await page.unrouteAll({ behavior: 'ignoreErrors' });

    await fakeRaffle(page, { session: 'none' });
    await page.goto('/tombola/castigatori');
    await expect(page).toHaveURL(/\/$/, { timeout: 25_000 });
  });

  test('c1 — nothing about winners shows before the data (neutral skeleton)', async ({ page }) => {
    await guest(page);
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route('**/api/cms/raffle-sessions/active', async (route) => {
      await held;
      await route.fulfill({ status: 404, contentType: 'application/json', body: '{"data":null}' });
    });
    await page.goto('/tombola/castigatori');
    await expect(page.getByRole('heading', { level: 1, name: 'Câștigători' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Se încarcă…' })).toHaveCount(1);
    await expect(page.getByText('Câștigătorii nu au fost anunțați încă.')).toHaveCount(0);
    await expect(cards(page)).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/loading-1280.png`, fullPage: true });
    release();
    await expect(page).toHaveURL(/\/$/, { timeout: 25_000 });
  });

  test('c2–c5 — notice, one card per type, prizes, winners and profile links; noindex; axe', async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    await guest(page);
    await winners(page);
    await page.goto('/tombola/castigatori');
    // c2
    await expect(page.getByRole('heading', { level: 1, name: 'Câștigători' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    // c3
    await expect(page.getByText('Câștigătorii vor fi contactați de către echipa Bluvi.')).toBeVisible();
    await expect(page.getByText('În cazul în care nu răspund în timp util, se va mai face o tragere la sorți.')).toBeVisible();
    // c4: one card per winnersByTypeKey key, in that order
    await expect(cards(page)).toHaveCount(3);
    await expect(cards(page).getByRole('heading', { level: 2 })).toHaveText(['Categoria Crap', 'Categoria Feeder', 'Categoria Răpitor']);
    // badge in the type's colour, readable label (blue → white, #FFC107 → black)
    await expect(card(page, 'Crap').getByText('Categoria Crap')).toHaveCSS('background-color', 'rgb(0, 0, 255)');
    await expect(card(page, 'Crap').getByText('Categoria Crap')).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(card(page, 'Feeder').getByText('Categoria Feeder')).toHaveCSS('background-color', 'rgb(255, 193, 7)');
    await expect(card(page, 'Feeder').getByText('Categoria Feeder')).toHaveCSS('color', 'rgb(0, 0, 0)');
    // the session prize of the type, collapsed (fish), expandable
    const crap = card(page, 'Crap');
    await expect(crap.getByText('Kit Crap E2E')).toBeVisible();
    await expect(crap.getByText('Mulinetă și geantă · 900 LEI × 1')).toBeVisible();
    const items = crap.getByRole('button', { name: '2 produse' });
    await expect(items).toHaveAttribute('aria-expanded', 'false');
    await expect(crap.getByText('Mulinetă E2E')).toBeHidden();
    await items.click();
    await expect(crap.getByText('Mulinetă E2E')).toBeVisible();
    await expect(card(page, 'Feeder').getByText('Nadă E2E')).toBeVisible();
    // the session has prizes but none for Răpitor → no prize row there (fish)
    await expect(card(page, 'Răpitor').getByText(/LEI|×/)).toHaveCount(0);
    for (const label of ['Crap', 'Feeder', 'Răpitor']) {
      await expect(card(page, label).getByRole('heading', { level: 3, name: 'Câștigători' })).toBeVisible();
    }
    // c5: names, «Câștigător #{i}», the trophy on the first, profile links
    const crapLinks = crap.getByRole('link');
    await expect(crapLinks).toHaveCount(2);
    await expect(crapLinks.nth(0)).toHaveAccessibleName(/Ion Pescarul/);
    await expect(crapLinks.nth(0)).toHaveAttribute('href', '/pescari/w1');
    await expect(crapLinks.nth(0).getByTestId('winner-trophy')).toBeVisible();
    await expect(crapLinks.nth(1)).toHaveText('Câștigător #2');
    await expect(crapLinks.nth(1)).toHaveAttribute('href', '/pescari/w2');
    await expect(crapLinks.nth(1).getByTestId('winner-trophy')).toHaveCount(0);
    await expect(card(page, 'Răpitor').getByRole('link')).toContainText('Câștigător #1'); // blank username
    // the avatar: the photo (relative URL made absolute), else fish's guest picture — named or not
    const photo = card(page, 'Feeder').getByRole('link').locator('img');
    await expect(photo).toHaveAttribute('src', /^https?:\/\/[^/]+\/uploads\/e2e_avatar\.jpg$/);
    await expect(card(page, 'Feeder').getByTestId('guest-avatar')).toHaveCount(0);
    await expect(crapLinks.nth(0).getByTestId('guest-avatar')).toBeVisible(); // named, no photo
    await expect(crapLinks.nth(0)).not.toContainText('IP'); // no initials disc
    await expect(crapLinks.nth(1).getByTestId('guest-avatar')).toBeVisible(); // no name, no photo
    await expectNoA11yViolations(page);
    for (const w of [375, 768, 1280, 1440, 1920]) {
      await page.setViewportSize({ width: w, height: w < 768 ? 812 : 900 });
      await page.screenshot({ path: `${SHOTS}/winners-${w}.png`, fullPage: true });
    }
    expect(consoleErrors).toEqual([]);
  });

  test('c5 — a winner row opens the angler profile', async ({ page }) => {
    await guest(page, 375);
    await winners(page);
    await page.goto('/tombola/castigatori');
    await card(page, 'Crap').getByRole('link', { name: /Ion Pescarul/ }).click();
    await expect(page).toHaveURL(/\/pescari\/w1$/);
  });

  test('c4 — no prize row when the session has none (never the static intro prizes, rule 4)', async ({ page }) => {
    await guest(page);
    await winners(page, { noPrizes: true });
    await page.goto('/tombola/castigatori');
    await expect(cards(page)).toHaveCount(3);
    for (const label of ['Crap', 'Feeder', 'Răpitor']) {
      await expect(card(page, label).getByRole('heading', { level: 3, name: 'Câștigători' })).toBeVisible();
      await expect(card(page, label).getByText(/LEI|×/)).toHaveCount(0);
    }
    for (const text of ['Echipament premium de pescuit', 'Merchandise Bluvi', 'Premii speciale expoziție']) {
      await expect(page.getByText(text)).toHaveCount(0);
    }
  });

  test('layout — the cards fill the row from 1024 whatever the number of categories', async ({ page }) => {
    await guest(page);
    const cardsSpan = async () =>
      cards(page).evaluateAll((els) => {
        const r = els.map((e) => e.getBoundingClientRect());
        return Math.max(...r.map((b) => b.right)) - Math.min(...r.map((b) => b.left));
      });
    const gridWidth = async () => cards(page).first().evaluate((el) => el.parentElement!.getBoundingClientRect().width);
    // one category (with its prize): one wide card, prize left and winners right
    await winners(page, { winnersByTypeKey: { crap: WINNERS.crap } });
    await page.goto('/tombola/castigatori');
    await expect(cards(page)).toHaveCount(1);
    for (const w of [1280, 1920]) {
      await page.setViewportSize({ width: w, height: 900 });
      expect(Math.abs((await cardsSpan()) - (await gridWidth()))).toBeLessThan(2);
      const prize = await card(page, 'Crap').getByText('Kit Crap E2E').boundingBox();
      const winner = await card(page, 'Crap').getByRole('link', { name: /Ion Pescarul/ }).boundingBox();
      expect(winner!.x).toBeGreaterThan(prize!.x + prize!.width);
      await page.screenshot({ path: `${SHOTS}/winners-one-${w}.png`, fullPage: true });
    }
    // one category without a prize: the winners take the card's width in columns
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await winners(page, { winnersByTypeKey: { crap: WINNERS.crap }, noPrizes: true });
    await page.goto('/tombola/castigatori');
    await expect(cards(page)).toHaveCount(1);
    await page.setViewportSize({ width: 1280, height: 900 });
    expect(Math.abs((await cardsSpan()) - (await gridWidth()))).toBeLessThan(2);
    const links = card(page, 'Crap').getByRole('link');
    const [a, b] = [await links.nth(0).boundingBox(), await links.nth(1).boundingBox()];
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(2); // side by side
    await page.screenshot({ path: `${SHOTS}/winners-one-noprize-1280.png`, fullPage: true });
    // two categories: two columns across the row
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await winners(page, { winnersByTypeKey: { crap: WINNERS.crap, feeder: WINNERS.feeder } });
    await page.goto('/tombola/castigatori');
    await expect(cards(page)).toHaveCount(2);
    for (const w of [1280, 1920]) {
      await page.setViewportSize({ width: w, height: 900 });
      expect(Math.abs((await cardsSpan()) - (await gridWidth()))).toBeLessThan(2);
      await page.screenshot({ path: `${SHOTS}/winners-two-${w}.png`, fullPage: true });
    }
  });

  test('c2 — winners flagged but no group: «nu au fost anunțați» + «Înapoi acasă»; axe', async ({ page }) => {
    await guest(page);
    await winners(page, { winnersByTypeKey: {} });
    await page.goto('/tombola/castigatori');
    await expect(page.getByRole('heading', { level: 1, name: 'Câștigători' })).toBeVisible();
    await expect(page.getByText('Câștigătorii nu au fost anunțați încă.')).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
    await expect(page.getByText('Câștigătorii vor fi contactați de către echipa Bluvi.')).toHaveCount(0);
    await expectNoA11yViolations(page);
    for (const w of [375, 1280]) {
      await page.setViewportSize({ width: w, height: w < 768 ? 812 : 900 });
      await page.screenshot({ path: `${SHOTS}/empty-${w}.png`, fullPage: true });
    }
    await page.getByRole('button', { name: 'Înapoi acasă' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('c6 — «Înapoi acasă» replaces the page with home; keyboard', async ({ page }) => {
    await guest(page, 375);
    await page.goto('/');
    await winners(page);
    await page.goto('/tombola/castigatori');
    await expect(cards(page)).toHaveCount(3);
    // Keyboard: the back chip, then the winner links in order, then the action.
    await page.locator('body').focus();
    const back = page.getByRole('link', { name: 'Înapoi acasă' });
    await back.focus();
    await expect(back).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab'); // past the «2 produse» toggle
    await expect(card(page, 'Crap').getByRole('link', { name: /Ion Pescarul/ })).toBeFocused();
    const home = page.getByRole('button', { name: 'Înapoi acasă' });
    await home.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/$/);
    // replace, not push: Back leaves the site's home for the page before it, not the winners
    await page.goBack();
    await expect(page).not.toHaveURL(/castigatori/);
  });

  test('load error → retry gate (rule 4), never «no winners»', async ({ page }) => {
    await guest(page);
    await fakeRaffle(page, { session: 'error' });
    await page.goto('/tombola/castigatori');
    await expect(page.getByRole('alert').getByText('Nu am putut încărca câștigătorii')).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText('Câștigătorii nu au fost anunțați încă.')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Încearcă din nou' })).toBeVisible();
  });
});
