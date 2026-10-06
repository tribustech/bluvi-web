import { collectConsoleErrors } from './helpers/console';
import { expect, test, type APIRequestContext, type Page, type Route } from '@playwright/test';
import { card, page as cardsPage, PIXEL } from './competitions-list.fixtures';
import { expectNoA11yViolations } from './helpers/a11y';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * Rezultate (/concursuri/rezultate) — the approved prototype (app/dev/hub/Results.tsx) on real data,
 * parity docs/parity/areas/competitions-list.yml competitions-list.incheiate c16–c22 (index c33, c34, s22):
 * rows grouped by day with the per-type headline; a row opens inline (one at a time) into the SVG
 * podium, the ranking type's tiles, places 4–8 (no no-catch rows), «Locul tău» and «Vezi
 * clasamentul complet»; the ranking is read only when a row is opened; ↑/↓/Home/End move between
 * rows; NC / FIPSed show the clubs' podium; on the phone the opened row is a full-width panel.
 * Local CMS on :1337 for the real list; the «Urmărite» list is mocked (page.route) for the states
 * the local data lacks.
 */

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1280, height: 900 };

const RANKING = /\/competitions\/[^/]+\/ranking(\?|$)/;
const FOLLOWED = /\/feed\/my-competition-cards\?.*scope=followed/;
const REGISTRATIONS = /\/competitions\/[^/]+\/registrations/;
/** A podium place's text (an sr-only span: browse mode ignores aria-label on a listitem). */
const placeText = (item: ReturnType<Page['locator']>) => item.locator('.sr-only');
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const IMG = 'http://localhost:1337/uploads/fixture.jpg';

let jwt = '';
test.describe.configure({ timeout: 90_000 });
test.use({ trace: 'off' });
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

const list = (page: Page) => page.locator('#concursuri-lista');
const rows = (page: Page) => list(page).locator('li[data-result-row]');
const row = (page: Page, name: string) => rows(page).filter({ has: page.getByRole('button', { name, exact: true }) });
const toggle = (page: Page, name: string) => list(page).getByRole('button', { name, exact: true });

async function open(page: Page, path = '/concursuri/rezultate') {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: 'Concursuri' })).toBeVisible();
  await expect(rows(page).first()).toBeVisible();
}

/** The rows and the podium rise in once: axe reads the settled colours. */
async function settled(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity),
  );
}

/* ---------------------------------------------------------------- mocked data */

const done = (id: string, name: string, day: string, over: Record<string, unknown> = {}) =>
  card(id, { name, status: 'completed', startDate: `${day}T05:00:00.000Z`, endDate: `${day}T13:00:00.000Z`, dateLabel: day.slice(8), ...over });

const res = (podium: Array<[string, string[]]>, over: Record<string, unknown> = {}) => ({
  capturedAt: '2026-10-05T14:00:00.000Z',
  hasCatches: true,
  catchCount: 61,
  totalKg: 486.2,
  biggestFishKg: 14.6,
  podium: podium.map(([displayName, avatarUrls], i) => ({ position: i + 1, tied: false, displayName, standName: String(i + 1), clubName: null, avatarUrls })),
  ...over,
});

const meta = (rankingType: string, over: Record<string, unknown> = {}) => ({
  rankingType,
  totalQuantity: 486.2,
  totalCatchesCount: 61,
  biggestFish: 14.6,
  numberOfSectors: 3,
  biggestCatch: { participants: [{ id: 1, documentId: 'u1', username: 'Echipa Unu' }], sectorName: 'A', standId: 1, standName: '1', teamName: 'Echipa Unu', weight: 14.6 },
  ...over,
});

const qRow = (name: string, pos: number, kg: number, over: Record<string, unknown> = {}) => ({
  sectorId: 's',
  sectorName: ['A', 'B', 'C'][pos % 3],
  standId: pos,
  standName: String(pos),
  teamName: name,
  participant: { id: 9000 + pos, documentId: `u${pos}`, username: name },
  registrationId: `reg-${pos}`,
  biggestFish: kg ? 3 : 0,
  catchCount: kg ? 4 : 0,
  sectorPosition: pos,
  generalPosition: pos,
  quantity: kg,
  quantityPoints: pos,
  ...over,
});

