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
  /** live quantity, 24 sectors A–X × 1 stand («[CHAT25] Test chat v2 — Cantitate»). */
  live: process.env.E2E_COMPETITION_LIVE ?? 'kee49a3e64b3f636b4b60daa',
  /** completed quality, 24 sectors, 7 catch columns, a sector minimum (grey «nu se punctează» cells). */
  quality: process.env.E2E_TABS_INDIVIDUALS ?? 'k5c9427518736c92684018b9',
  /** completed bestOfTiers (Best 3 / 5 / 7 / 9), one sector, four entrants without a catch. */
  bestOfTiers: process.env.E2E_COMPETITION_BEST_OF_TIERS ?? 'wyjmy091opw9wat92j7i9xc5',
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
  await settled(page);
  return errors;
}

/**
 * The streamed parts revealed (no Suspense boundary still waiting on its template) and their entry
 * transitions over: the h1 can stream in before the ranking does, and a read or an axe scan in
 * between sees a table that is not there yet or a fade halfway through (contrast under AA).
 */
async function settled(page: Page) {
  await page.waitForFunction(() => !document.querySelector('template[id^="B:"]'), undefined, { timeout: 30_000 });
  await transitionsDone(page);
}

/** Every finite animation / transition over (a looping shimmer never ends and is not waited on). */
async function transitionsDone(page: Page) {
  await page.waitForFunction(
    () => document.getAnimations().every(a => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity),
    undefined,
    { timeout: 10_000 },
  );
}

/**
 * axe once the screen is at rest: a scan during a fade (the docked panel sliding in, a chip losing
 * its selected fill) measures the colours halfway and reports a contrast the screen never rests at.
 */
