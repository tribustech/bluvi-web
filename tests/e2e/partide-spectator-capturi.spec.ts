import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';

/*
 * partide.spectator-capturi (/partide/[id]/capturi, T1) c1–c4, plus partide.spectator.c12 (the
 * spectator's «Vezi toate ({n})» opening it). fish: app/(app)/partide/comunitate/capturi/[id].tsx,
 * features/partide/community/hooks.ts (useSessionCatchesInfinite, useCommunitySession).
 *
 * Data:
 *  - MOCKED partide: ids starting with `e2e-` are never read by the server in development
 *    (../_spectator/load.ts), so the BROWSER's GET /feed/community/sessions/:id and
 *    /feed/community/sessions/:id/catches (cursor pages) answer them here (page.route). The page is
 *    read-only and public: no CMS write, no Firestore (spectators read the CMS only).
 *  - REAL: one ended public partidă of the local CMS (server prerender, JSON-LD) and an unknown id
 *    (the CMS's 404 → the not-found state, noindex).
 * A fixed clock (page.clock) makes the times deterministic (Bucharest, UTC+3 on 2026-10-07).
 * The FOLLOW_RECORD_* → /partide/[id]/capturi mapping: tests/unit/notification-href.test.ts.
 */

const NOW = new Date('2026-10-07T12:00:00.000Z'); // 15:00 in Bucharest
const MANY = 'e2e-capturi';
const EMPTY = 'e2e-capturi-empty';
const GONE = 'e2e-capturi-gone';
const DAYS = 'e2e-capturi-zile';
const LIVE = 'e2e-capturi-live';
const REAL = process.env.E2E_PARTIDA_ID ?? 'perfseedfq3otnzlrafuws4b';
const UNKNOWN = 'zzunknownpartida000000001';
/** Mocked 404 / 500 answers are logged by the browser. */
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of (404|500)/];

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGM4YWODFTEMLQkAZZlQAVIPr1MAAAAASUVORK5CYII=',
  'base64',
);
const PHOTO = (n: string) => `https://e2e-photos.invalid/${n}.png`;
const at = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();

/* ------------------------------------------------------------------------------------------------
 * Fixtures: 27 catches, newest first (14:50, 14:40, …), 20 a page.
 *  #0 Crap 3,4 kg, photo · #1 Caras 1,24 kg, no photo · #2 nothing known, photo · #3 Somn 8,69 kg,
 *  photo — the partidă's biggest · #4… Amur, a photo on every even one.
 * ---------------------------------------------------------------------------------------------- */

type Catch = ReturnType<typeof catchOf>;

function catchOf(i: number, species: string | null, kg: number | null, photo: boolean) {
  const src = photo ? PHOTO(`c-${i}`) : null;
  return { clientId: `c-${i}`, species, weightKg: kg, photoUrl: src, photoGridUrl: src, photoThumbUrl: src, occurredAt: at(10 + i * 10), width: null, height: null };
}

const CATCHES: Catch[] = [
  catchOf(0, 'Crap', 3.4, true),
  catchOf(1, 'Caras', 1.24, false),
  catchOf(2, null, null, true),
  catchOf(3, 'Somn', 8.69, true),
  ...Array.from({ length: 23 }, (_, k) => catchOf(k + 4, 'Amur', Math.round((1 + (k + 4) / 10) * 100) / 100, (k + 4) % 2 === 0)),
];
const TOTAL = CATCHES.length; // 27

function detail(id: string, catches: Catch[]) {
  const photos = catches.filter(c => c.photoUrl);
  const weighed = catches.filter(c => c.weightKg != null);
  const max = weighed.reduce<Catch | null>((m, c) => (m == null || c.weightKg! > m.weightKg! ? c : m), null);
  const oldest = catches.length ? Math.min(...catches.map(c => new Date(c.occurredAt).getTime())) : NOW.getTime();
  return {
    documentId: id,
    startedAt: new Date(Math.min(new Date(at(300)).getTime(), oldest - 30 * 60_000)).toISOString(),
    endedAt: id === LIVE ? null : at(5),
    venueName: 'Balta Mock',
    venueType: 'lake',
    publicWaterCode: null,
    locality: 'Giurgiu',
    lakeId: 'e2e-lake-1',
    imageUrl: null,
    venueImageUrl: null,
    members: [{ uid: 'e2e-angler-1', name: 'Ion Pescar', avatarUrl: null }],
    catchCount: catches.length,
    maxKg: max?.weightKg ?? null,
    durationMs: 295 * 60_000,
    catches: catches.slice(0, 10),
    photos: photos.slice(0, 5),
    weighedCatches: catches.filter(c => c.weightKg != null).map(c => ({ t: c.occurredAt, kg: c.weightKg, species: c.species })),
    maxCatch: max,
    photoCount: photos.length,
    hasMoreCatches: catches.length > 10,
    anglerStats: null,
  };
}

