import { type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { expect, test } from './helpers/fake-chat';
import { nationalStandLabel } from '@/app/(site)/concursuri/[id]/_components/stand';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { CMS, qaJwt, signIn } from './helpers/session';

/*
 * Concurs · Cântare — parity docs/parity/areas/competition-page.yml, competition-page.cantare and
 * competition-page.cantar-detaliu; owner rules 8, 14 and 16 (ROADMAP §4b). Under 1280 the phone's
 * stand cards (a stand opens its weighings, a weighing its detail: a sheet, a dialog to 1279); from
 * 1280 every weighing in one table and the detail docked beside it. Covered for a standard
 * competition (24 sectors of one stand, live), a feeder on legs and a national championship, at
 * 375 / 1280 / 1440 / 1920: table vs cards, row → docked detail, the pager, the «Manșa N» switch on
 * the table and on the detail, NC stand labels, the ?cantar=&stand= link (an overlay), the 60 s
 * refresh countdown, the revisions view, Escape and focus return, the keyboard focus ring, axe.
 *
 * Local CMS on :1337, QA user «Sim QA». Every id below is read from the CMS in beforeAll (override
 * the competitions with E2E_TABS_*), so the specs follow the local data instead of hard-coding it.
 */

const ID = {
  live: process.env.E2E_TABS_LIVE ?? 'kee49a3e64b3f636b4b60daa',
  feeder: process.env.E2E_TABS_FEEDER ?? 'rg340d4r4gnwf2mbyhxvasnr',
  nc: process.env.E2E_TABS_NC ?? 'z7rvhm55ziyr0tbblqwjp39q',
};
type Kind = keyof typeof ID;

const WIDTHS = [375, 1280, 1440, 1920] as const;
const viewport = (width: number) => ({ width, height: width < 768 ? 812 : 900 });
const cantare = (id: string) => `/concursuri/${id}/cantare`;

type Weighing = { documentId: string; weighingStatus: string; catches: unknown[] };
type Stand = { documentId: string; name: string };
type Sector = { documentId: string; name: string; stands: Stand[] };
type Alloc = Record<string, { sectorDrawPosition: number | null } | undefined>;
/** A stand with weighings and how the page names it. */
type Pick = { sector: string; stand: Stand; label: string; weighings: Weighing[] };

const data = {} as Record<Kind, { sectors: Sector[]; alloc: Alloc; pick: Pick }>;
/** Feeder: one stand's weighings per leg (1-based), the stand having a different count in two legs. */
let feederLegs: { pick: Omit<Pick, 'weighings'>; legs: Weighing[][] } | null = null;
/** NC: a weighing that was edited (numberOfRevisions > 0), on its stand. */
let revised: { pick: Pick; weighingId: string; revisions: number } | null = null;
let jwt = '';

test.describe.configure({ timeout: 180_000 });

const json = async (request: APIRequestContext, path: string, auth?: string) => {
  const res = await request.get(`${CMS}${path}`, auth ? { headers: { Authorization: `Bearer ${auth}` } } : undefined);
  expect(res.ok(), `${path} answers`).toBeTruthy();
  return (await res.json()) as { data: unknown };
};
const byStand = async (request: APIRequestContext, cid: string, sid: string, round?: number) =>
  (await json(request, `/feed/weighings/by-stand?competitionId=${cid}&standId=${sid}${round ? `&round=${round}` : ''}`)).data as Weighing[];

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
  for (const kind of Object.keys(ID) as Kind[]) {
    const id = ID[kind];
    const c = (await json(request, `/feed/competitions/${id}`)).data as { sectors: Sector[]; roundsCount: number | null };
    const alloc = (await json(request, `/competitions/${id}/allocated-participants`)).data as Alloc;
    const summary = (await json(request, `/competitions/${id}/weighings-summary`, jwt)).data as { standId: string; regularCount: number; extraCount: number }[];
    const weighed = summary.filter(s => s.regularCount + s.extraCount > 0).sort((a, b) => b.regularCount + b.extraCount - (a.regularCount + a.extraCount));
    const where = (sid: string) => {
      for (const sector of c.sectors) {
        const stand = sector.stands.find(s => s.documentId === sid);
        if (stand) return { sector: sector.name, stand, label: kind === 'nc' ? nationalStandLabel(sector.name, alloc[sid]?.sectorDrawPosition, stand.name) : stand.name };
      }
      throw new Error(`stand ${sid} not in ${id}`);
    };
    expect(weighed.length, `${kind}: a stand with weighings`).toBeGreaterThan(0);
    // Feeder: the current leg's weighings are the cards' and the table's at rest — picked below.
    const first = where(weighed[0].standId);
    data[kind] = { sectors: c.sectors, alloc, pick: { ...first, weighings: kind === 'feeder' ? [] : await byStand(request, id, first.stand.documentId) } };
    if (kind === 'feeder') {
      const legs = c.roundsCount ?? 1;
      expect(legs, 'the feeder has two legs or more').toBeGreaterThan(1);
      for (const s of weighed) {
        const all = await Promise.all(Array.from({ length: legs }, (_, i) => byStand(request, id, s.standId, i + 1)));
        if (new Set(all.map(l => l.length)).size > 1 && all.every(l => l.length > 0)) {
          feederLegs = { pick: where(s.standId), legs: all };
          break;
        }
      }
      expect(feederLegs, 'a feeder stand weighed in two legs, a different number of times').not.toBeNull();
    }
    if (kind === 'nc') {
      for (const s of weighed) {
        for (const w of await byStand(request, id, s.standId)) {
          const d = (await (await request.get(`${CMS}/feed/weighings/${w.documentId}`)).json()) as { data?: { numberOfRevisions?: number }; numberOfRevisions?: number };
          const n = (d.data ?? d).numberOfRevisions ?? 0;
          if (n > 0 && !revised) revised = { pick: { ...where(s.standId), weighings: await byStand(request, id, s.standId) }, weighingId: w.documentId, revisions: n };
        }
        if (revised) break;
      }
      expect(revised, 'the NC has an edited weighing').not.toBeNull();
    }
  }
});

