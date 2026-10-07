import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { routes } from '@/lib/routes';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';
import { partideFaultsAvailable, servePhotos } from './partide-comunitate.fixtures';
import { ANGLERS, EMPTY, mockStats, prepareContext, stats, type StatsMock } from './partide-clasament.fixtures';

/*
 * Clasamente (/partide/clasament) — parity docs/parity/areas/partide.yml partide.clasament c1–c8.
 * fish: features/partide/screens/AnglersLeaderboardScreen.tsx.
 *
 * The stats are served with page.route (the hub's dev-only `noprefetch` cookie leaves the read to
 * the browser): full, podium only, empty Bălți / Specii, an empty period, an error, a slow period
 * switch. The viewer is the real QA session (signed in / out); their place is put in the mocked
 * ranking by their documentId. Read only: nothing is written anywhere, no Firestore.
 */

test.setTimeout(120_000);

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };

test.beforeAll(async ({ request }) => {
  test.skip(!(await partideFaultsAvailable(request)), 'needs next dev (the noprefetch switch is dev-only)');
});
test.beforeEach(async ({ context }) => {
  await prepareContext(context);
});

async function open(page: Page, mock: StatsMock, path = routes.partideRanking(), viewport = PHONE) {
  await page.setViewportSize(viewport);
  await servePhotos(page);
  const m = await mockStats(page, mock);
  await page.goto(path);
  return m;
}

const FULL: StatsMock = { week: stats('week'), month: stats('month'), year: stats('year') };

async function qaUid(page: Page, context: BrowserContext) {
  const jwt = await qaJwt(page.request);
  await signIn(context, jwt);
  const me = await (await page.request.get(`${CMS}/users/me`, { headers: { authorization: `Bearer ${jwt}` } })).json();
  return me.documentId as string;
}

const content = (page: Page) => page.getByTestId('ranking-content');

/** A period chip (the radio is visually hidden under its label). */
const chip = (page: Page, label: string) => page.getByTestId('period-chips').getByText(label, { exact: true });

/** The popover fades in: let it settle before axe reads its colours. */
const settled = (page: Page) => page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));

