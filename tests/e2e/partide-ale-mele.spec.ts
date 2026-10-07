import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { partideHrefs } from '@/lib/partide-pages';
import { routes } from '@/lib/routes';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { qaJwt, signIn } from './helpers/session';
import { aleMeleRows, catchesPage, LONG_LAKE, mockMine } from './partide-ale-mele.fixtures';

/*
 * Partide · Ale mele (/partide/ale-mele) — parity docs/parity/areas/partide.yml partide.ale-mele
 * c1–c17. fish: app/(app)/(tabs)/partide.tsx, scenes/AleMeleScene.tsx.
 *
 * The QA user's own reads are mocked at /api/cms (the proxy the page uses; ./partide-ale-mele.fixtures):
 * /feed/sessions/mine (the journal), /feed/sessions/mine/catches (MY catches), /feed/sessions/active
 * and the live session (the hub's probe). Nothing is created or written anywhere — no CMS write, no
 * Firestore.
 * Links to M4 pages that ship later are asserted through lib/partide-pages, so the spec stays right
 * when their flags flip.
 */

test.setTimeout(120_000);
test.use({ locale: 'ro-RO', timezoneId: 'Europe/Bucharest' });

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };
const PAGE = routes.partideMine();

const { F1, F2, OPEN, LIVE, LONG, LONG_OPEN, ALL } = aleMeleRows();

async function signedIn(context: BrowserContext, page: Page) {
  await signIn(context, await qaJwt(page.request));
}

async function open(page: Page, viewport = PHONE) {
  await page.setViewportSize(viewport);
  await page.goto(PAGE);
}

const visible = (page: Page, testId: string) => page.getByTestId(testId).locator('visible=true');

