import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL } from './helpers/base-url';
import { collectConsoleErrors } from './helpers/console';
import { expect, test, type OrganizerHarness } from './helpers/fake-organizer';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * «Aplică penalizare» (parity organizer.penalties-apply c1–c7; fish app/(app)/penalties/[competitionId]/apply.tsx).
 *
 * READS hit the local CMS: «TEST Card · Echipă» (team, quantity: «Nada Grea» on Sector A, Stand 1 with
 * two members) and «Andrew 1» (individual, quantity: a guest and a participant). The statute is served
 * per test (author / referee / participant); the competition is served «started» (penalties exist only
 * while it runs), and a status, ranking type, stand or failure the data does not have is made by editing
 * the real read in page.route.
 * WRITES NEVER reach the CMS: a penalty pushes to every participant, referee and follower and posts in
 * the competition chat. The harness (helpers/fake-organizer) aborts and fails on any un-mocked non-GET;
 * every POST here is route-mocked and its method, path and body asserted.
 */

test.describe.configure({ timeout: 180_000, retries: 1 });

const TEAM = process.env.E2E_PENALTY_TEAM_COMPETITION ?? 'g5l98otx5ypg6wttowra9yww';
const TEAM_REG = process.env.E2E_PENALTY_TEAM_REGISTRATION ?? 's2mx0gunmo63zr9fiv2o8ocw';
const SINGLE = process.env.E2E_PENALTY_SINGLE_COMPETITION ?? 'i8kzbi5k51vmbyq75dmyez3d';

const WIDTHS = [375, 1280, 1440, 1920];
const apply = (c: string, r?: string) => `/concursuri/${c}/penalizari/aplica${r ? `?inscriere=${r}` : ''}`;
const hub = (c: string) => new RegExp(`/concursuri/${c}/penalizari$`);
const stands = (c: string) => new RegExp(`/concursuri/${c}/penalizari/stand$`);
const penaltyPath = (c: string, r: string) => `/competitions/${c}/registrations/${r}/penalties`;

type Reg = { documentId: string; teamName: string | null; guestName?: string | null; participants?: { username: string }[]; stand?: { id?: number; documentId: string; name: string } | null };
type Sector = { name: string; stands: { documentId: string }[] };
type Role = 'author' | 'referee' | 'participant' | null;

let jwt = '';
let team: { reg: Reg; sector: string };
let single: { guest: Reg; angler: Reg; sectors: Sector[] };

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  mkdirSync('.shots', { recursive: true });
  const auth = { headers: { Authorization: `Bearer ${jwt}` } };
  const regs = async (c: string) => (await (await request.get(`${CMS}/competitions/${c}/registrations`, auth)).json()) as Reg[];
  const sectors = async (c: string) => ((await (await request.get(`${CMS}/feed/competitions/${c}`)).json()) as { data: { sectors: Sector[] } }).data.sectors;

  const teamReg = (await regs(TEAM)).find((r) => r.documentId === TEAM_REG);
  expect(teamReg?.stand, 'the team fixture registration must be allocated').toBeTruthy();
  const teamSectors = await sectors(TEAM);
  const s = teamSectors.find((x) => x.stands.some((st) => st.documentId === teamReg!.stand!.documentId));
  expect(s).toBeTruthy();
  expect(teamReg!.participants!.length).toBeGreaterThanOrEqual(2);
  team = { reg: teamReg!, sector: s!.name };

  const singleRegs = (await regs(SINGLE)).filter((r) => r.stand);
  const guest = singleRegs.find((r) => r.guestName);
  const angler = singleRegs.find((r) => !r.guestName && r.participants?.length);
  expect(guest && angler, 'the single fixture needs an allocated guest and an allocated angler').toBeTruthy();
  single = { guest: guest!, angler: angler!, sectors: await sectors(SINGLE) };
});

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

const path = (url: string) => new URL(url).pathname;

type Served = {
  rankingType?: string;
  competitionStatus?: string;
  failRegistrations?: boolean;
  /** Edits the real registrations read (e.g. a stand removed). */
  editRegistrations?: (regs: Reg[]) => Reg[];
};