async function axeAtRest(page: Page) {
  await transitionsDone(page);
  await expectNoA11yViolations(page);
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

test('competition-page.clasament.c3 competition-page.clasament.c27 competition-page.clasament.c31 competition-page.clasament.s10 — feeder: General | Manșa 1 | Manșa 2, completed opens on General; «Cum se calculează» docked beside the table from 1280 (context), without the provisional chip', async ({
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
  await axeAtRest(page);
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
  // The leg tabs are one segmented strip (ROADMAP §4b.20): their own track, sitting in the ranking
  // card's band (on its surface, not on the page grey); the selected leg is filled accent.
  const strip = legChips(page);
  const { track, chipsGround } = await strip.evaluate(el => {
    let n: HTMLElement | null = el.parentElement;
    while (n && getComputedStyle(n).backgroundColor === 'rgba(0, 0, 0, 0)') n = n.parentElement;
    return { track: getComputedStyle(el).backgroundColor, chipsGround: n ? getComputedStyle(n).backgroundColor : '' };
  });
  expect(track).not.toBe('rgba(0, 0, 0, 0)');
  expect(chipsGround).toBe('rgb(255, 255, 255)');
  const selectedTab = strip.locator('label:has(input:checked)');
  expect(await selectedTab.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(
    await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.className = 'bg-accent';
      document.body.append(probe);
      const c = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return c;
    }),
  );
  expect(await selectedTab.evaluate(el => getComputedStyle(el).color)).toBe('rgb(255, 255, 255)');
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
  // fish's colours (ROADMAP §4b.15): the Total group in TOTAL_COLOR, each leg its own colour —
  // white on the group header, the colour on its tinted sub-header and in its points.
  const bg = (l: Locator) => l.evaluate(el => getComputedStyle(el).backgroundColor);
  const fg = (l: Locator) => l.evaluate(el => getComputedStyle(el).color);
  const groupHeads = table.locator('thead tr').first().locator('th');
  expect(await bg(groupHeads.nth(2))).toBe('rgb(57, 73, 171)');
  expect(await fg(groupHeads.nth(2))).toBe('rgb(255, 255, 255)');
  expect(await bg(groupHeads.nth(3))).toBe('rgb(21, 101, 192)');
  expect(await bg(groupHeads.nth(4))).toBe('rgb(0, 121, 107)');
  expect(await fg(rows.nth(3).locator('td').nth(1))).toBe('rgb(57, 73, 171)');
  expect(await fg(rows.nth(3).locator('td').nth(5))).toBe('rgb(21, 101, 192)');
  // The plain heads (Loc, Echipă) are fish's grey head, the podium rows fish's blue, then zebra.
  expect(await bg(groupHeads.nth(0))).toBe('rgb(241, 243, 248)');
  expect(await bg(rows.nth(0))).toBe('rgb(238, 245, 255)');
  expect(await bg(rows.nth(3))).not.toBe(await bg(rows.nth(4)));
  // Compact (§4b.16): the card is as wide as its table, the numbers stay beside the names.
  const card = (await table.boundingBox())!;
  expect(card.width).toBeLessThan(1000);
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
  // From 1280 one card per sector, side by side: the sector is the card's title (fish's solid
  // sector band), then the full column heads — no second «Sector X» row inside the table.
  expect(await headTexts(table.locator('table').first())).toEqual(['Stand', 'Echipă', 'Cantitate', 'Nr. buc', 'C.M.M.C', 'Puncte']);
  await expect(table.locator('thead th').nth(2)).toHaveAccessibleName('Cantitate, kg');
  await expect(table.locator('table')).toHaveCount(4);
  await expect(table.getByRole('heading', { level: 3 })).toHaveText(['Sector A', 'Sector B', 'Sector C', 'Sector D']);
  await expect(table.getByRole('rowheader').filter({ hasText: /^Sector [A-D]$/ })).toHaveCount(0);
  // fish's colours (ROADMAP §4b.15): the plain grey head, the sector's solid band (sector A, white
  // on it), the sector winner on the sector's 16% tint.
  const headBg = await table.locator('thead th').first().evaluate(el => getComputedStyle(el).backgroundColor);
  expect(headBg).toBe('rgb(241, 243, 248)');
  const band = table.getByRole('heading', { level: 3 }).first();
  expect(await band.evaluate(el => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color])).toEqual([
    'rgb(25, 118, 210)',
    'rgb(255, 255, 255)',
  ]);
  const a = table.locator('tbody').first();
  const seats = await a.locator('tr th[scope="row"]').allInnerTexts();
  expect(seats).toEqual(['A4', 'A1', 'A5', 'A2', 'A3']);
  await expect(a.locator('tr').nth(0)).toContainText('Câștigător de sector');
  await expect(a.locator('tr').nth(1)).not.toContainText('Câștigător de sector');
  await expect(a.locator('tr').nth(0).locator('td').last()).toHaveText(/(^|\s)1$/);
  const winnerBg = await a.locator('tr').nth(0).evaluate(el => getComputedStyle(el).backgroundColor);
  expect(winnerBg).not.toBe('rgb(255, 255, 255)');
  expect(winnerBg).not.toBe(await a.locator('tr').nth(2).evaluate(el => getComputedStyle(el).backgroundColor));
  // The winner's trophy sits before the points, centred on them: its digits on the same line as
  // every other row's, flush right with theirs, and the trophy's middle on the digits' middle.
  const digitsMid = (cell: Locator) =>
    cell.evaluate(el => {
      // The last visible text node: the points' digits (the trophy's sr-only words skipped).
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let text: Node | null = null;
      for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.textContent?.trim() && !n.parentElement?.closest('.sr-only')) text = n;
      if (!text) throw new Error('no digits');
      const range = document.createRange();
      range.selectNodeContents(text);
      const r = range.getBoundingClientRect();
      const row = el.getBoundingClientRect();
      return { mid: r.top + r.height / 2 - row.top, right: row.right - r.right };
    });
  const winnerCell = a.locator('tr').nth(0).locator('td').last();
  const winner = await digitsMid(winnerCell);
  const plain = await digitsMid(a.locator('tr').nth(1).locator('td').last());
  expect(Math.abs(winner.mid - plain.mid)).toBeLessThanOrEqual(1);
  expect(Math.abs(winner.right - plain.right)).toBeLessThanOrEqual(1);
  const trophy = (await winnerCell.locator('svg[data-mark]').boundingBox())!;
  const cellBox = (await winnerCell.boundingBox())!;
  expect(Math.abs(trophy.y + trophy.height / 2 - cellBox.y - winner.mid)).toBeLessThanOrEqual(1.5);
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
  // The second angler of the crew is not clamped away (no «…»), and no word is cut in half: the
  // name wraps between its words, every line inside the pinned column.
  const name = first.locator('td').first().locator('[data-rank-name]');
  expect(await name.evaluate(el => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  expect(await name.evaluate(el => getComputedStyle(el).webkitLineClamp)).toBe('none');
  expect(await name.evaluate(el => getComputedStyle(el).overflowWrap)).toBe('normal');
});

test('competition-page.clasament.c28 — feeder General on a 375 phone: Loc and the name stay pinned while the legs scroll; the pinned edge shows once scrolled', async ({
  page,
}) => {
  await open(page, ID.feeder, PHONE);
  const region = page.getByRole('region', { name: 'Clasament general' });
  await expect(region).toHaveAttribute('data-more', 'true');
  await expect(region).toHaveAttribute('data-scrolled', 'false');
  const name = region.locator('tbody tr').first().locator('td').first();
  // The pinned block (Loc + the name) stays under ~55% of the card, so Total and the first leg's
  // colours are on screen without a scroll (ROADMAP §4b.15), as the NC table.
  const card = (await region.boundingBox())!;
  const nameBox = (await name.boundingBox())!;
  expect(nameBox.x + nameBox.width - card.x).toBeLessThan(card.width * 0.55);
  const before = nameBox.x;
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
  await expect(page.getByText(/Cantitate pe sector|Capturi/).locator('visible=true').first()).toBeVisible();
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
  await axeAtRest(page);
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
    await axeAtRest(page);
    await pick(legChips(page), 'Manșa 2');
    await expect(page.getByRole('region', { name: 'Clasament manșa 2' })).toBeVisible();
    await axeAtRest(page);
    expect(errors).toEqual([]);
  });
}