test('c1 c2 c3 c4 — title, period chips in the URL, podium 2·1·3, tabs and the table from 4', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await open(page, FULL);
  await expect(page.getByRole('heading', { level: 1, name: 'Clasamente' })).toBeVisible();

  // c1 — the chips, «Luna» by default (no param).
  const chips = page.getByRole('radiogroup', { name: 'Perioadă' });
  for (const label of ['Săptămâna', 'Luna', 'Anul curent']) await expect(chips.getByRole('radio', { name: label })).toBeVisible();
  await expect(chips.getByRole('radio', { name: 'Luna' })).toBeChecked();

  // c2 — 2 · 1 · 3, first name, kg, each a link to the profile.
  const podium = page.getByRole('list', { name: 'Podium' });
  await expect(podium.locator('[data-rank]')).toHaveCount(3);
  expect(await podium.locator('[data-rank]').evaluateAll((els) => els.map((e) => e.getAttribute('data-rank')))).toEqual(['2', '1', '3']);
  await expect(podium.locator('[data-rank="1"]')).toContainText('Andrei');
  await expect(podium.locator('[data-rank="1"]')).toContainText('48,35');
  await expect(podium.locator('[data-rank="1"]').getByRole('link')).toHaveAttribute('href', routes.angler('a-1'));
  await expect(podium.locator('[data-rank="2"]').getByRole('link')).toHaveAttribute('href', routes.angler('a-2'));
  await expect(podium.locator('[data-rank="3"]')).toContainText('Radu');

  // c3 — the tab bar.
  const tabs = page.getByRole('tablist', { name: 'Clasament' });
  await expect(tabs.getByRole('tab')).toHaveText([/Pescari/, /Bălți/, /Specii/]);
  await expect(tabs.getByRole('tab', { name: /Pescari/ })).toHaveAttribute('aria-selected', 'true');

  // c4 — ranks 4+: rank, name, «n partide · n capturi» (plurals), kg; the null name is «Pescar».
  const rows = page.getByTestId('angler-rows').locator('tbody tr');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('4');
  await expect(rows.nth(0)).toContainText('Ioana Dobre');
  await expect(rows.nth(0)).toContainText('3 partide · 9 capturi');
  await expect(rows.nth(0)).toContainText('22,5');
  await expect(rows.nth(1)).toContainText('1 partidă · 1 captură');
  await expect(rows.nth(2)).toContainText('Pescar');
  await expect(rows.nth(0).getByRole('link')).toHaveAttribute('href', routes.angler('a-4'));
  await expect(page.getByText('capot', { exact: false })).toHaveCount(0);

  // c1 — the period is written to the URL (replaced) and read back on reload.
  await chip(page, 'Săptămâna').click();
  await expect(page).toHaveURL(/\/partide\/clasament\?perioada=week$/);
  await page.reload();
  await expect(page.getByRole('radiogroup', { name: 'Perioadă' }).getByRole('radio', { name: 'Săptămâna' })).toBeChecked();
  await expect(page.getByTestId('podium')).toBeVisible();

  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('c1 c3 — an invalid period reads as Luna, an invalid tab as Pescari; ?tab= opens a tab', async ({ page }) => {
  const m = await open(page, FULL, '/partide/clasament?perioada=decada&tab=nimic');
  await expect(page.getByRole('radio', { name: 'Luna' })).toBeChecked();
  await expect(page.getByRole('tab', { name: /Pescari/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/\/partide\/clasament$/);
  expect(m.hits.every((p) => p === 'month')).toBe(true);

  await page.goto('/partide/clasament?perioada=year&tab=specii');
  await expect(page.getByRole('radio', { name: 'Anul curent' })).toBeChecked();
  await expect(page.getByRole('tab', { name: /Specii/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('species-rows')).toBeVisible();
});

test('c3 keyboard — the tabs are an ARIA tablist: arrows move the selection, the tab goes into the URL', async ({ page }) => {
  await open(page, FULL, routes.partideRanking(), DESKTOP);
  const pescari = page.getByRole('tab', { name: /Pescari/ });
  await pescari.focus();
  await page.keyboard.press('ArrowRight');
  const balti = page.getByRole('tab', { name: /Bălți/ });
  await expect(balti).toBeFocused();
  await expect(balti).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toBeVisible();
  await expect(page.getByTestId('venue-rows')).toBeVisible();
  await expect(page).toHaveURL(/tab=balti/);
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: /Specii/ })).toBeFocused();
  await expect(page).toHaveURL(/tab=specii/);
  await page.keyboard.press('Home');
  await expect(pescari).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/\/partide\/clasament$/);
  // Tab from the tablist reaches the first row's link (one tab stop for the whole bar).
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('angler-rows').getByRole('link').first()).toBeFocused();
});

test('c4 — with only the podium: «Doar podiumul are date pentru perioada asta.»', async ({ page }) => {
  await open(page, { month: stats('month', { topAnglers: ANGLERS.slice(0, 3) }) });
  await expect(page.getByTestId('podium')).toBeVisible();
  await expect(page.getByTestId('podium-only')).toHaveText('Doar podiumul are date pentru perioada asta.');
  await expect(page.getByTestId('angler-rows')).toHaveCount(0);
});

test('c5 c6 — Bălți (lakes link to the lake page) and Specii rows', async ({ page }) => {
  await open(page, FULL, routes.partideRanking(), DESKTOP);
  await page.getByRole('tab', { name: /Bălți/ }).click();
  const venues = page.getByTestId('venue-rows').locator('tbody tr');
  await expect(venues).toHaveCount(2);
  await expect(venues.nth(0)).toContainText('Lacul Chita');
  await expect(venues.nth(0)).toContainText('Corbu');
  await expect(venues.nth(0)).toContainText('40');
  await expect(venues.nth(0).getByRole('link', { name: 'Lacul Chita' })).toHaveAttribute('href', routes.lake('lake-1'));
  // A public water has no lake page: a plain row.
  await expect(venues.nth(1).getByRole('link')).toHaveCount(0);

  await page.getByRole('tab', { name: /Specii/ }).click();
  const species = page.getByTestId('species-rows').locator('tbody tr');
  await expect(species).toHaveCount(3);
  await expect(species.nth(0)).toContainText('Crap');
  await expect(species.nth(0)).toContainText('75');
  await expect(species.nth(1)).toContainText('22,5');
  await expect(species.nth(0).locator('[data-medal="1"]')).toBeVisible();
  await expectNoA11yViolations(page);
});