async function open(page: Page, { at, role = 'author', served = {} }: { at: string; role?: Role; served?: Served }) {
  await signIn(page.context(), jwt);
  const reads: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'GET' && path(r.url()).startsWith('/api/cms/')) reads.push(path(r.url()));
  });
  const errors = collectConsoleErrors(page, {
    ignore: /Failed to load resource: the server responded with a status of (500|409|400)/,
  });
  await page.route(
    (url) => url.pathname.startsWith('/api/cms/user/profile/competition/') && url.pathname.endsWith('/statute'),
    (route) => route.fulfill({ json: { userRole: role, isReferee: false, isParticipant: false } }),
  );
  await page.route(
    (url) => /^\/api\/cms\/feed\/competitions\/[^/]+$/.test(url.pathname),
    async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const res = await route.fetch();
      const body = (await res.json()) as { data: Record<string, unknown> };
      await route.fulfill({
        response: res,
        json: {
          ...body,
          data: {
            ...body.data,
            rankingType: served.rankingType ?? body.data.rankingType,
            // The local fixtures are finished; a penalty is only possible while the competition runs.
            competitionStatus: served.competitionStatus ?? 'started',
          },
        },
      });
    },
  );
  await page.route(
    (url) => /^\/api\/cms\/competitions\/[^/]+\/registrations$/.test(url.pathname),
    async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      if (served.failRegistrations) return route.fulfill({ status: 500, json: { data: null, error: { status: 500, message: 'boom' } } });
      if (served.editRegistrations) {
        const res = await route.fetch();
        return route.fulfill({ response: res, json: served.editRegistrations((await res.json()) as Reg[]) });
      }
      return route.fallback();
    },
  );
  await page.goto(at);
  return { reads, errors };
}

const h1 = (page: Page) => page.getByRole('heading', { level: 1, name: 'Aplică penalizare' });
const submitBtn = (page: Page) => page.getByTestId('penalty-apply-submit');
const reason = (page: Page) => page.getByRole('textbox', { name: /^Motivul/ });
const weight = (page: Page) => page.getByRole('textbox', { name: 'Greutate de penalizat' });
const radio = (page: Page, name: string) => page.getByRole('radio', { name: new RegExp(`^${name}`) });
/** Picks an action as a person does: a click on its card (the radio itself is sr-only). */
const pick = (page: Page, name: string) => page.locator('label').filter({ has: radio(page, name) }).click();

/** Loaded (one reload if the shared dev server's Fast Refresh strands the first load). */
async function loaded(page: Page) {
  const ok = await submitBtn(page).waitFor({ timeout: 20_000 }).then(
    () => true,
    () => false,
  );
  if (!ok) await page.reload();
  await expect(submitBtn(page)).toBeVisible({ timeout: 30_000 });
}