/* ------------------------------------------------------------------ */
/* National Championship / FIPSed                                      */
/* ------------------------------------------------------------------ */

const ncPills = (page: Page) => visible(page.getByRole('radiogroup', { name: 'Clasament pe' }));

test('competition-page.clasament.c3 competition-page.clasament-nc.c1 competition-page.clasament-nc.c2 competition-page.clasament-nc.c4 competition-page.clasament-nc.c5 competition-page.clasament-nc.c6 competition-page.clasament-nc.s1 — General club table: pills, columns, merged club cells, names, winners, three decimals', async ({ page }) => {
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
  // c5: clubPosition 1 ≤ 3 sectors → the club's trophy on its place; a team with generalPosition ≤ 3
  // the sector trophy on its individual place.
  await expect(club.getByText(', câștigător', { exact: true })).toHaveCount(1);
  await expect(club.getByText(', câștigător de sector', { exact: true })).toHaveCount(1);
  await expect(table.locator('tbody').nth(3).getByText(/, câștigător/)).toHaveCount(0);
  // fish's club colours (ROADMAP §4b.15): each club in its own colour (the palette A–F by row), a
  // winning club at 90% under white/black, the others at 40% under black; the club cell opened by
  // the colour's 4px edge.
  const look = (l: Locator) => l.evaluate(el => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color]);
  const [winBg] = await look(club.locator('th[scope="rowgroup"]'));
  const [secondBg, secondInk] = await look(table.locator('tbody').nth(1).locator('th[scope="rowgroup"]'));
  const [plainBg, plainInk] = await look(table.locator('tbody').nth(3).locator('th[scope="rowgroup"]'));
  expect(new Set([winBg, secondBg, plainBg, 'rgb(255, 255, 255)']).size).toBe(4);
  expect(secondInk).toBe('rgb(0, 0, 0)'); // sector B's orange at 90%: black (AA)
  expect(plainInk).toBe('rgb(0, 0, 0)');
  await expect(club.locator('th[scope="rowgroup"] .rank-sector-solid')).toHaveCount(1);
  // The header row is fish's indigo band.
  expect(await table.locator('thead th').first().evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(224, 231, 255)');
  await axeAtRest(page);
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
  // fish ScrollableTable: the Stand cell white, every other cell at sector A's 40%, black.
  const stand = await rows.first().locator('th').evaluate(el => getComputedStyle(el).backgroundColor);
  const kgLook = await rows.first().locator('td').nth(2).evaluate(el => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color]);
  expect(stand).toBe('rgb(255, 255, 255)');
  expect(kgLook[0]).not.toBe('rgb(255, 255, 255)');
  expect(kgLook[1]).toBe('rgb(0, 0, 0)');
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
  await axeAtRest(page);
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

test('competition-page.clasament-nc.c1 — on a 375 phone the club table keeps Club, Pescari, Loc General and Loc Individual on the first screen; Pescari and both places stay pinned while the numbers scroll', async ({ page }) => {
  await open(page, ID.nc, PHONE);
  const region = page.getByRole('region', { name: 'Clasament pe cluburi' });
  const card = (await region.boundingBox())!;
  const head = (title: string) => region.locator('thead th').filter({ hasText: new RegExp(`^${title}$`) });
  const inView = async (title: string) => {
    const b = (await head(title).boundingBox())!;
    return b.x >= card.x - 1 && b.x + b.width <= card.x + card.width + 1;
  };
  for (const title of ['Club', 'Pescari', 'Loc General', 'Loc Individual']) expect(await inView(title), title).toBe(true);
  // Loc Individual closes the card at its right edge, Loc General beside it.
  const individual = (await head('Loc Individual').boundingBox())!;
  expect(Math.abs(individual.x + individual.width - (card.x + card.width))).toBeLessThanOrEqual(1.5);
  const names = region.locator('tbody tr').first().locator('td').first();
  const [generalX, individualX] = [(await head('Loc General').boundingBox())!.x, individual.x];
  await region.evaluate(el => el.scrollTo({ left: 400 }));
  await expect(region).toHaveAttribute('data-scrolled', 'true');
  // Club scrolled away under Pescari, which is pinned at the card's left; the places did not move.
  await expect.poll(async () => Math.round((await names.boundingBox())!.x)).toBe(Math.round(card.x));
  expect(Math.round((await head('Loc General').boundingBox())!.x)).toBe(Math.round(generalX));
  expect(Math.round((await head('Loc Individual').boundingBox())!.x)).toBe(Math.round(individualX));
  // No right-edge fade over the pinned places.
  expect(await region.evaluate(el => getComputedStyle(el).maskImage)).toBe('none');
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
    await axeAtRest(page);
    await pick(ncPills(page), 'Sector B');
    await expect(page.getByRole('region', { name: 'Clasament sector B' })).toBeVisible();
    await axeAtRest(page);
    expect(errors).toEqual([]);
  });
}