/** A 36 h partidă: two catches today (7 OCT), one yesterday (6 OCT). */
const DAY_CATCHES: Catch[] = [catchOf(0, 'Crap', 9, true), catchOf(1, 'Caras', 1.2, false), { ...catchOf(2, 'Somn', 4.5, true), occurredAt: at(24 * 60 + 30) }];
/** A live partidă: 4 catches, then (setLive) a fifth — the new biggest. */
const LIVE_BEFORE: Catch[] = [catchOf(1, 'Crap', 3.4, false), catchOf(2, 'Caras', 1.2, false), catchOf(3, 'Somn', 5.5, false), catchOf(4, 'Amur', 2, false)];
const LIVE_AFTER: Catch[] = [catchOf(0, 'Crap', 9.1, false), ...LIVE_BEFORE];

const FIXTURES: Record<string, Catch[]> = { [MANY]: CATCHES, [EMPTY]: [], [DAYS]: DAY_CATCHES, [LIVE]: LIVE_BEFORE };

type Calls = { pages: (string | null)[] };

/**
 * The partidă and its catch pages; `status` answers every read of the catches with that status
 * (once, then 200, when `once`); `delayMs` holds the first read of each.
 */
async function mockCms(page: Page, { catchesStatus = 200, once = false, delayMs = 0 } = {}): Promise<Calls> {
  const calls: Calls = { pages: [] };
  let failures = catchesStatus === 200 ? 0 : once ? 1 : Infinity;
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const hold = () => (delayMs ? new Promise(r => setTimeout(r, delayMs)) : Promise.resolve());
  await page.route('https://e2e-photos.invalid/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.route(/\/feed\/community\/sessions\/(e2e-[^/?]+)(\?.*)?$/, async route => {
    const id = /sessions\/(e2e-[^/?]+)/.exec(route.request().url())![1];
    await hold();
    const catches = FIXTURES[id];
    return catches ? json(route, { data: detail(id, catches) }) : json(route, { error: { status: 404 } }, 404);
  });
  await page.route(/\/feed\/community\/sessions\/(e2e-[^/?]+)\/catches(\?.*)?$/, async route => {
    const url = new URL(route.request().url());
    const id = /sessions\/(e2e-[^/?]+)\/catches/.exec(url.pathname)![1];
    const cursor = url.searchParams.get('cursor');
    calls.pages.push(cursor);
    await hold();
    const catches = FIXTURES[id];
    if (!catches) return json(route, { error: { status: 404 } }, 404);
    if (failures > 0) {
      failures -= 1;
      return json(route, { error: { status: catchesStatus } }, catchesStatus);
    }
    const size = Number(url.searchParams.get('pageSize') ?? 20);
    const start = cursor ? Number(cursor.slice(1)) : 0;
    const data = catches.slice(start, start + size);
    const next = start + size < catches.length ? `p${start + size}` : null;
    return json(route, { data, meta: { pagination: { pageSize: size, total: catches.length }, nextCursor: next } });
  });
  return calls;
}

async function open(page: Page, id: string, width = 1280) {
  await page.setViewportSize({ width, height: 900 });
  await page.clock.install({ time: NOW });
  await page.goto(`/partide/${id}/capturi`);
}

const title = (page: Page) => page.getByRole('heading', { level: 1 });
const phoneRows = (page: Page) => page.getByTestId('catches-list').getByTestId('partida-catch');
const tableRows = (page: Page) => page.getByTestId('catches-table').getByTestId('catches-row');
const lightbox = (page: Page) => page.getByTestId('lightbox');

