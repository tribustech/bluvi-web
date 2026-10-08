import { mkdirSync } from 'node:fs';
import { expect, test, type Locator, type Page, type Request, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * Concurs · Participanți for its author (parity competition-page.participanti-organizator c1–c10,
 * competition-page.participanti.c2, participant.b.organizer-edit-registration, the «Editează» half of
 * participant.register-guests.c15; fish components/competition/RegistrationsList.tsx,
 * ExpandableRegistration.tsx, CollapsableActions.tsx, services/mutations/useRegistrationsList.tsx).
 *
 * READS hit the local CMS: «SIM3 Cupa C&B Ed 8» (notStarted, team, authored by the QA user, 20 guest
 * crews), its completed twin, and «Feeder E2E 085047» (notStarted, individual, 6 guests). WRITES NEVER
 * DO: accepting / rejecting / moving a registration e-mails and pushes real users, so every non-GET
 * to the browser's CMS edge is aborted by a catch-all route, and the three status PATCHes are answered
 * by page.route with their method and path asserted. States the local data lacks (pending, rejected,
 * account holders, phones, deleted accounts, an empty list) are made by editing the list read on its
 * way to the page.
 */

test.describe.configure({ timeout: 180_000, retries: 1 });

const TEAM = process.env.E2E_REG_TEAM ?? 'a6xjl65ooe9eadrtvvqj9hn1'; // SIM3 Cupa C&B Ed 8 · notStarted · team · QA author
const DONE = process.env.E2E_REG_DONE ?? 'rg340d4r4gnwf2mbyhxvasnr'; // SIM3 Cupa C&B Ed 8 · completed · team · QA author
const SINGLE = process.env.E2E_REG_SINGLE ?? 'ct0f8s742qd63eqt8oya75ws'; // Feeder E2E 085047 · notStarted · individual · QA author

const PHONE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1000 };
const DESKTOP = { width: 1440, height: 900 };
const WIDTHS = [375, 1280, 1440, 1920];

let jwt = '';
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  mkdirSync('.shots', { recursive: true });
});

type Reg = {
  id: number;
  documentId: string;
  registrationStatus: string;
  teamName: string | null;
  guestName?: string | null;
  participants?: { id: number; documentId: string; username: string | null; avatar?: { url: string } | null }[];
  stand?: { id: number; documentId: string; name: string } | null;
  author?: { id: number; documentId: string; username?: string | null; phone?: string | null } | null;
  club?: { name: string } | null;
};

const path = (url: string) => new URL(url).pathname;
const isCms = (r: Request) => path(r.url()).startsWith('/api/cms/');
const page$ = (id: string, filtru?: string) => `/concursuri/${id}/participanti${filtru ? `?filtru=${filtru}` : ''}`;
const listPath = (id: string) => `/api/cms/competitions/${id}/registrations`;
const competitionPath = (id: string) => `/api/cms/feed/competitions/${id}`;
const statutePath = (id: string) => `/api/cms/user/profile/competition/${id}/statute`;

type Watch = { writes: string[]; reads: string[] };
/** The anglers' stats batch is a read sent as POST (the person popover). */
const isBatchRead = (url: string) => path(url) === '/api/cms/user/statistics/batch';

/** The real list, read once per spec (the QA user's JWT; GET only). */
const real = new Map<string, Reg[]>();
async function realList(page: Page, id: string): Promise<Reg[]> {
  if (!real.has(id)) {
    const res = await page.request.get(`${CMS}/competitions/${id}/registrations`, { headers: { Authorization: `Bearer ${jwt}` } });
    expect(res.ok()).toBe(true);
    real.set(id, (await res.json()) as Reg[]);
  }
  return structuredClone(real.get(id)!);
}

async function open(
  page: Page,
  id: string,
  {
    filtru,
    viewport = PHONE,
    list,
    gate,
    status,
  }: {
    filtru?: string;
    viewport?: { width: number; height: number };
    /** Edits the list read (the real one in, the page's out). */
    list?: (regs: Reg[]) => Reg[];
    /** Holds the list read until it resolves. */
    gate?: Promise<void>;
    /** Answers each status PATCH (default 200). */
    status?: (route: Route) => Promise<void>;
  } = {},
) {
  await signIn(page.context(), jwt);
  await page.setViewportSize(viewport);
  const watch: Watch = { writes: [], reads: [] };
  page.on('request', r => {
    if (!isCms(r)) return;
    if (r.method() !== 'GET' && !isBatchRead(r.url())) watch.writes.push(`${r.method()} ${path(r.url())}`);
    else watch.reads.push(path(r.url()));
  });
  // Registered first: later routes win. Every write no test answers is aborted.
  await page.route(
    url => url.pathname.startsWith('/api/cms/'),
    route => (route.request().method() === 'GET' || isBatchRead(route.request().url()) ? route.fallback() : route.abort()),
  );
  await page.route(
    url => /^\/api\/cms\/registrations\/[^/]+\/(accept|reject|pending)$/.test(url.pathname),
    async route => {
      if (route.request().method() !== 'PATCH') return route.abort();
      if (status) return status(route);
      return route.fulfill({ status: 200, json: { message: 'ok' } });
    },
  );
  await page.route(
    url => url.pathname === listPath(id),
    async route => {
      if (gate) await gate;
      const regs = await realList(page, id);
      await route.fulfill({ json: list ? list(regs) : regs });
    },
  );
  const errors = collectConsoleErrors(page, { ignore: /Failed to load resource: the server responded with a status of (500|400)|net::ERR_FAILED/ });
  await page.goto(page$(id, filtru));
  return { watch, errors };
}

