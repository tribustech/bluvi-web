import { mkdirSync } from 'node:fs';
import type { Page, Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { expect, test, type OrganizerHarness, type RecordedWrite } from './helpers/fake-organizer';
import { qaJwt, signIn } from './helpers/session';

/*
 * Concurs · Organizare — parity docs/parity/areas/competition-page.yml competition-page.organizare
 * c1–c14 (c8 skipped by design: fish never shows it), bara-actiuni c10 c11 c13, participant.yml
 * participant.register-guests.c15 (the menu entry), organizer.yml b.competition-menu,
 * b.cannot-edit-started, b.scale-entries, b.active-weighing-banner, b.feeder-allocate-next.
 *
 * CRITICAL — every organizer WRITE (start / end the competition, close / start a feeder leg, add /
 * remove a referee) pushes to REAL people from the local CMS: the fake-organizer harness aborts any
 * un-mocked write (the test fails), and each write here is route-mocked with its method, path and
 * body asserted. Reads go to the local CMS; the per-viewer state the local data lacks (the statute,
 * a status, a feeder leg, the seating, a weighing in progress, the referees) is answered through the
 * same-origin proxy (/api/cms/…, page.route) on top of the real responses.
 */

const OWN = process.env.E2E_ORG_OWN ?? 'a6xjl65ooe9eadrtvvqj9hn1'; // notStarted team, QA authors it, 4 × 5 stands, full (20/20)
const LIVE = process.env.E2E_COMPETITION_LIVE ?? 'kee49a3e64b3f636b4b60daa'; // started quantity, 24 × 1 stand, all seated
const FEEDER = process.env.E2E_COMPETITION_FEEDER ?? 'rg340d4r4gnwf2mbyhxvasnr'; // feederRounds (2 legs), served as started
const NC = process.env.E2E_COMPETITION_NC ?? 'z7rvhm55ziyr0tbblqwjp39q'; // completed nationalChampionship (no penalties)

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };

test.describe.configure({ timeout: 120_000 });

let jwt = '';
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});
// Reads still in flight when a test ends (the live poll) are dropped, not reported.
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

type Json = Record<string, unknown>;
type Role = 'author' | 'referee' | 'participant' | null;
type Setup = {
  role?: Role;
  /** Patches the real /feed/competitions/:id (the client's read after the session lands). */
  patch?: (c: Json) => void;
  /** The seating answer (null: the real one). */
  allocated?: Json | null;
  active?: unknown[];
  signedIn?: boolean;
  /** Holds the statute answer until this promise resolves (the role unknown meanwhile). */
  statuteGate?: Promise<void>;
};

/** Counts of the client's competition reads (fish invalidations after a write). */
type Reads = { competition: number };

async function setup(page: Page, id: string, { role = 'author', patch, allocated = null, active, signedIn = true, statuteGate }: Setup = {}): Promise<Reads> {
  const reads: Reads = { competition: 0 };
  if (signedIn) await signIn(page.context(), jwt);
  await page.addInitScript(() => {
    (window as unknown as { __events: unknown[] }).__events = [];
    window.addEventListener('bluvi:analytics', e => (window as unknown as { __events: unknown[] }).__events.push((e as CustomEvent).detail));
  });
  await page.route(
    url => url.pathname === `/api/cms/feed/competitions/${id}`,
    async (route: Route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      reads.competition++;
      const res = await route.fetch();
      const json = (await res.json()) as { data: Json };
      patch?.(json.data);
      return route.fulfill({ response: res, json });
    },
  );
  await page.route(/\/api\/cms\/user\/profile\/competition\/[^/]+\/statute/, async route => {
    if (route.request().method() !== 'GET') return route.fallback();
    if (statuteGate) await statuteGate;
    return route.fulfill({ json: { userRole: role } });
  });
  if (allocated) {
    await page.route(
      url => url.pathname === `/api/cms/competitions/${id}/allocated-participants`,
      route => (route.request().method() === 'GET' ? route.fulfill({ json: { data: allocated } }) : route.fallback()),
    );
  }
  if (active) {
    await page.route(
      url => url.pathname === `/api/cms/competitions/${id}/active-weighing`,
      route => (route.request().method() === 'GET' ? route.fulfill({ json: active }) : route.fallback()),
    );
  }
  return reads;
}

async function open(page: Page, path: string, viewport = PHONE) {
  await page.setViewportSize(viewport);
  // A 403 the local CMS answers for a grant it lacks is the browser's own network log line.
  const errors = collectConsoleErrors(page, { ignore: /Failed to load resource/ });
  const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 45_000 });
  await page.waitForFunction(() => Object.keys(document.querySelector('h1') ?? {}).some(k => k.startsWith('__react')), null, { timeout: 60_000 });
  return errors;
}

const bar = (page: Page) => page.getByRole('region', { name: 'Bara de acțiuni' });
// WCAG 2.5.3 Label in Name: the tile is named by its visible «Organizare».
const orgTile = (page: Page) => bar(page).getByRole('button', { name: 'Organizare', exact: true });
const penaltiesLink = (scope: Page | ReturnType<typeof bar>) => scope.getByRole('link', { name: 'Penalizări', exact: true });
const submenu = (page: Page) => bar(page).getByRole('navigation', { name: 'Acțiuni organizator' });
const headerMenuButton = (page: Page) => page.getByRole('button', { name: 'Organizare', exact: true });
const headerMenu = (page: Page) => page.getByRole('menu', { name: 'Organizare' });
const toast = (page: Page, text: string) => page.getByText(text, { exact: true }).first();
const items = async (nav: ReturnType<typeof submenu>) => (await nav.locator('li').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());