/* ------------------------------------------------------------------------------------------------
 * c1 — title and back
 * ---------------------------------------------------------------------------------------------- */

test('partide.spectator-capturi.c1 «Capturi (27)» — the total from page 1 — with the way back to the partidă', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await mockCms(page);
  await open(page, MANY, 375);
  await expect(title(page)).toHaveText('Capturi (27)');
  await expect(page.getByTestId('catches-subtitle')).toHaveText('Partidă la Balta Mock');
  const back = page.getByRole('link', { name: 'Înapoi la partidă' }).first();
  await expect(back).toHaveAttribute('href', `/partide/${MANY}`);
  await expectNoA11yViolations(page);
  await back.click();
  await expect(page).toHaveURL(new RegExp(`/partide/${MANY}$`));
  expect(errors).toEqual([]);
});

test('partide.spectator-capturi.c1 c4 first load: «Capturi» without a total over the list skeleton, then «Capturi (27)»', async ({ page }) => {
  await mockCms(page, { delayMs: 2500 });
  await open(page, MANY, 375);
  await expect(page.getByTestId('catches-skeleton').first()).toBeVisible();
  await expect(title(page)).toHaveText('Capturi');
  await expect(page.getByText('Se încarcă capturile…').first()).toBeAttached();
  await expect(title(page)).toHaveText('Capturi (27)', { timeout: 20_000 });
  await expect(page.getByTestId('catches-skeleton')).toHaveCount(0);
});

/* ------------------------------------------------------------------------------------------------
 * c2 — every catch, the biggest highlighted, the next page at the end
 * ---------------------------------------------------------------------------------------------- */

test('partide.spectator-capturi.c2 phone: fish rows (thumb, species, time, kg), the max in indigo, 20 then all 27 on scroll', async ({ page }) => {
  const calls = await mockCms(page);
  await open(page, MANY, 375);
  const rows = phoneRows(page);
  await expect(rows).toHaveCount(20);
  await expect(page.getByTestId('catches-table')).toBeHidden();
  await expect(rows.nth(0)).toContainText('Crap');
  await expect(rows.nth(0)).toContainText('14:50');
  await expect(rows.nth(0)).toContainText(/3,4\s*kg/);
  await expect(rows.nth(1)).toContainText('Caras');
  await expect(rows.nth(2)).toContainText('Captură'); // no species: fish's «Captură»
  // The partidă's biggest (maxKg 8,69), and only it.
  await expect(page.getByTestId('catches-list').locator('[data-testid="partida-catch"][data-max]')).toHaveCount(1);
  await expect(rows.nth(3)).toHaveAttribute('data-max', 'true');
  await expect(rows.nth(3).getByText('8,69')).toHaveClass(/text-accent-ink/);
  await expect(rows.nth(0).getByText('3,4')).toHaveClass(/text-ink/);
  // The end of the list loads the next page (the cursor), and the footer says it is all here.
  await rows.nth(19).scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 4000);
  await expect(rows).toHaveCount(TOTAL);
  expect(calls.pages).toEqual([null, 'p20']);
  await expect(rows.last()).toContainText('Amur');
});

test('partide.spectator-capturi.c2 desktop (rule 14): a table with every column, the biggest labelled, all rows on scroll, no summary below 1280', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const calls = await mockCms(page);
  await open(page, MANY, 1024);
  const table = page.getByTestId('catches-table');
  await expect(table).toBeVisible();
  for (const h of ['Ora', 'Foto', 'Specie', 'Greutate']) await expect(table.getByRole('columnheader', { name: h })).toBeVisible();
  await expect(phoneRows(page).first()).toBeHidden();
  const rows = tableRows(page);
  await expect(rows).toHaveCount(20);
  const first = rows.nth(0).getByRole('cell');
  await expect(first.nth(0)).toHaveText('14:50');
  await expect(first.nth(2)).toHaveText('Crap');
  await expect(first.nth(3)).toHaveText(/3,4\s*kg/);
  await expect(rows.nth(1).getByRole('cell').nth(3)).toHaveText(/1,24\s*kg/);
  await expect(rows.nth(2).getByRole('cell').nth(2)).toHaveText('Captură');
  await expect(rows.nth(2).getByRole('cell').nth(3)).toHaveText('–'); // not weighed (never «capot»)
  await expect(rows.nth(3)).toHaveAttribute('data-max', 'true');
  await expect(rows.nth(3)).toContainText('Cea mai mare');
  await expect(table.getByText('Cea mai mare')).toHaveCount(1);
  await expect(page.getByTestId('catches-summary')).toBeHidden();
  await expectNoA11yViolations(page);
  await rows.nth(19).scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 4000);
  await expect(rows).toHaveCount(TOTAL);
  expect(calls.pages).toEqual([null, 'p20']);
  expect(errors).toEqual([]);
});