const section = (page: Page) => page.getByRole('region', { name: 'Înscrieri' });
const filters = (page: Page) => page.getByRole('radiogroup', { name: 'Filtrează înscrierile' });
const filter = (page: Page, label: string) => filters(page).getByRole('radio', { name: new RegExp(`^${label}`) });
/** Picks a filter as a reader does: a click on its segment (the radio itself is visually hidden). */
const pick = (page: Page, key: 'all' | 'pending' | 'registered' | 'rejected') => filters(page).locator(`[data-filter="${key}"]`).click();
const cards = (page: Page) => page.locator('[data-registrations="cards"] > li > article');
const card = (page: Page, name: string) => page.locator('[data-registrations="cards"] article').filter({ has: page.getByText(name, { exact: true }) });
const tableRows = (page: Page) => page.locator('[data-registrations="table"] tbody tr');
const tableRow = (page: Page, name: string) => tableRows(page).filter({ has: page.getByText(name, { exact: true }) });
const noWrites = (watch: Watch) => expect(watch.writes, 'no real organizer writes').toEqual([]);
const count = (watch: Watch, p: string) => watch.reads.filter(r => r === p).length;

async function loaded(page: Page) {
  const ready = filters(page);
  const ok = await ready.waitFor({ timeout: 30_000 }).then(
    () => true,
    () => false,
  );
  if (!ok) await page.reload();
  await expect(ready).toBeVisible({ timeout: 30_000 });
}

async function shoot(page: Page, name: string, widths = WIDTHS) {
  const size = page.viewportSize();
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `.shots/participanti-org-${name}-${width}.png`, fullPage: true });
  }
  if (size) await page.setViewportSize(size);
}

/** Toggles a phone card open. */
async function expand(page: Page, name: string): Promise<Locator> {
  const c = card(page, name);
  const toggle = c.locator('button[aria-expanded]');
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await expect(c.getByRole('list', { name: 'Acțiuni' })).toBeVisible();
  return c;
}

const user = (n: number, username: string | null, avatar: string | null = null) => ({ id: 9000 + n, documentId: `e2e-user-${n}`, username, avatar: avatar ? { url: avatar } : null });
const author = (phone: string | null) => ({ id: 1, documentId: 'e2e-author', username: 'Autor', phone });

/**
 * The individual list remade with every status and kind: on stands 3 and 1 approved, unallocated
 * pending first, a rejected one on stand 2, an unallocated rejected one last (fish c3); guests, an
 * account holder with a phone, a deleted account.
 */
function mixedSingle(regs: Reg[]): Reg[] {
  const [a, b, c, d, e, f] = regs;
  return [
    { ...a, registrationStatus: 'rejected', stand: null, guestName: 'Respins Nealocat' },
    { ...b, registrationStatus: 'registered', guestName: null, participants: [user(1, 'Ion Pescaru')], author: author('+40 712 000 111') },
    { ...c, registrationStatus: 'pending', stand: null, guestName: 'Gigel Așteaptă' },
    { ...d, registrationStatus: 'rejected', guestName: 'Respins Pe Stand' },
    { ...e, registrationStatus: 'registered', guestName: null, participants: [user(2, null)], author: null },
    { ...f, registrationStatus: 'pending', guestName: 'Vasile Nou', author: author(null) },
  ].map((r, i) => ({ ...r, stand: r.stand === null ? null : { id: 100 + i, documentId: `e2e-stand-${i}`, name: String([0, 3, 0, 2, 1, 4][i]) } }));
}

/* ------------------------------------------------------------------ */

test('competition-page.participanti.c2 — the author sees the organizer list, not the public roster nor the old notice; axe', async ({ page }) => {
  const { watch, errors } = await open(page, TEAM, { viewport: DESKTOP });
  await loaded(page);
  await expect(section(page)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Ești organizatorul acestui concurs' })).toHaveCount(0);
  await expect(page.getByText('Gestionează în aplicație')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Echipe înscrise|Participanți înscriși/ })).toHaveCount(0);
  await expect(tableRows(page)).toHaveCount((await realList(page, TEAM)).length);
  await expectNoA11yViolations(page);
  await page.setViewportSize(PHONE);
  await expect(cards(page).first()).toBeVisible();
  await expectNoA11yViolations(page);
  noWrites(watch);
  expect(errors).toEqual([]);
});

test('competition-page.participanti-organizator.c1 — every registration, the skeleton while the list loads', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(r => (release = r));
  const { watch } = await open(page, TEAM, { gate });
  await expect(page.getByRole('status').filter({ hasText: 'Se încarcă înscrierile…' })).toBeAttached({ timeout: 30_000 });
  await expect(page.locator('[data-bone="registration"]').first()).toBeVisible();
  await expect(filters(page)).toHaveCount(0);
  await shoot(page, 'loading');
  release();
  await loaded(page);
  const all = await realList(page, TEAM);
  await expect(cards(page)).toHaveCount(all.length);
  await expect(section(page).getByText(`${all.length} de echipe înscrise`)).toBeVisible();
  await shoot(page, 'team');
  noWrites(watch);
});

