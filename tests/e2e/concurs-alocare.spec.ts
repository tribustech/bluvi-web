import { mkdirSync } from 'node:fs';
import { expect, test, type Page, type Request, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * «Alocare participanți» / «Standuri manșa N» (parity organizer.participants c1–c9 +
 * organizer.b.feeder-allocate-next; fish app/(app)/configure/participants/[competitionId].tsx).
 *
 * READS hit the local CMS:
 *  - TEAM «SIM3 Cupa C&B Ed 8» (team, notStarted, authored by the QA user): 4 sectors × 5 stands,
 *    20 registered guest teams, every one allocated;
 *  - FEEDER «Cupa Feeder 2 Manșe» (single, feederRounds, 2 legs, QA author): 2 sectors × 3 stands,
 *    6 registered guests.
 * A state the local data does not have (a club, an angler with an account, the previous leg's
 * seats, a failure, another viewer) is made by editing the real response in page.route.
 * WRITES NEVER reach the CMS — an allocation pushes COMPETITION_PARTICIPANTS_ALLOCATION to real
 * devices: both the POST allocate-stand-to-registration and the PUT rounds/:round/allocation are
 * fulfilled here with their exact bodies asserted. Every other non-GET to the browser's CMS edge
 * (/api/cms/** and the CMS origin) is ABORTED by a catch-all route registered before any mock (so it
 * never reaches the CMS, even on a regression or a retry), and every non-GET is recorded and must be
 * one of the mocked ones (onlyWrites).
 */

test.describe.configure({ timeout: 180_000, retries: 1 });

const TEAM = process.env.E2E_ALLOCATION_TEAM ?? 'a6xjl65ooe9eadrtvvqj9hn1';
const FEEDER = process.env.E2E_ALLOCATION_FEEDER ?? 'bi9ptgcag7nbakrglxh16vx4';
const PHONE = { width: 375, height: 812 };
const WIDTHS = [375, 1280, 1440, 1920];

type Stand = { documentId: string; name: string };
type Sector = { documentId: string; name: string; stands: Stand[] };
type Registration = {
  id: number;
  documentId: string;
  registrationStatus: string;
  teamName: string | null;
  guestName: string | null;
  club: { name: string } | null;
  participants: { id: number; documentId: string; username: string; avatar: { url: string } | null }[];
};
type Competition = {
  competitionType: string;
  rankingType: string;
  competitionStatus: string;
  roundsCount: number | null;
  currentRound: number | null;
  roundStatus: string | null;
  sectors: Sector[];
  registrations: Registration[];
};
type Allocated = Record<string, { registrationId: string; teamName: string; guestName: string } | null>;
type Watch = { writes: string[]; reads: string[] };
type Sent = { method: string; body: unknown }[];

const path = (url: string) => new URL(url).pathname;
const CMS_ORIGIN = new URL(CMS).origin;
const isCmsUrl = (url: URL) => url.pathname.startsWith('/api/cms/') || url.origin === CMS_ORIGIN;
const isCms = (r: Request) => isCmsUrl(new URL(r.url()));
const byName = (a: string, b: string) => a.localeCompare(b, 'ro', { numeric: true });
/** The web's order (standOrder.compareNames): sectors by name, natural. */
const sectorNames = (c: Competition) => c.sectors.map((s) => s.name).sort(byName);
/** A feeder competition whose leg 1 is closed: «Reașază pentru manșa 2» is the one leg seating offered. */
const legOneClosed = (c: Competition): Competition => ({ ...c, competitionStatus: 'started', currentRound: 1, roundStatus: 'closed' });
const competitionPath = (id: string) => `/api/cms/feed/competitions/${id}`;
const allocationsPath = (id: string) => `/api/cms/competitions/${id}/allocated-participants`;
const registrationsPath = (id: string) => `/api/cms/competitions/${id}/registrations`;
const rankingPath = (id: string) => `/api/cms/competitions/${id}/ranking`;
const statutePath = (id: string) => `/api/cms/user/profile/competition/${id}/statute`;
const allocatePath = (id: string) => `/api/cms/competitions/${id}/allocate-stand-to-registration`;
const legPath = (id: string, round: number) => `/api/cms/feed/competitions/${id}/rounds/${round}/allocation`;

let jwt = '';
let team: Competition;
let teamAllocated: Allocated;
let feeder: Competition;

async function read<T>(request: import('@playwright/test').APIRequestContext, url: string): Promise<T> {
  const res = await request.get(url);
  expect(res.ok(), url).toBe(true);
  const json = await res.json();
  return (json.data ?? json) as T;
}

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  mkdirSync('.shots', { recursive: true });
  team = await read<Competition>(request, `${CMS}/feed/competitions/${TEAM}`);
  teamAllocated = await read<Allocated>(request, `${CMS}/competitions/${TEAM}/allocated-participants`);
  feeder = await read<Competition>(request, `${CMS}/feed/competitions/${FEEDER}`);
  expect(team.competitionType).toBe('team');
  expect(feeder.competitionType).toBe('single');
  expect(feeder.rankingType).toBe('feederRounds');
  expect(feeder.roundsCount).toBe(2);
  expect(team.competitionStatus).toBe('notStarted');
  // Every TEAM entrant is seated (the no-change test relies on it).
  expect(Object.values(teamAllocated).filter(Boolean)).toHaveLength(team.registrations.length);
});