const club = (name: string, pos: number, points: number, sectorPoints: number[]) => ({
  clubId: `k${pos}`,
  clubName: name,
  clubPoints: points,
  clubPosition: pos,
  clubAverageWeight: 3,
  clubTotalQuantity: 142.6 - pos * 10,
  clubTotalCatchCount: 40,
  clubBiggestCatch: 9,
  teams: sectorPoints.map((p, i) => ({
    sectorId: 's',
    sectorName: 'ABC'[i],
    standId: pos * 10 + i,
    standName: String(i),
    teamName: `${name} ${i + 1}`,
    participants: null,
    biggestFish: 3,
    catchCount: 4,
    sectorPosition: p,
    generalPosition: p,
    quantity: 30,
    sectorPoints: p,
  })),
});

/**
 * «Înscris» comes from the «Ale mele» list the SERVER prefetches (page.route cannot reach it): the
 * QA user's real registrations on the local CMS. The team fixture borrows the id of one of them.
 */
async function myRegisteredId(request: APIRequestContext): Promise<string | null> {
  const res = await request.get(`${CMS}/feed/my-competition-cards?scope=registered&page=1&pageSize=20`, { headers: { Authorization: `Bearer ${jwt}` } });
  const body = (await res.json()) as { data?: Array<{ documentId: string }> };
  return body.data?.[0]?.documentId ?? null;
}

async function mockFollowed(page: Page, viewerId: number, teamId = 'fx-r-team') {
  const regReads: string[] = [];
  await page.route(/\/uploads\/fixture\.jpg/, (r) => r.fulfill({ body: PIXEL, contentType: 'image/png' }));
  const team = done(teamId, 'FX Cupa Echipe', '2026-10-04', {
    format: { kind: 'team', teamSize: 3, unit: 'echipe' },
    joinedCount: 12,
    results: res([
      ['Echipa Unu', [`${IMG}?a1`, `${IMG}?a2`, `${IMG}?a3`]],
      ['Echipa Doi', []],
      ['Echipa Trei', [`${IMG}?a4`]],
    ]),
  });
  const nc = done('fx-r-nc', 'FX Campionat Național', '2026-10-04', {
    rankingType: 'nationalChampionship',
    rankingLabel: 'Campionat Național',
    format: { kind: 'team', teamSize: 3, unit: 'echipe' },
    // The card's podium is the TEAMS' (each with its club); the row crowns the club.
    results: res([['Echipa Alba 1', []]], {
      podium: [{ position: 1, tied: false, displayName: 'Echipa Alba 1', standName: '1', clubName: 'CS Carpathia Alba', avatarUrls: [] }],
    }),
  });
  const empty = done('fx-r-zero', 'FX Fără capturi', '2026-09-27', { results: res([], { hasCatches: false, catchCount: 0, totalKg: null, biggestFishKg: null }) });
  // Results unavailable (no snapshot): not «no catches» — the ranking is read like any other.
  const unknown = done('fx-r-null', 'FX Fără instantaneu', '2026-09-27', { results: null });
  const unknown404 = done('fx-r-null404', 'FX Fără clasament', '2026-09-27', { results: null });
  await page.route(FOLLOWED, (r) => {
    const status = new URL(r.request().url()).searchParams.get('status');
    return json(r, cardsPage(status === 'completed' ? [team, nc, empty, unknown, unknown404] : [], { counts: { notStarted: 0, started: 0, completed: 5 } }));
  });
  const reads: string[] = [];
  await page.route(RANKING, (r) => {
    const id = decodeURIComponent(new URL(r.request().url()).pathname.split('/').at(-2) ?? '');
    reads.push(id);
    if (id === teamId) {
      return json(r, {
        metadata: meta('quantity'),
        rankings: [
          qRow('Echipa Unu', 1, 52.8),
          qRow('Echipa Doi', 2, 49.1),
          qRow('Echipa Trei', 3, 44.6),
          qRow('Echipa Patru', 4, 39.2),
          // The viewer's own row, 5th.
          qRow('Echipa Mea', 5, 35.7, { participant: { id: viewerId, documentId: 'me', username: 'eu' } }),
          // A no-catch row is never a place (it is in the full ranking).
          qRow('Echipa Goală', 6, 0),
        ],
      });
    }
    if (id === 'fx-r-null') {
      return json(r, { metadata: meta('quantity'), rankings: [qRow('Echipa Nouă', 1, 18.4), qRow('Echipa Veche', 2, 12.1)] });
    }
    if (id === 'fx-r-nc') {
      return json(r, {
        metadata: meta('nationalChampionship'),
        rankings: [club('CS Carpathia Alba', 1, 8, [1, 1, 6]), club('Clubul Crap Mureș', 2, 11, [2, 3, 6]), club('ACS Delta Tulcea', 3, 13.5, [3, 4.5, 6])],
      });
    }
    return json(r, { error: { status: 404, message: 'fixture' } }, 404);
  });
  await page.route(REGISTRATIONS, (r) => {
    regReads.push(r.request().url());
    return json(r, []);
  });
  return Object.assign(reads, { regReads });
}

