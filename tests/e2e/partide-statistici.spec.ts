import { expect, test, type Page, type Route } from '@playwright/test';
import { seriesDetailLabels, type CommunityStatsDTO, type StatsPeriod } from '@/core/partide';
import { partideHrefs } from '@/lib/partide-pages';
import { routes } from '@/lib/routes';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { IMG, partideFaultsAvailable, servePhotos, setPartideNoPrefetch } from './partide-comunitate.fixtures';

/*
 * Partide · Statistici comunitate (/partide/statistici) — parity docs/parity/areas/partide.yml
 * partide.statistici c1–c9. fish: app/(app)/partide/statistici.tsx + components/stats/*.
 *
 * Every read of /feed/community/stats is served with page.route (the page's dev-only `noprefetch`
 * switch leaves the first read to the browser): full, empty, failed and slow periods. Read-only
 * page — nothing is written anywhere, no Firestore.
 */

test.setTimeout(90_000);

const PHONE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };

test.beforeAll(async ({ request }) => {
  test.skip(!(await partideFaultsAvailable(request)), 'needs next dev (the noprefetch switch is dev-only)');
});
test.beforeEach(async ({ context }) => {
  await setPartideNoPrefetch(context);
});

/* ------------------------------------------------------------------ fixtures */

const series = (n: number, label: (i: number) => string) =>
  Array.from({ length: n }, (_, i) => ({ label: label(i), count: i === 0 ? 1 : i === n - 1 ? 3 : (i * 7) % 5 }));

function full(period: StatsPeriod, over: Partial<CommunityStatsDTO> = {}): CommunityStatsDTO {
  const n = period === 'week' ? 7 : period === 'month' ? 30 : 10;
  return {
    period,
    totals: period === 'week' ? { partide: 4, anglers: 3, catches: 9, totalKg: 20 } : { partide: 12, anglers: 5, catches: 31, totalKg: 88.4 },
    weeklySeries: series(n, (i) => String(i + 1)),
    topAnglers: [
      { uid: 'ang-1', name: 'Ion Popescu', avatarUrl: null, partide: 5, catches: 14, totalKg: 41.25 },
      { uid: 'ang-2', name: null, avatarUrl: null, partide: 1, catches: 1, totalKg: 12.5 },
      { uid: 'ang-3', name: 'Maria Ionescu', avatarUrl: null, partide: 3, catches: 9, totalKg: 0 },
      { uid: 'ang-4', name: 'Al patrulea', avatarUrl: null, partide: 2, catches: 2, totalKg: 0 },
    ],
    topVenues: [
      { key: 'lake:l1', name: 'Balta Live', locality: 'Giurgiu', lakeId: 'l1', imageUrl: `${IMG}/lake.jpg`, partide: 6, catches: 20, liveCount: 2 },
      { key: 'water:RO1', name: 'Dunărea', locality: null, lakeId: null, imageUrl: null, partide: 1, catches: 1, liveCount: 0 },
      { key: 'lake:l3', name: 'Balta Trei', locality: 'Ilfov', lakeId: 'l3', imageUrl: null, partide: 2, catches: 5, liveCount: 0 },
      { key: 'lake:l4', name: 'Balta Patru', locality: 'Ilfov', lakeId: 'l4', imageUrl: null, partide: 2, catches: 4, liveCount: 0 },
      { key: 'lake:l5', name: 'Balta Cinci', locality: 'Ilfov', lakeId: 'l5', imageUrl: null, partide: 1, catches: 1, liveCount: 0 },
      { key: 'lake:l6', name: 'Balta Șase', locality: 'Ilfov', lakeId: 'l6', imageUrl: null, partide: 1, catches: 0, liveCount: 0 },
    ],
    record: {
      weightKg: 12.4,
      species: 'Crap',
      venueName: 'Balta Live',
      sessionDocumentId: 'rec-sess',
      angler: { uid: 'ang-1', name: 'Ion Popescu', avatarUrl: null },
      occurredAt: '2026-10-03T10:00:00.000Z',
      photoUrl: `${IMG}/catch.jpg`,
      photoWidth: 1600,
      photoHeight: 900,
    },
    species: [
      { name: 'Crap', count: 20, pct: 64.5 },
      { name: 'Somn', count: 8, pct: 25.8 },
      { name: 'Biban', count: 3, pct: 9.7 },
    ],
    stands: [],
    ...over,
  };
}