test('c1 — a guest gets the journal wall, «Autentifică-te» back to this tab; the other tabs stay links', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const { hits } = await mockMine(page, { rows: ALL });
  await open(page);
  const wall = page.getByTestId('ale-mele-wall');
  await expect(wall.getByRole('heading', { name: 'Jurnalul tău de pescuit' })).toBeVisible();
  await expect(wall).toContainText('Autentifică-te pentru a-ți vedea partidele, capturile și statisticile într-un singur loc.');
  await expect(wall.getByRole('link', { name: 'Autentifică-te' })).toHaveAttribute('href', routes.signIn(PAGE));
  // c7 — fish's hero above the wall for a guest too (no auth check there), each action through
  // sign-in, while start or join is on the web (owner rule 4: never an actionless hero).
  await expectGuestHero(page);
  const tabs = page.getByRole('navigation', { name: 'Partide' });
  await expect(tabs.getByRole('link', { name: 'Ale mele' })).toHaveAttribute('aria-current', 'page');
  await expect(tabs.getByRole('link', { name: 'Comunitate' })).toHaveAttribute('href', routes.partide());
  const explore = partideHrefs.explore();
  if (explore) await expect(tabs.getByRole('link', { name: 'Explorează' })).toHaveAttribute('href', explore);
  expect(hits.mine).toBe(0);
  expect(hits.catches).toBe(0);
  await expect(page).toHaveTitle(/Ale mele/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expectNoA11yViolations(page);
  await page.setViewportSize(DESKTOP);
  await expect(wall.getByRole('link', { name: 'Autentifică-te' })).toBeVisible();
  await expectGuestHero(page);
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

/** The guest's «Ești la pescuit?»: visible with start or join on the web, absent otherwise. */
async function expectGuestHero(page: Page) {
  const start = partideHrefs.start();
  const join = partideHrefs.join();
  const hero = page.getByRole('region', { name: 'Ești la pescuit?' }).locator('visible=true');
  if (!start && !join) {
    await expect(page.getByRole('region', { name: 'Ești la pescuit?' })).toHaveCount(0);
    return;
  }
  await expect(hero).toBeVisible();
  // Above the wall below 1280 (the left column from 1280 is above it in reading order too).
  const heroBox = await hero.boundingBox();
  const wallBox = await page.getByTestId('ale-mele-wall').boundingBox();
  if ((page.viewportSize()?.width ?? 0) < 1280) expect(heroBox!.y).toBeLessThan(wallBox!.y);
  if (start) await expect(hero.getByRole('link', { name: 'Începe o partidă' })).toHaveAttribute('href', routes.signIn(start));
  if (join) await expect(hero.getByRole('link', { name: 'Intră cu cod' })).toHaveAttribute('href', routes.signIn(join));
}

test('c2 c3 — the list is read only on this tab (skeleton first, never zeros); cached when coming back', async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await signedIn(context, page);
  const { hits, state } = await mockMine(page, { rows: [F1], delayMs: 1500 });
  await page.setViewportSize(PHONE);
  await page.goto(routes.partide());
  await expect(page.getByRole('heading', { level: 1, name: 'Partide' })).toBeVisible();
  // Comunitate does not pay for Ale mele's history (fish usePartideHistory enabled on the tab).
  await page.waitForTimeout(800);
  expect(hits.mine).toBe(0);

  await page.getByRole('navigation', { name: 'Partide' }).getByRole('link', { name: 'Ale mele' }).click();
  await expect(page).toHaveURL(PAGE);
  // c3 — the skeleton while the first list is in flight, no stat card of zeros.
  await expect(page.getByTestId('ale-mele-skeleton')).toBeVisible();
  await expect(page.getByTestId('journal-stat-strip')).toHaveCount(0);
  await expect(page.getByTestId('journal-stat-strip')).toBeVisible();
  await expect(page.getByTestId('stat-Partide')).toContainText('1');
  expect(hits.mine).toBe(1);

  // Back to Comunitate and again to Ale mele: the cached list shows at once, no new read (5 min).
  state.delayMs = 0;
  await page.getByRole('navigation', { name: 'Partide' }).getByRole('link', { name: 'Comunitate' }).click();
  await expect(page).toHaveURL(routes.partide());
  await page.getByRole('navigation', { name: 'Partide' }).getByRole('link', { name: 'Ale mele' }).click();
  await expect(page.getByTestId('journal-stat-strip')).toBeVisible();
  await expect(page.getByTestId('ale-mele-skeleton')).toHaveCount(0);
  expect(hits.mine).toBe(1);
  expect(errors).toEqual([]);
});

test('c4 — a refetch shows «Se actualizează…» over the content, which stays', async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await signedIn(context, page);
  const { hits, state } = await mockMine(page, { rows: [F1, F2] });
  await open(page, DESKTOP);
  await expect(visible(page, 'history-preview').getByTestId('own-card')).toHaveCount(2);
  state.delayMs = 2000;
  await page.getByRole('button', { name: 'Reîmprospătează' }).click();
  await expect(page.getByTestId('refetch-row')).toHaveText('Se actualizează…');
  await expect(visible(page, 'history-preview').getByTestId('own-card')).toHaveCount(2);
  await expect(page.getByTestId('refetch-row')).toHaveCount(0);
  expect(hits.mine).toBe(2);
  expect(errors).toEqual([]);
});

test('c5 c17 — the stat card counts the live partidă too; the live one is never a card (the dock shows it)', async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await signedIn(context, page);
  const { hits } = await mockMine(page, { rows: ALL, live: true });
  await open(page);
  const strip = page.getByTestId('journal-stat-strip');
  await expect(strip).toBeVisible();
  // 6 rows (live included) · 6+3+0+2+4+1 catches · 41,2+19,1+5+20 kg · record 14,2 (the live one's).
  await expect(page.getByTestId('stat-Partide')).toHaveText('Partide6');
  await expect(page.getByTestId('stat-Capturi')).toHaveText('Capturi16');
  await expect(page.getByTestId('stat-Capturi').locator('dd span').first()).toHaveClass(/text-accent-ink/);
  await expect(page.getByTestId('stat-Cantitate')).toHaveText('Cantitate85,3kg');
  await expect(page.getByTestId('stat-Record')).toHaveText('Record14,2kg');
  // c17 — no card for the live partidă anywhere; the dock carries it (below 1280).
  await expect(page.getByText('Balta Mea', { exact: true }).locator('visible=true')).toHaveCount(1);
  await expect(page.getByTestId('partida-activa-dock')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Ești la pescuit?' })).toHaveCount(0);

  // From 1280 the same figures are the bento, beside the chart; the live partidă's card on the left.
  await page.setViewportSize(DESKTOP);
  await expect(page.getByTestId('journal-bento')).toBeVisible();
  await expect(page.getByTestId('journal-stat-strip')).toBeHidden();
  await expect(page.getByTestId('bento-partide')).toHaveText('6');
  await expect(page.getByTestId('bento-capturi')).toHaveText('16');
  await expect(page.getByTestId('bento-cantitate')).toHaveText('85,3 kg');
  await expect(page.getByTestId('bento-record')).toHaveText('14,2 kg');
  await expect(page.getByTestId('partida-activa-card')).toBeVisible();
  await expect(page.getByTestId('partida-activa-card')).toContainText('Balta Mea');
  await expectNoA11yViolations(page);
  expect(hits.firebase).toEqual([]);
  expect(errors).toEqual([]);
});