async function open(page: Page, at: string, setup?: (page: Page) => Promise<unknown>) {
  await signIn(page.context(), jwt);
  const watch: Watch = { writes: [], reads: [] };
  // FIRST, before any mock: no write reaches the CMS (real pushes / e-mails). Playwright tries the
  // most recently registered route first, so the mockWrite handlers below still answer theirs;
  // whatever falls through to here is aborted (and recorded by the listener, failing onlyWrites).
  await page.route(isCmsUrl, (route) => (route.request().method() === 'GET' ? route.fallback() : route.abort('blockedbyclient')));
  page.on('request', (r) => {
    if (!isCms(r)) return;
    if (r.method() !== 'GET') watch.writes.push(`${r.method()} ${path(r.url())}`);
    else watch.reads.push(path(r.url()));
  });
  const errors = collectConsoleErrors(page, { ignore: /Failed to load resource: the server responded with a status of (500|400)/ });
  if (setup) await setup(page);
  await page.goto(at);
  return { watch, errors };
}

/** Edits a real read on its way to the page. */
async function editJson<T>(page: Page, pathname: string, change: (data: T) => T) {
  await page.route(
    (url) => url.pathname === pathname,
    async (route: Route) => {
      const res = await route.fetch();
      const json = await res.json();
      const body = json && typeof json === 'object' && 'data' in json && json.data ? { ...json, data: change(json.data) } : change(json);
      await route.fulfill({ response: res, json: body });
    },
  );
}

/** A write, answered here (never the CMS): records each method + body. */
async function mockWrite(page: Page, pathname: string, answer: (route: Route, sent: Sent) => Promise<void>) {
  const sent: Sent = [];
  await page.route(
    (url) => url.pathname === pathname,
    async (route) => {
      sent.push({ method: route.request().method(), body: route.request().postDataJSON() });
      await answer(route, sent);
    },
  );
  return sent;
}

async function loaded(page: Page, sectorName: string) {
  const first = page.getByRole('heading', { level: 2, name: `Sector ${sectorName}` });
  const seen = await first.waitFor({ timeout: 12_000 }).then(
    () => true,
    () => false,
  );
  // The shared dev server's Fast Refresh (other agents' edits) can strand a load: one reload.
  if (!seen) await page.reload();
  await expect(first).toBeVisible({ timeout: 30_000 });
}

