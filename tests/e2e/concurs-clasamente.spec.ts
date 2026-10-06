import { collectConsoleErrors } from './helpers/console';
import { expectNoA11yViolations } from './helpers/a11y';
import { qaJwt, signIn } from './helpers/session';
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

/*
 * Concurs · the rankings with their own tables — parity docs/parity/areas/competition-page.yml:
 *  - feeder on legs (competition-page.clasament c27–c33, fish FeederRankingTable);
 *  - National Championship / FIPSed (competition-page.clasament-nc, fish NationalChampionshipRanking).
 * Local CMS on :1337. Override the ids with E2E_COMPETITION_* when the local data moves.
 */

const ID = {
  /** completed feederRounds, team, 4 sectors × 5 stands, 2 legs, 20 crews («SIM3 Cupa C&B Ed 8»). */
  feeder: process.env.E2E_COMPETITION_FEEDER ?? 'rg340d4r4gnwf2mbyhxvasnr',
  /** completed feederRounds, single, 2 legs, 6 entrants nobody seated in a leg. */
  feederUnseated: process.env.E2E_COMPETITION_FEEDER_UNSEATED ?? 'bi9ptgcag7nbakrglxh16vx4',
  /** completed nationalChampionship, 3 sectors, 6 clubs × 3 teams, no draw positions. */
  nc: process.env.E2E_COMPETITION_NC ?? 'z7rvhm55ziyr0tbblqwjp39q',
  /** completed fipsed, 33 clubs (stands already carry the sector letter: «A3»). */
  fipsed: process.env.E2E_COMPETITION_FIPSED ?? 'vdsjq8ulsmwnr2b77j6q3jp4',
};

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };

test.describe.configure({ timeout: 120_000 });