/* ---------------------------------------------------------------- local CMS */

test.describe('signed out', () => {
  test('competitions-list.index.c33 competitions-list.index.c34 competitions-list.incheiate.c16 competitions-list.incheiate.c17 competitions-list.incheiate.c18 competitions-list.incheiate.c19 competitions-list.incheiate.c20 competitions-list.incheiate.c21 competitions-list.incheiate.c22 competitions-list.index.s22 — rows by day; the ranking is read only on open; feeder in points; podium, tiles, places, «Vezi clasamentul complet»; keyboard', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: /Failed to load resource/ });
    const reads: string[] = [];
    page.on('request', (r) => {
      if (RANKING.test(r.url())) reads.push(r.url());
    });
    await page.setViewportSize(DESKTOP);
    await open(page);
    // Day headers (weekday, day, month) — «Azi» / «Ieri» once the browser knows today.
    await expect(list(page).getByRole('heading', { level: 3 }).first()).toHaveText(/^(Azi|Ieri|(Luni|Marți|Miercuri|Joi|Vineri|Sâmbătă|Duminică), \d+ [a-z]+)/);
    // No ranking per row of the page: not even on hover or focus.
    const feeder = row(page, 'SIM3 Cupa C&B Ed 8');
    await feeder.hover();
    await page.waitForTimeout(1500);
    expect(reads).toEqual([]);
    // Closed, the row stands on the card: the winner; the headline slot is the feeder's points
    // label with «–» (the card has no headline value) — never another metric; CMMC is its own chip.
    const header = toggle(page, 'SIM3 Cupa C&B Ed 8');
    const slot = header.locator('span.md\\:flex').last();
    await expect(header).toContainText('Câștigător');
    await expect(slot).toHaveText(/^Puncte( · \d+ manșe)?–se vede la deschidere$/);
    await expect(header).toContainText(/CMMC\s*\d+(,\d+)? kg/);
    const closedLabel = (await slot.textContent())!.replace(/–.*$/, '');
    // Opened: the ranking is read once; the same slot is FILLED with the ranking's points.
    await toggle(page, 'SIM3 Cupa C&B Ed 8').click();
    await expect(toggle(page, 'SIM3 Cupa C&B Ed 8')).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => reads.length).toBe(1);
    await expect(slot).toHaveText(/^Puncte( · \d+ manșe)?\d+(,\d)? (de )?punct(e)?$/);
    expect((await slot.textContent())!.startsWith(closedLabel)).toBe(true);
    await expect(header).toContainText(/CMMC\s*\d+(,\d+)? kg/);
    await expect(header).not.toContainText(/kg total/);
    const panel = page.getByRole('region', { name: 'Rezultate SIM3 Cupa C&B Ed 8' });
    const podium = panel.getByRole('list', { name: 'Podium' }).getByRole('listitem');
    await expect(podium).toHaveCount(3);
    await expect(placeText(podium.first())).toHaveText(/^Locul 1: .+, \d+(,\d)? (de )?punct(e)?$/);
    await expect(podium.first()).not.toHaveAttribute('aria-label');
    // The baseline bar is outside the list: an <ol> holds <li>s only.
    expect(await panel.getByRole('list', { name: 'Podium' }).evaluate((ol) => [...ol.children].every((c) => c.tagName === 'LI'))).toBe(true);
    await expect(panel.getByText('Cele mai puține puncte câștigă')).toBeVisible();
    await expect(panel.getByText(/^Cum s-a câștigat: locul în sector/i)).toBeVisible();
    await expect(panel.getByText('manșe câștigate')).toBeVisible();
    await expect(panel.getByText(/^Locurile 4–\d$/)).toBeVisible();
    await expect(panel.getByRole('link', { name: /Vezi clasamentul complet/ })).toHaveAttribute('href', /\/clasament$/);
    await expect(panel.getByRole('link', { name: 'Vezi concursul' })).toHaveAttribute('href', /^\/concursuri\/[^/]+$/);
    // «Vezi clasamentul complet» lives in the opened area only.
    await expect(list(page).getByRole('link', { name: /Vezi clasamentul complet/ })).toHaveCount(1);
    await settled(page);
    await expectNoA11yViolations(page);
    // One open at a time: opening another closes the first; the same press closes it.
    const second = rows(page).nth(1).getByRole('button', { expanded: false }).first();
    const secondName = (await second.getAttribute('aria-labelledby'))!;
    await second.click();
    await expect(toggle(page, 'SIM3 Cupa C&B Ed 8')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(`[aria-labelledby="${secondName}"]`)).toHaveAttribute('aria-expanded', 'true');
    await page.locator(`[aria-labelledby="${secondName}"]`).click();
    await expect(list(page).locator('button[aria-expanded="true"]')).toHaveCount(0);
    // Keyboard: a single tab stop; ↓ / ↑ / End / Home move between rows; Enter opens.
    await expect(list(page).locator('button[aria-expanded][tabindex="0"]')).toHaveCount(1);
    const buttons = list(page).locator('button[aria-expanded]');
    await buttons.first().focus();
    await page.keyboard.press('ArrowDown');
    await expect(buttons.nth(1)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(buttons.first()).toBeFocused();
    await page.keyboard.press('End');
    await expect(buttons.last()).toBeFocused();
    await page.keyboard.press('Home');
    await expect(buttons.first()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(buttons.first()).toHaveAttribute('aria-expanded', 'true');
    expect(errors).toEqual([]);
  });

  test('competitions-list.incheiate.c17 competitions-list.incheiate.c22 — phone: the rows read the winner and the figure under the name; the opened row is a full-width panel', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: /Failed to load resource/ });
    await page.setViewportSize(PHONE);
    await open(page);
    const name = 'SIM3 Cupa C&B Ed 8';
    // Under the winner: the headline label with «–» (filled on open), then the CMMC chip.
    await expect(row(page, name).getByText(/^Puncte( · \d+ manșe)?: –se vede la deschidere$/)).toBeVisible();
    await expect(row(page, name).getByText(/^CMMC \d+(,\d+)? kg$/).filter({ visible: true })).toHaveCount(1);
    await toggle(page, name).click();
    const panel = page.getByRole('region', { name: `Rezultate ${name}` });
    await expect(panel.getByRole('list', { name: 'Podium' })).toBeVisible();
    await settled(page);
    const box = await row(page, name).boundingBox();
    expect(box!.x).toBeLessThanOrEqual(1);
    expect(box!.width).toBeGreaterThanOrEqual(PHONE.width - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(PHONE.width);
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });
});