test('c5 c6 phone — the counts under the names with plurals', async ({ page }) => {
  await open(page, FULL, '/partide/clasament?tab=balti');
  const venues = page.getByTestId('venue-rows').locator('tbody tr');
  await expect(venues.nth(0)).toContainText('Corbu · 12 partide');
  // The catches: the figure bold, the noun apart, with formatCount's «de» from 20.
  await expect(venues.nth(0).locator('td').last()).toHaveText(/^40\s?de capturi$/);
  await expect(venues.nth(1)).toContainText('1 partidă');
  await expect(venues.nth(1).locator('td').last()).toHaveText(/^1\s?captură$/);
  await page.getByRole('tab', { name: /Specii/ }).click();
  const species = page.getByTestId('species-rows').locator('tbody tr');
  await expect(species.nth(0)).toContainText('30 de capturi');
  await expect(species.nth(2)).toContainText('1 captură');
});

test('c5 c6 — empty Bălți and Specii lines', async ({ page }) => {
  await open(page, { month: stats('month', { topVenues: [], species: [] }) }, '/partide/clasament?tab=balti');
  await expect(page.getByTestId('venues-empty')).toHaveText('Nicio baltă cu partide în această perioadă.');
  await page.getByRole('tab', { name: /Specii/ }).click();
  await expect(page.getByTestId('species-empty')).toHaveText('Nicio specie înregistrată în această perioadă.');
});

test('c7 — a ranked viewer sees «Ești pe locul 5 din 12 pescari luna asta — 10,5 kg»; the row is marked', async ({ page, context }) => {
  const uid = await qaUid(page, context);
  const ranked = ANGLERS.map((a) => (a.uid === 'a-5' ? { ...a, uid } : a));
  await open(page, { month: stats('month', { topAnglers: ranked }), year: stats('year', { topAnglers: ranked }) });
  const pill = page.getByTestId('me-pill').locator('visible=true');
  await expect(pill).toHaveText(/Ești pe locul 5 din 12 pescari luna asta — 10,5\s?kg/);
  await expect(page.locator('tr[data-me]')).toContainText('Tu');

  // The phrase follows the period; only on «Pescari».
  await chip(page, 'Anul curent').click();
  await expect(pill).toHaveText(/anul ăsta/);
  await page.getByRole('tab', { name: /Bălți/ }).click();
  await expect(page.getByTestId('me-pill').locator('visible=true')).toHaveCount(0);

  // Desktop: in the right column.
  await page.setViewportSize(DESKTOP);
  await page.getByRole('tab', { name: /Pescari/ }).click();
  await expect(page.getByRole('complementary', { name: 'Poziția ta și perioada' }).getByTestId('me-pill')).toBeVisible();
});