test('partide.spectator-capturi.c2 from 1280: the summary card beside the table (status, count, the biggest, «Vezi partida»), the table never stretched (rule 16)', async ({ page }) => {
  await mockCms(page);
  for (const width of [1280, 1440, 1920]) {
    await open(page, MANY, width);
    const summary = page.getByTestId('catches-summary');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('ÎNCHEIATĂ');
    await expect(summary).toContainText('Balta Mock');
    await expect(summary).toContainText('27');
    await expect(summary).toContainText(/8,69\s*kg/);
    await expect(summary).toContainText('Somn');
    await expect(summary.getByRole('link', { name: 'Vezi partida' })).toHaveAttribute('href', `/partide/${MANY}`);
    const box = await page.getByTestId('catches-list').boundingBox();
    expect(box!.width, `table width at ${width}`).toBeLessThanOrEqual(600);
    // The kg stays within reach of its species (no 500 px gulf between «Crap» and «3,4 kg»).
    const cells = tableRows(page).nth(0).getByRole('cell');
    const species = await cells.nth(2).getByText('Crap').boundingBox();
    const kg = await cells.nth(3).getByText('3,4').boundingBox();
    expect(kg!.x - (species!.x + species!.width), `species → kg gap at ${width}`).toBeLessThanOrEqual(360);
    const side = await summary.boundingBox();
    expect(side!.x - (box!.x + box!.width), `the summary sits beside the table at ${width}`).toBeLessThanOrEqual(32);
  }
});

test('partide.spectator-capturi.c2 a partidă over more than one day: a «Zi» column on desktop, a caption per day on the phone, the day in the lightbox', async ({ page }) => {
  await mockCms(page);
  await open(page, DAYS, 1280);
  const table = page.getByTestId('catches-table');
  for (const h of ['Zi', 'Ora', 'Foto', 'Specie', 'Greutate']) await expect(table.getByRole('columnheader', { name: h })).toBeVisible();
  const rows = tableRows(page);
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0).getByRole('cell').nth(0)).toHaveText('7 OCT');
  await expect(rows.nth(0).getByRole('cell').nth(1)).toHaveText('14:50');
  await expect(rows.nth(2).getByRole('cell').nth(0)).toHaveText('6 OCT');
  await expect(rows.nth(2).getByRole('cell').nth(1)).toHaveText('14:30');
  await expect(rows.nth(2).getByRole('button', { name: 'Somn, 4,5 kg, 6 OCT, 14:30 — vezi fotografia' })).toBeVisible();
  await expectNoA11yViolations(page);

  await open(page, DAYS, 375);
  const days = page.getByTestId('catches-day');
  await expect(days).toHaveText(['7 OCT', '6 OCT']);
  await expect(phoneRows(page)).toHaveCount(3);
  await phoneRows(page).nth(2).getByRole('button').click();
  await expect(lightbox(page).getByTestId('lightbox-footer')).toHaveText('Somn · 4,5 kg · 6 OCT, 14:30');
  await page.keyboard.press('Escape');
  await expectNoA11yViolations(page);

  // A same-day partidă keeps HH:MM alone (fish): no «Zi», no day captions.
  await open(page, MANY, 1280);
  await expect(page.getByTestId('catches-table').getByRole('columnheader', { name: 'Zi' })).toHaveCount(0);
  await open(page, MANY, 375);
  await expect(phoneRows(page)).toHaveCount(20);
  await expect(page.getByTestId('catches-day')).toHaveCount(0);
});