test('competition-page.participanti-organizator.c2 — Toți · În așteptare · Aprobați · Respinși with counts; pending always coloured; ?filtru= in and out', async ({ page }) => {
  const { watch } = await open(page, SINGLE, { list: mixedSingle, filtru: 'in-asteptare' });
  await loaded(page);
  // A real segmented control (owner rule 20): one radiogroup, four radios, the URL's filter selected.
  await expect(filters(page).getByRole('radio')).toHaveCount(4);
  await expect(filter(page, 'În așteptare')).toBeChecked();
  for (const [key, n] of [['all', 6], ['pending', 2], ['registered', 2], ['rejected', 2]] as const) {
    await expect(filters(page).locator(`[data-filter="${key}"] [data-count]`)).toHaveText(String(n));
  }
  await expect(cards(page)).toHaveCount(2);
  await shoot(page, 'pending');
  // Unselected, the pending count keeps its colour; the others are neutral.
  await pick(page, 'all');
  await expect(page).toHaveURL(new RegExp(`/concursuri/${SINGLE}/participanti$`));
  await expect(filter(page, 'Toți')).toBeChecked();
  const bg = (label: string) => filters(page).locator(`[data-filter="${label}"] [data-count]`).evaluate(el => getComputedStyle(el).backgroundColor);
  expect(await bg('pending')).not.toBe(await bg('registered'));
  expect(await bg('registered')).toBe(await bg('rejected'));
  await expect(cards(page)).toHaveCount(6);
  // Keyboard: the arrows move the selection, the URL follows.
  await filter(page, 'Toți').focus();
  await page.keyboard.press('ArrowRight');
  await expect(filter(page, 'În așteptare')).toBeChecked();
  await page.keyboard.press('ArrowRight');
  await expect(filter(page, 'Aprobați')).toBeChecked();
  await expect(page).toHaveURL(/\?filtru=aprobati$/);
  await expect(cards(page)).toHaveCount(2);
  await pick(page, 'rejected');
  await expect(page).toHaveURL(/\?filtru=respinsi$/);
  // Reloaded, the URL's filter comes back; an unknown one is Toți.
  await page.reload();
  await loaded(page);
  await expect(filter(page, 'Respinși')).toBeChecked();
  await page.goto(page$(SINGLE, 'orice'));
  await loaded(page);
  await expect(filter(page, 'Toți')).toBeChecked();
  noWrites(watch);
});

test('competition-page.participanti-organizator.c3 c5 — by stand: unallocated first, unallocated rejected last; names, stands, status icons with words', async ({ page }) => {
  const { watch } = await open(page, SINGLE, { list: mixedSingle });
  await loaded(page);
  const names = await cards(page).evaluateAll(els => els.map(e => e.getAttribute('aria-label')));
  expect(names).toEqual(['Gigel Așteaptă', 'Cont șters', 'Respins Pe Stand', 'Ion Pescaru', 'Vasile Nou', 'Respins Nealocat']);
  const row = card(page, 'Gigel Așteaptă');
  await expect(row.getByText('Nealocat')).toBeVisible();
  await expect(row.getByRole('img', { name: 'În așteptare' })).toBeVisible();
  await expect(card(page, 'Ion Pescaru').getByText('Stand 3')).toBeVisible();
  await expect(card(page, 'Ion Pescaru').getByRole('img', { name: 'Aprobat' })).toBeVisible();
  await expect(card(page, 'Respins Nealocat').getByRole('img', { name: 'Respins' })).toBeVisible();
  // Desktop: the same order, the status in words.
  await page.setViewportSize(DESKTOP);
  const rows = await tableRows(page).evaluateAll(els => els.map(e => e.querySelector('td:nth-child(2) .t-body-strong')?.textContent));
  expect(rows).toEqual(['Gigel Așteaptă', 'Cont șters', 'Respins Pe Stand', 'Ion Pescaru', 'Vasile Nou', 'Respins Nealocat']);
  await expect(tableRow(page, 'Respins Pe Stand').locator('[data-status="rejected"]')).toHaveText('Respins');
  await shoot(page, 'mixed');
  noWrites(watch);
});

test('competition-page.participanti-organizator.c5 — a team: «Echipa: …» with its members, the faces; without a team name the members', async ({ page }) => {
  const { watch } = await open(page, TEAM, {
    list: regs => [
      { ...regs[0], teamName: 'Crapii E2E', guestName: null, participants: [user(1, 'Ion E2E'), user(2, 'Ana E2E'), user(3, 'Dan E2E'), user(4, 'Ilie E2E')] },
      { ...regs[1], teamName: null, guestName: null, participants: [user(5, 'Mara E2E'), user(6, null)] },
      ...regs.slice(2),
    ],
  });
  await loaded(page);
  const team = card(page, 'Echipa: Crapii E2E');
  await expect(team.getByText('Ion E2E, Ana E2E, Dan E2E, Ilie E2E')).toBeVisible();
  // Two faces and «+2» (four members).
  await expect(team.getByText('+2')).toBeVisible();
  await expect(card(page, 'Mara E2E, Cont șters')).toBeVisible();
  // A guest crew: «Echipa: …» + the typed-in names.
  const guests = (await realList(page, TEAM))[2];
  await expect(card(page, `Echipa: ${guests.teamName!.trim()}`).getByText(guests.guestName!.trim(), { exact: true })).toBeVisible();
  noWrites(watch);
});