async function open(page: Page, path: string, width: number) {
  await page.setViewportSize(viewport(width));
  const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

const table = (page: Page) => page.locator('[data-weighings-scroll] table');
const docked = (page: Page) => page.getByRole('complementary', { name: 'Detaliu cântar' });
const rowButton = (page: Page, weighingId: string) => page.locator(`tr[data-weighing="${weighingId}"]`).getByRole('button', { name: /^(Cântar \d+|#\d+)$/ });
/** The detail's stand heading: «Sector A, Stand 12»; NC «Stand A3(12)». */
const detailLabel = (kind: Kind, p: { sector: string; label: string }) => (kind === 'nc' ? `Stand ${p.label}` : `Sector ${p.sector}, Stand ${p.label}`);

/** Press (or Enter on) a control until `shown` is visible: a press before hydration is not seen by React. */
async function pressUntil(control: Locator, shown: Locator, keyboard = false) {
  await expect(async () => {
    if (!(await shown.isVisible())) {
      if (keyboard) {
        await control.focus();
        await control.press('Enter');
      } else await control.click();
    }
    await expect(shown).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}

/** Its transitions finished (the panel's slide-in fades it: axe would read the colours mid-fade). */
const settled = (surface: Locator) => surface.evaluate(el => Promise.allSettled(el.getAnimations({ subtree: true }).map(a => a.finished)));

/** The phone's stand card toggle for a stand («Stand 12 …», NC «Stand A3(12) …»). */
const standToggle = (page: Page, label: string) => page.locator('button[aria-expanded]').filter({ hasText: new RegExp(`^Stand ${label.replace(/[()]/g, '\\$&')}(?![\\d(])`) });

for (const kind of Object.keys(ID) as Kind[]) {
  for (const width of WIDTHS) {
    test(`${kind} ${width}px · ${width < 1280 ? 'stand cards → weighing → sheet' : 'the table (every column) → row → docked detail'}; Escape, focus return, axe`, async ({ page, context }) => {
      await signIn(context, jwt);
      const errors = collectConsoleErrors(page);
      await open(page, cantare(ID[kind]), width);
      const { pick } = data[kind];
      const p = kind === 'feeder' ? feederLegs!.pick : pick;
      if (width < 1280) {
        // Rule 14 is the desktop's: under 1280 the stands as cards, no table.
        await expect(page.getByRole('heading', { level: 2, name: `Sector ${p.sector}` })).toBeVisible();
        await expect(table(page)).toHaveCount(0);
        const toggle = standToggle(page, p.label);
        const region = page.getByRole('region', { name: `Cântarele standului ${p.label}` });
        await pressUntil(toggle, region);
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        const tile = region.getByRole('button', { name: /^Cântar 1\b/ });
        await expect(tile).toBeVisible();
        await tile.click();
        const sheet = page.getByRole('dialog', { name: 'Detaliu cântar' });
        await expect(sheet).toBeVisible();
        await expect(sheet.getByText(detailLabel(kind, p), { exact: true })).toBeVisible();
        await settled(sheet);
        await expectNoA11yViolations(page);
        await page.keyboard.press('Escape');
        await expect(sheet).toBeHidden();
        await expect(tile).toBeFocused();
      } else {
        // Rule 14: every column, the stands as rows, not the phone's cards stretched.
        await expect(table(page)).toBeVisible();
        const heads = await table(page).locator('thead th').allInnerTexts();
        expect(heads.map(h => h.trim())).toEqual(['Stand', expect.stringMatching(/^(Pescar|Echipă)$/), 'Cântar', 'Interval', 'Capturi', 'Kg', 'Stare']);
        await expect(page.locator('button[aria-expanded][aria-controls^="cantare-"]')).toHaveCount(0);
        // Rule 16: the table never stretches across the screen.
        expect((await table(page).boundingBox())!.width).toBeLessThanOrEqual(1024);
        // The current leg's weighing on the picked stand (feeder: the leg the switch shows).
        let ids = pick.weighings.map(w => w.documentId);
        if (kind === 'feeder') {
          const current = Number((await page.getByRole('group', { name: 'Manșa cântarelor' }).getByRole('button', { pressed: true }).innerText()).replace(/\D/g, ''));
          ids = feederLegs!.legs[current - 1].map(w => w.documentId);
        }
        const row = rowButton(page, ids[0]);
        // The keyboard opens it (Enter on the row's button).
        await pressUntil(row, docked(page), true);
        await expect(docked(page).getByText(detailLabel(kind, p), { exact: true })).toBeVisible();
        await expect(page.locator(`tr[data-weighing="${ids[0]}"]`)).toHaveAttribute('data-selected', 'true');
        // Docked beside the table (not over it), the table still usable; focus moved into the panel.
        // The side column keeps to the content's right edge: no dead strip after it at 1920
        // (Read once its slide-in has settled.)
        const rowRight = await table(page).evaluate(el => el.closest('[data-weighings-scroll]')!.parentElement!.parentElement!.parentElement!.getBoundingClientRect().right);
        await expect.poll(async () => Math.round((await docked(page).boundingBox())!.x + (await docked(page).boundingBox())!.width - rowRight)).toBe(0);
        const [tb, pb] = [(await table(page).boundingBox())!, (await docked(page).boundingBox())!];
        expect(pb.x).toBeGreaterThanOrEqual(tb.x + tb.width);
        expect(await docked(page).evaluate(el => el.contains(document.activeElement))).toBeTruthy();
        await settled(docked(page));
        await expectNoA11yViolations(page);
        await page.keyboard.press('Escape');
        await expect(docked(page)).toHaveCount(0);
        await expect(row).toBeFocused();
      }
      expect(errors).toEqual([]);
    });
  }
}

test('live 1440 · the pager: Anterior / «Cântar i / n» / Următor through the stand’s weighings', async ({ page, context }) => {
  await signIn(context, jwt);
  await open(page, cantare(ID.live), 1440);
  const { pick } = data.live;
  const n = pick.weighings.length;
  expect(n, 'the live stand has two weighings or more').toBeGreaterThan(1);
  await pressUntil(rowButton(page, pick.weighings[0].documentId), docked(page));
  const panel = docked(page);
  const pager = panel.getByRole('navigation', { name: 'Cântarele standului' });
  await expect(pager.getByText(`Cântar 1 / ${n}`, { exact: true })).toBeVisible();
  const prev = pager.getByRole('button', { name: 'Anterior' });
  const next = pager.getByRole('button', { name: 'Următor' });
  await expect(prev).toHaveAttribute('aria-disabled', 'true');
  for (let i = 2; i <= n; i++) {
    await next.click();
    await expect(pager.getByText(`Cântar ${i} / ${n}`, { exact: true })).toBeVisible();
  }
  await expect(next).toHaveAttribute('aria-disabled', 'true');
  // At its end the arrow keeps the keyboard focus that pressed it (aria-disabled, not disabled).
  await next.focus();
  await page.keyboard.press('Enter');
  await expect(pager.getByText(`Cântar ${n} / ${n}`, { exact: true })).toBeVisible();
  await expect(next).toBeFocused();
  await prev.click();
  await expect(pager.getByText(`Cântar ${n - 1} / ${n}`, { exact: true })).toBeVisible();
  await expectNoA11yViolations(page);
});

for (const width of [1280, 1920]) {
  test(`feeder ${width}px · «Manșa N» switch: the rows are that leg's, and the detail opens on the leg shown`, async ({ page, context }) => {
    await signIn(context, jwt);
    await open(page, cantare(ID.feeder), width);
    const { pick, legs } = feederLegs!;
    const group = page.getByRole('group', { name: 'Manșa cântarelor' });
    await expect(group.getByRole('button')).toHaveCount(legs.length);
    const status = page.locator('[data-weighings-scroll]').locator('xpath=..').locator('p[aria-live="polite"]').first();
    for (let leg = 1; leg <= legs.length; leg++) {
      const button = group.getByRole('button', { name: `Manșa ${leg}` });
      await expect(async () => {
        await button.click();
        await expect(button).toHaveAttribute('aria-pressed', 'true', { timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
      await expect(status).toHaveText(new RegExp(`^Manșa ${leg} · `));
      await expect(table(page).locator('caption')).toContainText(`manșa ${leg}`);
      // The stand's rows are this leg's weighings, and no other leg's.
      for (const w of legs[leg - 1]) await expect(page.locator(`tr[data-weighing="${w.documentId}"]`)).toHaveCount(1);
      for (const other of legs.filter((_, i) => i !== leg - 1)) for (const w of other) await expect(page.locator(`tr[data-weighing="${w.documentId}"]`)).toHaveCount(0);
      // The detail's pager steps through this leg's weighings of the stand.
      await rowButton(page, legs[leg - 1][0].documentId).click();
      await expect(docked(page).getByText(detailLabel('feeder', pick), { exact: true })).toBeVisible();
      const count = legs[leg - 1].length;
      await expect(docked(page).getByText(`Cântar 1 / ${count}`, { exact: true })).toBeVisible();
      await docked(page).getByRole('button', { name: 'Închide' }).click();
      await expect(docked(page)).toHaveCount(0);
    }
    await expectNoA11yViolations(page);
  });
}

for (const width of [375, 1440]) {
  test(`NC ${width}px · stands named «A3(12)» (or «A12» undrawn) on the ${width < 1280 ? 'stand cards' : 'table'} and in the detail`, async ({ page, context }) => {
    await signIn(context, jwt);
    await open(page, cantare(ID.nc), width);
    const { pick } = data.nc;
    expect(pick.label).toMatch(/^[A-Z]\d+(\(\d+\))?$/);
    if (width < 1280) {
      await pressUntil(standToggle(page, pick.label), page.getByRole('region', { name: `Cântarele standului ${pick.label}` }));
      await page.getByRole('region', { name: `Cântarele standului ${pick.label}` }).getByRole('button', { name: /^Cântar 1\b/ }).click();
      await expect(page.getByRole('dialog', { name: 'Detaliu cântar' }).getByText(`Stand ${pick.label}`, { exact: true })).toBeVisible();
    } else {
      // The stand's row header («Sector A, Stand A3(12)» to a screen reader, the label in big type).
      const label = pick.label.replace(/[()]/g, '\\$&');
      await expect(table(page).locator('th[scope="row"]').filter({ hasText: new RegExp(`Stand ${label}(?![\\d(])`) })).toHaveCount(1);
      await pressUntil(rowButton(page, pick.weighings[0].documentId), docked(page));
      await expect(docked(page).getByText(`Stand ${pick.label}`, { exact: true })).toBeVisible();
    }
  });
}

test('NC 1440 · an edited weighing: the warning (keyboard focus ring) opens «Istoric modificări», «Înapoi la cântar» returns the focus to it', async ({ page, context }) => {
  await signIn(context, jwt);
  await open(page, cantare(ID.nc), 1440);
  const { weighingId, revisions } = revised!;
  await pressUntil(rowButton(page, weighingId), docked(page));
  const warning = docked(page).getByRole('button', { name: `Acest cântar a avut ${revisions === 1 ? 'o modificare' : `${revisions} modificări`}.` });
  await expect(warning).toBeVisible();
  await expect(docked(page).getByRole('button', { name: 'Vezi istoric' })).toBeVisible();
  // Rule 8: reached from the keyboard, it shows the ring.
  await warning.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(warning).toBeFocused();
  expect(await warning.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  await page.keyboard.press('Enter');
  await expect(docked(page).getByRole('heading', { name: 'Istoric modificări' })).toBeVisible();
  await settled(docked(page));
  await expectNoA11yViolations(page);
  await docked(page).getByRole('button', { name: 'Înapoi la cântar' }).click();
  await expect(warning).toBeFocused();
});

for (const width of [375, 1440]) {
  test(`deep link ${width}px · ?cantar=&stand= opens that weighing's detail as an overlay; closing it drops the params`, async ({ page, context }) => {
    await signIn(context, jwt);
    const { pick } = data.live;
    const w = pick.weighings[pick.weighings.length - 1].documentId;
    await open(page, `${cantare(ID.live)}?cantar=${w}&stand=${pick.stand.documentId}`, width);
    const dialog = page.getByRole('dialog', { name: 'Detaliu cântar' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(detailLabel('live', pick), { exact: true })).toBeVisible();
    await expect(dialog.getByText(`Cântar ${pick.weighings.length} / ${pick.weighings.length}`, { exact: true })).toBeVisible();
    // From 1280 an overlay over the table, not the docked panel.
    if (width >= 1280) {
      await expect(table(page)).toBeVisible();
      await expect(docked(page)).toHaveCount(0);
    }
    await settled(dialog);
    await expectNoA11yViolations(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect.poll(() => new URL(page.url()).searchParams.has('cantar')).toBe(false);
    expect(new URL(page.url()).searchParams.has('stand')).toBe(false);
  });
}

test('live 1440 · a weighing in progress refreshes itself: «Se actualizează în m:ss» counts down from 1:00, re-reads at 0 and on «Actualizează»', async ({ page, context }) => {
  await signIn(context, jwt);
  const { pick } = data.live;
  const w = pick.weighings[0].documentId;
  let reads = 0;
  // The local data has no weighing in progress: this one answers as started.
  await page.route(u => new URL(u).pathname.endsWith(`/feed/weighings/${w}`), async route => {
    reads++;
    const res = await route.fetch();
    const body = (await res.json()) as { data?: Record<string, unknown> } & Record<string, unknown>;
    const d = body.data ?? body;
    d.weighingStatus = 'started';
    d.endDate = null;
    await route.fulfill({ response: res, json: body });
  });
  await page.clock.install();
  await open(page, cantare(ID.live), 1440);
  await pressUntil(rowButton(page, w), docked(page));
  const countdown = docked(page).getByText(/^Se actualizează în \d:\d\d$/);
  await expect(countdown).toHaveText('Se actualizează în 1:00');
  await page.clock.runFor(5_000);
  await expect(countdown).toHaveText('Se actualizează în 0:55');
  const before = reads;
  await page.clock.runFor(55_000);
  await expect.poll(() => reads).toBeGreaterThan(before);
  await expect(countdown).toHaveText(/^Se actualizează în (1:00|0:59)$/);
  const again = reads;
  await docked(page).getByRole('button', { name: 'Actualizează' }).click();
  await expect.poll(() => reads).toBeGreaterThan(again);
  await expect(countdown).toHaveText('Se actualizează în 1:00');
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('375 · rule 8: the stand toggle and a weighing tile show the ring on keyboard focus', async ({ page, context }) => {
  await signIn(context, jwt);
  await open(page, cantare(ID.live), 375);
  const { pick } = data.live;
  const toggle = standToggle(page, pick.label);
  const region = page.getByRole('region', { name: `Cântarele standului ${pick.label}` });
  await pressUntil(toggle, region, true);
  // The focus is the keyboard's (Enter): the ring shows.
  await expect(toggle).toBeFocused();
  expect(await toggle.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  const tile = region.getByRole('button', { name: /^Cântar 1\b/ });
  await tile.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(tile).toBeFocused();
  expect(await tile.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  // Enter opens the detail; closing it brings the focus back to the tile.
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'Detaliu cântar' });
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(tile).toBeFocused();
});