test('c2 c4 c7 — kg ties (nothing weighed) rank by catches, then partide: podium, rows and the pill agree', async ({ page, context }) => {
  const uid = await qaUid(page, context);
  const tied = (id: string, name: string, partide: number, catches: number) => ({ uid: id, name, avatarUrl: null, partide, catches, totalKg: 0 });
  // The CMS's order (kg desc, then uid): meaningless when nothing was weighed.
  const server = [tied('t-a', 'Alin Avram', 1, 1), tied('t-b', 'Bogdan Barbu', 3, 9), tied('t-c', 'Costel Cazan', 2, 5), tied('t-d', 'Dan Dima', 2, 7), tied(uid, 'Eu Însumi', 4, 6)];
  await open(page, { month: stats('month', { topAnglers: server }) });
  const podium = page.getByRole('list', { name: 'Podium' });
  await expect(podium.locator('[data-rank="1"]')).toContainText('Bogdan');
  await expect(podium.locator('[data-rank="2"]')).toContainText('Dan');
  await expect(podium.locator('[data-rank="3"]')).toContainText('Eu');
  await expect(podium.locator('[data-rank="1"]')).toContainText('9 capturi');
  const rows = page.getByTestId('angler-rows').locator('tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('Costel Cazan');
  await expect(rows.nth(1)).toContainText('Alin Avram');
  // The pill reads the same list; no weight clause (nothing weighed).
  await expect(page.getByTestId('me-pill').locator('visible=true')).toHaveText(/Ești pe locul 3 din 12 pescari luna asta$/);
});

test('c1 c8 — a deep link never paints the default place first (prerendered HTML, no noprefetch)', async ({ page, context }) => {
  // The real static path: the server prerenders luna (the CMS's month) as the Suspense fallback.
  await context.clearCookies({ name: 'bluvi-e2e-partide' });
  const html = await (await page.request.get('/partide/clasament?perioada=week&tab=specii')).text();
  test.skip(!html.includes('data-testid="podium"'), 'the local CMS has no month ranking: the static HTML carries no podium to hide');

  // 1. Before hydration — what a production visitor paints first: the prerendered shell, where the
  //    URL's place (useSearchParams) is still the Suspense fallback (the default place: luna,
  //    «Pescari») until the scripts hydrate it. next dev renders per request and streams the
  //    URL's place into that boundary at once, so the dev document is turned back into the shell:
  //    no external scripts (no hydration) and no reveal of the boundary that holds the fallback.
  await page.route(/\/partide\/clasament(\?.*)?$/, async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const res = await route.fetch();
    let body = (await res.text()).replace(/<script\b[^>]*\bsrc=[^>]*><\/script>/g, '');
    const at = body.indexOf('data-testid="ranking-static"');
    const boundary = at > 0 ? [...body.slice(0, at).matchAll(/<template id="(B:\d+)"/g)].pop()?.[1] : undefined;
    if (boundary) body = body.replace(new RegExp(`\\$RC\\("${boundary}","S:\\d+"\\)`), '');
    await route.fulfill({ response: res, body });
  });
  await page.setViewportSize(PHONE);
  await page.goto('/partide/clasament?perioada=week&tab=specii');
  await expect(page.getByTestId('ranking-skeleton').locator('visible=true').first()).toBeVisible();
  await expect(page.locator('#ranking-deep-link')).toHaveCount(1);
  await expect(page.getByTestId('ranking-static').getByTestId('podium')).toHaveCount(1);
  await expect(page.getByTestId('podium').locator('visible=true')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: /Pescari/ })).toHaveCount(0);
  await page.unrouteAll({ behavior: 'wait' });

  // 2. The hand-over: every frame from the first parse to the week's figures — only the week's
  //    podium (its names) and only «Specii» are ever on screen.
  await page.addInitScript(() => {
    const seen: { podium: string[]; tab: string[] } = { podium: [], tab: [] };
    (window as unknown as { __seen: typeof seen }).__seen = seen;
    const look = () => {
      for (const el of document.querySelectorAll<HTMLElement>('[data-testid="podium"]')) if (el.checkVisibility()) seen.podium.push(el.textContent ?? '');
      for (const el of document.querySelectorAll<HTMLElement>('[role="tab"][aria-selected="true"]')) if (el.checkVisibility()) seen.tab.push(el.textContent ?? '');
    };
    new MutationObserver(look).observe(document, { childList: true, subtree: true, attributes: true });
    const frame = () => {
      look();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  const week = ANGLERS.map((a, i) => ({ ...a, name: `Hebdo${i} ${a.name ?? 'Pescar'}` }));
  await open(page, { week: stats('week', { topAnglers: week }), delayMs: { week: 1500 } }, '/partide/clasament?perioada=week&tab=specii');
  await expect(page.getByRole('radio', { name: 'Săptămâna' })).toBeChecked();
  await expect(page.getByRole('tab', { name: /Specii/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('podium')).toContainText('Hebdo0');
  await expect(page.getByTestId('species-rows')).toBeVisible();
  const seen = await page.evaluate(() => (window as unknown as { __seen: { podium: string[]; tab: string[] } }).__seen);
  expect(seen.podium.length).toBeGreaterThan(0);
  expect(seen.podium.filter((t) => !t.includes('Hebdo0'))).toEqual([]);
  expect(seen.tab.filter((t) => !t.includes('Specii'))).toEqual([]);
  // The marker is gone once the screen at the URL's place mounted.
  await expect(page.locator('#ranking-deep-link')).toHaveCount(0);
});

test('c7 — a signed-in viewer outside the ranking and a guest see no pill', async ({ page, context }) => {
  await open(page, FULL);
  await expect(page.getByTestId('angler-rows')).toBeVisible();
  await expect(page.getByTestId('me-pill')).toHaveCount(0);

  await qaUid(page, context);
  await page.reload();
  await expect(page.getByTestId('angler-rows')).toBeVisible();
  // The session has answered (the top bar shows the account), still no pill: not ranked.
  await expect(page.getByRole('link', { name: 'Intră' })).toHaveCount(0);
  await expect(page.getByTestId('me-pill')).toHaveCount(0);
});

test('c8 — error copy, then a retry that loads', async ({ page }) => {
  const errors = collectConsoleErrors(page, { ignore: /Failed to load resource: the server responded with a status of 500/ });
  const m = await open(page, { month: 'error' });
  await expect(page.getByTestId('ranking-error')).toContainText('Nu am putut încărca statisticile.');
  await expect(page.getByTestId('podium')).toHaveCount(0);
  m.state.month = stats('month');
  await page.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(page.getByTestId('podium')).toBeVisible();
  expect(errors).toEqual([]);
});

test('c8 — empty period: «Niciun clasament pentru perioada selectată încă.», the wider period one press away', async ({ page }) => {
  await open(page, { month: EMPTY('month'), year: stats('year') });
  await expect(page.getByTestId('ranking-empty')).toContainText('Niciun clasament pentru perioada selectată încă.');
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await page.getByTestId('wider-period').click();
  await expect(page.getByRole('radio', { name: 'Anul curent' })).toBeChecked();
  await expect(page.getByTestId('podium')).toBeVisible();
  await expect(page).toHaveURL(/perioada=year/);
});

test('c8 — a period switch keeps the previous figures, busy and inert, until the new ones land', async ({ page }) => {
  const m = await open(page, { month: stats('month'), week: stats('week', { topAnglers: ANGLERS.slice(0, 3) }), delayMs: { week: 2500 } });
  await expect(page.getByTestId('angler-rows')).toBeVisible();
  await chip(page, 'Săptămâna').click();
  await expect(page.getByTestId('switching-bar').first()).toBeVisible();
  await expect(content(page)).toHaveAttribute('aria-busy', 'true');
  await expect(content(page)).toHaveAttribute('inert', '');
  await expect(page.getByTestId('angler-rows')).toBeVisible(); // the old figures, dimmed
  await expect(page.getByTestId('podium-only')).toBeVisible({ timeout: 10_000 });
  await expect(content(page)).not.toHaveAttribute('aria-busy', 'true');
  expect(m.hits).toContain('week');
});

test('c8 — first load shows the skeleton', async ({ page }) => {
  await open(page, { month: stats('month'), delayMs: { month: 2500 } });
  await expect(page.getByTestId('ranking-skeleton')).toBeVisible();
  await expect(page.getByTestId('podium')).toBeVisible({ timeout: 10_000 });
});

test('rule 17 — from 1024 a row opens the popover with «Vezi profilul»; Escape returns focus; a phone follows the link', async ({ page }) => {
  await open(page, FULL, routes.partideRanking(), DESKTOP);
  const row = page.getByTestId('angler-rows').locator('tbody tr').first();
  await row.click({ position: { x: 600, y: 20 } });
  const dialog = page.getByRole('dialog', { name: 'Ioana Dobre' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Locul 4 luna asta');
  await expect(dialog.getByRole('link', { name: 'Vezi profilul' })).toHaveAttribute('href', routes.angler('a-4'));
  await expect(dialog.getByRole('link', { name: 'Vezi profilul' })).toBeFocused();
  await settled(page);
  await expectNoA11yViolations(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(row.getByRole('link')).toBeFocused();
  // Enter on the link opens it again (keyboard path).
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Ioana Dobre' })).toBeVisible();
  // «Vezi profilul» goes to the profile at once (the row's popover press is not a navigation the
  // shell's double-activation guard would hold against it).
  await page.getByRole('link', { name: 'Vezi profilul' }).click();
  await expect(page).toHaveURL(new RegExp(`${routes.angler('a-4')}$`), { timeout: 30_000 });

  // Phone: the press goes to the profile.
  await page.setViewportSize(PHONE);
  await page.goto(routes.partideRanking());
  await expect(page.getByTestId('angler-rows')).toBeVisible();
  await page.getByTestId('angler-rows').locator('tbody tr').first().click();
  await expect(page).toHaveURL(new RegExp(`${routes.angler('a-4')}$`), { timeout: 30_000 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a11y — phone and desktop, signed out', async ({ page }) => {
  await open(page, FULL);
  await expect(page.getByTestId('angler-rows')).toBeVisible();
  await expectNoA11yViolations(page);
  await page.setViewportSize(DESKTOP);
  await expect(page.getByTestId('community-pages')).toBeVisible();
  await expect(page.getByTestId('community-pages').getByRole('link', { name: 'Clasamente' })).toHaveAttribute('aria-current', 'page');
  await expectNoA11yViolations(page);
});