async function shoot(page: Page, name: string) {
  const size = page.viewportSize() ?? { width: 375, height: 812 };
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `.shots/penalizari-aplica-${name}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize(size);
}

const visibleSubject = (page: Page) => page.getByTestId('penalty-subject').locator('visible=true').first();

const okPenalty = (body: Record<string, unknown>) => ({
  status: 201,
  json: { documentId: 'pen-e2e', action: body.action, value: body.value ?? null, reason: body.reason, createdAt: new Date().toISOString() },
});

async function mockApply(organizer: OrganizerHarness, c: string, r: string, respond?: Parameters<OrganizerHarness['mockWrite']>[2]) {
  await organizer.mockWrite('POST', penaltyPath(c, r), respond ?? ((w) => okPenalty(w.body as Record<string, unknown>)));
}

test.describe('c1 c3 the subject and the three cards', () => {
  test('team: «Sector X, Stand N», «Echipa …», members as bullets; Avertisment preselected with fish copy', async ({ page }) => {
    const { errors } = await open(page, { at: apply(TEAM, TEAM_REG), role: 'referee' });
    await loaded(page);
    await expect(h1(page)).toBeVisible();
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const card = visibleSubject(page);
      await expect(card).toContainText(`Sector ${team.sector}, Stand ${team.reg.stand!.name}`);
      await expect(card).toContainText(`Echipa ${team.reg.teamName}`);
      for (const p of team.reg.participants!) await expect(card.getByRole('listitem').filter({ hasText: p.username })).toBeVisible();
    }
    await expect(page.getByRole('group', { name: 'Tip penalizare' })).toBeVisible();
    await expect(radio(page, 'Avertisment')).toBeChecked();
    await expect(radio(page, 'Penalizare greutate')).not.toBeChecked();
    await expect(radio(page, 'Eliminare')).not.toBeChecked();
    await expect(page.getByText('Doar pentru istoric. Nu modifică clasamentul.').first()).toBeVisible();
    await expect(page.getByText('Scade o cantitate (kg) din greutatea totală a echipei. Capturile rămân intacte.').first()).toBeVisible();
    await expect(page.getByText('Echipa este forțată pe ultimul loc în clasament.').first()).toBeVisible();
    // The referee's cards: yellow, yellow, red.
    const tones = await page.locator('form [data-tone]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tone')));
    expect(tones).toEqual(['warning', 'warning', 'danger']);
    await expect(weight(page)).toHaveCount(0);
    await expectNoA11yViolations(page);
    await shoot(page, 'team');
    // Keyboard: the group is one tab stop, the arrows move the choice.
    await radio(page, 'Avertisment').focus();
    await page.keyboard.press('ArrowDown');
    await expect(radio(page, 'Penalizare greutate')).toBeChecked();
    await expect(weight(page)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('individual: the guest name, or the angler; no bullets', async ({ page }) => {
    await open(page, { at: apply(SINGLE, single.guest.documentId), role: 'author' });
    await loaded(page);
    const sectorOf = (r: Reg) => single.sectors.find((s) => s.stands.some((st) => st.documentId === r.stand!.documentId))!.name;
    let card = visibleSubject(page);
    await expect(card).toContainText(`Sector ${sectorOf(single.guest)}, Stand ${single.guest.stand!.name}`);
    await expect(card).toContainText(single.guest.guestName!);
    await expect(card.getByRole('listitem')).toHaveCount(0);
    await shoot(page, 'guest');

    await page.goto(apply(SINGLE, single.angler.documentId));
    await loaded(page);
    card = visibleSubject(page);
    await expect(card).toContainText(`Sector ${sectorOf(single.angler)}, Stand ${single.angler.stand!.name}`);
    await expect(card).toContainText(single.angler.participants![0].username);
    await expect(card).not.toContainText('Echipa');
    await expect(card.getByRole('listitem')).toHaveCount(0);
  });
});

test.describe('c2 where the page sends you', () => {
  test('an unknown registration → the stand picker', async ({ page }) => {
    await open(page, { at: apply(TEAM, 'nu-exista'), role: 'author' });
    await expect(page).toHaveURL(stands(TEAM), { timeout: 30_000 });
  });

  test('no «inscriere» → the stand picker, without reading the registrations', async ({ page }) => {
    const { reads } = await open(page, { at: apply(TEAM), role: 'author' });
    await expect(page).toHaveURL(stands(TEAM), { timeout: 30_000 });
    expect(reads.filter((r) => r.endsWith(`/competitions/${TEAM}/registrations`))).toEqual([]);
  });

  test('a competition that is not running (completed / not started) → the hub, never the form', async ({ page }) => {
    for (const competitionStatus of ['completed', 'notStarted']) {
      await open(page, { at: apply(TEAM, TEAM_REG), role: 'author', served: { competitionStatus } });
      await expect(page).toHaveURL(hub(TEAM), { timeout: 30_000 });
      await expect(reason(page)).toHaveCount(0);
    }
  });

  test('a registration without a stand, or on a stand outside every sector → the stand picker', async ({ page }) => {
    const variants: ((r: Reg) => Reg)[] = [
      (r) => ({ ...r, stand: null }),
      (r) => ({ ...r, stand: { id: 999_999, documentId: 'nu-exista-in-sector', name: '99' } }),
    ];
    for (const edit of variants) {
      await open(page, {
        at: apply(TEAM, TEAM_REG),
        role: 'author',
        served: { editRegistrations: (regs) => regs.map((r) => (r.documentId === TEAM_REG ? edit(r) : r)) },
      });
      await expect(page).toHaveURL(stands(TEAM), { timeout: 30_000 });
      await expect(page.getByText('Nealocat')).toHaveCount(0);
    }
  });

  test('a ranking type without penalties → the hub', async ({ page }) => {
    await open(page, { at: apply(TEAM, TEAM_REG), role: 'author', served: { rankingType: 'feederRounds' } });
    await expect(page).toHaveURL(hub(TEAM), { timeout: 30_000 });
  });
});

test.describe('c4 c5 validation', () => {
  test('weight: revealed by «Penalizare greutate», kg, placeholder 0.000, refuses missing / ≤ 0; reason 5–255 with its counter', async ({ page, organizer }) => {
    await mockApply(organizer, TEAM, TEAM_REG);
    await open(page, { at: apply(TEAM, TEAM_REG), role: 'author' });
    await loaded(page);
    await expect(reason(page)).toHaveAttribute('placeholder', 'Descrie motivul (5-255 caractere)');
    await expect(page.getByText('0 / 255')).toBeVisible();

    await reason(page).fill('abc');
    await expect(page.getByText('Motivul trebuie să aibă cel puțin 5 caractere')).toBeVisible();
    await reason(page).fill('x'.repeat(300));
    expect((await reason(page).inputValue()).length).toBe(255);
    await expect(page.getByText('255 / 255')).toBeVisible();

    await pick(page, 'Penalizare greutate');
    await expect(radio(page, 'Penalizare greutate')).toBeChecked();
    await expect(weight(page)).toBeVisible();
    await expect(weight(page)).toHaveAttribute('placeholder', '0.000');
    await expect(weight(page)).toHaveAttribute('inputmode', 'decimal');
    const msg = 'Valoare obligatorie (kg) — trebuie să fie un număr mai mare ca 0';
    await reason(page).fill('Prea multe lansete în apă');
    await submitBtn(page).click();
    await expect(page.getByText(msg)).toBeVisible();
    await expect(weight(page)).toBeFocused();
    await weight(page).fill('0');
    await expect(page.getByText(msg)).toBeVisible();
    await weight(page).fill('-2');
    await submitBtn(page).click();
    await expect(page.getByText(msg)).toBeVisible();
    expect(organizer.writes).toEqual([]);
    await page.setViewportSize({ width: 375, height: 900 });
    await page.screenshot({ path: '.shots/penalizari-aplica-errors-375.png', fullPage: true });
    await expectNoA11yViolations(page);
  });

  test('a reason padded with spaces is measured trimmed: «   abcd» is too short, nothing is sent', async ({ page, organizer }) => {
    await mockApply(organizer, TEAM, TEAM_REG);
    await open(page, { at: apply(TEAM, TEAM_REG), role: 'author' });
    await loaded(page);
    await reason(page).fill('   abcd');
    await submitBtn(page).click();
    await expect(page.getByText('Motivul trebuie să aibă cel puțin 5 caractere')).toBeVisible();
    await expect(reason(page)).toBeFocused();
    expect(organizer.writes).toEqual([]);
  });

  test('a short reason blocks the submit and takes focus', async ({ page, organizer }) => {
    await mockApply(organizer, TEAM, TEAM_REG);
    await open(page, { at: apply(TEAM, TEAM_REG), role: 'author' });
    await loaded(page);
    await submitBtn(page).click();
    await expect(page.getByText('Motivul trebuie să aibă cel puțin 5 caractere')).toBeVisible();
    await expect(reason(page)).toBeFocused();
    expect(organizer.writes).toEqual([]);
  });
});

test.describe('c6 «Aplică»', () => {
  for (const [label, action] of [
    ['Avertisment', 'WARNING'],
    ['Eliminare', 'ELIMINATE'],
  ] as const) {
    test(`${label}: POST with the trimmed reason and no value → toast → the hub`, async ({ page, organizer }) => {
      await mockApply(organizer, TEAM, TEAM_REG, (w) => ({ ...okPenalty(w.body as Record<string, unknown>), delayMs: 1200 }));
      await open(page, { at: apply(TEAM, TEAM_REG), role: 'referee' });
      await loaded(page);
      if (action !== 'WARNING') await pick(page, label);
      await reason(page).fill('   Comportament nesportiv la cântar   ');
      await submitBtn(page).click();
      // Loading while the POST is out: busy, «Se aplică…», no second POST on a second click.
      await expect(submitBtn(page)).toHaveAttribute('aria-busy', 'true');
      await expect(submitBtn(page)).toHaveText('Se aplică…');
      await submitBtn(page).click({ force: true }).catch(() => {});
      await expect(page.getByText('Penalizarea a fost aplicată')).toBeVisible({ timeout: 15_000 });
      await expect(page).toHaveURL(hub(TEAM), { timeout: 30_000 });
      expect(organizer.writes).toHaveLength(1);
      expect(organizer.writes[0]).toMatchObject({ method: 'POST', path: penaltyPath(TEAM, TEAM_REG) });
      expect(organizer.writes[0].body).toEqual({ action, reason: 'Comportament nesportiv la cântar' });
    });
  }

  test('Penalizare greutate: the value parsed from a comma', async ({ page, organizer }) => {
    await mockApply(organizer, TEAM, TEAM_REG);
    await open(page, { at: apply(TEAM, TEAM_REG), role: 'author' });
    await loaded(page);
    await pick(page, 'Penalizare greutate');
    await weight(page).fill('1,5');
    await reason(page).fill('Peşte sub măsură reținut');
    await page.setViewportSize({ width: 1440, height: 900 });
    const summary = page.getByTestId('penalty-summary');
    await expect(summary).toContainText('Penalizare greutate');
    await expect(summary).toContainText('1,5 kg');
    await expect(summary).toContainText('Peşte sub măsură reținut');
    await page.screenshot({ path: '.shots/penalizari-aplica-weight-1440.png', fullPage: true });
    await submitBtn(page).click();
    await expect(page).toHaveURL(hub(TEAM), { timeout: 30_000 });
    expect(organizer.writes.map((w) => w.body)).toEqual([{ action: 'DEDUCT_TOTAL_WEIGHT', value: 1.5, reason: 'Peşte sub măsură reținut' }]);
  });
});

test.describe('c7 failures', () => {
  test('PENALTY:ALREADY_ELIMINATED: inline under «Tip penalizare», cleared when the action changes', async ({ page, organizer }) => {
    await mockApply(organizer, TEAM, TEAM_REG, {
      status: 409,
      json: { data: null, error: { status: 409, name: 'ConflictError', message: 'Echipa este deja eliminată.', details: { bluCode: 'PENALTY:ALREADY_ELIMINATED' } } },
    });
    await open(page, { at: apply(TEAM, TEAM_REG), role: 'author' });
    await loaded(page);
    await pick(page, 'Eliminare');
    await reason(page).fill('A doua eliminare');
    await submitBtn(page).click();
    const inline = page.getByTestId('action-error');
    await expect(inline).toHaveText('Această echipă este deja eliminată. Revocă eliminarea pentru a aplica o nouă penalizare.');
    // Under the group's title, above the cards.
    const [legendBox, errorBox, firstCard] = await Promise.all([
      page.getByText('Tip penalizare', { exact: true }).first().boundingBox(),
      inline.boundingBox(),
      page.locator('label').filter({ has: radio(page, 'Avertisment') }).boundingBox(),
    ]);
    expect(errorBox!.y).toBeGreaterThan(legendBox!.y);
    expect(errorBox!.y).toBeLessThan(firstCard!.y);
    await expect(page).toHaveURL(new RegExp('/penalizari/aplica'));
    expect(organizer.writes[0].body).toEqual({ action: 'ELIMINATE', reason: 'A doua eliminare' });
    await shoot(page, 'eliminated');
    await expectNoA11yViolations(page);
    await pick(page, 'Avertisment');
    await expect(inline).toHaveCount(0);
  });

  test('another CMS error toasts its message; an unknown one the fallback; the form stays', async ({ page, organizer }) => {
    let n = 0;
    await mockApply(organizer, TEAM, TEAM_REG, () =>
      n++ === 0
        ? {
            status: 400,
            json: { data: null, error: { status: 400, name: 'BadRequest', message: 'Penalizările pot fi aplicate doar în timpul competiției.', details: { bluCode: 'PENALTY:INVALID_COMPETITION_STATUS' } } },
          }
        : { status: 500, json: { data: null, error: { status: 500, name: 'InternalServerError', message: 'boom' } } },
    );
    await open(page, { at: apply(TEAM, TEAM_REG), role: 'author' });
    await loaded(page);
    await reason(page).fill('Motiv de test');
    await submitBtn(page).click();
    await expect(page.getByText('Penalizările pot fi aplicate doar în timpul competiției.')).toBeVisible();
    await expect(submitBtn(page)).toBeEnabled();
    await submitBtn(page).click();
    await expect(page.getByText('Penalizarea nu a putut fi aplicată. Te rugăm să reîncerci.')).toBeVisible();
    await expect(page.getByTestId('action-error')).toHaveCount(0);
    await expect(reason(page)).toHaveValue('Motiv de test');
    expect(organizer.writes).toHaveLength(2);
  });
});

test.describe('states', () => {
  test('leave guard: unsaved input asks before the back chip leaves', async ({ page }) => {
    await open(page, { at: apply(TEAM, TEAM_REG), role: 'author' });
    await loaded(page);
    await reason(page).fill('Ceva nesalvat');
    await page.getByRole('link', { name: 'Înapoi la standuri' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Renunți la modificări?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Continuă editarea' }).click();
    await expect(reason(page)).toHaveValue('Ceva nesalvat');
    await page.getByRole('link', { name: 'Înapoi la standuri' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Renunță' }).click();
    await expect(page).toHaveURL(stands(TEAM), { timeout: 30_000 });
  });

  test('a participant meets the role gate; the registrations are never read', async ({ page }) => {
    const { reads } = await open(page, { at: apply(TEAM, TEAM_REG), role: 'participant' });
    await expect(page.getByText('Doar pentru organizator și arbitri')).toBeVisible({ timeout: 30_000 });
    expect(reads.filter((r) => r.endsWith('/registrations'))).toEqual([]);
    await expect(submitBtn(page)).toHaveCount(0);
    await shoot(page, 'denied');
  });

  test('the registrations read fails: the error gate, «Încearcă din nou» reads again', async ({ page }) => {
    const served: Served = { failRegistrations: true };
    const { reads } = await open(page, { at: apply(TEAM, TEAM_REG), role: 'author', served });
    await expect(page.getByTestId('management-retry')).toBeVisible({ timeout: 30_000 });
    await shoot(page, 'error');
    const before = reads.filter((r) => r.endsWith('/registrations')).length;
    served.failRegistrations = false;
    await page.getByTestId('management-retry').click();
    await loaded(page);
    expect(reads.filter((r) => r.endsWith('/registrations')).length).toBeGreaterThan(before);
  });

  test('loading: the skeleton under the real title', async ({ page }) => {
    let release!: () => void;
    const hold = new Promise<void>((r) => (release = r));
    await page.route(
      (url) => /^\/api\/cms\/competitions\/[^/]+\/registrations$/.test(url.pathname),
      async (route) => {
        await hold;
        return route.fallback();
      },
    );
    await open(page, { at: apply(TEAM, TEAM_REG), role: 'author' });
    await expect(page.getByTestId('apply-skeleton')).toBeVisible({ timeout: 30_000 });
    await expect(h1(page)).toBeVisible();
    await shoot(page, 'loading');
    release();
    await loaded(page);
  });

  test('signed out: sent to sign-in with the return path', async ({ request }) => {
    const res = await request.get(`${BASE_URL}${apply(TEAM, TEAM_REG)}`, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    const loc = res.headers().location ?? '';
    expect(decodeURIComponent(loc)).toContain(`/intra?next=${apply(TEAM, TEAM_REG)}`);
  });

});