test('partide.spectator-capturi.c2 live: the partidă\'s 60 s poll bringing a new catch reads the list again — title, rows, biggest and summary agree', async ({ page }) => {
  await mockCms(page);
  await open(page, LIVE, 1440);
  const summary = page.getByTestId('catches-summary');
  await expect(title(page)).toHaveText('Capturi (4)');
  await expect(summary).toContainText('ÎN DESFĂȘURARE');
  await expect(summary.getByRole('definition').first()).toHaveText('4');
  await expect(tableRows(page)).toHaveCount(4);
  await expect(tableRows(page).nth(2)).toHaveAttribute('data-max', 'true'); // Somn 5,5
  FIXTURES[LIVE] = LIVE_AFTER;
  try {
    await page.clock.fastForward(61_000);
    await expect(title(page)).toHaveText('Capturi (5)');
    await expect(tableRows(page)).toHaveCount(5);
    await expect(summary.getByRole('definition').first()).toHaveText('5');
    await expect(summary).toContainText(/9,1\s*kg/);
    await expect(tableRows(page).nth(0)).toHaveAttribute('data-max', 'true'); // the new biggest, highlighted
    await expect(page.getByTestId('catches-table').locator('[data-max]')).toHaveCount(1);
  } finally {
    FIXTURES[LIVE] = LIVE_BEFORE;
  }
});

/* ------------------------------------------------------------------------------------------------
 * c3 — the lightbox: photos only, captioned
 * ---------------------------------------------------------------------------------------------- */

test('partide.spectator-capturi.c3 phone: a photo row opens the lightbox «{specie} · {kg} kg · HH:MM», paging photos only; no-photo rows are not buttons', async ({ page }) => {
  await mockCms(page);
  await open(page, MANY, 375);
  const rows = phoneRows(page);
  await expect(rows).toHaveCount(20);
  await expect(rows.nth(1).getByRole('button')).toHaveCount(0); // Caras, no photo
  await rows.nth(0).getByRole('button').click();
  await expect(lightbox(page)).toBeVisible();
  await expect(lightbox(page).getByTestId('lightbox-footer')).toHaveText('Crap · 3,4 kg · 14:50');
  await page.keyboard.press('ArrowRight'); // skips #1 (no photo)
  await expect(lightbox(page).getByTestId('lightbox-footer')).toHaveText('14:30'); // nothing else known
  await page.keyboard.press('ArrowRight');
  await expect(lightbox(page).getByTestId('lightbox-footer')).toHaveText('Somn · 8,69 kg · 14:20');
  await page.keyboard.press('Escape');
  await expect(lightbox(page)).toBeHidden();
});

test('partide.spectator-capturi.c3 desktop: the thumbnail (keyboard) or the row opens the lightbox; focus returns to it', async ({ page }) => {
  await mockCms(page);
  await open(page, MANY, 1440);
  const rows = tableRows(page);
  await expect(rows).toHaveCount(20);
  await expect(rows.nth(1).getByRole('button')).toHaveCount(0);
  const thumb = rows.nth(3).getByRole('button', { name: 'Somn, 8,69 kg, 14:20 — vezi fotografia' });
  await thumb.focus();
  await page.keyboard.press('Enter');
  await expect(lightbox(page).getByTestId('lightbox-footer')).toHaveText('Somn · 8,69 kg · 14:20');
  await page.keyboard.press('Escape');
  await expect(lightbox(page)).toBeHidden();
  await expect(thumb).toBeFocused();
  // A click anywhere on a photo row opens it too.
  await rows.nth(0).getByRole('cell').nth(2).click();
  await expect(lightbox(page).getByTestId('lightbox-footer')).toHaveText('Crap · 3,4 kg · 14:50');
  await page.keyboard.press('Escape');
  // A row without a photo opens nothing.
  await rows.nth(1).getByRole('cell').nth(2).click();
  await expect(lightbox(page)).toBeHidden();
});

/* ------------------------------------------------------------------------------------------------
 * c4 — empty; the other states
 * ---------------------------------------------------------------------------------------------- */