const EMPTY = (period: StatsPeriod): CommunityStatsDTO => ({
  ...full(period),
  totals: { partide: 0, anglers: 0, catches: 0, totalKg: 0 },
  weeklySeries: series(period === 'week' ? 7 : 30, () => '').map((p) => ({ ...p, count: 0 })),
  topAnglers: [],
  topVenues: [],
  record: null,
  species: [],
});

type Answer = { status?: number; body?: CommunityStatsDTO; delayMs?: number };

/** Serves /feed/community/stats per period (answers may change between calls); records the periods asked. */
async function serveStats(page: Page, answers: Partial<Record<StatsPeriod, Answer | Answer[]>>) {
  const asked: string[] = [];
  const calls: Record<string, number> = {};
  await page.route('**/feed/community/stats*', async (route: Route) => {
    const period = (new URL(route.request().url()).searchParams.get('period') ?? 'month') as StatsPeriod;
    asked.push(period);
    const list = answers[period];
    const i = calls[period] ?? 0;
    calls[period] = i + 1;
    const a = Array.isArray(list) ? list[Math.min(i, list.length - 1)] : (list ?? { body: full(period) });
    if (a.delayMs) await new Promise((r) => setTimeout(r, a.delayMs));
    if (a.status && a.status >= 400) return route.fulfill({ status: a.status, contentType: 'application/json', body: '{"error":{"status":500}}' }).catch(() => {});
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: a.body ?? full(period) }) }).catch(() => {});
  });
  return asked;
}

async function open(page: Page, path: string, viewport = PHONE) {
  await page.setViewportSize(viewport);
  await servePhotos(page);
  await page.goto(path);
}

const chip = (page: Page, name: string) => page.getByTestId('period-chips').getByRole('radio', { name });
/** Choose a period as a user does: the chip's label (the radio itself is visually hidden). */
const pick = (page: Page, name: string) => page.getByTestId('period-chips').getByText(name, { exact: true }).click();

/* ------------------------------------------------------------------ tests */