test('competition-page.participanti-organizator.c4 — no registrations; a filter without matches', async ({ page }) => {
  const { watch } = await open(page, SINGLE, { list: () => [] });
  await loaded(page);
  await expect(page.getByText('Nu există înregistrări pentru această competiție.')).toBeVisible();
  await shoot(page, 'empty');
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const second = await open(page, SINGLE, { list: regs => regs.map(r => ({ ...r, registrationStatus: 'registered' })), filtru: 'respinsi' });
  await loaded(page);
  await expect(page.getByTestId('registrations-filter-empty')).toHaveText('Nu există înregistrări cu acest status.');
  await shoot(page, 'filter-empty');
  noWrites(watch);
  noWrites(second.watch);
});

test('competition-page.participanti-organizator.c6 participant.b.organizer-edit-registration participant.register-guests.c15 — «Editează»: guests → the guests form, accounts → the form in organizer mode; never for rejected', async ({ page }) => {
  const { watch } = await open(page, SINGLE, { list: mixedSingle });
  await loaded(page);
  const guest = await expand(page, 'Gigel Așteaptă');
  const guestId = mixedSingle(await realList(page, SINGLE))[2].documentId;
  await expect(guest.getByRole('link', { name: 'Editează' })).toHaveAttribute('href', `/concursuri/${SINGLE}/inscriere/fara-cont?inscriere=${guestId}`);
  await shoot(page, 'expanded', [375]);
  const account = await expand(page, 'Ion Pescaru');
  const accountId = mixedSingle(await realList(page, SINGLE))[1].documentId;
  await expect(account.getByRole('link', { name: 'Editează' })).toHaveAttribute('href', `/concursuri/${SINGLE}/inscriere?organizator=1&inscriere=${accountId}`);
  const rejected = await expand(page, 'Respins Pe Stand');
  await expect(rejected.getByRole('link', { name: 'Editează' })).toHaveCount(0);
  // Desktop: the same links inline.
  await page.setViewportSize(DESKTOP);
  await expect(tableRow(page, 'Ion Pescaru').getByRole('link', { name: 'Editează — Ion Pescaru' })).toHaveAttribute('href', `/concursuri/${SINGLE}/inscriere?organizator=1&inscriere=${accountId}`);
  await expect(tableRow(page, 'Respins Nealocat').getByRole('link', { name: /Editează/ })).toHaveCount(0);
  // Following it opens the registration form (the organizer's edit, M5).
  await tableRow(page, 'Gigel Așteaptă').getByRole('link', { name: 'Editează — Gigel Așteaptă' }).click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${SINGLE}/inscriere/fara-cont\\?inscriere=${guestId}$`));
  noWrites(watch);
});

test('competition-page.participanti-organizator.c6 c8 — completed: only «Apelează» (no Editează, no status change)', async ({ page }) => {
  const { watch } = await open(page, DONE);
  await loaded(page);
  const first = (await realList(page, DONE))[0];
  const name = `Echipa: ${first.teamName!.trim()}`;
  const c = await expand(page, name);
  await expect(c.getByRole('list', { name: 'Acțiuni' }).getByRole('listitem')).toHaveCount(1);
  await expect(c.getByRole('button', { name: 'Apelează' })).toBeVisible();
  await page.setViewportSize(DESKTOP);
  const row = tableRow(page, name);
  await expect(row.getByRole('group').locator('a:visible, button:visible')).toHaveCount(1);
  noWrites(watch);
});

test('competition-page.participanti-organizator.c7 — «Apelează»: tel: + contact_pressed; without a phone «Număr de telefon invalid»', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __events: { name: string; params: Record<string, unknown> }[] };
    w.__events = [];
    window.addEventListener('bluvi:analytics', e => w.__events.push((e as CustomEvent).detail));
  });
  const { watch } = await open(page, SINGLE, { list: mixedSingle });
  await loaded(page);
  const withPhone = await expand(page, 'Ion Pescaru');
  const call = withPhone.getByRole('link', { name: 'Apelează' });
  await expect(call).toHaveAttribute('href', 'tel:+40712000111');
  // The tel: navigation is the OS's: dispatch the click without following it.
  await call.evaluate(a => a.addEventListener('click', e => e.preventDefault(), { once: true }));
  await call.click();
  const events = await page.evaluate(() => (window as unknown as { __events: { name: string; params: Record<string, unknown> }[] }).__events);
  expect(events).toContainEqual({
    name: 'contact_pressed',
    params: { contact_type: 'Organizer registrant contact', competition_id: SINGLE, competition_name: expect.any(String) },
  });
  for (const name of ['Vasile Nou', 'Cont șters']) {
    const c = await expand(page, name);
    await c.getByRole('button', { name: 'Apelează' }).click();
    await expect(page.getByText('Număr de telefon invalid')).toBeVisible();
  }
  noWrites(watch);
});

test('competition-page.participanti-organizator.c8 — before the start: the actions each status allows, with fish’s confirmations; «Închide» changes nothing', async ({ page }) => {
  const { watch } = await open(page, SINGLE, { list: mixedSingle });
  await loaded(page);
  const labels = async (name: string) => (await expand(page, name)).getByRole('list', { name: 'Acțiuni' }).getByRole('listitem').allInnerTexts();
  expect(await labels('Gigel Așteaptă')).toEqual(['Editează', 'Apelează', 'Respinge', 'Aprobă']);
  expect(await labels('Ion Pescaru')).toEqual(['Editează', 'Apelează', 'Mută în așteptare', 'Elimină']);
  expect(await labels('Respins Pe Stand')).toEqual(['Apelează', 'Mută în așteptare', 'Aprobă']);
  const dialogs: [string, string, string, string, string][] = [
    ['Gigel Așteaptă', 'Respinge', 'Respinge', 'Ești sigur că vrei să respingi cererea de participare la concurs?', 'Respinge'],
    ['Gigel Așteaptă', 'Aprobă', 'Acceptă înregistrarea', 'Ești sigur că vrei să aprobi cererea de participare la concurs?', 'Acceptă'],
    ['Ion Pescaru', 'Elimină', 'Elimină', 'Ești sigur că vrei să elimini participantul?', 'Elimină'],
    ['Ion Pescaru', 'Mută în așteptare', 'Mută în lista de așteptare', 'Ești sigur că vrei să muți participantul înapoi în lista de așteptare?', 'Mută'],
  ];
  for (const [name, action, title, question, confirm] of dialogs) {
    const c = card(page, name);
    await expand(page, name);
    await c.getByRole('button', { name: action, exact: true }).click();
    const dialog = page.getByRole('alertdialog', { name: title });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(question)).toBeVisible();
    await expect(dialog.getByRole('button', { name: confirm, exact: true })).toBeVisible();
    if (action === 'Aprobă') await shoot(page, 'confirm', [375, 1440]);
    await dialog.getByRole('button', { name: 'Închide' }).click();
    await expect(dialog).toHaveCount(0);
  }
  noWrites(watch);
  // Desktop: the same, inline, with the row's name in each action's accessible name.
  await page.setViewportSize(DESKTOP);
  await expect(tableRow(page, 'Gigel Așteaptă').getByRole('button', { name: 'Aprobă — Gigel Așteaptă' })).toBeVisible();
  await expect(tableRow(page, 'Ion Pescaru').getByRole('button', { name: 'Elimină — Ion Pescaru' })).toBeVisible();
  await expect(tableRow(page, 'Ion Pescaru').getByRole('button', { name: /Aprobă/ })).toHaveCount(0);
  await expectNoA11yViolations(page);
});

test('competition-page.participanti-organizator.c9 — each status change: the PATCH (mocked), the row collapses and moves, the competition re-read', async ({ page }) => {
  const writes: { method: string; path: string; body: string | null }[] = [];
  const { watch } = await open(page, SINGLE, {
    list: mixedSingle,
    filtru: 'in-asteptare',
    status: async route => {
      const r = route.request();
      writes.push({ method: r.method(), path: path(r.url()), body: r.postData() });
      await route.fulfill({ status: 200, json: {} });
    },
  });
  await loaded(page);
  const ids = mixedSingle(await realList(page, SINGLE)).map(r => r.documentId);
  const competitionReads = count(watch, competitionPath(SINGLE));
  // Approve the pending guest: PATCH /registrations/:id/accept, no body.
  const c = await expand(page, 'Gigel Așteaptă');
  await c.getByRole('button', { name: 'Aprobă', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Acceptă' }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toEqual({ method: 'PATCH', path: `/api/cms/registrations/${ids[2]}/accept`, body: null });
  await expect(page.getByText('Înregistrare acceptată cu succes.')).toBeVisible();
  // Out of «În așteptare» at once (optimistic), the counts with it.
  await expect(card(page, 'Gigel Așteaptă')).toHaveCount(0);
  await expect(filters(page).locator('[data-filter="pending"] [data-count]')).toHaveText('1');
  await expect(filters(page).locator('[data-filter="registered"] [data-count]')).toHaveText('3');
  await expect.poll(() => count(watch, competitionPath(SINGLE))).toBeGreaterThan(competitionReads);
  // Reject the other pending one.
  const v = await expand(page, 'Vasile Nou');
  await v.getByRole('button', { name: 'Respinge', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Respinge' }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1]).toEqual({ method: 'PATCH', path: `/api/cms/registrations/${ids[5]}/reject`, body: null });
  await expect(page.getByTestId('registrations-filter-empty')).toBeVisible();
  // Desktop: move an approved one back to the waiting list.
  await page.setViewportSize(DESKTOP);
  await pick(page, 'registered');
  await tableRow(page, 'Ion Pescaru').getByRole('button', { name: 'Mută în așteptare — Ion Pescaru' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Mută', exact: true }).click();
  await expect.poll(() => writes.length).toBe(3);
  expect(writes[2]).toEqual({ method: 'PATCH', path: `/api/cms/registrations/${ids[1]}/pending`, body: null });
  await expect(tableRow(page, 'Ion Pescaru')).toHaveCount(0);
  // The phone row of a changed registration is closed again.
  await page.setViewportSize(PHONE);
  await pick(page, 'all');
  await expect(card(page, 'Gigel Așteaptă').getByRole('button').first()).toHaveAttribute('aria-expanded', 'false');
  expect(watch.writes.filter(w => !/\/registrations\/[^/]+\/(accept|reject|pending)$/.test(w))).toEqual([]);
});

test('competition-page.participanti-organizator.c9 — a failed change rolls the row back and says so', async ({ page }) => {
  const { watch } = await open(page, SINGLE, { list: mixedSingle, status: route => route.fulfill({ status: 500, json: { error: { status: 500, message: 'boom' } } }) });
  await loaded(page);
  const c = await expand(page, 'Gigel Așteaptă');
  await c.getByRole('button', { name: 'Aprobă', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Acceptă' }).click();
  await expect(page.getByText('Nu s-a putut actualiza înscrierea. Încearcă din nou.')).toBeVisible();
  await expect(card(page, 'Gigel Așteaptă').getByRole('img', { name: 'În așteptare' })).toBeVisible();
  expect(watch.writes.every(w => w.endsWith('/accept'))).toBe(true);
});

test('competition-page.participanti-organizator.c10 — «Actualizează» re-reads the list, the competition and the statute', async ({ page }) => {
  const { watch } = await open(page, TEAM);
  await loaded(page);
  // The first reads settled (an invalidation during an in-flight read is folded into it).
  await expect.poll(() => count(watch, statutePath(TEAM))).toBeGreaterThan(0);
  await page.waitForTimeout(1500);
  const before = [count(watch, listPath(TEAM)), count(watch, competitionPath(TEAM)), count(watch, statutePath(TEAM))];
  await section(page).getByRole('button', { name: 'Actualizează' }).click();
  await expect.poll(() => count(watch, listPath(TEAM))).toBeGreaterThan(before[0]);
  await expect.poll(() => count(watch, competitionPath(TEAM))).toBeGreaterThan(before[1]);
  await expect.poll(() => count(watch, statutePath(TEAM))).toBeGreaterThan(before[2]);
  noWrites(watch);
});

test('competition-page.participanti-organizator — desktop roster (owner rules 14, 17, 18): a table with every action inline; a person opens the popover → /pescari/[id]', async ({ page }) => {
  const { watch, errors } = await open(page, SINGLE, { list: mixedSingle, viewport: DESKTOP });
  await loaded(page);
  await expect(page.locator('[data-registrations="cards"]')).toBeHidden();
  const table = page.locator('[data-registrations="table"]');
  await expect(table.getByRole('columnheader')).toHaveText(['Stand', 'Participant', 'Status', 'Acțiuni']);
  // No expand: the actions are on the row.
  await expect(tableRow(page, 'Gigel Așteaptă').getByRole('button', { name: 'Respinge — Gigel Așteaptă' })).toBeVisible();
  const person = tableRow(page, 'Ion Pescaru').getByRole('button', { name: 'Ion Pescaru', exact: true });
  await person.click();
  const pop = page.getByRole('dialog', { name: 'Ion Pescaru' });
  await expect(pop).toBeVisible();
  await expect(pop.getByRole('link', { name: 'Vezi profilul' })).toHaveAttribute('href', '/pescari/e2e-user-1');
  await shoot(page, 'popover', [1280, 1440, 1920]);
  await page.keyboard.press('Escape');
  await expect(pop).toHaveCount(0);
  await expect(person).toBeFocused();
  // A guest is not a person to open.
  await expect(tableRow(page, 'Gigel Așteaptă').getByRole('button', { name: /^Gigel/ })).toHaveCount(0);
  // 768–1023: the cards (the table from 1024).
  await page.setViewportSize(TABLET);
  await expect(cards(page).first()).toBeVisible();
  await expect(table).toBeHidden();
  noWrites(watch);
  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ */
/* Review fixes: popover stats, CMS refusals, hook-level toasts, focus, slots, desktop call */

/** Ion Pescaru (an account) pending instead of approved. */
const ionPending = (regs: Reg[]) => mixedSingle(regs).map(r => (r.participants?.[0]?.documentId === 'e2e-user-1' ? { ...r, registrationStatus: 'pending' } : r));

test('competition-page.participanti-organizator — the person popover of a pending account holder: his real stats, never made-up zeros', async ({ page }) => {
  const asked: string[][] = [];
  const { watch } = await open(page, SINGLE, { list: ionPending, viewport: DESKTOP });
  await page.route(
    url => url.pathname === '/api/cms/user/statistics/batch',
    async route => {
      const ids = (JSON.parse(route.request().postData() ?? '{}') as { documentIds: string[] }).documentIds;
      asked.push(ids);
      await route.fulfill({ json: { data: Object.fromEntries(ids.filter(i => i === 'e2e-user-1').map(i => [i, { catches: 312, biggestCatchKg: 18.4, competitions: 41 }])) } });
    },
  );
  await loaded(page);
  await tableRow(page, 'Ion Pescaru').getByRole('button', { name: 'Ion Pescaru', exact: true }).click();
  const pop = page.getByRole('dialog', { name: 'Ion Pescaru' });
  await expect(pop).toBeVisible();
  await expect(pop.getByText('312', { exact: true })).toBeVisible();
  await expect(pop.getByText('41', { exact: true })).toBeVisible();
  expect(asked.flat()).toContain('e2e-user-1');
  await page.keyboard.press('Escape');
  noWrites(watch);
});

test('competition-page.participanti-organizator — an account missing from the stats batch shows no stats at all', async ({ page }) => {
  const { watch } = await open(page, SINGLE, { list: ionPending, viewport: DESKTOP });
  await page.route(
    url => url.pathname === '/api/cms/user/statistics/batch',
    route => route.fulfill({ json: { data: {} } }),
  );
  await loaded(page);
  await tableRow(page, 'Ion Pescaru').getByRole('button', { name: 'Ion Pescaru', exact: true }).click();
  const pop = page.getByRole('dialog', { name: 'Ion Pescaru' });
  await expect(pop).toBeVisible();
  await expect(pop.getByRole('link', { name: 'Vezi profilul' })).toBeVisible();
  await expect(pop.getByText('Capturi')).toHaveCount(0);
  await expect(pop.getByText('Concursuri')).toHaveCount(0);
  noWrites(watch);
});

test('competition-page.participanti-organizator.c9 — a refusal the CMS explains (400 + bluCode) says why, not «try again»', async ({ page }) => {
  const answers = [
    { message: 'Numarul maxim de participanti a fost atins.', bluCode: 'REGISTRATION:PARTICIPANTS_LIMIT_EXCEEDED', shown: 'Numărul maxim de participanți a fost atins.' },
    { message: 'Nu poti accepta o inregistrare la o competitie care deja a început.', bluCode: 'REGISTRATION:COMPETITION_STATUS_NOT_STARTED', shown: 'Concursul a început; înscrierile nu mai pot fi schimbate.' },
    { message: 'Altă problemă explicată de CMS.', bluCode: 'REGISTRATION:SOMETHING_NEW', shown: 'Altă problemă explicată de CMS.' },
  ];
  let n = 0;
  const writes: string[] = [];
  const { watch } = await open(page, SINGLE, {
    list: mixedSingle,
    status: async route => {
      const a = answers[n++];
      writes.push(`${route.request().method()} ${path(route.request().url())}`);
      await route.fulfill({ status: 400, json: { data: null, error: { status: 400, name: 'BadRequestError', message: a.message, details: { bluCode: a.bluCode } } } });
    },
  });
  await loaded(page);
  for (const a of answers) {
    const c = await expand(page, 'Gigel Așteaptă');
    await c.getByRole('button', { name: 'Aprobă', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Acceptă' }).click();
    await expect(page.getByText(a.shown, { exact: true })).toBeVisible();
    await expect(page.getByText('Nu s-a putut actualiza înscrierea. Încearcă din nou.')).toHaveCount(0);
    // Rolled back.
    await expect(card(page, 'Gigel Așteaptă').getByRole('img', { name: 'În așteptare' })).toBeVisible();
  }
  expect(writes.every(w => /^PATCH \/api\/cms\/registrations\/[^/]+\/accept$/.test(w))).toBe(true);
  expect(watch.writes.every(w => w.endsWith('/accept'))).toBe(true);
});

test('competition-page.participanti-organizator.c9 — two changes in flight both report; a change still reports after leaving the tab', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(r => (release = r));
  const writes: string[] = [];
  const { watch } = await open(page, SINGLE, {
    list: mixedSingle,
    viewport: DESKTOP,
    status: async route => {
      const p = path(route.request().url());
      writes.push(p);
      if (p.endsWith('/accept')) await held; // the accept (e-mails, pushes) is slow
      await route.fulfill({ status: 200, json: {} });
    },
  });
  await loaded(page);
  await tableRow(page, 'Gigel Așteaptă').getByRole('button', { name: 'Aprobă — Gigel Așteaptă' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Acceptă' }).click();
  await tableRow(page, 'Vasile Nou').getByRole('button', { name: 'Respinge — Vasile Nou' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Respinge' }).click();
  await expect(page.getByText('Înregistrare respinsă cu succes.')).toBeVisible();
  release();
  await expect(page.getByText('Înregistrare acceptată cu succes.')).toBeVisible();
  expect(writes).toHaveLength(2);

  // Approve, then straight to Clasament before the answer: the toast still comes.
  let release2!: () => void;
  const held2 = new Promise<void>(r => (release2 = r));
  await page.unroute(url => /^\/api\/cms\/registrations\/[^/]+\/(accept|reject|pending)$/.test(url.pathname));
  await page.route(
    url => /^\/api\/cms\/registrations\/[^/]+\/(accept|reject|pending)$/.test(url.pathname),
    async route => {
      if (route.request().method() !== 'PATCH') return route.abort();
      writes.push(path(route.request().url()));
      await held2;
      await route.fulfill({ status: 200, json: {} });
    },
  );
  await pick(page, 'rejected');
  await tableRow(page, 'Respins Pe Stand').getByRole('button', { name: 'Aprobă — Respins Pe Stand' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Acceptă' }).click();
  await expect.poll(() => writes.length).toBe(3);
  await page.getByRole('navigation', { name: 'Secțiunile concursului' }).getByRole('link', { name: /^Clasament/ }).locator('visible=true').first().click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${SINGLE}$`), { timeout: 30_000 });
  await expect(filters(page)).toHaveCount(0, { timeout: 30_000 }); // the organizer list is gone (unmounted)
  release2();
  await expect(page.getByText('Înregistrare acceptată cu succes.')).toBeVisible();
  expect(watch.writes.filter(w => !/\/registrations\/[^/]+\/(accept|reject|pending)$/.test(w))).toEqual([]);
});