/* ------------------------------------------------------------------ */
/* The standard table (quantity, quality, bestOf, bestOfTiers)          */
/* ------------------------------------------------------------------ */

/** fish's indigo header row (RANKING_HEAD: accent-tint-2). */
const RANK_HEAD_BG = 'rgb(224, 231, 255)';
const visibleRegion = (page: Page, name: string) => visible(page.getByRole('region', { name, exact: true }));

test('§4b.12 §4b.15 — the standard ranking on a 375 phone is fish’s ScrollableTable: the indigo head, the sector fills, the Stand pinned while the columns scroll', async ({
  page,
}) => {
  await open(page, ID.live, PHONE);
  const region = visibleRegion(page, 'Clasament general');
  await expect(region).toBeVisible();
  await expect(page.getByRole('list', { name: 'Clasament' })).toHaveCount(0);
  expect(await region.locator('thead th').first().evaluate(el => getComputedStyle(el).backgroundColor)).toBe(RANK_HEAD_BG);
  // Measured as wider than the phone: the pinned layout is on.
  await expect(region.locator('xpath=..')).toHaveAttribute('data-wide', 'true');
  const row = region.locator('tbody tr').first();
  // The Stand cell stays white (its sector the 4px edge); the name cell carries fish's 40% tint.
  const [standBg, nameBg] = await Promise.all([
    row.locator('td').first().evaluate(el => getComputedStyle(el).backgroundColor),
    row.locator('th[scope="row"]').evaluate(el => getComputedStyle(el).backgroundColor),
  ]);
  expect(standBg).toBe('rgb(255, 255, 255)');
  expect(nameBg).not.toBe('rgb(255, 255, 255)');
  expect(nameBg).not.toBe('rgba(0, 0, 0, 0)');
  // Wider than the phone: the region scrolls sideways (the page does not), the Stand stays put.
  const { scroll, client } = await region.evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth }));
  expect(scroll).toBeGreaterThan(client);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(PHONE.width);
  const stand = row.locator('td').first();
  const before = (await stand.boundingBox())!.x;
  await region.evaluate(el => el.scrollTo({ left: 200 }));
  await expect.poll(async () => Math.round((await stand.boundingBox())!.x - before)).toBe(0);
  await expect.poll(async () => Math.round((await row.locator('th[scope="row"]').boundingBox())!.x)).toBeLessThan(before);
});