async function open(page: Page, id: string, viewport = DESKTOP) {
  await page.setViewportSize(viewport);
  const errors = collectConsoleErrors(page);
  const res = await page.goto(`/concursuri/${id}`, { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  // A cold dev compile can take a while on the first visit.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 45_000 });
  return errors;
}

const visible = (l: Locator) => l.locator('visible=true').first();
const legChips = (page: Page) => visible(page.getByRole('radiogroup', { name: 'Manșa clasamentului' }));
/**
 * Picks a chip. Before hydration a press only checks the native radio (React then resets it), so
 * wait until React owns the input first.
 */
async function pick(group: Locator, name: string) {
  const radio = group.getByRole('radio', { name, exact: true });
  await expect
    .poll(() => radio.evaluate(el => Object.keys(el).some(k => k.startsWith('__reactProps'))), { timeout: 60_000 })
    .toBe(true);
  await group.getByText(name, { exact: true }).click();
  await expect(radio).toBeChecked();
}
const headTexts = (table: Locator) => table.locator('thead th').allInnerTexts();

/* ------------------------------------------------------------------ */
/* Feeder on legs                                                      */
/* ------------------------------------------------------------------ */

test('competition-page.clasament.c27 competition-page.clasament.c31 competition-page.clasament.s10 — feeder: General | Manșa 1 | Manșa 2, completed opens on General; «Cum se calculează» docked beside the table from 1280 (context), without the provisional chip', async ({
  page,
}) => {
  const errors = await open(page, ID.feeder);
  const chips = legChips(page);
  await expect(chips.getByRole('radio')).toHaveCount(3);
  await expect(chips.locator('label')).toHaveText(['General', 'Manșa 1', 'Manșa 2']);
  await expect(chips.getByRole('radio', { name: 'General' })).toBeChecked();

  const helpButton = page.getByRole('button', { name: 'Cum se calculează clasamentul' });
  // Reading help next to the table (the kit ResponsiveSurface `context`): from 1280 the docked side
  // panel, so the table stays in view; focus moves into it. (A press before hydration does nothing.)
  const help = page.getByRole('complementary', { name: 'Cum se calculează' });
  await expect(async () => {
    await helpButton.click();
    await expect(help).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expect(help.getByRole('button', { name: 'Închide' })).toBeFocused();
  await expect(page.getByRole('region', { name: 'Clasament general' })).toBeInViewport();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(help.getByText('Puncte', { exact: true })).toBeVisible();
  await expect(help.getByText(/primul ia 1 punct, al doilea 2… La egalitate se dă media locurilor/)).toBeVisible();
  await expect(help.getByText('Stand', { exact: true })).toBeVisible();
  await expect(help.getByText(/A4 = sectorul A, standul 4/)).toBeVisible();
  await expect(help.getByText('General', { exact: true })).toBeVisible();
  await expect(help.getByText(/Cel mai mic total câștigă; la egalitate decide cantitatea totală/)).toBeVisible();
  // Completed: no «Clasament provizoriu» chip.
  await expect(help.getByText(/Clasament provizoriu/)).toHaveCount(0);
  await expectNoA11yViolations(page);
  await page.keyboard.press('Escape');
  await expect(help).toBeHidden();
  await expect(helpButton).toBeFocused();
  expect(errors).toEqual([]);
});

test('competition-page.clasament.c28 competition-page.clasament.s10 — feeder General: Loc, Echipă, Total (Puncte, Kg), one group per leg (Stand, Kg, Puncte); by place; podium trophy; one-decimal points; the controls are the card’s band', async ({
  page,
}) => {
  await open(page, ID.feeder);
  const table = page.getByRole('region', { name: 'Clasament general' });
  await expect(table).toBeVisible();
  const head = (await headTexts(table)).map(t => t.replace(/\s+/g, ' ').trim());
  // Visible header text (the leg names of the sub-columns are sr-only, read with each cell).
  expect(head.slice(0, 5)).toEqual(['Loc', 'Echipă', 'Total', 'Manșa 1', 'Manșa 2']);
  expect(head.slice(5)).toEqual([
    'Puncte',
    'Kg',
    'Manșa 1, Stand',
    'Manșa 1, Kg',
    'Manșa 1, Puncte',
    'Manșa 2, Stand',
    'Manșa 2, Kg',
    'Manșa 2, Puncte',
  ]);
  const rows = table.locator('tbody tr');
  await expect(rows).toHaveCount(20);
  // Ordered by generalPosition.
  const places = (await rows.locator('th').allInnerTexts()).map(t => Number(t.replace(/\D/g, '')));
  expect(places).toEqual([...places].sort((a, b) => a - b));
  // Every place is the kit table's plain number (one idiom with the standard ranking); the podium
  // (1–3 with fish) adds the trophy.
  await expect(rows.nth(0).locator('th')).toContainText('podium');
  await expect(rows.nth(2).locator('th')).toContainText('podium');
  await expect(rows.nth(3).locator('th')).not.toContainText('podium');
  await expect(rows.nth(3).locator('th .bg-accent-tint, th .bg-navy')).toHaveCount(0);
  // The leg chips sit in the ranking card's band (on its surface, not on the page grey).
  const chipsGround = await legChips(page).evaluate(el => {
    let n: HTMLElement | null = el.parentElement;
    while (n && getComputedStyle(n).backgroundColor === 'rgba(0, 0, 0, 0)') n = n.parentElement;
    return n ? getComputedStyle(n).backgroundColor : '';
  });
  expect(chipsGround).toBe('rgb(255, 255, 255)');
  // Row 1: «Voicu Ionel si Ivan Gabriel», 3 points, 50,530 kg, C13 32,200 2 · A5 18,330 1 — each leg's
  // stand with its sector (the dot, and «Sector C, stand 13» for a screen reader).
  await expect(rows.nth(0).locator('td')).toHaveText([
    'Voicu Ionel si Ivan Gabriel',
    '3',
    '50,530',
    'Sector C, stand 13C13',
    '32,200',
    '2',
    'Sector A, stand 5A5',
    '18,330',
    '1',
  ]);
  // The points are ink, not indigo (indigo in a row means the viewer's own row or a win).
  await expect(rows.nth(3).locator('td').nth(1)).toHaveClass(/text-ink(\s|$)/);
  // Halves stay one decimal («6,5»).
  await expect(table.getByRole('cell', { name: '6,5', exact: true })).toBeVisible();
});

test('competition-page.clasament.c29 competition-page.clasament.s10 — feeder leg: one card per sector from 1280 (its title, its heads), by points then kg, sector winners marked; Stand · Echipă · Cantitate · Nr. buc · C.M.M.C · Puncte', async ({
  page,
}) => {
  await open(page, ID.feeder);
  await pick(legChips(page), 'Manșa 1');
  const table = page.getByRole('region', { name: 'Clasament manșa 1' });
  await expect(table).toBeVisible();
  // From 1280 one card per sector, side by side: the sector is the card's title (on its surface),
  // then the full column heads — no second «Sector X» row inside the table.
  expect(await headTexts(table.locator('table').first())).toEqual(['Stand', 'Echipă', 'Cantitate', 'Nr. buc', 'C.M.M.C', 'Puncte']);
  await expect(table.locator('thead th').nth(2)).toHaveAccessibleName('Cantitate, kg');
  await expect(table.locator('table')).toHaveCount(4);
  await expect(table.getByRole('heading', { level: 3 })).toHaveText(['Sector A', 'Sector B', 'Sector C', 'Sector D']);
  await expect(table.getByRole('rowheader').filter({ hasText: /^Sector [A-D]$/ })).toHaveCount(0);
  // Every ranking table's header row is coloured (ROADMAP §4b.12): accent-tint-2, never the card's white.
  const headBg = await table.locator('thead th').first().evaluate(el => getComputedStyle(el).backgroundColor);
  expect(headBg).toBe('rgb(224, 231, 255)');
  const a = table.locator('tbody').first();
  const seats = await a.locator('tr th[scope="row"]').allInnerTexts();
  expect(seats).toEqual(['A4', 'A1', 'A5', 'A2', 'A3']);
  await expect(a.locator('tr').nth(0)).toContainText('Câștigător de sector');
  await expect(a.locator('tr').nth(1)).not.toContainText('Câștigător de sector');
  await expect(a.locator('tr').nth(0).locator('td').last()).toHaveText('1');
  // Desktop density: the number cells have room (not the phone's 4px sides).
  const kg = (await a.locator('tr').first().locator('td').nth(1).boundingBox())!;
  expect(kg.width).toBeGreaterThanOrEqual(64);
});

test('competition-page.clasament.c29 competition-page.clasament.s10 — feeder leg nobody was seated in: a state naming them, not a table of dashes', async ({ page }) => {
  for (const vp of [PHONE, DESKTOP]) {
    await open(page, ID.feederUnseated, vp);
    await pick(legChips(page), 'Manșa 1');
    await expect(visible(page.getByRole('heading', { name: 'Nimeni nu a pescuit în manșa 1' }))).toBeVisible();
    await expect(visible(page.getByText('Nu au pescuit în această manșă:'))).toBeVisible();
    await expect(page.getByRole('region', { name: 'Clasament manșa 1' })).toHaveCount(0);
  }
});

test('competition-page.clasament.c29 competition-page.clasament.s10 — feeder leg on a 375 phone: Kg and Puncte as columns, Buc · CMMC under the full name; no sideways scroll', async ({ page }) => {
  await open(page, ID.feeder, PHONE);
  await pick(legChips(page), 'Manșa 1');
  const region = page.getByRole('region', { name: 'Clasament manșa 1' });
  await expect(region).toBeVisible();
  const { scroll, client } = await region.evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth }));
  expect(scroll).toBeLessThanOrEqual(client + 1);
  await expect(region.getByRole('columnheader', { name: 'Puncte' })).toBeInViewport();
  await expect(region.getByRole('columnheader', { name: 'Număr de bucăți' })).toBeHidden();
  const first = region.locator('tbody tr').nth(1);
  await expect(first).toContainText('Virgil Boldor si Marius Cornea');
  await expect(first).toContainText('6 buc · CMMC 7,725');
  // The second angler of the crew is not clamped away: the name keeps its two lines in full.
  const name = first.locator('td').first().locator('.line-clamp-2');
  expect(await name.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
});

test('competition-page.clasament.c28 — feeder General on a 375 phone: Loc and the name stay pinned while the legs scroll; the pinned edge shows once scrolled', async ({
  page,
}) => {
  await open(page, ID.feeder, PHONE);
  const region = page.getByRole('region', { name: 'Clasament general' });
  await expect(region).toHaveAttribute('data-more', 'true');
  await expect(region).toHaveAttribute('data-scrolled', 'false');
  const name = region.locator('tbody tr').first().locator('td').first();
  const before = (await name.boundingBox())!.x;
  await region.evaluate(el => el.scrollTo({ left: 260 }));
  await expect(region).toHaveAttribute('data-scrolled', 'true');
  expect(Math.round((await name.boundingBox())!.x)).toBe(Math.round(before));
});

/*
 * The live feeder states (fish CompetitionRanking FeederLegTabs / FeederFutureLeg / FeederHelpSheet):
 * no local feeder is live, so the browser's own reads are answered by the test — the real feeder
 * core and ranking, with the status and the legs changed. The server renders the real (completed)
 * page; a focus after 30 s re-reads the core and the ranking (parity clasament.c6), which turns the
 * page live on the fixture.
 */
type FeederLive = { roundsCount: number; currentRound: number; roundStatus: 'running' | 'closed'; empty?: boolean };

async function liveFeeder(page: Page, request: APIRequestContext, live: FeederLive) {
  const core = await (await request.get(`/api/cms/feed/competitions/${ID.feeder}`)).json();
  const ranking = await (await request.get(`/api/cms/competitions/${ID.feeder}/ranking`)).json();
  const state = { ...live };
  await page.route(new RegExp(`/api/cms/feed/competitions/${ID.feeder}(\\?|$)`), route =>
    route.fulfill({ json: { ...core, data: { ...core.data, competitionStatus: 'started' } } }),
  );
  await page.route(new RegExp(`/api/cms/competitions/${ID.feeder}/ranking(\\?|$)`), route =>
    route.fulfill({
      json: {
        ...ranking,
        // `empty`: nothing weighed yet anywhere (leg 1 just started): the CMS answers no rows.
        rankings: state.empty ? [] : ranking.rankings,
        metadata: { ...ranking.metadata, roundsCount: state.roundsCount, currentRound: state.currentRound, roundStatus: state.roundStatus },
      },
    }),
  );
  await page.clock.install({ time: new Date() });
  await open(page, ID.feeder);
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  /** Re-read the live parts (a focus after 30 s), with the legs as `next` says. */
  const refresh = async (next?: Partial<FeederLive>) => {
    Object.assign(state, next);
    await page.clock.runFor(31_000);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  };
  await refresh();
  await expect(page.getByText('LIVE', { exact: true }).locator('visible=true').first()).toBeVisible();
  return refresh;
}

test('competition-page.clasament.c27 competition-page.clasament.c30 competition-page.clasament.c31 competition-page.clasament.s10 competition-page.bara-actiuni.c6 — live feeder, leg 2 running: opens on Manșa 2; Manșa 3 has not started (Clasament complet off); provisional chip; a picked tab stays', async ({
  page,
  request,
}) => {
  const refresh = await liveFeeder(page, request, { roundsCount: 3, currentRound: 2, roundStatus: 'running' });
  const chips = legChips(page);
  await expect(chips.locator('label')).toHaveText(['General', 'Manșa 1', 'Manșa 2', 'Manșa 3']);
  // c27: the default tab is the running leg.
  await expect(chips.getByRole('radio', { name: 'Manșa 2' })).toBeChecked();
  await expect(page.getByRole('region', { name: 'Clasament manșa 2' })).toBeVisible();

  // c30: the next leg has not started.
  await pick(chips, 'Manșa 3');
  await expect(page.getByRole('heading', { name: 'Manșa 3 nu a început încă' })).toBeVisible();
  await expect(page.getByText('Începe după încheierea manșei 2.')).toBeVisible();
  // bara-actiuni.c6: nothing to show full screen on an empty leg.
  await expect(visible(page.getByRole('button', { name: 'Clasament complet' }))).toBeDisabled();

  // c31: «Cum se calculează» says the ranking is provisional.
  await page.getByRole('button', { name: 'Cum se calculează clasamentul' }).click();
  const help = page.getByRole('complementary', { name: 'Cum se calculează' });
  await expect(help.getByText('Clasament provizoriu · manșa 2 este în desfășurare')).toBeVisible();
  await page.keyboard.press('Escape');

  // c27: once the reader picks a tab it stays, even when the running leg moves on.
  await pick(chips, 'Manșa 1');
  await refresh({ currentRound: 3 });
  await expect.poll(async () => (await chips.locator('label').allInnerTexts()).length).toBe(4);
  await expect(chips.getByRole('radio', { name: 'Manșa 1' })).toBeChecked();
});

test('competition-page.clasament.c30 competition-page.clasament.c31 competition-page.clasament.s10 — live feeder, leg 2 closed: General by default; Manșa 3 waits for the organiser to reseat the stands; «manșa 2 este încheiată»', async ({
  page,
  request,
}) => {
  await liveFeeder(page, request, { roundsCount: 3, currentRound: 2, roundStatus: 'closed' });
  const chips = legChips(page);
  await expect(chips.getByRole('radio', { name: 'General' })).toBeChecked();
  await pick(chips, 'Manșa 3');
  await expect(page.getByRole('heading', { name: 'Manșa 3 nu a început încă' })).toBeVisible();
  await expect(page.getByText('Organizatorul reașază standurile după tragerea la sorți, apoi pornește manșa.')).toBeVisible();
  await page.getByRole('button', { name: 'Cum se calculează clasamentul' }).click();
  await expect(page.getByRole('complementary', { name: 'Cum se calculează' }).getByText('Clasament provizoriu · manșa 2 este încheiată')).toBeVisible();
});

test('competition-page.clasament.c27 competition-page.clasament.c30 competition-page.clasament.s10 — live feeder, leg 3 started with nothing weighed: opens on Manșa 3, «Manșa 3 a început»', async ({ page, request }) => {
  await liveFeeder(page, request, { roundsCount: 3, currentRound: 3, roundStatus: 'running' });
  const chips = legChips(page);
  await expect(chips.getByRole('radio', { name: 'Manșa 3' })).toBeChecked();
  await expect(page.getByRole('heading', { name: 'Manșa 3 a început' })).toBeVisible();
  await expect(page.getByText('Clasamentul manșei apare după prima cântărire.')).toBeVisible();
});

test('competition-page.clasament.c30 competition-page.clasament.s10 — live feeder, leg 1 just started and nothing weighed anywhere (no rows): «Manșa 1 a început», not «Nu există date de afișat»', async ({
  page,
  request,
}) => {
  await liveFeeder(page, request, { roundsCount: 3, currentRound: 1, roundStatus: 'running', empty: true });
  const chips = legChips(page);
  await expect(chips.getByRole('radio', { name: 'Manșa 1' })).toBeChecked();
  await expect(page.getByRole('heading', { name: 'Manșa 1 a început' })).toBeVisible();
  await expect(page.getByText('Clasamentul manșei apare după prima cântărire.')).toBeVisible();
  // A future leg keeps its own message on an empty ranking too; General has nothing to show.
  await pick(chips, 'Manșa 2');
  await expect(page.getByRole('heading', { name: 'Manșa 2 nu a început încă' })).toBeVisible();
  await pick(chips, 'General');
  await expect(visible(page.getByText('Nu există date de afișat'))).toBeVisible();
});

test('statistici — feeder legs: no «Top capturi» (Best-N is per stand; a stand holds a different crew every leg), and the view tab does not promise it', async ({
  page,
  context,
  request,
}) => {
  await signIn(context, await qaJwt(request));
  const bestN: string[] = [];
  page.on('request', r => {
    if (/\/ranking-best-n|\/best-n/i.test(r.url())) bestN.push(r.url());
  });
  await open(page, ID.feeder);
  const tab = page.getByRole('tab', { name: /Statistici/ });
  await expect(tab).not.toContainText('Top 3/5/7');
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  // A press before hydration is not a switch: press until the tab is selected.
  await expect(async () => {
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 1000 });
  }).toPass();
  await expect(page.getByRole('heading', { name: /Cantitate pe sector|Capturi/ }).first()).toBeVisible();
  await expect(page.getByText(/Top capturi/)).toHaveCount(0);
  expect(bestN).toEqual([]);
});