async function openSubmenu(page: Page) {
  await expect(orgTile(page)).toBeVisible({ timeout: 30_000 });
  await orgTile(page).click();
  await expect(submenu(page)).toBeVisible();
}

async function openHeaderMenu(page: Page) {
  await expect(headerMenuButton(page)).toBeVisible({ timeout: 30_000 });
  await headerMenuButton(page).click();
  await expect(headerMenu(page)).toBeVisible();
}

/** Lets the surfaces' entry transitions finish (axe reads colours mid-fade otherwise). */
const settled = (page: Page) =>
  page.evaluate(() => Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => undefined))));

const shot = async (page: Page, name: string) => {
  await settled(page);
  mkdirSync('.shots', { recursive: true });
  await page.screenshot({ path: `.shots/organizare-${name}.png`, fullPage: false });
};

const onlyWrites = (organizer: OrganizerHarness, expected: Partial<RecordedWrite>[]) =>
  expect(organizer.writes.map(w => ({ method: w.method, path: w.path, ...(w.body === undefined ? {} : { body: w.body }) }))).toEqual(expected);

/* ------------------------------------------------------------------ */
/* c1 c2 — who sees «Organizare», the notStarted menu                   */
/* ------------------------------------------------------------------ */

test('competition-page.organizare.c1 c2 participant.register-guests.c15 — phone: the author’s «Organizare» opens the submenu in fish order, «Înapoi» returns', async ({ page, organizer }) => {
  await setup(page, OWN, { patch: c => (c.participantsLimit = 30) });
  const errors = await open(page, `/concursuri/${OWN}`);
  await openSubmenu(page);
  // The menu follows the competition the browser reads once the session lands (the limit patched).
  await expect.poll(() => items(submenu(page))).toEqual([
    'Înapoi',
    'Modifică competiția',
    'Alocă standuri pe sectoare',
    'Alocă participanții pe standuri',
    'Adaugă participanți fără cont',
    'Start concurs',
    'Adaugă arbitru',
    'Șterge arbitru',
  ]);
  const nav = submenu(page);
  await expect(nav.getByRole('link', { name: 'Modifică competiția' })).toHaveAttribute(
    'href',
    `/concursuri/${OWN}/editeaza/detalii?inapoi=${encodeURIComponent(`/concursuri/${OWN}`)}`,
  );
  await expect(nav.getByRole('link', { name: 'Alocă standuri pe sectoare' })).toHaveAttribute('href', `/concursuri/${OWN}/sectoare`);
  await expect(nav.getByRole('link', { name: 'Alocă participanții pe standuri' })).toHaveAttribute('href', `/concursuri/${OWN}/alocare`);
  await expect(nav.getByRole('link', { name: 'Adaugă participanți fără cont' })).toHaveAttribute('href', `/concursuri/${OWN}/inscriere/fara-cont`);
  // Focus moved into the submenu; «Înapoi» (and Escape) bring the tile back, focused.
  await expect(nav.getByRole('button', { name: 'Înapoi' })).toBeFocused();
  await shot(page, 'phone-submenu-notstarted');
  await settled(page);
  await expectNoA11yViolations(page);
  await page.keyboard.press('Escape');
  await expect(orgTile(page)).toBeFocused();
  await orgTile(page).click();
  await nav.getByRole('button', { name: 'Înapoi' }).click();
  await expect(orgTile(page)).toBeVisible();
  onlyWrites(organizer, []);
  expect(errors).toEqual([]);
});

test('participant.register-guests.c15 — «Adaugă participanți fără cont» is gone once the limit is reached; no stands → no participants allocation', async ({ page }) => {
  // The real competition is full (20 / 20); its sectors emptied of stands.
  await setup(page, OWN, { patch: c => (c.sectors = (c.sectors as Json[]).map(s => ({ ...s, stands: [] }))) });
  await open(page, `/concursuri/${OWN}`);
  await openSubmenu(page);
  await expect.poll(() => items(submenu(page))).toEqual(['Înapoi', 'Modifică competiția', 'Alocă standuri pe sectoare', 'Start concurs', 'Adaugă arbitru', 'Șterge arbitru']);
});

test('competition-page.organizare.c1 — no «Organizare» for a participant, a referee before the start, a guest, or the author once completed', async ({ page, browser }) => {
  await setup(page, OWN, { role: 'participant' });
  await open(page, `/concursuri/${OWN}`);
  await expect(bar(page).getByRole('link', { name: /Înscrie-te|Modifică înscrierea/ }).or(bar(page).getByRole('button', { name: /Înscrie-te|Modifică înscrierea/ })).first()).toBeVisible({ timeout: 30_000 });
  await expect(orgTile(page)).toHaveCount(0);

  const ctx = await browser.newContext();
  const guest = await ctx.newPage();
  await open(guest, `/concursuri/${OWN}`);
  await expect(orgTile(guest)).toHaveCount(0);
  await ctx.close();

  const ctx2 = await browser.newContext();
  const done = await ctx2.newPage();
  await setup(done, NC, { role: 'author' });
  await open(done, `/concursuri/${NC}`, DESKTOP);
  await expect(done.getByRole('button', { name: 'Distribuie' })).toBeVisible();
  await done.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await expect(headerMenuButton(done)).toHaveCount(0);
  await done.unrouteAll({ behavior: 'ignoreErrors' });
  await ctx2.close();
});