test('§4b.16 — the standard table at 1440 is as wide as its columns: the band of controls never widens it, the name track fits the names', async ({
  page,
}) => {
  for (const id of [ID.live, ID.bestOfTiers]) {
    await open(page, id);
    const region = visibleRegion(page, 'Clasament general');
    await expect(region.locator('tbody tr').first()).toBeVisible();
    const card = region.locator('xpath=..');
    const [regionBox, cardBox] = [(await region.boundingBox())!, (await card.boundingBox())!];
    expect(Math.abs(cardBox.width - regionBox.width)).toBeLessThanOrEqual(1);
    // The longest names here are ~150px: with the avatar and the padding, about 260px at most.
    const name = (await region.locator('thead th').nth(1).boundingBox())!;
    expect(name.width).toBeLessThanOrEqual(260);
  }
});

test('§4b.16 — «Pe sectoare» at 1440: the controls span the sector tables, and every sector’s columns line up', async ({ page }) => {
  await open(page, ID.quality);
  const section = visible(page.locator('section[aria-label="Clasament"]'));
  const afisare = section.getByRole('group', { name: 'Afișare' });
  // A press before hydration does nothing: press until the sector tables show.
  await expect(async () => {
    await afisare.getByText('Pe sectoare', { exact: true }).click();
    await expect(section.getByRole('region', { name: /^Clasament sector / }).first()).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 60_000 });
  const tables = section.getByRole('region', { name: /^Clasament sector / });
  await expect(tables.first()).toBeVisible();
  expect(await tables.count()).toBeGreaterThan(2);
  const lefts = await tables.evaluateAll(els =>
    els.map(el => [...el.querySelectorAll('thead th')].map(th => Math.round(th.getBoundingClientRect().left)).join(',')),
  );
  expect(new Set(lefts).size).toBe(1);
  const band = afisare.locator('xpath=ancestor::div[contains(@class,"rounded-card")][1]');
  const [bandBox, tableBox] = [(await band.boundingBox())!, (await tables.first().boundingBox())!];
  expect(Math.abs(bandBox.x - tableBox.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(bandBox.width - tableBox.width)).toBeLessThanOrEqual(1);
  // fish's grey «nu se punctează» catch cells ($gray4), the same in both themes.
  const unscored = section.locator('td[aria-label="nu se punctează"]').first();
  expect(await unscored.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(237, 237, 237)');
});

test('§4b.11 — bestOfTiers: a row without a catch, and a Best N the row never reached, read «–» in the Best-N band, never «0,000»', async ({ page }) => {
  await open(page, ID.bestOfTiers);
  const region = visibleRegion(page, 'Clasament general');
  await expect(region.locator('tbody tr').first()).toBeVisible();
  // The Best-N band (columns «Best N») holds no «0,000» anywhere.
  const heads = await headTexts(region);
  const tierCols = heads.map((h, i) => (/^Best \d+$/.test(h.replace(/\s+/g, ' ').trim()) ? i : -1)).filter(i => i >= 0);
  expect(tierCols.length).toBeGreaterThan(0);
  for (const i of tierCols) {
    const texts = await region.locator(`tbody tr > :nth-child(${i + 1})`).allInnerTexts();
    expect(texts.filter(t => /0,000/.test(t))).toEqual([]);
  }
  // A no-catch row has one «nothing» mark: «–» in «Nr. Buc» too, never «0» beside the «–»s.
  const count = heads.findIndex(h => /Nr\.?\s*Buc/.test(h));
  expect(count).toBeGreaterThan(-1);
  const noCatch = region
    .locator('tbody tr')
    .filter({ has: page.locator(`> :nth-child(${count + 1}) .sr-only`, { hasText: 'Fără capturi' }) })
    .first();
  await expect(noCatch.locator(`> :nth-child(${count + 1}) span[aria-hidden]`)).toHaveText('–');
  await expect(noCatch.locator(`> :nth-child(${tierCols[0] + 1})`).getByText('Fără capturi')).toHaveClass(/sr-only/);
  expect(await region.locator(`tbody tr > :nth-child(${count + 1})`).allInnerTexts()).not.toContain('0');
});

test('§4b.20 — feeder leg from 1280: the leg tabs stay in a card heading the sector grid (as wide as it), never loose on the page', async ({ page }) => {
  for (const width of [1280, 1440]) {
    await open(page, ID.feeder, { width, height: 900 });
    await pick(legChips(page), 'Manșa 1');
    const grid = page.getByRole('region', { name: 'Clasament manșa 1' });
    await expect(grid.locator('table').first()).toBeVisible();
    // The band is a card (its surface and shadow), the strip one segmented container on it.
    const band = legChips(page).locator('xpath=ancestor::div[contains(@class,"rounded-card")][1]');
    const look = await band.evaluate(el => [getComputedStyle(el).backgroundColor, getComputedStyle(el).boxShadow]);
    expect(look[0]).toBe('rgb(255, 255, 255)');
    expect(look[1]).not.toBe('none');
    // The selected leg is filled (white text on the accent), the others are not.
    const tabs = legChips(page).locator('label');
    expect(await tabs.filter({ hasText: 'Manșa 1' }).evaluate(el => getComputedStyle(el).color)).toBe('rgb(255, 255, 255)');
    expect(await tabs.filter({ hasText: 'General' }).evaluate(el => getComputedStyle(el).color)).not.toBe('rgb(255, 255, 255)');
    // The grid's header: aligned with the sector cards under it and as wide as the row they fill
    // (never a stub card floating over a 1200px grid, §4b.16).
    const cards = await grid.locator(':scope > section').evaluateAll(els => els.map(el => el.getBoundingClientRect()).map(r => ({ x: r.x, right: r.right, y: r.y })));
    const firstRow = cards.filter(c => Math.abs(c.y - cards[0].y) < 1);
    const card = (await band.boundingBox())!;
    expect(Math.abs(card.x - firstRow[0].x)).toBeLessThanOrEqual(1);
    expect(Math.abs(card.x + card.width - Math.max(...firstRow.map(c => c.right)))).toBeLessThanOrEqual(1);
  }
});