test('c1 c4 c5 c6 c7 c8 c9 — the full period, phone and desktop', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await serveStats(page, {});
  await open(page, routes.partideStats());

  // c1 — title, back, the three chips with Luna chosen.
  await expect(page.getByRole('heading', { level: 1, name: 'Statistici comunitate' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Înapoi' })).toBeVisible();
  for (const name of ['Săptămâna', 'Luna', 'Anul curent']) await expect(chip(page, name)).toHaveCount(1);
  await expect(chip(page, 'Luna')).toBeChecked();

  // c4 — partide · pescari · capturi (no kg tile).
  await expect(page.getByTestId('stat-partide')).toContainText('12');
  await expect(page.getByTestId('stat-anglers')).toContainText('Pescari');
  await expect(page.getByTestId('stat-anglers')).toContainText('5');
  await expect(page.getByTestId('stat-catches')).toContainText('31');
  await expect(page.getByTestId('stats-bento')).not.toContainText('kg total');

  // c5 — the chart; arrowing through it names the bucket «{n} captură/capturi · {label}».
  const chart = page.getByTestId('activity-card').getByRole('img');
  const detail = seriesDetailLabels('month', 30, new Date());
  await chart.focus();
  await page.keyboard.press('Home');
  await expect(page.getByTestId('activity-card')).toContainText(`1 captură · ${detail[0]}`);
  await page.keyboard.press('End');
  await expect(page.getByTestId('activity-card')).toContainText(`3 capturi · ${detail[29]}`);
  // Pointer scrubbing names a bucket too.
  const box = (await chart.boundingBox())!;
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2);
  await expect(page.getByTestId('activity-card')).toContainText(`3 capturi · ${detail[29]}`);

  // c6 — top 3 anglers, «Pescar» without a name, the counts, the profile links, «Clasament ›».
  const rows = page.getByTestId('top-angler');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Ion Popescu');
  await expect(rows.nth(0)).toContainText('5 partide · 14 capturi');
  await expect(rows.nth(0)).toContainText('41,25');
  await expect(rows.nth(1)).toContainText('Pescar');
  await expect(rows.nth(1)).toContainText('1 partidă · 1 captură');
  await expect(rows.nth(2)).toContainText('—');
  await expect(rows.nth(0).getByRole('link')).toHaveAttribute('href', routes.angler('ang-1'));
  const ranking = partideHrefs.ranking('month');
  if (ranking) await expect(page.getByTestId('top-anglers-ranking')).toHaveAttribute('href', ranking);
  else await expect(page.getByTestId('top-anglers-ranking')).toHaveCount(0);

  // c7 — the record: the period tag, kg · species, the meta, the link to its partidă.
  const hero = page.getByTestId('record-hero');
  await expect(hero).toContainText('RECORDUL LUNII');
  await expect(page.getByTestId('record-kg')).toHaveText('12,4');
  await expect(page.getByTestId('record-species')).toHaveText('Crap');
  await expect(page.getByTestId('record-meta')).toContainText('Ion · Balta Live · 3 OCT');
  await expect(page.getByTestId('record-link')).toHaveAttribute('href', routes.partida('rec-sess'));

  // c8 — top 5 venues: the live pill, «N capturi», lakes link, a public water does not.
  const venues = page.getByTestId('top-venue');
  await expect(venues).toHaveCount(5);
  await expect(venues.nth(0)).toContainText('2 LIVE');
  await expect(venues.nth(0)).toContainText('Giurgiu · 6 partide');
  await expect(venues.nth(0).getByRole('link')).toHaveAttribute('href', routes.lake('l1'));
  await expect(venues.nth(1)).toContainText('1 partidă');
  await expect(venues.nth(1)).toContainText('1 captură');
  await expect(venues.nth(1).getByRole('link')).toHaveCount(0);
  await expect(venues.nth(2)).toContainText('5 capturi');
  await expect(page.getByTestId('top-venues')).not.toContainText('Balta Șase');

  // c9 — one bar per species with its share.
  const species = page.getByTestId('species-row');
  await expect(species).toHaveCount(3);
  await expect(species.nth(0)).toContainText('Crap');
  await expect(species.nth(0)).toContainText('64,5%');
  await expect(species.nth(2)).toContainText('9,7%');

  await expectNoA11yViolations(page);

  // Desktop: the same blocks in the bento, the record beside the totals.
  await page.setViewportSize(DESKTOP);
  const heroBox = (await hero.boundingBox())!;
  const partideBox = (await page.getByTestId('stat-partide').boundingBox())!;
  expect(Math.abs(heroBox.y - partideBox.y)).toBeLessThan(2);
  expect(partideBox.x).toBeGreaterThan(heroBox.x + heroBox.width);
  await expectNoA11yViolations(page);
  expect(errors).toEqual([]);
});

test('c1 — the period lives in ?perioada= (invalid → Luna, Luna left out)', async ({ page }) => {
  const asked = await serveStats(page, {});
  await open(page, `${routes.partideStats()}?perioada=foo`);
  await expect(page.getByTestId('stats-bento')).toBeVisible();
  await expect(chip(page, 'Luna')).toBeChecked();
  await expect(page).toHaveURL(/\/partide\/statistici$/);
  expect(asked[0]).toBe('month');

  await pick(page, 'Săptămâna');
  await expect(page).toHaveURL(/\?perioada=week$/);
  await expect(page.getByTestId('stat-partide')).toContainText('4');
  await expect(page.getByTestId('record-hero')).toContainText('RECORDUL SĂPTĂMÂNII');
  expect(asked).toContain('week');

  await pick(page, 'Luna');
  await expect(page).toHaveURL(/\/partide\/statistici$/);

  // A shared link opens on its period.
  await page.goto(routes.partideStats('year'));
  await expect(chip(page, 'Anul curent')).toBeChecked();
  await expect(page.getByTestId('record-hero')).toContainText('RECORDUL ANULUI');
});

test('c2 — a slow switch keeps the previous figures dimmed to 40% and inert', async ({ page }) => {
  await serveStats(page, { week: { body: full('week'), delayMs: 3000 } });
  await open(page, routes.partideStats(), DESKTOP);
  await expect(page.getByTestId('stat-partide')).toContainText('12');

  await pick(page, 'Săptămâna');
  const content = page.getByTestId('stats-content');
  await expect(content).toHaveAttribute('data-switching', 'true');
  await expect(content).toHaveCSS('opacity', '0.4');
  await expect(content).toHaveAttribute('inert', '');
  // The previous period's numbers and its tag stay (never the new period's name over them).
  await expect(page.getByTestId('stat-partide')).toContainText('12');
  await expect(page.getByTestId('record-hero')).toContainText('RECORDUL LUNII');
  // The chips stay live, with the spinner beside them.
  await expect(chip(page, 'Săptămâna')).toBeChecked();

  await expect(content).not.toHaveAttribute('data-switching', 'true', { timeout: 10_000 });
  await expect(content).toHaveCSS('opacity', '1');
  await expect(page.getByTestId('stat-partide')).toContainText('4');
  await expect(page.getByTestId('record-hero')).toContainText('RECORDUL SĂPTĂMÂNII');
});

test('c3 — a failed read is the error card with a retry, never empty or stale', async ({ page }) => {
  await serveStats(page, { month: [{ status: 500 }, { body: full('month') }], week: { status: 500 } });
  await open(page, routes.partideStats());
  const error = page.getByTestId('stats-error');
  await expect(error).toContainText('Nu am putut încărca statisticile.');
  await expect(error).toContainText('Verifică conexiunea');
  await expect(page.getByTestId('stats-empty')).toHaveCount(0);
  await expectNoA11yViolations(page);

  await error.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(page.getByTestId('stats-bento')).toBeVisible();
  await expect(page.getByTestId('stat-partide')).toContainText('12');

  // A failed switch shows the error, not the previous period's figures; the chips stay.
  await pick(page, 'Săptămâna');
  await expect(page.getByTestId('stats-error')).toBeVisible();
  await expect(page.getByTestId('stats-bento')).toHaveCount(0);
  await pick(page, 'Luna');
  await expect(page.getByTestId('stat-partide')).toContainText('12');
});

test('c3 — an empty period says so and offers the wider one', async ({ page }) => {
  await serveStats(page, { month: { body: EMPTY('month') } });
  await open(page, routes.partideStats());
  const empty = page.getByTestId('stats-empty');
  await expect(empty).toContainText('Nicio partidă în comunitate pentru perioada selectată.');
  await expect(page.getByTestId('stats-bento')).toHaveCount(0);
  await expectNoA11yViolations(page);
  await empty.getByRole('button', { name: 'Vezi anul curent' }).click();
  await expect(chip(page, 'Anul curent')).toBeChecked();
  await expect(page.getByTestId('stats-bento')).toBeVisible();
  await expect(page).toHaveURL(/\?perioada=year$/);
});

test('sections hide when their arrays are empty; a record without photo or partidă', async ({ page }) => {
  await serveStats(page, {
    month: {
      body: full('month', {
        weeklySeries: [],
        topAnglers: [],
        topVenues: [],
        species: [],
        record: { ...full('month').record!, photoUrl: null, sessionDocumentId: null, species: null, angler: null },
      }),
    },
  });
  await open(page, routes.partideStats(), DESKTOP);
  await expect(page.getByTestId('stat-partide')).toContainText('12');
  for (const id of ['activity-card', 'top-anglers', 'top-venues', 'species-card']) await expect(page.getByTestId(id)).toHaveCount(0);
  const hero = page.getByTestId('record-hero');
  await expect(hero).toContainText('RECORDUL LUNII');
  await expect(page.getByTestId('record-kg')).toHaveText('12,4');
  await expect(page.getByTestId('record-species')).toHaveCount(0);
  await expect(page.getByTestId('record-meta')).toContainText('Balta Live · 3 OCT');
  await expect(hero.getByRole('link')).toHaveCount(0);

  // No record either: the totals alone.
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await serveStats(page, { month: { body: full('month', { record: null }) } });
  await page.reload();
  await expect(page.getByTestId('stat-partide')).toContainText('12');
  await expect(page.getByTestId('record-hero')).toHaveCount(0);
});

test('c7 — a record photo that fails to load falls back to the navy tile with the trophy', async ({ page }) => {
  await serveStats(page, {});
  await page.setViewportSize(PHONE);
  await servePhotos(page);
  // Registered after servePhotos, so it wins for the record's photo.
  await page.route(`${IMG}/catch.jpg`, (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto(routes.partideStats());
  const hero = page.getByTestId('record-hero');
  await expect(hero).toContainText('RECORDUL LUNII');
  await expect(page.getByTestId('record-photo')).toHaveCount(0);
  await expect(page.getByTestId('record-trophy')).toHaveCount(1);
  await expect(page.getByTestId('record-tag')).toHaveAttribute('data-tone', 'navy');
  await expect(page.getByTestId('record-tag')).not.toHaveClass(/bg-photo-scrim/);
  await expect(page.getByTestId('record-link')).not.toHaveClass(/aspect-video/);
  await expectNoA11yViolations(page);
});

test('phone: DOM, Tab and visual order are the fish order (totals, chart, anglers, record, venues, species)', async ({ page }) => {
  await serveStats(page, {});
  await open(page, routes.partideStats());
  const blocks = ['stat-partide', 'activity-card', 'top-anglers', 'record-hero', 'top-venues', 'species-card'];
  await expect(page.getByTestId('species-card')).toBeVisible();
  const order = await page.evaluate((ids) => {
    const els = ids.map((id) => document.querySelector(`[data-testid="${id}"]`)!);
    const dom = [...els].sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)).map((e) => e.getAttribute('data-testid'));
    const visual = [...els].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).map((e) => e.getAttribute('data-testid'));
    return { dom, visual };
  }, blocks);
  expect(order.dom).toEqual(blocks);
  expect(order.visual).toEqual(blocks);

  // Tab from the chart: the anglers' rows, then the record, then the venues' links — never back up.
  await page.getByTestId('activity-card').getByRole('img').focus();
  const seen: string[] = [];
  for (let i = 0; i < 20; i++) {
    const at = await page.evaluate((ids) => {
      const el = document.activeElement;
      return ids.find((id) => el?.closest(`[data-testid="${id}"]`)) ?? null;
    }, blocks);
    if (at && seen[seen.length - 1] !== at) seen.push(at);
    if (at === null && seen.length > 1) break;
    await page.keyboard.press('Tab');
  }
  expect(seen).toEqual(['activity-card', 'top-anglers', 'record-hero', 'top-venues']);
});