test('c6 c7 — nothing at all: the empty journal and no section; the hero only with something to offer', async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await signedIn(context, page);
  await mockMine(page, { rows: [] });
  await open(page);
  const empty = page.getByTestId('empty-journal');
  await expect(empty).toContainText('Jurnalul tău de pescuit');
  await expect(empty).toContainText('Începe prima partidă ca să-ți urmărești capturile, cronometrele și tiparele.');
  await expect(page.getByTestId('stat-Partide')).toHaveText('Partide0');
  for (const title of ['Capturile mele', 'Statistici', 'Istoric partide']) await expect(page.getByRole('heading', { name: title })).toHaveCount(0);
  await expect(page.getByTestId('open-section')).toHaveCount(0);
  // c7 — no live partidă: fish's hero, while start or join is on the web (owner rule 4: never an
  // actionless hero).
  const start = partideHrefs.start();
  const join = partideHrefs.join();
  const hero = page.getByRole('region', { name: 'Ești la pescuit?' }).locator('visible=true');
  if (start || join) {
    await expect(hero).toBeVisible();
    if (start) await expect(hero.getByRole('link', { name: 'Începe o partidă' })).toHaveAttribute('href', start);
    if (join) await expect(hero.getByRole('link', { name: 'Intră cu cod' })).toHaveAttribute('href', join);
  } else {
    await expect(page.getByRole('region', { name: 'Ești la pescuit?' })).toHaveCount(0);
  }
  await expectNoA11yViolations(page);
  await page.setViewportSize(DESKTOP);
  await expect(empty).toBeVisible();
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('c8 c9 c10 — «Capturile mele»: my catches feed, 12 cards, the lightbox pages on and shares the Bluvi card', async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await signedIn(context, page);
  const { hits } = await mockMine(page, {
    rows: [F1, F2],
    catches: { first: catchesPage(0, 20, 25, 'c2'), c2: catchesPage(20, 5, 25, null) },
  });
  await open(page);
  const section = page.getByRole('region', { name: 'Capturile mele' });
  await expect(section).toBeVisible();
  // c9 — MY feed (/feed/sessions/mine/catches), never the public profile grid.
  expect(hits.catches).toBe(1);
  expect(hits.profileCatches).toBe(0);
  // c8 — at most 12 cards; the header carries no link; «Vezi tot» is the rail's tail card.
  const rail = page.getByTestId('my-catches-rail');
  await expect(rail.getByTestId('my-catch-card')).toHaveCount(12);
  await expect(section.getByRole('heading', { name: 'Capturile mele' }).locator('..').locator('..').getByRole('link')).toHaveCount(0);
  const seeAll = partideHrefs.myCatches();
  if (seeAll) await expect(page.getByTestId('my-catches-see-all')).toHaveAttribute('href', seeAll);
  else await expect(page.getByTestId('my-catches-see-all')).toHaveCount(0);
  // A card: the kg (its own unit), the species («Captură» when unknown), the venue.
  await expect(rail.getByTestId('my-catch-card').nth(0)).toContainText('4,0kgCrap');
  await expect(rail.getByTestId('my-catch-card').nth(1)).toContainText('Captură');
  await expect(rail.getByTestId('my-catch-card').nth(3)).not.toContainText('kg');

  // c10 — a card opens the lightbox at its index, with the catch's footer.
  await rail.getByTestId('my-catch-card').nth(1).getByRole('button').click();
  const box = page.getByRole('dialog', { name: 'Captura 2 din 25' });
  await expect(box).toBeVisible();
  await expect(box.getByTestId('catch-detail-footer')).toContainText('5,0kg');
  await expect(box.getByTestId('catch-detail-footer')).toContainText('Balta Chita');
  await expect(box.getByTestId('catch-detail-footer')).toContainText('Cupa Toamnei');
  await expect(box.getByTestId('catch-detail-footer')).toContainText('19 sep 2026');
  await expectNoA11yViolations(page);
  // Reaching the last loaded catch asks for the next page.
  for (let i = 2; i < 20; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', { name: 'Captura 20 din 25' })).toBeVisible();
  await expect.poll(() => hits.catches).toBe(2);
  // The page has landed once «→» is no longer at the end.
  await expect(page.getByRole('button', { name: 'Fotografia următoare' })).not.toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', { name: 'Captura 21 din 25' })).toBeVisible();
  // Back to the competition catch and share it: the lightbox closes, the Bluvi card opens.
  for (let i = 21; i > 2; i--) await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('dialog', { name: 'Captura 2 din 25' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Captura 2 din 25' }).getByRole('button', { name: 'Distribuie captura' }).click();
  await expect(page.getByRole('dialog', { name: /Captura/ })).toHaveCount(0);
  const sheet = page.getByRole('dialog', { name: 'Distribuie captura' });
  await expect(sheet).toBeVisible();
  const card = sheet.getByRole('img', { name: /^Imaginea care se distribuie/ });
  await expect(card).toHaveAttribute('aria-label', 'Imaginea care se distribuie: Balta Chita · Cupa Toamnei · 5,0 kg · 19 sep 2026');
  await expect(sheet.getByRole('group', { name: 'Ce să apară pe poză' }).getByRole('button')).toHaveText(['Greutate', 'Baltă', 'Data', 'Competiție']);
  await sheet.getByRole('button', { name: 'Competiție' }).click();
  await expect(card).toHaveAttribute('aria-label', 'Imaginea care se distribuie: Balta Chita · 5,0 kg · 19 sep 2026');
  await expect(sheet.getByRole('button', { name: 'Distribuie', exact: true })).toBeEnabled();
  await expectNoA11yViolations(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('c8 — with a mouse from 768 the rail pages with previous / next arrows (the scrollbar is hidden)', async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await signedIn(context, page);
  await mockMine(page, { rows: [F1], catches: { first: catchesPage(0, 12, 12, null) } });
  await open(page, DESKTOP);
  const rail = page.getByTestId('my-catches-rail');
  await expect(rail.getByTestId('my-catch-card')).toHaveCount(12);
  const section = page.getByRole('region', { name: 'Capturile mele' });
  const prev = section.getByRole('button', { name: 'Capturile mele: înapoi' });
  const next = section.getByRole('button', { name: 'Capturile mele: înainte' });
  await expect(next).toBeVisible();
  await expect(next).toHaveAttribute('aria-controls', (await rail.getAttribute('id'))!);
  await expect(prev).toHaveAttribute('aria-disabled', 'true');
  const lastCard = rail.getByTestId('my-catch-card').last();
  // Inside the rail's visible box (horizontally): the rail clips what it has not scrolled to.
  const inRail = async () => {
    const r = (await rail.boundingBox())!;
    const c = (await lastCard.boundingBox())!;
    return c.x >= r.x - 1 && c.x + c.width <= r.x + r.width + 1;
  };
  expect(await inRail()).toBe(false);
  // Page by page to the end: the 12th card comes into view and «înainte» stops.
  for (let i = 0; i < 4 && (await next.getAttribute('aria-disabled')) !== 'true'; i++) {
    await next.click();
    await page.waitForTimeout(400);
  }
  await expect.poll(inRail).toBe(true);
  await expect(next).toHaveAttribute('aria-disabled', 'true');
  await expect(prev).not.toHaveAttribute('aria-disabled', 'true');
  await expectNoA11yViolations(page);
  // A phone (touch rail, swipe): no arrows.
  await page.setViewportSize(PHONE);
  await expect(next).toBeHidden();
  expect(errors).toEqual([]);
});

test('c8 — no catch photo: no «Capturile mele» at all', async ({ page, context }) => {
  await signedIn(context, page);
  const { hits } = await mockMine(page, { rows: [F1] });
  await open(page);
  await expect(page.getByTestId('journal-stat-strip')).toBeVisible();
  await expect.poll(() => hits.catches).toBe(1);
  await expect(page.getByRole('heading', { name: 'Statistici' }).locator('visible=true')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Capturile mele' })).toHaveCount(0);
});

test('c11 c12 c13 — Statistici: the 7-month chart, the best catch, the hours (comma decimal)', async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await signedIn(context, page);
  await mockMine(page, { rows: ALL, live: true });
  await open(page);
  const stats = page.getByRole('region', { name: 'Statistici' }).locator('visible=true');
  await expect(stats.getByRole('heading', { name: 'Capturi pe lună' })).toBeVisible();
  await expect(stats.getByText('ultimele 7 luni')).toBeVisible();
  await expect(stats.getByTestId('chart-bar')).toHaveCount(7);
  // The live partidă's 4 catches are not in the chart (the render list); this month carries F1's.
  const counts = await stats.getByTestId('chart-bar').evaluateAll((bars) => bars.map((b) => Number((b as HTMLElement).dataset.count)));
  expect(counts.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(6 + 3 + 0 + 2 + 1);
  // c12 — the best catch over the rendered list: F1's 12,35 kg at Balta Chita.
  await expect(stats.getByTestId('best-catch')).toContainText('Cea mai bună captură');
  await expect(stats.getByTestId('best-catch')).toContainText('12,35kg');
  await expect(stats.getByTestId('best-catch')).toContainText('Balta Chita');
  // c13 — 6+4+5+3 = 18 h over 4 finished partide.
  await expect(stats.getByTestId('hours-fished')).toContainText('18h');
  await expect(stats.getByTestId('hours-fished')).toContainText('~4,5 h / partidă');

  // From 1280: the bento tiles say the same.
  await page.setViewportSize(DESKTOP);
  const bento = page.getByTestId('journal-bento');
  await expect(bento.getByRole('heading', { name: 'Capturi pe lună' })).toBeVisible();
  await expect(bento).toContainText('12,35 kg');
  await expect(bento).toContainText('18 h');
  await expect(bento).toContainText('~4,5 h / partidă');
  expect(errors).toEqual([]);
});

test('c12 c13 — nothing weighed and nothing finished: «—» and «Nicio captură încă»', async ({ page, context }) => {
  await signedIn(context, page);
  await mockMine(page, { rows: [OPEN] });
  await open(page);
  const stats = page.getByRole('region', { name: 'Statistici' }).locator('visible=true');
  await expect(stats.getByTestId('best-catch')).toContainText('—');
  await expect(stats.getByTestId('best-catch')).toContainText('Nicio captură încă');
  await expect(stats.getByTestId('hours-fished')).toContainText('0h');
  await expect(stats.getByTestId('hours-fished')).toContainText('—');
});

test('c14 c16 — «În desfășurare»: the open partide as own cards with «Continuă partida»; hidden when none', async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await signedIn(context, page);
  const { state } = await mockMine(page, { rows: ALL, live: true });
  await open(page);
  const section = page.getByTestId('open-section');
  await expect(section.getByRole('heading', { name: /în desfășurare/i })).toBeVisible();
  const card = section.getByTestId('own-card-live');
  await expect(card).toHaveCount(1);
  // c16 — the venue, «{localitate} · {stand}», capturi · kg total («—» unweighed) · de pescuit, the
  // «Live» ribbon, «Începută acum …».
  await expect(card.getByRole('heading', { name: 'Balta Moara Vlăsiei' })).toBeVisible();
  await expect(card).toContainText('Ilfov · Stand 3');
  await expect(card.getByTestId('stat-strip')).toHaveText(/^captură1kg total—de pescuit3h 0\dm$/);
  await expect(card.getByTestId('card-ribbon')).toHaveText('Live');
  await expect(card).toContainText(/Începută acum 3h 0\dm/);
  const href = partideHrefs.partida(OPEN.documentId);
  if (href) {
    await expect(card.getByRole('link', { name: 'Continuă partida: Balta Moara Vlăsiei' })).toHaveAttribute('href', href);
    await expect(card.getByRole('link', { name: 'Balta Moara Vlăsiei' })).toHaveAttribute('href', href);
  } else {
    await expect(card.getByRole('link')).toHaveCount(0);
  }

  // Without an open partidă (other than the live one) the section is gone.
  state.rows = [F1, LIVE];
  await page.reload();
  await expect(page.getByTestId('journal-stat-strip')).toBeVisible();
  await expect(page.getByTestId('open-section')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('c15 c16 c17 — «Istoric partide»: the 3 newest finished partide; «Nicio partidă încheiată încă.» with none', async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await signedIn(context, page);
  const { state } = await mockMine(page, { rows: ALL, live: true });
  await open(page);
  const history = page.getByRole('region', { name: 'Istoric partide' });
  const cards = history.getByTestId('own-card');
  await expect(cards).toHaveCount(3);
  await expect(cards.getByRole('heading')).toHaveText(['Balta Chita', 'Lacul Snagov', 'Balta Dridu']);
  // c17 — neither the live partidă nor an open one is a history card.
  await expect(history).not.toContainText('Balta Mea');
  await expect(history).not.toContainText('Balta Moara Vlăsiei');
  // c16 — a finished card: stand label, kg total, durată, the date range, «Vezi rezumatul»; a
  // partidă hidden from the profile (F2) is here all the same.
  await expect(cards.nth(0)).toContainText('Ilfov · Stand 7');
  await expect(cards.nth(0).getByTestId('stat-strip')).toHaveText('capturi6kg total41,2durată6h 00m');
  await expect(cards.nth(1).getByTestId('stat-strip')).toHaveText('capturi3kg total19,1durată4h 00m');
  await expect(cards.nth(2).getByTestId('stat-strip')).toHaveText('capturi0kg total—durată5h 00m');
  await expect(cards.nth(0).locator('footer time')).toHaveText(/^\d{1,2} [A-Za-zăîșțâ]+ · \d{2}:\d{2} – \d{2}:\d{2}$|^\d{1,2} [A-Za-zăîșțâ]+ \d{2}:\d{2} – \d{1,2} [A-Za-zăîșțâ]+ \d{2}:\d{2}$/);
  const href = partideHrefs.partida('f1');
  if (href) {
    await expect(cards.nth(0).getByRole('link', { name: 'Balta Chita' })).toHaveAttribute('href', href);
    await expect(cards.nth(0)).toContainText('Vezi rezumatul');
  } else {
    await expect(cards.nth(0).getByRole('link')).toHaveCount(0);
  }
  const all = partideHrefs.history();
  if (all) await expect(history.getByRole('link', { name: 'Vezi tot istoricul partidelor' })).toHaveAttribute('href', all);
  else await expect(history.getByRole('link', { name: /Vezi tot/ })).toHaveCount(0);
  await expectNoA11yViolations(page);

  // Nothing finished and nothing open (the live one only): the line.
  state.rows = [LIVE];
  await page.reload();
  await expect(page.getByTestId('no-finished')).toHaveText('Nicio partidă încheiată încă.');
  expect(errors).toEqual([]);
});

test('c16 — a 40+ character venue at 375: every own card fits the phone and keeps all three stats', async ({ page, context }) => {
  const errors = collectConsoleErrors(page);
  await signedIn(context, page);
  await mockMine(page, { rows: [LONG, LONG_OPEN, F1, F2] });
  await open(page);
  const width = PHONE.width;
  for (const id of ['open-section', 'history-preview']) {
    const grid = page.getByTestId(id);
    await expect(grid.getByRole('heading', { name: LONG_LAKE })).toBeVisible();
    const cards = grid.locator('[data-testid^="own-card"]');
    expect(await cards.count()).toBeGreaterThan(0);
    for (const card of await cards.all()) {
      const box = (await card.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      // The third stat is on screen, not clipped by the page.
      const third = card.getByTestId('stat-strip').getByText(/^(durată|de pescuit)$/);
      await expect(third).toBeVisible();
      const t = (await third.boundingBox())!;
      expect(t.x + t.width).toBeLessThanOrEqual(width);
    }
  }
  // The long title truncates inside its card rather than widening it.
  const title = page.getByTestId('history-preview').getByRole('heading', { name: LONG_LAKE });
  expect(await title.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await expect(page.getByTestId('history-preview').getByTestId('own-card').first().getByTestId('stat-strip')).toHaveText('capturi4kg total22,5durată6h 00m');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  expect(errors).toEqual([]);
});

test('a failed first read is an error card with a retry, never an empty journal', async ({ page, context }) => {
  const errors = collectConsoleErrors(page, { ignore: /Failed to load resource: the server responded with a status of 500/ });
  await signedIn(context, page);
  const { state } = await mockMine(page, { rows: 'error' });
  await open(page);
  await expect(page.getByText('Jurnalul nu s-a putut încărca.')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('empty-journal')).toHaveCount(0);
  state.rows = [F1];
  await page.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(page.getByTestId('journal-stat-strip')).toBeVisible();
  expect(errors).toEqual([]);
});