async function shoot(page: Page, name: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(450);
    await page.screenshot({ path: `.shots/alocare-${name}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize(PHONE);
}

const row = (page: Page, sector: string, stand: string) => page.getByTestId(`alloc-stand-${sector}-${stand}`);
const openRow = (page: Page, sector: string, stand: string) =>
  row(page, sector, stand).getByRole('button', { name: new RegExp(`^Sector ${sector}, stand ${stand}:`) }).click();
const onlyWrites = (watch: Watch, allowed: string[]) => expect(watch.writes, 'only the mocked writes').toEqual(allowed);
const count = (watch: Watch, p: string) => watch.reads.filter((r) => r === p).length;
const regById = (c: Competition, id: string) => c.registrations.find((r) => r.documentId === id)!;

test('signed out → sign-in with the return path (?mansa kept)', async ({ request }) => {
  for (const at of [`/concursuri/${TEAM}/alocare`, `/concursuri/${FEEDER}/alocare?mansa=2`]) {
    const res = await request.get(`${BASE_URL}${at}`, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(decodeURIComponent(res.headers().location)).toContain(`/intra?next=${at}`);
  }
});

test('organizer.participants.c1 — loading until the competition AND the allocations are in; noindex', async ({ page }) => {
  await page.setViewportSize(PHONE);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const { watch, errors } = await open(page, `/concursuri/${TEAM}/alocare`, (p) =>
    p.route(
      (url) => url.pathname === allocationsPath(TEAM),
      async (route) => {
        await gate;
        await route.continue();
      },
    ),
  );
  await expect(page.getByRole('heading', { level: 1, name: 'Alocare participanți' })).toBeVisible({ timeout: 30_000 });
  // The competition arrives; the allocations are held: still loading, no stands.
  await expect.poll(() => count(watch, competitionPath(TEAM))).toBeGreaterThan(0);
  await expect(page.getByRole('status').filter({ hasText: 'Se încarcă standurile…' })).toBeAttached();
  await expect(page.locator('section[aria-busy="true"]')).toBeVisible();
  await expect(page.getByTestId('alloc-skeleton')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /^Sector / })).toHaveCount(0);
  await shoot(page, 'loading');
  release();
  await loaded(page, team.sectors[0].name);
  await expect(page.locator('section[aria-busy="true"]')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('link', { name: 'Înapoi la concurs' })).toHaveAttribute('href', `/concursuri/${TEAM}`);
  onlyWrites(watch, []);
  expect(errors).toEqual([]);
});

test('organizer.participants.c1 — an error offers «Încearcă din nou», which refetches competition, allocations and registrations', async ({ page }) => {
  await page.setViewportSize(PHONE);
  let fail = true;
  const { watch, errors } = await open(page, `/concursuri/${TEAM}/alocare`, (p) =>
    p.route(
      (url) => url.pathname === allocationsPath(TEAM),
      (route) => (fail ? route.fulfill({ status: 500, json: { data: null, error: { status: 500, message: 'boom' } } }) : route.continue()),
    ),
  );
  const alert = page.getByRole('alert');
  await expect(alert.getByRole('heading', { name: 'Serverul nu răspunde' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Alocare participanți' })).toBeVisible();
  await shoot(page, 'error');
  await expectNoA11yViolations(page);
  fail = false;
  const before = {
    competition: count(watch, competitionPath(TEAM)),
    allocations: count(watch, allocationsPath(TEAM)),
    registrations: count(watch, registrationsPath(TEAM)),
  };
  await page.getByRole('button', { name: 'Încearcă din nou' }).click();
  await loaded(page, team.sectors[0].name);
  expect(count(watch, competitionPath(TEAM))).toBeGreaterThan(before.competition);
  expect(count(watch, allocationsPath(TEAM))).toBeGreaterThan(before.allocations);
  expect(count(watch, registrationsPath(TEAM))).toBeGreaterThan(before.registrations);
  onlyWrites(watch, []);
  expect(errors).toEqual([]);
});

test('organizer.participants.c2 c4 c5 — title, «Sector X» in order, «Stand N» + occupant prefilled from the allocations, filled rows green', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const s0 = team.sectors[0];
  const free = s0.stands[1];
  const clubbed = teamAllocated[s0.stands[0].documentId]!.registrationId;
  const { watch, errors } = await open(page, `/concursuri/${TEAM}/alocare`, async (p) => {
    // One stand free (no allocation), one team with a club and two members with accounts.
    await editJson<Allocated>(p, allocationsPath(TEAM), (a) => ({ ...a, [free.documentId]: null }));
    await editJson<Competition>(p, competitionPath(TEAM), (c) => ({
      ...c,
      registrations: c.registrations.map((r) =>
        r.documentId === clubbed
          ? {
              ...r,
              club: { name: 'CS Crapul Vesel' },
              teamName: 'Rechinii',
              participants: [
                { id: 901, documentId: 'u901', username: 'ion.pescar', avatar: null },
                { id: 902, documentId: 'u902', username: 'ana.crap', avatar: null },
              ],
            }
          : r,
      ),
    }));
  });
  await loaded(page, s0.name);
  await expect(page.getByRole('heading', { level: 1, name: 'Alocare participanți' })).toBeVisible();
  await expect(page.getByTestId('alloc-leg-intro')).toHaveCount(0);
  // Sectors in natural order by name (the CMS sends them «C, A, B, D»), stands too.
  await expect(page.getByRole('heading', { level: 2, name: /^Sector / })).toHaveText(sectorNames(team).map((n) => `Sector ${n}`));
  for (const sector of team.sectors) {
    const names = await page.getByTestId(`alloc-sector-${sector.name}`).locator('[data-testid^="alloc-stand-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
    expect(names).toEqual(sector.stands.map((st) => st.name).sort(byName).map((n) => `alloc-stand-${sector.name}-${n}`));
  }
  // The club, then «Echipă: participanți».
  const first = row(page, s0.name, s0.stands[0].name);
  await expect(first).toContainText(`Stand ${s0.stands[0].name}`);
  await expect(first).toContainText('CS Crapul Vesel');
  await expect(first.locator('strong')).toHaveText('Rechinii: ');
  await expect(first).toContainText('Rechinii: ion.pescar, ana.crap');
  await expect(first).toHaveAttribute('data-filled', 'true');
  await expect(first).toHaveCSS('background-color', 'rgb(220, 252, 231)');
  // The free stand: «-», the indigo tint, the pencil.
  const empty = row(page, s0.name, free.name);
  await expect(empty).toContainText(`Stand ${free.name}-`);
  await expect(empty).not.toHaveAttribute('data-filled', 'true');
  await expect(empty.getByTestId('alloc-edit')).toBeVisible();
  // Every other stand shows its allocated team (a guest team: its name once, bold).
  for (const sector of team.sectors) {
    for (const stand of sector.stands) {
      const a = teamAllocated[stand.documentId];
      if (!a || stand.documentId === free.documentId || a.registrationId === clubbed) continue;
      const reg = regById(team, a.registrationId);
      await expect(row(page, sector.name, stand.name)).toContainText(reg.teamName ?? reg.guestName ?? '');
      await expect(row(page, sector.name, stand.name)).toHaveAttribute('data-filled', 'true');
    }
  }
  await expect(page.getByTestId('alloc-progress')).toHaveText(`${team.registrations.length - 1} din 20 de înscrieri confirmate au stand.`);
  // Nothing edited yet: the save is off and says why.
  await expect(page.getByRole('button', { name: 'Finalizează alocarea' })).toBeDisabled();
  await expect(page.getByTestId('alloc-no-changes')).toHaveText(' Nicio modificare de salvat.');
  // The occupant in full on the row's title (desktop rows wrap, phone rows clamp).
  await expect(first.getByRole('button').first()).toHaveAttribute('title', 'CS Crapul Vesel, Rechinii: ion.pescar, ana.crap');
  await shoot(page, 'loaded');
  await page.setViewportSize({ width: 1440, height: 900 });
  // Desktop: the sectors side by side, the summary aside with who has no stand.
  const boxes = await Promise.all(team.sectors.slice(0, 2).map((s) => page.getByTestId(`alloc-sector-${s.name}`).boundingBox()));
  expect(Math.abs((boxes[0]?.y ?? 0) - (boxes[1]?.y ?? 1))).toBeLessThan(2);
  await expect(page.getByTestId('alloc-summary')).toContainText('19/20');
  await expect(page.getByTestId('alloc-unseated')).toContainText('Fără stand (1)');
  await expectNoA11yViolations(page);
  onlyWrites(watch, []);
  expect(errors).toEqual([]);
});

test('organizer.participants.c6 c7 — the picker: registered only, team labels + members, seated disabled and last, trash empties a stand', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const [s0, s1] = team.sectors;
  const target = teamAllocated[s0.stands[0].documentId]!.registrationId;
  const other = teamAllocated[s0.stands[1].documentId]!.registrationId;
  const { watch, errors } = await open(page, `/concursuri/${TEAM}/alocare`, (p) =>
    editJson<Competition>(p, competitionPath(TEAM), (c) => ({
      ...c,
      registrations: [
        ...c.registrations.map((r) =>
          r.documentId === target
            ? { ...r, club: { name: 'CS Crapul Vesel' }, teamName: 'Rechinii', participants: [{ id: 901, documentId: 'u901', username: 'ion.pescar', avatar: null }] }
            : r.documentId === other
              ? { ...r, club: { name: 'Clubul Mare' }, teamName: null }
              : r,
        ),
        // Not registered: never offered.
        { id: 99001, documentId: 'pending-team', registrationStatus: 'pending', teamName: 'În așteptare', guestName: 'În așteptare', stand: null, club: null, author: null, participants: [] },
      ],
    })),
  );
  await loaded(page, s0.name);
  // Empty the first stand (trash), then open the picker from the row.
  await row(page, s0.name, s0.stands[0].name).getByTestId('alloc-clear').click();
  await expect(row(page, s0.name, s0.stands[0].name)).toContainText(`Stand ${s0.stands[0].name}-`);
  await openRow(page, s0.name, s0.stands[0].name);
  const picker = page.getByRole('dialog', { name: `Sector ${s0.name} · Stand ${s0.stands[0].name}` });
  await expect(picker).toBeVisible();
  const options = picker.getByRole('list', { name: 'Înscrieri' }).getByRole('button');
  await expect(options).toHaveCount(20);
  // The freed team is the one choosable entry, first; «Club - Echipă» with its member under it.
  await expect(options.first()).toHaveAccessibleName('CS Crapul Vesel - Rechinii');
  await expect(options.first()).toContainText('ion.pescar');
  await expect(options.first()).toBeEnabled();
  // «Club» alone for a team without a name; seated → disabled, its stand as the reason.
  const club = picker.getByRole('button', { name: `Clubul Mare, Stand ${s0.name}${s0.stands[1].name}` });
  await expect(club).toBeDisabled();
  await expect(picker.getByText('În așteptare')).toHaveCount(0);
  await shoot(page, 'picker');
  await expectNoA11yViolations(page);
  // Search matches the label; nothing → «Nu s-au găsit rezultate».
  const search = picker.getByRole('searchbox', { name: 'Caută participantul' });
  await search.fill('rechin');
  await expect(options).toHaveCount(1);
  await search.fill('zzzz');
  await expect(picker.getByText('Nu s-au găsit rezultate')).toBeVisible();
  await search.fill('');
  // Choosing seats it and closes; re-opening the stand marks it selected.
  await options.first().click();
  await expect(picker).toBeHidden();
  await expect(row(page, s0.name, s0.stands[0].name)).toContainText('Rechinii: ion.pescar');
  // Moving it: clear here, put it on a stand of the next sector (the row's own pencil opens the picker).
  await row(page, s0.name, s0.stands[0].name).getByTestId('alloc-clear').click();
  await row(page, s1.name, s1.stands[0].name).getByTestId('alloc-clear').click();
  await row(page, s1.name, s1.stands[0].name).getByTestId('alloc-edit').click();
  const picker2 = page.getByRole('dialog', { name: `Sector ${s1.name} · Stand ${s1.stands[0].name}` });
  await expect(picker2.getByRole('list', { name: 'Înscrieri' }).getByRole('button').filter({ hasNotText: 'Stand ' })).toHaveCount(2);
  await picker2.getByRole('button', { name: 'CS Crapul Vesel - Rechinii' }).click();
  await expect(row(page, s1.name, s1.stands[0].name)).toContainText('Rechinii: ion.pescar');
  onlyWrites(watch, []);
  expect(errors).toEqual([]);
});

test('organizer.participants.c7 — individual labels «Club - user» / «user» / guest; search by username+id and «Fără cont #id»', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const [a, b] = feeder.registrations;
  const { watch, errors } = await open(page, `/concursuri/${FEEDER}/alocare`, async (p) => {
    await editJson<Allocated>(p, allocationsPath(FEEDER), (al) => Object.fromEntries(Object.keys(al).map((k) => [k, null])));
    // The local feeder is completed: back before its start, where the normal allocation opens.
    await editJson<Competition>(p, competitionPath(FEEDER), (c) => ({
      ...c,
      competitionStatus: 'notStarted',
      currentRound: null,
      roundStatus: null,
      registrations: c.registrations.map((r) =>
        r.documentId === a.documentId
          ? { ...r, club: { name: 'CS Crapul Vesel' }, participants: [{ id: 55, documentId: 'u55', username: 'ionpescar', avatar: null }] }
          : r.documentId === b.documentId
            ? { ...r, participants: [{ id: 56, documentId: 'u56', username: 'anacrap', avatar: null }] }
            : r,
      ),
    }));
  });
  await loaded(page, feeder.sectors[0].name);
  const s = feeder.sectors[0];
  await openRow(page, s.name, s.stands[0].name);
  const picker = page.getByRole('dialog', { name: `Sector ${s.name} · Stand ${s.stands[0].name}` });
  const options = picker.getByRole('list', { name: 'Înscrieri' }).getByRole('button');
  await expect(options).toHaveCount(feeder.registrations.length);
  await expect(options.nth(0)).toHaveAccessibleName('CS Crapul Vesel - ionpescar');
  await expect(options.nth(1)).toHaveAccessibleName('anacrap');
  await expect(options.nth(2)).toHaveAccessibleName(feeder.registrations[2].guestName!);
  const search = picker.getByRole('searchbox', { name: 'Caută participantul' });
  await search.fill('ionpescar55');
  await expect(options).toHaveCount(1);
  await expect(options.first()).toHaveAccessibleName('CS Crapul Vesel - ionpescar');
  await search.fill(`Fără cont #${feeder.registrations[3].id}`);
  await expect(options).toHaveCount(1);
  await expect(options.first()).toHaveAccessibleName(feeder.registrations[3].guestName!);
  await search.fill('');
  await shoot(page, 'picker-individual');
  onlyWrites(watch, []);
  expect(errors).toEqual([]);
});

test('organizer.participants.c8 — «Finalizează alocarea» POSTs { allocations: { registrationId: standId } }, toast, back + refetch', async ({ page }) => {
  await page.setViewportSize(PHONE);
  let release!: () => void;
  const hold = new Promise<void>((r) => (release = r));
  let sent: Sent = [];
  const [s0, s1] = team.sectors;
  const { watch, errors } = await open(page, `/concursuri/${TEAM}/alocare`, async (p) => {
    sent = await mockWrite(p, allocatePath(TEAM), async (route) => {
      await hold;
      await route.fulfill({ json: { success: true } });
    });
  });
  await loaded(page, s0.name);
  // Swap: empty s0's first stand and s1's first stand, then seat s0's team on s1's stand.
  const moved = teamAllocated[s0.stands[0].documentId]!.registrationId;
  const dropped = teamAllocated[s1.stands[0].documentId]!.registrationId;
  await row(page, s0.name, s0.stands[0].name).getByTestId('alloc-clear').click();
  await row(page, s1.name, s1.stands[0].name).getByTestId('alloc-clear').click();
  await openRow(page, s1.name, s1.stands[0].name);
  const reg = regById(team, moved);
  await page
    .getByRole('dialog', { name: `Sector ${s1.name} · Stand ${s1.stands[0].name}` })
    .getByRole('button', { name: reg.teamName ?? reg.guestName ?? '', exact: true })
    .click();
  const save = page.getByRole('button', { name: 'Finalizează alocarea' });
  await save.click();
  await expect(save).toHaveAttribute('aria-busy', 'true');
  await expect(save).toBeDisabled();
  await expect(row(page, s0.name, s0.stands[1].name).getByRole('button').first()).toBeDisabled();
  await shoot(page, 'saving');
  const before = { c: count(watch, competitionPath(TEAM)), a: count(watch, allocationsPath(TEAM)), r: count(watch, registrationsPath(TEAM)) };
  release();
  await expect(page.getByText('Alocarea participanților a fost realizată cu succes')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${TEAM}$`));
  const expected: Record<string, string> = {};
  for (const [standId, a] of Object.entries(teamAllocated)) if (a) expected[a.registrationId] = standId;
  delete expected[dropped];
  expected[moved] = s1.stands[0].documentId;
  expect(sent).toEqual([{ method: 'POST', body: { allocations: expected } }]);
  await expect.poll(() => count(watch, competitionPath(TEAM))).toBeGreaterThan(before.c);
  await expect.poll(() => count(watch, registrationsPath(TEAM)) + count(watch, allocationsPath(TEAM))).toBeGreaterThan(before.r + before.a);
  // No history entry left behind (fish router.back()).
  await page.goBack();
  await page.waitForLoadState('domcontentloaded');
  expect(path(page.url())).not.toMatch(/\/alocare$/);
  onlyWrites(watch, [`POST ${allocatePath(TEAM)}`]);
  expect(errors).toEqual([]);
});

test('organizer.participants.c8 — an error toasts the server message, keeps the edits and still refetches', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  let sent: Sent = [];
  const s0 = team.sectors[0];
  const { watch } = await open(page, `/concursuri/${TEAM}/alocare`, async (p) => {
    sent = await mockWrite(p, allocatePath(TEAM), (route) =>
      route.fulfill({
        status: 400,
        json: { data: null, error: { status: 400, name: 'BadRequestError', message: 'Standul este deja ocupat.', details: { bluCode: 'STAND_TAKEN' } } },
      }),
    );
  });
  await loaded(page, s0.name);
  await row(page, s0.name, s0.stands[0].name).getByTestId('alloc-clear').click();
  const before = { a: count(watch, allocationsPath(TEAM)), r: count(watch, registrationsPath(TEAM)) };
  await page.getByRole('button', { name: 'Finalizează alocarea' }).click();
  await expect(page.getByText('Standul este deja ocupat.')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${TEAM}/alocare$`));
  await expect(row(page, s0.name, s0.stands[0].name)).toContainText(`Stand ${s0.stands[0].name}-`);
  await expect(page.getByRole('button', { name: 'Finalizează alocarea' })).toBeEnabled();
  await expect.poll(() => count(watch, allocationsPath(TEAM))).toBeGreaterThan(before.a);
  await expect.poll(() => count(watch, registrationsPath(TEAM))).toBeGreaterThan(before.r);
  // The refetch keeps the edit.
  await expect(row(page, s0.name, s0.stands[0].name)).toContainText(`Stand ${s0.stands[0].name}-`);
  expect(sent).toHaveLength(1);
  onlyWrites(watch, [`POST ${allocatePath(TEAM)}`]);
});