test('partide.spectator-capturi.c4 empty: «Nicio captură încă.» and the way back, «Capturi (0)», at every width', async ({ page }) => {
  await mockCms(page);
  for (const width of [375, 1280, 1440, 1920]) {
    await open(page, EMPTY, width);
    await expect(page.getByTestId('catches-empty')).toBeVisible();
    await expect(page.getByText('Nicio captură încă.')).toBeVisible();
    await expect(title(page)).toHaveText('Capturi (0)');
    await expect(page.getByTestId('catches-empty').getByRole('link', { name: 'Înapoi la partidă' })).toHaveAttribute('href', `/partide/${EMPTY}`);
    await expect(page.getByTestId('catches-table')).toHaveCount(0);
  }
  await expectNoA11yViolations(page);
});

test('partide.spectator-capturi not found: the CMS 404 (unknown or private) — the partidă\'s not-found state, nothing of it shown', async ({ page }) => {
  const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
  await mockCms(page);
  await open(page, GONE, 375);
  await expect(page.getByRole('heading', { level: 1, name: 'Partida nu a fost găsită.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Vezi partidele' })).toHaveAttribute('href', '/partide');
  await expect(page.getByText('Balta Mock')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('partide.spectator-capturi not found on the server (a real unknown id): rendered, noindex, never a 404 page', async ({ page }) => {
  const res = await page.goto(`/partide/${UNKNOWN}/capturi`);
  expect(res?.status()).toBe(200);
  await expect(page.getByTestId('partida-not-found')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page).toHaveTitle(/Partida nu a fost găsită/);
});

test('partide.spectator-capturi a failed first read: «Nu am putut încărca capturile.» + «Reîncearcă», which reads it again', async ({ page }) => {
  const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
  await mockCms(page, { catchesStatus: 500, once: true });
  await open(page, MANY, 375);
  const error = page.getByTestId('catches-error');
  await expect(error).toContainText('Nu am putut încărca capturile.');
  await error.getByRole('button', { name: 'Reîncearcă' }).click();
  await expect(phoneRows(page)).toHaveCount(20);
  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------------------------------------
 * The real CMS — prerendered, JSON-LD, metadata
 * ---------------------------------------------------------------------------------------------- */

test('partide.spectator-capturi a real public partidă: rows in the HTML, ImageGallery + breadcrumb JSON-LD, canonical, title', async ({ page, request }) => {
  const res = await request.get(`/partide/${REAL}/capturi`);
  expect(res.ok()).toBe(true);
  const html = await res.text();
  expect(html).toContain('data-testid="catches-row"');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap(m => JSON.parse(m[1]) as Record<string, unknown>[]);
  const gallery = blocks.find(b => b['@type'] === 'ImageGallery') as { name: string; url: string; image?: { caption: string }[] } | undefined;
  expect(gallery?.name).toMatch(/^Capturi · Partidă la /);
  expect(gallery?.url).toMatch(new RegExp(`/partide/${REAL}/capturi$`));
  expect(gallery?.image?.length ?? 0).toBeGreaterThan(0);
  expect(gallery!.image![0].caption).toMatch(/kg · \d\d:\d\d$/);
  expect(blocks.some(b => b['@type'] === 'BreadcrumbList')).toBe(true);

  await page.goto(`/partide/${REAL}/capturi`);
  await expect(title(page)).toHaveText(/^Capturi \(\d+\)$/);
  await expect(page).toHaveTitle(/Capturi · Partidă la /);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/partide/${REAL}/capturi$`));
});

/* ------------------------------------------------------------------------------------------------
 * partide.spectator.c12 — the way in
 * ---------------------------------------------------------------------------------------------- */

test('partide.spectator.c12 «Vezi toate (27)» on the partidă opens /partide/[id]/capturi', async ({ page }) => {
  await mockCms(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.clock.install({ time: NOW });
  await page.goto(`/partide/${MANY}`);
  const link = page.getByRole('link', { name: 'Vezi toate (27)' });
  await expect(link).toHaveAttribute('href', `/partide/${MANY}/capturi`);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/partide/${MANY}/capturi$`));
  await expect(title(page)).toHaveText('Capturi (27)');
});