/* ---------------------------------------------------------------- mocked «Urmărite» */

test.describe('signed in (mocked list)', () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context, jwt);
  });

  test('competitions-list.incheiate.c16 competitions-list.incheiate.c17 competitions-list.incheiate.c19 competitions-list.incheiate.c20 competitions-list.incheiate.c21 — a team: its name over its members’ faces; places 4–8 without no-catch rows; «Locul tău»; NC: the clubs’ podium; no catches: no podium', async ({ page, request }) => {
    const errors = collectConsoleErrors(page, { ignore: /Failed to load resource/ });
    const me = await (await request.get(`${CMS}/users/me`, { headers: { Authorization: `Bearer ${jwt}` } })).json();
    const teamId = await myRegisteredId(request);
    test.skip(!teamId, 'the QA user has no registration on the local CMS');
    const reads = await mockFollowed(page, me.id as number, teamId!);
    await page.setViewportSize(DESKTOP);
    await open(page);
    await page.getByRole('button', { name: 'Concursuri urmărite' }).click();
    await expect(toggle(page, 'FX Cupa Echipe')).toBeVisible();
    // Grouped by day: two the same Sunday, three a week before.
    await expect(list(page).getByRole('heading', { level: 3 })).toHaveText([/^Duminică, 4 octombrie/, /^Duminică, 27 septembrie/]);
    expect([...reads]).toEqual([]);
    // Closed: the viewer's own competition says so («Ale mele», no ranking read); the headline slot
    // is «Total –», the heaviest fish its own chip.
    await expect(toggle(page, 'FX Cupa Echipe')).toContainText('Înscris');
    await expect(toggle(page, 'FX Campionat Național')).not.toContainText('Înscris');
    await expect(toggle(page, 'FX Cupa Echipe')).toContainText(/Total–/);
    await expect(toggle(page, 'FX Cupa Echipe')).toContainText(/CMMC\s*14,6 kg/);
    // NC closed: the winning CLUB (the first team's club), never the team.
    await expect(toggle(page, 'FX Campionat Național')).toContainText(/Club câștigător:? CS Carpathia Alba/);
    await expect(toggle(page, 'FX Campionat Național')).not.toContainText('Echipa Alba 1');
    await expect(toggle(page, 'FX Campionat Național')).toContainText(/Puncte club–/);

    // A team.
    await toggle(page, 'FX Cupa Echipe').click();
    const team = page.getByRole('region', { name: 'Rezultate FX Cupa Echipe' });
    const podium = team.getByRole('list', { name: 'Podium' }).getByRole('listitem');
    await expect(placeText(podium.first())).toHaveText('Locul 1: Echipa Unu, 52,8 kg');
    await expect(podium.first().locator('img')).toHaveCount(3);
    await expect(toggle(page, 'FX Cupa Echipe')).toContainText(/Total\s*52,8 kg/);
    await expect(toggle(page, 'FX Cupa Echipe')).toContainText(/CMMC\s*14,6 kg/);
    await expect(team.getByText('Locurile 4–5')).toBeVisible();
    await expect(team.getByText('Echipa Goală')).toHaveCount(0);
    await expect(team.locator('li[aria-current="true"]')).toContainText('Echipa Mea');
    await expect(toggle(page, 'FX Cupa Echipe')).toContainText('Locul tău: 5');
    await expect(toggle(page, 'FX Cupa Echipe')).not.toContainText('Înscris');
    // The ranking's own row names the viewer: the registrations list is never read.
    expect(reads.regReads).toEqual([]);
    await expect(team.getByText('medie pe stand')).toBeVisible();
    await expect(team.getByText('12 echipe · 3 sectoare')).toBeVisible();

    // NC: the clubs, in points.
    await toggle(page, 'FX Campionat Național').click();
    await expect(toggle(page, 'FX Cupa Echipe')).toHaveAttribute('aria-expanded', 'false');
    const nc = page.getByRole('region', { name: 'Rezultate FX Campionat Național' });
    await expect(placeText(nc.getByRole('list', { name: 'Podium' }).getByRole('listitem').first())).toHaveText('Locul 1: CS Carpathia Alba, 8 puncte');
    await expect(toggle(page, 'FX Campionat Național')).toContainText(/Club câștigător:? CS Carpathia Alba/);
    await expect(toggle(page, 'FX Campionat Național')).toContainText(/Puncte club\s*8 puncte/);
    await expect(nc.getByText('sectoare câștigate')).toBeVisible();
    await expect(nc.getByText('2/3')).toBeVisible();

    // No catches: no podium and no ranking read; the competition stays one click away.
    await toggle(page, 'FX Fără capturi').click();
    const zero = page.getByRole('region', { name: 'Rezultate FX Fără capturi' });
    await expect(zero.getByText('Concursul s-a încheiat fără capturi cântărite.')).toBeVisible();
    await expect(zero.getByRole('list', { name: 'Podium' })).toHaveCount(0);
    await expect(zero.getByRole('link', { name: 'Vezi concursul' })).toHaveAttribute('href', '/concursuri/fx-r-zero');
    await expect(zero.getByRole('link', { name: /Vezi clasamentul complet/ })).toHaveCount(0);
    await expect(toggle(page, 'FX Fără capturi')).toContainText('Fără capturi');

    // Results unavailable (null): closed, no claim either way; opened, the ranking is read.
    for (const name of ['FX Fără instantaneu', 'FX Fără clasament']) {
      await expect(toggle(page, name)).not.toContainText('Fără capturi');
      await expect(toggle(page, name)).toContainText(/Câștigător: –/);
    }
    await toggle(page, 'FX Fără instantaneu').click();
    const unknown = page.getByRole('region', { name: 'Rezultate FX Fără instantaneu' });
    await expect(placeText(unknown.getByRole('list', { name: 'Podium' }).getByRole('listitem').first())).toHaveText('Locul 1: Echipa Nouă, 18,4 kg');
    await expect(toggle(page, 'FX Fără instantaneu')).toContainText(/Câștigător:? Echipa Nouă/);
    await expect(toggle(page, 'FX Fără instantaneu')).toContainText(/Total\s*18,4 kg/);
    await expect(unknown.getByRole('link', { name: /Vezi clasamentul complet/ })).toHaveAttribute('href', '/concursuri/fx-r-null/clasament');
    await expect(unknown.getByText('Concursul s-a încheiat fără capturi cântărite.')).toHaveCount(0);
    // …and when even the ranking cannot be read, it says just that — the full ranking one click away.
    await toggle(page, 'FX Fără clasament').click();
    const unknown404 = page.getByRole('region', { name: 'Rezultate FX Fără clasament' });
    await expect(unknown404.getByText('Rezultatele nu sunt disponibile.')).toBeVisible();
    await expect(unknown404.getByRole('link', { name: /Vezi clasamentul complet/ })).toBeVisible();
    await expect(unknown404.getByText(/fără capturi/i)).toHaveCount(0);
    expect([...reads].sort()).toEqual(['fx-r-nc', 'fx-r-null', 'fx-r-null404', teamId!].sort());
    expect(reads.regReads).toEqual([]);
    await settled(page);
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('competitions-list.incheiate.c20 — a seat the ranking does not name by user (a team captained by someone else): the registrations are read only then, after the ranking, to find «Locul tău»', async ({ page, request }) => {
    const errors = collectConsoleErrors(page, { ignore: /Failed to load resource/ });
    const me = await (await request.get(`${CMS}/users/me`, { headers: { Authorization: `Bearer ${jwt}` } })).json();
    const teamId = await myRegisteredId(request);
    test.skip(!teamId, 'the QA user has no registration on the local CMS');
    const reads = await mockFollowed(page, -1, teamId!);
    let rankingAnswered = false;
    await page.unroute(RANKING);
    await page.route(RANKING, (r) => {
      rankingAnswered = true;
      return json(r, {
        metadata: meta('quantity'),
        rankings: [qRow('Echipa Unu', 1, 52.8), qRow('Echipa Doi', 2, 49.1), qRow('Echipa Trei', 3, 44.6), qRow('Echipa Căpitan', 4, 39.2, { registrationId: 'reg-mine' })],
      });
    });
    await page.unroute(REGISTRATIONS);
    await page.route(REGISTRATIONS, (r) => {
      // Dependent read: never before the ranking has answered.
      expect(rankingAnswered).toBe(true);
      reads.regReads.push(r.request().url());
      return json(r, [{ id: 7, documentId: 'reg-mine', registrationStatus: 'registered', teamName: 'Echipa Căpitan', participants: [{ id: me.id, documentId: 'me' }] }]);
    });
    await page.setViewportSize(DESKTOP);
    await open(page);
    await page.getByRole('button', { name: 'Concursuri urmărite' }).click();
    await expect(toggle(page, 'FX Cupa Echipe')).toContainText('Înscris');
    await toggle(page, 'FX Cupa Echipe').click();
    await expect(toggle(page, 'FX Cupa Echipe')).toContainText('Locul tău: 4');
    expect(reads.regReads).toHaveLength(1);
    // A competition the viewer was not registered in never reads its registrations.
    await toggle(page, 'FX Fără instantaneu').click();
    await expect(page.getByRole('region', { name: 'Rezultate FX Fără instantaneu' }).getByRole('list', { name: 'Podium' })).toBeVisible();
    await page.waitForTimeout(500);
    expect(reads.regReads).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('competitions-list.index.c33 competitions-list.incheiate.c22 — the list keeps one tab stop when a refetch drops the focused row; Tab from the status tabs reaches it', async ({ page }) => {
    await page.route(/\/uploads\/fixture\.jpg/, (r) => r.fulfill({ body: PIXEL, contentType: 'image/png' }));
    const none = { capturedAt: '2026-09-20T10:00:00.000Z', hasCatches: false, catchCount: 0, totalKg: null, biggestFishKg: null, podium: [] };
    const a = done('fx-res-a', 'FX Rezultat A', '2026-09-20', { results: none });
    const b = done('fx-res-b', 'FX Rezultat B', '2026-09-13', { results: none });
    // The first page comes with the HTML; the refetch («Reîmprospătează») no longer has the row
    // that held the tab stop.
    await page.route(/\/feed\/competition-cards\?.*status=completed/, (r) => json(r, cardsPage([a, b], { counts: { notStarted: 0, started: 0, completed: 2 } })));
    await page.setViewportSize(DESKTOP);
    await open(page);
    const first = list(page).locator('button[aria-expanded]').first();
    await expect(first).toHaveAttribute('tabindex', '0');
    const firstName = (await list(page).locator(`#${await first.getAttribute('aria-labelledby')}`).textContent()) ?? '';
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    const rowA = toggle(page, 'FX Rezultat A');
    await expect(rowA).toBeVisible();
    await expect(toggle(page, firstName)).toHaveCount(0);
    await expect(rowA).toHaveAttribute('tabindex', '0');
    await expect(list(page).locator('button[aria-expanded][tabindex="0"]')).toHaveCount(1);
    await page.getByRole('tablist', { name: 'Stare concursuri' }).getByRole('tab', { selected: true }).focus();
    let inList = false;
    for (let i = 0; i < 30 && !inList; i++) {
      await page.keyboard.press('Tab');
      inList = await page.evaluate(() => !!document.activeElement?.closest('[data-results-list]'));
    }
    expect(inList).toBe(true);
    await expect(rowA).toBeFocused();
  });

  test('competitions-list.incheiate.c18 — a ranking that fails: the opened row stands on the card (names, CMMC, catches), no error', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: /Failed to load resource|404/ });
    await mockFollowed(page, -1);
    await page.unroute(RANKING);
    await page.route(RANKING, (r) => json(r, { error: { status: 500, message: 'fixture' } }, 500));
    await page.setViewportSize(DESKTOP);
    await open(page);
    await page.getByRole('button', { name: 'Concursuri urmărite' }).click();
    await toggle(page, 'FX Cupa Echipe').click();
    const team = page.getByRole('region', { name: 'Rezultate FX Cupa Echipe' });
    await expect(placeText(team.getByRole('list', { name: 'Podium' }).getByRole('listitem').first())).toHaveText('Locul 1: Echipa Unu', { timeout: 30_000 });
    await expect(team.getByText('CMMC', { exact: true })).toBeVisible();
    await expect(team.getByText(/^Locurile/)).toHaveCount(0);
    await expect(toggle(page, 'FX Cupa Echipe')).toContainText(/CMMC\s*14,6 kg/);
    expect(errors).toEqual([]);
  });
});