test('organizer.participants.c2 c3 c5 c7 c9 + b.feeder-allocate-next — ?mansa=2: empty leg seating, previous seats, save gated on all seated, PUT rounds/2/allocation', async ({ page }) => {
  await page.setViewportSize(PHONE);
  let sent: Sent = [];
  const seats: Record<string, string> = {};
  const { watch, errors } = await open(page, `/concursuri/${FEEDER}/alocare?mansa=2`, async (p) => {
    await editJson<Competition>(p, competitionPath(FEEDER), legOneClosed);
    // The local ranking has no leg-1 seats: give each entrant one («M1: A/1»…).
    await editJson<{ rankings: { registrationId: string; rounds: { round: number; sectorName: string | null; standName: string | null }[] }[] }>(
      p,
      rankingPath(FEEDER),
      (r) => ({
        ...r,
        rankings: r.rankings.map((x, i) => {
          const sector = feeder.sectors[i % feeder.sectors.length];
          const stand = sector.stands[Math.floor(i / feeder.sectors.length) % sector.stands.length];
          seats[x.registrationId] = `M1: ${sector.name}/${stand.name}`;
          return { ...x, rounds: x.rounds.map((c) => (c.round === 1 ? { ...c, sectorName: sector.name, standName: stand.name } : c)) };
        }),
      }),
    );
    sent = await mockWrite(p, legPath(FEEDER, 2), (route) => route.fulfill({ json: { data: { round: 2, allocated: feeder.registrations.length } } }));
  });
  await loaded(page, feeder.sectors[0].name);
  const n = feeder.registrations.filter((r) => r.registrationStatus === 'registered').length;
  await expect(page.getByRole('heading', { level: 1, name: 'Standuri manșa 2' })).toBeVisible();
  await expect(page.getByTestId('alloc-leg-intro')).toHaveText(
    'Introdu rezultatul tragerii la sorți pentru manșa 2: alege participantul de pe fiecare stand. Sub fiecare nume vezi unde a pescuit în manșa anterioară.',
  );
  // Starts empty (the allocations of leg 1 are not copied).
  await expect(page.locator('[data-testid^="alloc-stand-"][data-filled]')).toHaveCount(0);
  const save = page.getByRole('button', { name: `Salvează standurile (0/${n})` });
  await expect(save).toBeDisabled();
  await shoot(page, 'leg-empty');
  // Seat everyone, in order, stand by stand; each option shows the previous leg's seat.
  const stands = feeder.sectors.flatMap((s) => s.stands.map((st) => ({ sector: s.name, stand: st })));
  const expected: Record<string, string> = {};
  for (let i = 0; i < n; i++) {
    const { sector, stand } = stands[i];
    await openRow(page, sector, stand.name);
    const picker = page.getByRole('dialog', { name: `Sector ${sector} · Stand ${stand.name}` });
    const first = picker.getByRole('list', { name: 'Înscrieri' }).getByRole('button').first();
    const label = (await first.getAttribute('aria-label')) ?? '';
    const reg = feeder.registrations.find((r) => (r.participants[0]?.username || r.guestName) === label)!;
    await expect(first).toContainText(seats[reg.documentId]);
    if (i === 0) await shoot(page, 'leg-picker');
    await first.click();
    await expect(picker).toBeHidden();
    expected[reg.documentId] = stand.documentId;
    if (i < n - 1) await expect(page.getByRole('button', { name: `Salvează standurile (${i + 1}/${n})` })).toBeDisabled();
  }
  const ready = page.getByRole('button', { name: `Salvează standurile (${n}/${n})` });
  await expect(ready).toBeEnabled();
  await ready.click();
  await expect(page.getByText('Standurile pentru manșa 2 au fost salvate')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${FEEDER}$`));
  expect(sent).toEqual([{ method: 'PUT', body: { allocations: expected } }]);
  onlyWrites(watch, [`PUT ${legPath(FEEDER, 2)}`]);
  expect(errors).toEqual([]);
});

test('organizer.participants — leaving with unsaved changes asks «Renunți la modificări?»', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const s0 = team.sectors[0];
  const { watch } = await open(page, `/concursuri/${TEAM}/alocare`);
  await loaded(page, s0.name);
  await row(page, s0.name, s0.stands[0].name).getByTestId('alloc-clear').click();
  await page.getByRole('link', { name: 'Înapoi la concurs' }).click();
  const guard = page.getByRole('alertdialog', { name: 'Renunți la modificări?' });
  await expect(guard).toBeVisible();
  await guard.getByRole('button', { name: 'Continuă editarea' }).click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${TEAM}/alocare$`));
  await page.getByRole('link', { name: 'Înapoi la concurs' }).click();
  await page.getByRole('alertdialog', { name: 'Renunți la modificări?' }).getByRole('button', { name: 'Renunță' }).click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${TEAM}$`));
  onlyWrites(watch, []);
});

test('organizer.participants — not the author → the neutral gate, no stands', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const { watch } = await open(page, `/concursuri/${TEAM}/alocare`, (p) =>
    p.route((url) => url.pathname === statutePath(TEAM), (route) => route.fulfill({ json: { userRole: 'participant' } })),
  );
  await expect(page.getByRole('heading', { name: 'Doar pentru organizatorul concursului' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 2, name: /^Sector / })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Finalizează alocarea' })).toHaveCount(0);
  onlyWrites(watch, []);
});

test('organizer.participants.c8 — nothing changed: the save is off («Nicio modificare de salvat.»), pressing it sends nothing', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const s0 = team.sectors[0];
  // A mock that would answer — it must never be called.
  let sent: Sent = [];
  const { watch, errors } = await open(page, `/concursuri/${TEAM}/alocare`, async (p) => {
    sent = await mockWrite(p, allocatePath(TEAM), (route) => route.fulfill({ json: { success: true } }));
  });
  await loaded(page, s0.name);
  await expect(page.getByTestId('alloc-progress')).toHaveText('20 din 20 de înscrieri confirmate au stand.');
  const save = page.getByRole('button', { name: 'Finalizează alocarea' });
  await expect(save).toBeDisabled();
  await expect(save).toHaveAccessibleDescription(/Nicio modificare de salvat\./);
  await save.click({ force: true });
  // An edit turns it on; undoing it (the same team back on its stand) turns it off again.
  const moved = teamAllocated[s0.stands[0].documentId]!.registrationId;
  const reg = regById(team, moved);
  await row(page, s0.name, s0.stands[0].name).getByTestId('alloc-clear').click();
  await expect(save).toBeEnabled();
  await expect(page.getByTestId('alloc-no-changes')).toHaveCount(0);
  await openRow(page, s0.name, s0.stands[0].name);
  await page
    .getByRole('dialog', { name: `Sector ${s0.name} · Stand ${s0.stands[0].name}` })
    .getByRole('button', { name: reg.teamName ?? reg.guestName ?? '', exact: true })
    .click();
  await expect(save).toBeDisabled();
  await save.click({ force: true });
  await page.waitForTimeout(800);
  await expect(page).toHaveURL(new RegExp(`/concursuri/${TEAM}/alocare$`));
  expect(sent).toEqual([]);
  onlyWrites(watch, []);
  expect(errors).toEqual([]);
});

test('organizer.participants — a started / ended competition: a neutral gate instead of the editor (the CMS refuses it)', async ({ page }) => {
  await page.setViewportSize(PHONE);
  let status = 'started';
  const { watch, errors } = await open(page, `/concursuri/${TEAM}/alocare`, (p) =>
    editJson<Competition>(p, competitionPath(TEAM), (c) => ({ ...c, competitionStatus: status })),
  );
  for (const next of ['started', 'completed']) {
    status = next;
    if (next !== 'started') await page.reload();
    await expect(page.getByRole('heading', { level: 2, name: 'Alocarea nu mai poate fi modificată' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Competiția a început deja, nu se mai pot face modificări')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: /^Sector / })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Finalizează alocarea' })).toHaveCount(0);
    await expect(page.getByRole('main').getByRole('link', { name: 'Înapoi la concurs' }).last()).toHaveAttribute('href', `/concursuri/${TEAM}`);
  }
  await shoot(page, 'started-gate');
  await expectNoA11yViolations(page);
  onlyWrites(watch, []);
  expect(errors).toEqual([]);
});

test('organizer.b.feeder-allocate-next — ?mansa=N only for the leg «Reașază pentru manșa N» offers; else a neutral gate', async ({ page }) => {
  await page.setViewportSize(PHONE);
  type Case = { id: string; at: string; edit: (c: Competition) => Competition; n: number };
  const cases: Case[] = [
    // Beyond the legs (leg 1 closed: only 2 is valid).
    { id: FEEDER, at: `/concursuri/${FEEDER}/alocare?mansa=9`, edit: legOneClosed, n: 9 },
    // The leg is already running.
    { id: FEEDER, at: `/concursuri/${FEEDER}/alocare?mansa=2`, edit: (c) => ({ ...c, competitionStatus: 'started', currentRound: 2, roundStatus: 'running' }), n: 2 },
    // The previous leg is not closed yet.
    { id: FEEDER, at: `/concursuri/${FEEDER}/alocare?mansa=2`, edit: (c) => ({ ...c, competitionStatus: 'started', currentRound: 1, roundStatus: 'running' }), n: 2 },
    // Not a feeder competition.
    { id: TEAM, at: `/concursuri/${TEAM}/alocare?mansa=2`, edit: (c) => c, n: 2 },
  ];
  let current = cases[0];
  const { watch, errors } = await open(page, cases[0].at, async (p) => {
    for (const id of [FEEDER, TEAM]) await editJson<Competition>(p, competitionPath(id), (c) => (current.id === id ? current.edit(c) : c));
  });
  for (const [i, c] of cases.entries()) {
    current = c;
    if (i > 0) await page.goto(c.at);
    await expect(page.getByRole('heading', { level: 1, name: `Standuri manșa ${c.n}` })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 2, name: `Standurile pentru manșa ${c.n} nu se pot stabili acum` })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 2, name: /^Sector / })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Salvează standurile/ })).toHaveCount(0);
    await expect(page.getByRole('main').getByRole('link', { name: 'Înapoi la concurs' }).last()).toHaveAttribute('href', `/concursuri/${c.id}`);
    if (i === 0) await shoot(page, 'leg-gate');
  }
  onlyWrites(watch, []);
  expect(errors).toEqual([]);
});