test('competition-page.clasament.c32 competition-page.bara-actiuni.c2 competition-page.bara-actiuni.s8 — feeder: the phone bar has no Sortare', async ({ page }) => {
  await open(page, ID.feeder, PHONE);
  const bar = page.getByRole('navigation', { name: 'Acțiuni concurs' });
  await expect(bar.getByRole('button', { name: 'Vezi clasamentul pe tot ecranul' })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Vezi cântarele din concurs' })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Statistici' })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Sortare clasament' })).toHaveCount(0);
});

test('competition-page.bara-actiuni.c6 competition-page.clasament.s10 — feeder: «Tot ecranul» opens the open tab full screen (Manșa 2)', async ({ page }) => {
  await open(page, ID.feeder, PHONE);
  await pick(legChips(page), 'Manșa 2');
  await page.getByRole('button', { name: 'Vezi clasamentul pe tot ecranul' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Manșa 2', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('region', { name: 'Manșa 2 complet' })).toBeVisible();
  await expectNoA11yViolations(page);
  await dialog.getByRole('button', { name: 'Închide' }).click();
  await expect(dialog).toBeHidden();
});

test('competition-page.clasament.c28 competition-page.clasament-nc.c1 — keyboard: the scrolling ranking regions show their focus ring (outline-style solid)', async ({ page }) => {
  const ringAfterTab = async (region: Locator) => {
    await visible(page.getByRole('button', { name: 'Clasament complet' })).focus();
    await page.keyboard.press('Tab');
    await expect(region).toBeFocused();
    return region.evaluate(el => ({ style: getComputedStyle(el).outlineStyle, width: getComputedStyle(el).outlineWidth }));
  };
  await open(page, ID.feeder);
  expect(await ringAfterTab(page.getByRole('region', { name: 'Clasament general' }))).toEqual({ style: 'solid', width: '2px' });
  await open(page, ID.nc);
  expect(await ringAfterTab(page.getByRole('region', { name: 'Clasament pe cluburi' }))).toEqual({ style: 'solid', width: '2px' });
});

test.fixme('competition-page.clasament.c33 — pressing a feeder row opens the angler stats dialog (competition-page.statistici-pescar, not built)', async () => {});

for (const vp of [PHONE, { width: 768, height: 1024 }, { width: 1280, height: 900 }, DESKTOP]) {
  test(`feeder · ${vp.width}px — General and a leg render, axe clean, no console errors`, async ({ page }) => {
    const errors = await open(page, ID.feeder, vp);
    await expect(page.getByRole('region', { name: 'Clasament general' })).toBeVisible();
    await expectNoA11yViolations(page);
    await pick(legChips(page), 'Manșa 2');
    await expect(page.getByRole('region', { name: 'Clasament manșa 2' })).toBeVisible();
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });
}

/* ------------------------------------------------------------------ */
/* National Championship / FIPSed                                      */
/* ------------------------------------------------------------------ */

const ncPills = (page: Page) => visible(page.getByRole('radiogroup', { name: 'Clasament pe' }));

test('competition-page.clasament-nc.c1 competition-page.clasament-nc.c2 competition-page.clasament-nc.c4 competition-page.clasament-nc.c5 competition-page.clasament-nc.c6 competition-page.clasament-nc.s1 — General club table: pills, columns, merged club cells, names, winners, three decimals', async ({ page }) => {
  const errors = await open(page, ID.nc);
  const pills = ncPills(page);
  await expect(pills.locator('label')).toHaveText(['General', 'Sector A', 'Sector B', 'Sector C']);
  await expect(pills.getByRole('radio', { name: 'General' })).toBeChecked();

  const table = page.getByRole('region', { name: 'Clasament pe cluburi' });
  expect(await headTexts(table)).toEqual([
    'Club',
    'Pescari',
    'Stand',
    'Cantitate Sector',
    'Total Kg Lot',
    'CMMC Lot',
    'Nr Pesti Lot',
    'Medie Lot',
    'Puncte Sector',
    'Puncte Lot',
    'Loc General',
    'Loc Individual',
  ]);
  // Default sort: position → the winning club first, its club cells merged over its 3 teams.
  const club = table.locator('tbody').first();
  await expect(club.locator('tr')).toHaveCount(3);
  await expect(club.locator('th[scope="rowgroup"]')).toHaveText('Ardealul');
  await expect(club.locator('th[scope="rowgroup"]')).toHaveAttribute('rowspan', '3');
  await expect(club.locator('tr').first().locator('td').nth(0)).toHaveText('Cici');
  await expect(club.locator('tr').first().locator('td').nth(1)).toHaveText('Sector A, stand 1A1');
  await expect(club.locator('tr').first().locator('td').nth(2)).toHaveText('34,700');
  await expect(club.locator('tr').first().locator('td').nth(3)).toHaveText('165,300');
  // c5: clubPosition 1 ≤ 3 sectors → the trophy on the plain place; a team with generalPosition ≤ 3 too.
  await expect(club.getByText(', podium')).toHaveCount(2);
  await expect(table.locator('tbody').nth(3).getByText(', podium')).toHaveCount(0);
  // Clubs are told apart by structure, never by a sector colour: no coloured club edge, every club
  // on the card's surface (no page-grey band), a stronger rule above each club.
  await expect(club.locator('th[scope="rowgroup"] [class*="bg-sector-"]')).toHaveCount(0);
  const second = table.locator('tbody').nth(1).locator('th[scope="rowgroup"]');
  const look = await second.evaluate(el => ({ bg: getComputedStyle(el).backgroundColor, rule: getComputedStyle(el).borderTopColor }));
  const plain = await table.locator('tbody').nth(1).locator('tr').nth(1).locator('td').first().evaluate(el => getComputedStyle(el).borderTopColor);
  expect(look.bg).toBe('rgb(255, 255, 255)');
  expect(look.rule).not.toBe(plain);
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('competition-page.clasament-nc.c7 competition-page.clasament-nc.c10 competition-page.clasament-nc.s2 — General order Club (backend) / Poziția (default); switching to a sector keeps a sort it offers', async ({ page }) => {
  await open(page, ID.nc);
  const table = page.getByRole('region', { name: 'Clasament pe cluburi' });
  const clubs = () => table.locator('th[scope="rowgroup"]').allInnerTexts();
  expect(await clubs()).toEqual(['Ardealul', 'Free Carp Deva', 'Carp Maniacs 1993', 'Enjoy Fishing', 'Bass Busters', 'Atomic Carp Arad']);
  const order = visible(page.getByRole('group', { name: 'Ordine' }));
  await order.getByText('Club', { exact: true }).click();
  expect(await clubs()).toEqual(['Ardealul', 'Atomic Carp Arad', 'Bass Busters', 'Carp Maniacs 1993', 'Enjoy Fishing', 'Free Carp Deva']);
  // A sector offers Stand / Poziția: «Club» falls back to Poziția.
  await pick(ncPills(page), 'Sector B');
  await expect(visible(page.getByRole('group', { name: 'Ordine' })).getByRole('radio', { name: 'Poziția în clasament' })).toBeChecked();
});

test('competition-page.clasament-nc.c8 competition-page.clasament-nc.c9 competition-page.clasament-nc.s1 competition-page.clasament-nc.s2 competition-page.clasament-nc.s4 competition-page.clasament-nc.s5 — a sector: its teams, Stand · Club · Pescari · Kg · Medie · CMMC · Nr. Buc · Puncte sector · Loc sector; Stand / Poziția', async ({
  page,
}) => {
  await open(page, ID.nc);
  await pick(ncPills(page), 'Sector A');
  const table = page.getByRole('region', { name: 'Clasament sector A' });
  expect(await headTexts(table)).toEqual(['Stand', 'Club', 'Pescari', 'Kg', 'Medie', 'CMMC', 'Nr. Buc', 'Puncte sector', 'Loc sector']);
  const rows = table.locator('tbody tr');
  await expect(rows).toHaveCount(6);
  // Position: by generalPosition, capot last; Lala (A10, 1st in A) leads.
  await expect(rows.first().locator('td').nth(1)).toHaveText('Lala');
  await expect(rows.first().locator('td').nth(2)).toHaveText('55,500');
  await expect(rows.first().locator('td').nth(3)).toHaveText('9,250');
  const order = visible(page.getByRole('group', { name: 'Ordine' }));
  await order.getByText('Stand', { exact: true }).click();
  // No draw positions: Stand orders by the sector position (capot last).
  const places = (await rows.locator('td:last-child').allInnerTexts()).map(t => Number(t.replace(/[^\d,]/g, '').replace(',', '.')));
  expect(places).toEqual([...places].sort((a, b) => a - b));
  await expectNoA11yViolations(page);
});

test('competition-page.clasament-nc.c12 competition-page.clasament-nc.s2 competition-page.bara-actiuni.c7 competition-page.bara-actiuni.s6 — phone Sortare offers Club / Poziția on General and confirms in the bar', async ({ page }) => {
  await open(page, ID.nc, PHONE);
  await page.getByRole('button', { name: 'Sortare clasament' }).click();
  const menu = page.getByRole('navigation', { name: 'Sortare clasament' });
  await expect(menu.getByRole('button')).toHaveText(['Înapoi', 'Club', 'Poziția în clasament']);
  await menu.getByRole('button', { name: 'Club' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sortarea clasamentului după club a fost efectuată.' })).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Clasament pe cluburi' }).locator('th[scope="rowgroup"]').first()).toHaveText('Ardealul');
  await expect(page.getByRole('region', { name: 'Clasament pe cluburi' }).locator('th[scope="rowgroup"]').nth(1)).toHaveText('Atomic Carp Arad');
});

test('competition-page.clasament-nc.c3 — FIPSed stands already named with the sector read once («A3», not «AA3»)', async ({ page }) => {
  await open(page, ID.fipsed);
  const table = page.getByRole('region', { name: 'Clasament pe cluburi' });
  await expect(table.locator('tbody').first().locator('tr').first().locator('td').nth(1)).toHaveText(/A3$/);
  await expect(table.locator('tbody').first().locator('tr').first().locator('td').nth(1)).not.toHaveText(/AA3/);
});

test('competition-page.clasament-nc.c13 — «Clasament complet» opens the club table, and on a sector that sector’s table', async ({ page }) => {
  await open(page, ID.nc);
  let dialog = page.getByRole('dialog');
  // A press before hydration does nothing: press until the dialog opens.
  await expect(async () => {
    await visible(page.getByRole('button', { name: 'Clasament complet' })).click();
    await expect(dialog.getByRole('region', { name: 'Clasament pe cluburi complet' })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 60_000 });
  await dialog.getByRole('button', { name: 'Închide' }).click();
  await pick(ncPills(page), 'Sector C');
  await visible(page.getByRole('button', { name: 'Clasament complet' })).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Sector C', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('region', { name: 'Sector C complet' })).toBeVisible();
});

test('competition-page.clasament-nc.c1 — on a 375 phone Club and Pescari stay pinned while the numbers scroll, under ~55% of the card', async ({ page }) => {
  await open(page, ID.nc, PHONE);
  const region = page.getByRole('region', { name: 'Clasament pe cluburi' });
  const club = region.locator('th[scope="rowgroup"]').first();
  const names = region.locator('tbody tr').first().locator('td').first();
  const card = (await region.boundingBox())!;
  const nameBox = (await names.boundingBox())!;
  expect(nameBox.x + nameBox.width - card.x).toBeLessThan(card.width * 0.6);
  const clubX = (await club.boundingBox())!.x;
  await region.evaluate(el => el.scrollTo({ left: 400 }));
  await expect(region).toHaveAttribute('data-scrolled', 'true');
  expect(Math.round((await club.boundingBox())!.x)).toBe(Math.round(clubX));
  expect(Math.round((await names.boundingBox())!.x)).toBe(Math.round(nameBox.x));
});

/** The NC ranking as the test says (the browser's own re-read, after a return to the tab). */
async function mockedNc(page: Page, request: APIRequestContext, change: (rankings: { teams: { sectorId: string }[] }[]) => unknown[], vp = DESKTOP) {
  const ranking = await (await request.get(`/api/cms/competitions/${ID.nc}/ranking`)).json();
  await page.route(new RegExp(`/api/cms/competitions/${ID.nc}/ranking(\\?|$)`), route =>
    route.fulfill({ json: { ...ranking, rankings: change(ranking.rankings) } }),
  );
  await page.clock.install({ time: new Date() });
  await open(page, ID.nc, vp);
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.clock.runFor(31_000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  return ranking;
}

test('competition-page.clasament-nc.c11 competition-page.clasament-nc.s3 — a sector with no teams: «Nu există DUO-uri în acest sector.», the pills stay to pick another', async ({ page, request }) => {
  type Club = { teams: { sectorId: string; sectorName: string }[] };
  const real = (await (await request.get(`/api/cms/competitions/${ID.nc}/ranking`)).json()).rankings as Club[];
  const sectorC = real.flatMap(c => c.teams).find(t => t.sectorName === 'C')?.sectorId;
  expect(sectorC).toBeTruthy();
  await mockedNc(page, request, rankings => (rankings as Club[]).map(c => ({ ...c, teams: c.teams.filter(t => t.sectorId !== sectorC) })));
  // The re-read landed: the club table lost sector C's teams.
  await expect(page.getByRole('region', { name: 'Clasament pe cluburi' }).locator('tbody').first().locator('tr')).toHaveCount(2);
  await pick(ncPills(page), 'Sector C');
  await expect(visible(page.getByText('Nu există DUO-uri în acest sector.'))).toBeVisible();
  await pick(ncPills(page), 'Sector A');
  await expect(page.getByRole('region', { name: 'Clasament sector A' })).toBeVisible();
});

test('competition-page.clasament-nc.c11 competition-page.clasament-nc.s6 — no NC data: «Nu există date de afișat»', async ({ page, request }) => {
  await mockedNc(page, request, () => []);
  await expect(visible(page.getByText('Nu există date de afișat'))).toBeVisible();
  await expect(page.getByRole('region', { name: 'Clasament pe cluburi' })).toHaveCount(0);
});

for (const vp of [PHONE, { width: 768, height: 1024 }, { width: 1280, height: 900 }, DESKTOP]) {
  test(`nc · ${vp.width}px — General and a sector render, axe clean, no console errors`, async ({ page }) => {
    const errors = await open(page, ID.nc, vp);
    await expect(page.getByRole('region', { name: 'Clasament pe cluburi' })).toBeVisible();
    await expectNoA11yViolations(page);
    await pick(ncPills(page), 'Sector B');
    await expect(page.getByRole('region', { name: 'Clasament sector B' })).toBeVisible();
    await expectNoA11yViolations(page);
    expect(errors).toEqual([]);
  });
}