test('c6 — the top 3 are the server order (fish slice(0, 3)), even on tied kilos; rows read their figures', async ({ page }) => {
  const tied = [
    { uid: 'u-a', name: 'Primul Server', avatarUrl: null, partide: 1, catches: 1, totalKg: 0 },
    { uid: 'u-b', name: 'Al Doilea', avatarUrl: null, partide: 2, catches: 2, totalKg: 0 },
    { uid: 'u-c', name: 'Al Treilea', avatarUrl: null, partide: 1, catches: 0, totalKg: 0 },
    { uid: 'u-d', name: 'Cele Mai Multe', avatarUrl: null, partide: 9, catches: 40, totalKg: 0 },
  ];
  await serveStats(page, { month: { body: full('month', { topAnglers: tied }) } });
  await open(page, routes.partideStats());
  const rows = page.getByTestId('top-angler');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Primul Server');
  await expect(rows.nth(1)).toContainText('Al Doilea');
  await expect(rows.nth(2)).toContainText('Al Treilea');
  await expect(page.getByTestId('top-anglers')).not.toContainText('Cele Mai Multe');
  // The row link's name is its content: the place, the name, the counts, the kg (none here).
  const link = rows.nth(1).getByRole('link');
  await expect(link).not.toHaveAttribute('aria-label', /.*/);
  await expect(link).toHaveAccessibleName(/Locul 2.*Al Doilea.*2 partide · 2 capturi.*nicio greutate/);
});

test('first load shows the skeleton, never zero-filled tiles', async ({ page }) => {
  await serveStats(page, { month: { body: full('month'), delayMs: 2500 } });
  await open(page, routes.partideStats());
  await expect(page.getByTestId('stats-skeleton')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Statistici comunitate' })).toBeVisible();
  await expect(page.getByTestId('stat-partide')).toContainText('12', { timeout: 10_000 });
  await expect(page.getByTestId('stats-skeleton')).toHaveCount(0);
});

test('server render: the period is in the HTML with its JSON-LD (no mock)', async ({ browser }) => {
  // A fresh context without the noprefetch cookie: the page's own cached CMS read.
  const ctx = await browser.newContext();
  const res = await ctx.request.get(routes.partideStats('year'));
  expect(res.ok()).toBe(true);
  const html = await res.text();
  expect(html).toContain('Statistici comunitate');
  expect(html).toMatch(/"@type":"CollectionPage"/);
  expect(html).toMatch(/"@type":"BreadcrumbList"/);
  expect(html).toContain('/partide/statistici/opengraph-image');
  await ctx.close();
});