test('competition-page.participanti-organizator — after a confirmed change focus stays in the list (keyboard)', async ({ page }) => {
  const { watch } = await open(page, SINGLE, { list: mixedSingle, filtru: 'in-asteptare', viewport: DESKTOP });
  await loaded(page);
  // Desktop, «În așteptare»: the approved row leaves → the next row's first action.
  await tableRow(page, 'Gigel Așteaptă').getByRole('button', { name: 'Aprobă — Gigel Așteaptă' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Acceptă' }).focus();
  await page.keyboard.press('Enter');
  await expect(tableRow(page, 'Gigel Așteaptă')).toHaveCount(0);
  await expect(tableRow(page, 'Vasile Nou').getByRole('link', { name: 'Editează — Vasile Nou' })).toBeFocused();
  // The last one leaves → the filter.
  await tableRow(page, 'Vasile Nou').getByRole('button', { name: 'Respinge — Vasile Nou' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Respinge' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('registrations-filter-empty')).toBeVisible();
  await expect(filter(page, 'În așteptare')).toBeFocused();
  // Phone, «Toți»: the row stays (closed) → its toggle.
  await page.setViewportSize(PHONE);
  await pick(page, 'all');
  const c = await expand(page, 'Respins Pe Stand');
  await c.getByRole('button', { name: 'Aprobă', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Acceptă' }).focus();
  await page.keyboard.press('Enter');
  await expect(card(page, 'Respins Pe Stand').locator('button[aria-expanded]')).toBeFocused();
  expect(watch.writes.filter(w => !/\/registrations\/[^/]+\/(accept|reject|pending)$/.test(w))).toEqual([]);
});

test('competition-page.participanti-organizator — desktop actions keep their column on every row (owner rules 14, 18)', async ({ page }) => {
  const { watch } = await open(page, SINGLE, { list: mixedSingle, viewport: DESKTOP });
  await loaded(page);
  const xs = async (name: RegExp) => {
    const out: number[] = [];
    for (const el of await page.locator('[data-registrations="table"] [role="group"]').getByRole('button', { name }).or(page.locator('[data-registrations="table"] [role="group"]').getByRole('link', { name })).all()) {
      const b = await el.boundingBox();
      out.push(Math.round(b!.x));
    }
    return out;
  };
  for (const name of [/^Apelează/, /^Aprobă/, /^Mută în așteptare/, /^(Respinge|Elimină)/, /^Editează/]) {
    const list = await xs(name);
    expect(list.length, String(name)).toBeGreaterThan(1);
    expect(new Set(list).size, `${name} x: ${list.join(',')}`).toBe(1);
  }
  // No label is cut by its slot.
  const clipped = await page.locator('[data-registrations="table"] [role="group"] button').evaluateAll(bs => bs.filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.textContent));
  expect(clipped).toEqual([]);
  for (const w of [1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width: w, height: 900 });
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(over, `no horizontal scroll at ${w}`).toBe(false);
  }
  await page.setViewportSize(DESKTOP);
  await shoot(page, 'mixed', [1024, 1280, 1440, 1920]);
  noWrites(watch);
});

test('competition-page.participanti-organizator.c7 — desktop «Apelează» shows the number: «Copiază» and «Sună», contact_pressed on either', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __events: { name: string }[]; __copied: string[] };
    w.__events = [];
    w.__copied = [];
    window.addEventListener('bluvi:analytics', e => w.__events.push((e as CustomEvent).detail));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (s: string) => void w.__copied.push(s) }, configurable: true });
  });
  const { watch } = await open(page, SINGLE, { list: mixedSingle, viewport: DESKTOP });
  await loaded(page);
  const events = () => page.evaluate(() => (window as unknown as { __events: { name: string }[] }).__events.filter(e => e.name === 'contact_pressed').length);
  await tableRow(page, 'Ion Pescaru').getByRole('button', { name: 'Apelează — Ion Pescaru' }).click();
  const pop = page.getByRole('dialog', { name: 'Telefon — Ion Pescaru' });
  await expect(pop).toBeVisible();
  await expect(pop.getByText('+40 712 000 111')).toBeVisible();
  expect(await events()).toBe(0); // opening is not a contact
  await shoot(page, 'call', [1280, 1440]);
  await pop.getByRole('button', { name: 'Copiază' }).click();
  await expect(page.getByText('Număr copiat')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied)).toEqual(['+40 712 000 111']);
  expect(await events()).toBe(1);
  await expect(pop).toBeHidden();
  await tableRow(page, 'Ion Pescaru').getByRole('button', { name: 'Apelează — Ion Pescaru' }).click();
  const call = pop.getByRole('link', { name: 'Sună' });
  await expect(call).toHaveAttribute('href', 'tel:+40712000111');
  await call.evaluate(a => a.addEventListener('click', e => e.preventDefault(), { once: true }));
  await call.click();
  expect(await events()).toBe(2);
  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();
  // Without a phone: still fish's toast.
  await tableRow(page, 'Vasile Nou').getByRole('button', { name: 'Apelează — Vasile Nou' }).click();
  await expect(page.getByText('Număr de telefon invalid')).toBeVisible();
  noWrites(watch);
});