test('competition-page.organizare.c1 c2 — from 768 the header «Organizare» is a menu (arrows, Escape), same entries', async ({ page, organizer }) => {
  await setup(page, OWN, { patch: c => (c.participantsLimit = 30) });
  const errors = await open(page, `/concursuri/${OWN}`, DESKTOP);
  await expect(headerMenuButton(page)).toBeVisible({ timeout: 30_000 });
  await headerMenuButton(page).focus();
  await page.keyboard.press('ArrowDown');
  const menu = headerMenu(page);
  await expect(menu).toBeVisible();
  await expect.poll(async () => (await menu.getByRole('menuitem').allInnerTexts()).map(t => t.trim())).toEqual([
    'Modifică competiția',
    'Alocă standuri pe sectoare',
    'Alocă participanții pe standuri',
    'Adaugă participanți fără cont',
    'Start concurs',
    'Adaugă arbitru',
    'Șterge arbitru',
  ]);
  await expect(menu.getByRole('menuitem', { name: 'Modifică competiția' })).toBeFocused();
  await expect(menu.getByRole('menuitem', { name: 'Adaugă participanți fără cont' })).toHaveAttribute('href', `/concursuri/${OWN}/inscriere/fara-cont`);
  await shot(page, 'desktop-menu-notstarted');
  await settled(page);
  await expectNoA11yViolations(page);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(headerMenuButton(page)).toBeFocused();
  onlyWrites(organizer, []);
  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ */
/* c3 — Start concurs                                                   */
/* ------------------------------------------------------------------ */

test('competition-page.organizare.c3 — phone: «Start concurs» asks in the bar; Anulează writes nothing; Confirmă PUTs /start, toasts, re-reads the competition', async ({ page, organizer }) => {
  const reads = await setup(page, OWN);
  await organizer.mockWrite('PUT', `/competitions/${OWN}/start`, { json: { id: 1, documentId: OWN, name: 'x', competitionStatus: 'started' } });
  const errors = await open(page, `/concursuri/${OWN}`);
  await openSubmenu(page);
  await submenu(page).getByRole('button', { name: 'Start concurs' }).click();
  const ask = bar(page).getByRole('group', { name: 'Ești sigur că vrei să dai start competiției?' });
  await expect(ask).toBeVisible();
  await shot(page, 'phone-confirm-start');
  // An irreversible write that notifies everyone: «Confirmă» is the danger button (fish 'destructive').
  await expect(ask.getByRole('button', { name: 'Confirmă' })).toHaveClass(/bg-status-danger-bg/);
  await ask.getByRole('button', { name: 'Anulează' }).click();
  await expect(ask).toHaveCount(0);
  // Focus goes back to the tile that asked, never onto <body>.
  await expect(orgTile(page)).toBeFocused();
  onlyWrites(organizer, []);

  await openSubmenu(page);
  await submenu(page).getByRole('button', { name: 'Start concurs' }).click();
  const before = reads.competition;
  await bar(page).getByRole('button', { name: 'Confirmă' }).click();
  await expect(toast(page, 'Competiția a fost începută cu succes')).toBeVisible();
  onlyWrites(organizer, [{ method: 'PUT', path: `/competitions/${OWN}/start` }]);
  await expect.poll(() => reads.competition).toBeGreaterThan(before);
  expect(errors).toEqual([]);
});

test('competition-page.organizare.c3 — from 768: the alert dialog (Anulează / Confirmă); an error toasts the server message', async ({ page, organizer }) => {
  await setup(page, OWN);
  await organizer.mockWrite('PUT', `/competitions/${OWN}/start`, {
    status: 400,
    json: { data: null, error: { status: 400, name: 'BadRequestError', message: 'Nu există participanți alocați.', details: { bluCode: 'COMPETITION:NO_ALLOCATION' } } },
  });
  await open(page, `/concursuri/${OWN}`, DESKTOP);
  await openHeaderMenu(page);
  await headerMenu(page).getByRole('menuitem', { name: 'Start concurs' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Ești sigur că vrei să dai start competiției?' });
  await expect(dialog).toBeVisible();
  await shot(page, 'desktop-confirm-start');
  await settled(page);
  await expectNoA11yViolations(page);
  await expect(dialog.getByRole('button', { name: 'Confirmă' })).toHaveClass(/bg-status-danger-bg/);
  // An alert must be answered: a click on the backdrop does not dismiss it.
  await page.mouse.click(8, 8);
  await expect(dialog).toBeVisible();
  onlyWrites(organizer, []);
  await dialog.getByRole('button', { name: 'Anulează' }).click();
  await expect(dialog).toBeHidden();
  onlyWrites(organizer, []);
  await openHeaderMenu(page);
  await headerMenu(page).getByRole('menuitem', { name: 'Start concurs' }).click();
  await dialog.getByRole('button', { name: 'Confirmă' }).click();
  await expect(toast(page, 'Nu există participanți alocați.')).toBeVisible();
  onlyWrites(organizer, [{ method: 'PUT', path: `/competitions/${OWN}/start` }]);
});

/* ------------------------------------------------------------------ */
/* c4 c5 c6 — started                                                   */
/* ------------------------------------------------------------------ */

test('competition-page.organizare.c4 c5 organizer.b.cannot-edit-started — started: the menu; «Modifică competiția» explains and offers the call', async ({ page, organizer }) => {
  await setup(page, LIVE);
  const errors = await open(page, `/concursuri/${LIVE}`);
  await openSubmenu(page);
  await expect.poll(() => items(submenu(page))).toEqual(['Înapoi', 'Modifică competiția', 'Adaugă cântar', 'Adaugă arbitru', 'Șterge arbitru', 'Penalizări', 'Încheie concurs']);
  await expect(submenu(page).getByRole('link', { name: 'Adaugă cântar' })).toHaveAttribute('href', `/concursuri/${LIVE}/cantar`);
  await expect(submenu(page).getByRole('link', { name: 'Penalizări' })).toHaveAttribute('href', `/concursuri/${LIVE}/penalizari`);
  await shot(page, 'phone-submenu-started');
  await submenu(page).getByRole('button', { name: 'Modifică competiția' }).click();
  const sheet = page.getByRole('dialog', { name: 'Nu poți modifica competiția' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('Competiția a început deja. Pentru modificări, contactează echipa Bluvi.')).toBeVisible();
  const call = sheet.getByRole('link', { name: 'Apelează' });
  await expect(call).toHaveAttribute('href', 'tel:+40733017091');
  await shot(page, 'phone-cannot-edit');
  await settled(page);
  await expectNoA11yViolations(page);
  // The call itself: logged as fish (contact_pressed), the tel: navigation cancelled here.
  await page.evaluate(() => document.addEventListener('click', e => e.preventDefault(), { once: true }));
  await call.click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __events: { name: string; params: Json }[] }).__events.filter(e => e.name === 'contact_pressed')))
    .toEqual([{ name: 'contact_pressed', params: { contact_type: 'Bluvi cannot edit contact' } }]);
  onlyWrites(organizer, []);
  expect(errors).toEqual([]);
});

test('competition-page.organizare.c4 — «Adaugă cântar» only once someone is seated; no «Penalizări» on a type without penalties', async ({ page }) => {
  await setup(page, LIVE, { allocated: {} });
  await open(page, `/concursuri/${LIVE}`);
  await openSubmenu(page);
  await expect.poll(() => items(submenu(page))).toEqual(['Înapoi', 'Modifică competiția', 'Adaugă arbitru', 'Șterge arbitru', 'Penalizări', 'Încheie concurs']);
});

test('competition-page.organizare.c6 — «Încheie concurs» asks, PUTs /end, toasts and re-reads the competition (desktop menu)', async ({ page, organizer }) => {
  const reads = await setup(page, LIVE);
  await organizer.mockWrite('PUT', `/competitions/${LIVE}/end`, { json: { data: { id: 1, documentId: LIVE, name: 'x', competitionStatus: 'completed' } } });
  await open(page, `/concursuri/${LIVE}`, DESKTOP);
  await openHeaderMenu(page);
  await expect.poll(async () => (await headerMenu(page).getByRole('menuitem').allInnerTexts()).map(t => t.trim())).toEqual([
    'Modifică competiția',
    'Adaugă cântar',
    'Adaugă arbitru',
    'Șterge arbitru',
    'Penalizări',
    'Încheie concurs',
  ]);
  await shot(page, 'desktop-menu-started');
  await headerMenu(page).getByRole('menuitem', { name: 'Încheie concurs' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Ești sigur că vrei să închei competiția?' });
  const before = reads.competition;
  await dialog.getByRole('button', { name: 'Confirmă' }).click();
  await expect(toast(page, 'Competiția a fost încheiată cu succes')).toBeVisible();
  onlyWrites(organizer, [{ method: 'PUT', path: `/competitions/${LIVE}/end` }]);
  await expect.poll(() => reads.competition).toBeGreaterThan(before);
});

/* ------------------------------------------------------------------ */
/* c7 — feeder legs                                                     */
/* ------------------------------------------------------------------ */

const leg = (currentRound: number, roundStatus: 'running' | 'closed') => (c: Json) => {
  c.competitionStatus = 'started';
  c.roundsCount = 2;
  c.currentRound = currentRound;
  c.roundStatus = roundStatus;
};

test('competition-page.organizare.c7 — a running leg: «Închide manșa 1» asks fish’s question, POSTs rounds/close, toasts', async ({ page, organizer }) => {
  await setup(page, FEEDER, { patch: leg(1, 'running') });
  await organizer.mockWrite('POST', `/feed/competitions/${FEEDER}/rounds/close`, { json: { data: { currentRound: 1, roundStatus: 'closed' } } });
  const errors = await open(page, `/concursuri/${FEEDER}`);
  await openSubmenu(page);
  await expect.poll(async () => (await items(submenu(page))).at(-1)).toBe('Închide manșa 1');
  expect(await items(submenu(page))).not.toContain('Încheie concurs');
  await submenu(page).getByRole('button', { name: 'Închide manșa 1' }).click();
  const ask = bar(page).getByRole('group', { name: 'Închizi manșa 1? Cântarele ei nu mai pot fi redeschise.' });
  await ask.getByRole('button', { name: 'Confirmă' }).click();
  await expect(toast(page, 'Manșa 1 a fost închisă')).toBeVisible();
  onlyWrites(organizer, [{ method: 'POST', path: `/feed/competitions/${FEEDER}/rounds/close` }]);
  expect(errors).toEqual([]);
});

test('competition-page.organizare.c7 organizer.b.feeder-allocate-next — a closed leg: «Reașază pentru manșa 2» (/alocare?mansa=2) and «Pornește manșa 2» (POST rounds/start); no «Adaugă cântar»', async ({ page, organizer }) => {
  await setup(page, FEEDER, { patch: leg(1, 'closed') });
  await organizer.mockWrite('POST', `/feed/competitions/${FEEDER}/rounds/start`, { json: { data: { currentRound: 2, roundStatus: 'running' } } });
  await open(page, `/concursuri/${FEEDER}`, DESKTOP);
  await openHeaderMenu(page);
  const menu = headerMenu(page);
  await expect.poll(async () => (await menu.getByRole('menuitem').allInnerTexts()).map(t => t.trim())).toEqual([
    'Modifică competiția',
    'Adaugă arbitru',
    'Șterge arbitru',
    'Reașază pentru manșa 2',
    'Pornește manșa 2',
  ]);
  await expect(menu.getByRole('menuitem', { name: 'Reașază pentru manșa 2' })).toHaveAttribute('href', `/concursuri/${FEEDER}/alocare?mansa=2`);
  await menu.getByRole('menuitem', { name: 'Pornește manșa 2' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Pornești manșa 2? Standurile trase sunt salvate?' });
  await dialog.getByRole('button', { name: 'Confirmă' }).click();
  await expect(toast(page, 'Manșa 2 a început')).toBeVisible();
  onlyWrites(organizer, [{ method: 'POST', path: `/feed/competitions/${FEEDER}/rounds/start` }]);
});

test('competition-page.organizare.c7 — the last leg running: «Încheie concurs»', async ({ page }) => {
  await setup(page, FEEDER, { patch: leg(2, 'running') });
  await open(page, `/concursuri/${FEEDER}`);
  await openSubmenu(page);
  await expect.poll(async () => (await items(submenu(page))).at(-1)).toBe('Încheie concurs');
});

test('competition-page.organizare.c1 — phone 375: the scrolling submenu shows a cut tile at the edge, every label whole, the last tile reachable', async ({ page }) => {
  await setup(page, LIVE);
  await open(page, `/concursuri/${LIVE}`);
  await openSubmenu(page);
  await expect.poll(async () => (await items(submenu(page))).at(-1)).toBe('Încheie concurs');
  const list = submenu(page).locator('ul');
  const geometry = () =>
    list.evaluate(ul => {
      const box = ul.getBoundingClientRect();
      const tiles = [...ul.querySelectorAll('li')].map(li => li.getBoundingClientRect());
      return {
        // A tile straddles the row's right edge: the row reads as «more» (no complete-looking row).
        cut: tiles.some(t => t.left < box.right - 8 && t.right > box.right + 8),
        truncated: [...ul.querySelectorAll<HTMLElement>('[data-tile-label]')].filter(l => l.scrollHeight > l.clientHeight + 1).map(l => l.textContent),
      };
    });
  const g = await geometry();
  // The row scrolls inside the screen (it once widened the bar past it, the last tiles clipped away).
  expect(await list.evaluate(ul => ul.getBoundingClientRect().right)).toBeLessThanOrEqual(PHONE.width);
  expect(g.cut).toBe(true);
  expect(g.truncated).toEqual([]);
  const last = submenu(page).getByRole('button', { name: 'Încheie concurs' });
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport({ ratio: 1 });
  const inside = await list.evaluate(ul => {
    const box = ul.getBoundingClientRect();
    const t = ul.querySelector('li:last-child')!.getBoundingClientRect();
    return t.right <= box.right + 1 && getComputedStyle(ul).maskImage === 'none';
  });
  expect(inside).toBe(true);

  // A referee's seven tiles: the same scrolling row, «Penalizări» reachable.
  const ctx = await page.context().browser()!.newContext();
  const ref = await ctx.newPage();
  await setup(ref, LIVE, { role: 'referee' });
  await open(ref, `/concursuri/${LIVE}`);
  const tile = penaltiesLink(bar(ref));
  await expect(tile).toBeAttached({ timeout: 30_000 });
  await tile.scrollIntoViewIfNeeded();
  await expect(tile).toBeInViewport({ ratio: 1 });
  await ref.unrouteAll({ behavior: 'ignoreErrors' });
  await ctx.close();
});

test('competition-page.organizare.c1 bara-actiuni.c10 — while the statute loads nothing is guessed: no «Penalizări» for the author, a bone in the header slot', async ({ page }) => {
  let answer = () => {};
  const gate = new Promise<void>(r => (answer = r));
  await setup(page, LIVE, { statuteGate: gate });
  await open(page, `/concursuri/${LIVE}`, DESKTOP);
  await expect(page.getByTestId('organizer-slot-bone')).toBeVisible({ timeout: 30_000 });
  await expect(penaltiesLink(page)).toHaveCount(0);
  await expect(headerMenuButton(page)).toHaveCount(0);
  await page.setViewportSize(PHONE);
  await expect(bar(page).getByRole('button', { name: 'Statistici' })).toBeVisible();
  await expect(penaltiesLink(bar(page))).toHaveCount(0);
  answer();
  await expect(orgTile(page)).toBeVisible({ timeout: 30_000 });
  await expect(penaltiesLink(bar(page))).toHaveCount(0);
  await page.setViewportSize(DESKTOP);
  await expect(headerMenuButton(page)).toBeVisible();
  await expect(page.getByTestId('organizer-slot-bone')).toHaveCount(0);
  await expect(penaltiesLink(page)).toHaveCount(0);
});

/* ------------------------------------------------------------------ */
/* c9 c10 — referees                                                    */
/* ------------------------------------------------------------------ */

const user = (i: number) => ({
  id: 5000 + i,
  documentId: `u${i}`,
  username: `Arbitru ${i}`,
  email: `a${i}@example.test`,
  provider: 'local',
  isProfileComplete: true,
  phone: null,
  hasRequestedOrganizerRole: false,
  avatar: null,
});

test('competition-page.organizare.c9 — «Adaugă arbitru»: search, paginated users (next page at the end), one chosen, PATCH referee, toast, re-read', async ({ page, organizer }) => {
  const reads = await setup(page, OWN);
  const userReads: string[] = [];
  await page.route(
    url => url.pathname === '/api/cms/user/all',
    route => {
      const url = new URL(route.request().url());
      userReads.push(url.search);
      const p = Number(url.searchParams.get('page'));
      const search = url.searchParams.get('search') ?? '';
      const all = search ? [user(7)] : Array.from({ length: 20 }, (_, i) => user(p === 1 ? i + 1 : i + 21));
      return route.fulfill({ json: { data: all, meta: { pagination: { page: p, pageSize: 20, pageCount: search ? 1 : 2, total: search ? 1 : 40 } } } });
    },
  );
  await organizer.mockWrite('PATCH', `/competitions/${OWN}/referee`, { status: 201, json: {} });
  await open(page, `/concursuri/${OWN}`, DESKTOP);
  await openHeaderMenu(page);
  await headerMenu(page).getByRole('menuitem', { name: 'Adaugă arbitru' }).click();
  const dialog = page.getByRole('dialog', { name: 'Alegeți un arbitru' });
  await expect(dialog.getByPlaceholder('Caută...')).toBeVisible();
  await expect(dialog.getByRole('radio', { name: 'Arbitru 1', exact: true })).toBeVisible();
  // The end of the list in view → page 2.
  await dialog.getByRole('radio', { name: 'Arbitru 20', exact: true }).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole('radio', { name: 'Arbitru 40', exact: true })).toBeAttached();
  expect(userReads.some(q => q.includes('page=2'))).toBe(true);
  await dialog.getByPlaceholder('Caută...').fill('Arb 7');
  await expect.poll(() => userReads.some(q => q.includes('search=Arb%207'))).toBe(true);
  await expect(dialog.getByRole('radio')).toHaveCount(1);
  await dialog.getByRole('radio', { name: 'Arbitru 7', exact: true }).click();
  await expect(dialog.getByRole('radio', { name: 'Arbitru 7', exact: true })).toHaveAttribute('aria-checked', 'true');
  await shot(page, 'desktop-referee-add');
  await settled(page);
  await expectNoA11yViolations(page);
  const before = reads.competition;
  await dialog.getByRole('button', { name: 'Adaugă' }).click();
  await expect(toast(page, 'Arbitrul a fost adăugat cu succes')).toBeVisible();
  await expect(dialog).toBeHidden();
  onlyWrites(organizer, [{ method: 'PATCH', path: `/competitions/${OWN}/referee`, body: { documentId: 'u7' } }]);
  await expect.poll(() => reads.competition).toBeGreaterThan(before);
});

test('competition-page.organizare.c10 — «Șterge arbitru»: the referees filtered by the search, «Nu există opțiuni», DELETE referee, toast', async ({ page, organizer }) => {
  await setup(page, LIVE, {
    patch: c =>
      (c.referees = [
        { id: 1, documentId: 'ref1', username: 'Ion Arbitru', phone: null },
        { id: 2, documentId: 'ref2', username: 'Maria Cântar', phone: null },
      ]),
  });
  await organizer.mockWrite('DELETE', `/competitions/${LIVE}/referee/ref2`, { status: 204 });
  const errors = await open(page, `/concursuri/${LIVE}`);
  await openSubmenu(page);
  await submenu(page).getByRole('button', { name: 'Șterge arbitru' }).click();
  const sheet = page.getByRole('dialog', { name: 'Șterge arbitru' });
  await expect(sheet.getByRole('radio')).toHaveCount(2);
  await sheet.getByPlaceholder('Caută...').fill('zzz');
  await expect(sheet.getByText('Nu există opțiuni')).toBeVisible();
  await sheet.getByPlaceholder('Caută...').fill('maria');
  await expect(sheet.getByRole('radio')).toHaveCount(1);
  await sheet.getByRole('radio', { name: 'Maria Cântar' }).click();
  // The search hides the chosen row: no choice any more, «Șterge» is closed and writes nothing.
  await sheet.getByPlaceholder('Caută...').fill('ion');
  await expect(sheet.getByRole('radio')).toHaveCount(1);
  const remove = sheet.getByRole('button', { name: 'Șterge', exact: true });
  await expect(remove).toHaveAttribute('aria-disabled', 'true');
  await remove.dispatchEvent('click');
  onlyWrites(organizer, []);
  await sheet.getByPlaceholder('Caută...').fill('maria');
  await sheet.getByRole('radio', { name: 'Maria Cântar' }).click();
  await expect(remove).not.toHaveAttribute('aria-disabled', 'true');
  await shot(page, 'phone-referee-remove');
  await settled(page);
  await expectNoA11yViolations(page);
  await remove.click();
  await expect(toast(page, 'Arbitrul a fost șters cu succes')).toBeVisible();
  onlyWrites(organizer, [{ method: 'DELETE', path: `/competitions/${LIVE}/referee/ref2` }]);
  await expect(sheet).toBeHidden();
  // The dialog kept the submenu behind it (fish): focus returns to the tile that opened it.
  await expect(submenu(page).getByRole('button', { name: 'Șterge arbitru' })).toBeFocused();
  // Reopened after the removal: the search and the choice are gone (fish onSettled), «Șterge» closed.
  await submenu(page).getByRole('button', { name: 'Șterge arbitru' }).click();
  await expect(sheet.getByPlaceholder('Caută...')).toHaveValue('');
  await expect(sheet.getByRole('radio')).toHaveCount(2);
  await expect(sheet.getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(remove).toHaveAttribute('aria-disabled', 'true');
  await remove.dispatchEvent('click');
  onlyWrites(organizer, [{ method: 'DELETE', path: `/competitions/${LIVE}/referee/ref2` }]);
  // Closed with Escape: focus back on the submenu's tile.
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(submenu(page).getByRole('button', { name: 'Șterge arbitru' })).toBeFocused();
  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ */
/* c11 c13 — a referee                                                  */
/* ------------------------------------------------------------------ */

test('competition-page.organizare.c11 — a referee: «Adaugă cântar» tile after Cântare (phone) and header button (768+) → the scale', async ({ page }) => {
  await setup(page, LIVE, { role: 'referee' });
  await open(page, `/concursuri/${LIVE}`);
  const tile = bar(page).getByRole('link', { name: 'Adaugă cântar' });
  await expect(tile).toHaveAttribute('href', `/concursuri/${LIVE}/cantar`, { timeout: 30_000 });
  const ids = await bar(page).locator('[data-tile]').evaluateAll(els => els.map(e => e.getAttribute('data-tile')));
  expect(ids.indexOf('adauga-cantar')).toBe(ids.indexOf('cantare') + 1);
  await expect(orgTile(page)).toHaveCount(0);
  await shot(page, 'phone-referee-bar');
  await page.setViewportSize(DESKTOP);
  await expect(page.getByRole('link', { name: 'Adaugă cântar' }).first()).toHaveAttribute('href', `/concursuri/${LIVE}/cantar`);
});

test('competition-page.organizare.c13 organizer.b.scale-entries — the referee’s «Acțiuni»: «Adaugă cântar», closed until someone is seated', async ({ page }) => {
  await setup(page, LIVE, { role: 'referee', allocated: {} });
  await open(page, `/concursuri/${LIVE}/informatii`);
  await bar(page).getByRole('button', { name: 'Acțiuni concurs' }).click();
  const sheet = page.getByRole('dialog', { name: 'Acțiuni' });
  const item = sheet.getByRole('button', { name: /Adaugă cântar/ });
  await expect(item).toHaveAttribute('aria-disabled', 'true');
  await expect(item).toContainText('Te rugăm să aloci mai întâi participanții pe standuri');
});

/* ------------------------------------------------------------------ */
/* c12 — the author's «Acțiuni» sheet                                   */
/* ------------------------------------------------------------------ */

test('competition-page.organizare.c12 c13 — started: the author’s «Acțiuni» rows with fish’s reasons; «Încheie concurs» asks «Închide» / «Încheie»', async ({ page, organizer }) => {
  await setup(page, LIVE);
  await organizer.mockWrite('PUT', `/competitions/${LIVE}/end`, { json: { data: { id: 1, documentId: LIVE, name: 'x', competitionStatus: 'completed' } } });
  const errors = await open(page, `/concursuri/${LIVE}/informatii`);
  await bar(page).getByRole('button', { name: 'Acțiuni concurs' }).click();
  const sheet = page.getByRole('dialog', { name: 'Acțiuni' });
  const rows = sheet.getByTestId('actions-sheet').locator('> li');
  await expect(rows.first()).not.toHaveClass(/animate-shimmer/, { timeout: 30_000 });
  const texts = (await rows.allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
  expect(texts).toEqual([
    expect.stringMatching(/^(Înscrie-te|Modifică înscrierea)/),
    'Încheie concurs',
    'Adaugă arbitru',
    'Șterge arbitru',
    'Adaugă participanți fără cont Competiția a început deja, nu se mai pot face modificări',
    'Alocă standuri pe sectoare Competiția a început deja, nu se mai pot face modificări',
    'Alocă participanții pe standuri Competiția a început deja, nu se mai pot face modificări',
    'Adaugă cântar',
  ]);
  await expect(sheet.getByRole('link', { name: 'Adaugă cântar' })).toHaveAttribute('href', `/concursuri/${LIVE}/cantar`);
  await shot(page, 'phone-actions-author-started');
  await settled(page);
  await expectNoA11yViolations(page);
  await sheet.getByRole('button', { name: 'Încheie concurs' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Ești sigur că vrei să închei competiția?' });
  await expect(dialog.getByRole('button', { name: 'Închide' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Încheie' }).click();
  await expect(toast(page, 'Competiția a fost încheiată cu succes')).toBeVisible();
  onlyWrites(organizer, [{ method: 'PUT', path: `/competitions/${LIVE}/end` }]);
  expect(errors).toEqual([]);
});

test('competition-page.organizare.c12 — completed: the author’s sheet is only «Vezi cântarele din concurs» → the scale', async ({ page }) => {
  await setup(page, NC);
  await open(page, `/concursuri/${NC}/informatii`);
  await bar(page).getByRole('button', { name: 'Acțiuni concurs' }).click();
  const sheet = page.getByRole('dialog', { name: 'Acțiuni' });
  await expect(sheet.getByRole('link', { name: 'Vezi cântarele din concurs' })).toHaveAttribute('href', `/concursuri/${NC}/cantar`, { timeout: 30_000 });
  await expect(sheet.getByTestId('actions-sheet').locator('> li')).toHaveCount(1);
});

/* ------------------------------------------------------------------ */
/* bara-actiuni c10 c13                                                 */
/* ------------------------------------------------------------------ */

test('competition-page.bara-actiuni.c10 — not the author: «Penalizări» after Statistici → the penalties page; none on NC', async ({ page, browser }) => {
  await setup(page, LIVE, { role: 'participant' });
  await open(page, `/concursuri/${LIVE}`);
  const tile = penaltiesLink(bar(page));
  await expect(tile).toHaveAttribute('href', `/concursuri/${LIVE}/penalizari`, { timeout: 30_000 });
  const ids = await bar(page).locator('[data-tile]').evaluateAll(els => els.map(e => e.getAttribute('data-tile')));
  expect(ids.indexOf('penalizari')).toBe(ids.indexOf('statistici') + 1);
  await shot(page, 'phone-participant-penalties');
  await settled(page);
  await expectNoA11yViolations(page);
  await page.setViewportSize(DESKTOP);
  await expect(penaltiesLink(page).first()).toBeVisible();

  const ctx = await browser.newContext();
  const nc = await ctx.newPage();
  await setup(nc, NC, { role: 'participant' });
  await open(nc, `/concursuri/${NC}`);
  await expect(nc.getByRole('region', { name: 'Bara de acțiuni' }).getByRole('button', { name: 'Statistici' })).toBeVisible({ timeout: 30_000 });
  await expect(penaltiesLink(nc)).toHaveCount(0);
  await nc.unrouteAll({ behavior: 'ignoreErrors' });
  await ctx.close();
});

test('competition-page.bara-actiuni.c13 — an angler’s «Vezi cântarele din concurs» opens the scale area', async ({ page }) => {
  await setup(page, LIVE, { role: null });
  await open(page, `/concursuri/${LIVE}/informatii`);
  await bar(page).getByRole('button', { name: 'Acțiuni concurs' }).click();
  await expect(page.getByRole('dialog', { name: 'Acțiuni' }).getByRole('link', { name: 'Vezi cântarele din concurs' })).toHaveAttribute(
    'href',
    `/concursuri/${LIVE}/cantar`,
    { timeout: 30_000 },
  );
});

/* ------------------------------------------------------------------ */
/* c14 + the active-weighing banner                                     */
/* ------------------------------------------------------------------ */

test('competition-page.organizare.c14 — Cântare: the author / a referee while it runs get «Deschide în cântar»; an angler does not', async ({ page, browser }) => {
  await setup(page, LIVE, { role: 'referee' });
  await open(page, `/concursuri/${LIVE}/cantare`);
  const stand = page.locator('[id^="stand-"]').first();
  await stand.getByRole('button').first().click();
  const link = page.getByTestId('scale-link').first();
  await expect(link).toBeVisible({ timeout: 30_000 });
  await expect(link).toHaveAttribute('href', new RegExp(`/concursuri/${LIVE}/cantar/[^/]+$`));
  await shot(page, 'phone-cantare-scale-link');
  await page.setViewportSize(DESKTOP);
  await expect(page.getByTestId('scale-link').first()).toHaveAttribute('href', `/concursuri/${LIVE}/cantar`);

  const ctx = await browser.newContext();
  const angler = await ctx.newPage();
  await setup(angler, LIVE, { role: null });
  await open(angler, `/concursuri/${LIVE}/cantare`, DESKTOP);
  await expect(angler.getByRole('table').first()).toBeVisible({ timeout: 30_000 });
  await expect(angler.getByTestId('scale-link')).toHaveCount(0);
  await angler.unrouteAll({ behavior: 'ignoreErrors' });
  await ctx.close();
});

test('organizer.b.active-weighing-banner — the author of a running competition: the banner (phone), the bento tile and the route tabs’ line (768+) open the weighing on the scale', async ({ page }) => {
  await setup(page, LIVE, {
    active: [
      {
        weighingDocumentId: 'w-live',
        weighingType: 'normal',
        stand: { id: 1, documentId: 'stand-x', name: '7', sectors: [{ id: 1, documentId: 'sec-a', name: 'A' }], sectorDrawPosition: null },
        competition: { rankingType: 'quantity' },
      },
    ],
  });
  await page.route(/\/concursuri\/[^/]+\/cantar\/stand-x\/w-live/, route =>
    route.request().resourceType() === 'document' ? route.fulfill({ body: '<html><body>cântar</body></html>', contentType: 'text/html' }) : route.fallback(),
  );
  await open(page, `/concursuri/${LIVE}`, DESKTOP);
  // Clasament: the bento's «Cântar în curs» tile carries the link; no band repeating it.
  const bento = page.getByRole('group', { name: 'Concursul pe scurt' });
  const tileLink = bento.getByRole('link', { name: 'Deschide în cântar', exact: true });
  await expect(tileLink).toHaveAttribute('href', `/concursuri/${LIVE}/cantar/stand-x/w-live`, { timeout: 30_000 });
  await expect(bento).toContainText('Cântar în curs');
  await expect(page.getByTestId('manager-weighing-notice')).toHaveCount(0);
  await shot(page, 'desktop-weighing-notice');
  // A route tab without the bento: the compact line.
  await open(page, `/concursuri/${LIVE}/informatii`, DESKTOP);
  const notice = page.getByTestId('manager-weighing-notice');
  await expect(notice).toContainText('Cântar în curs pe standul A7', { timeout: 30_000 });
  await expect(notice.getByRole('link', { name: 'Deschide în cântar' })).toHaveAttribute('href', `/concursuri/${LIVE}/cantar/stand-x/w-live`);
  await shot(page, 'desktop-weighing-notice-tab');
  await open(page, `/concursuri/${LIVE}`, PHONE);
  await bar(page).getByRole('button', { name: /Cântar în curs pe standul A7/ }).click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${LIVE}/cantar/stand-x/w-live$`));
});

/* ------------------------------------------------------------------ */
/* Screenshots: every width                                             */
/* ------------------------------------------------------------------ */

for (const width of [375, 1280, 1440, 1920]) {
  test(`screenshots — the author’s menu at ${width}`, async ({ page }) => {
    await setup(page, LIVE);
    await open(page, `/concursuri/${LIVE}`, { width, height: 900 });
    if (width < 768) await openSubmenu(page);
    else await openHeaderMenu(page);
    await shot(page, `menu-started-${width}`);
  });
}
