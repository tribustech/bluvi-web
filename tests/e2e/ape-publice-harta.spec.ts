import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';

/*
 * Ape publice — the map's own behaviour (parity public-waters.harta-ape): the zoom bands, the
 * clusters, the taps on the map, the camera restore, the claim reroute, the type filter and the
 * empty area. The rest of the screen (chrome, list, search, counties, locate) is in
 * ape-publice.spec.ts. Each test names the criterion / state ids it covers.
 *
 * The camera is driven and read through the dev-only test hook WaterMap leaves on its container
 * (`.maplibregl-map`.__map, dropped from production builds). «Zoom» below is fish's
 * (log2(360 / longitude span), features/public-waters/band.ts), converted to MapLibre's zoom
 * for the canvas width — the same conversion the screen makes.
 */

test.setTimeout(180_000);

const DESKTOP = { width: 1440, height: 900 };
/** Snagov (reservoir, Ilfov): a lake big enough to draw as a shape in the geometry band. */
const SNAGOV = { id: 2245, lng: 26.1418, lat: 44.7067 };
/** Razim (Tulcea): the first row of the «largest waters» list over Romania. */
const RAZIM = { id: 56, code: 'L:RO14_01_L49' };
const CHITA = process.env.E2E_LAKE_CHITA ?? 's84u55lo4n9z0emngozttt6e';
const LAKE_TYPES = 'natural_lake,reservoir_lake,coastal_lake,transitional_lake';

type Cam = { w: number; s: number; e: number; n: number; fishZoom: number };
type HookEl = HTMLElement & { __map?: import('maplibre-gl').Map };

const mapEl = (page: Page) => page.locator('.maplibregl-map');

async function mapReady(page: Page) {
  await expect.poll(() => mapEl(page).evaluate((el: HookEl) => Boolean(el.__map)), { timeout: 60_000 }).toBe(true);
}

async function camera(page: Page): Promise<Cam> {
  return mapEl(page).evaluate((el: HookEl) => {
    const b = el.__map!.getBounds();
    return { w: b.getWest(), s: b.getSouth(), e: b.getEast(), n: b.getNorth(), fishZoom: Math.log2(360 / (b.getEast() - b.getWest())) };
  });
}

/** The camera at rest (no easing in flight). */
async function settled(page: Page) {
  await expect.poll(() => mapEl(page).evaluate((el: HookEl) => !el.__map!.isMoving()), { timeout: 20_000 }).toBe(true);
}

/** A programmatic jump (not a user gesture) to `fishZoom` over lng/lat; resolves on moveend. */
async function jumpTo(page: Page, lng: number, lat: number, fishZoom: number) {
  await mapEl(page).evaluate(
    (el: HookEl, [lng, lat, z]) =>
      new Promise<void>((resolve) => {
        const m = el.__map!;
        const width = m.getCanvas().clientWidth || 1;
        m.once('moveend', () => resolve());
        m.jumpTo({ center: [lng, lat], zoom: z - Math.log2(512 / width) });
      }),
    [lng, lat, fishZoom] as const,
  );
}

const sameCamera = (a: Cam, b: Cam) => {
  const tol = (a.e - a.w) * 0.01;
  return Math.abs(a.w - b.w) < tol && Math.abs(a.e - b.e) < tol && Math.abs(a.n - b.n) < tol && Math.abs(a.s - b.s) < tol;
};

/** The ids the indigo network source currently draws. */
async function drawnIds(page: Page) {
  return mapEl(page).evaluate((el: HookEl) => [...new Set(el.__map!.querySourceFeatures('pw-network').map((f) => Number(f.properties?.id)))]);
}

/**
 * A point of the visible map (page coordinates) with nothing on it: no water shape within 30px,
 * no marker within 44px, not under the toolbar, list or card.
 */
async function emptyPoint(page: Page) {
  const p = await mapEl(page).evaluate((el: HookEl) => {
    const m = el.__map!;
    const canvas = m.getCanvas();
    const box = canvas.getBoundingClientRect();
    const markers = [...el.querySelectorAll('.maplibregl-marker')].map((n) => n.getBoundingClientRect());
    const layers = ['pw-net-fill', 'pw-net-line', 'pw-sel-fill', 'pw-sel-line'];
    for (let fy = 0.3; fy <= 0.85; fy += 0.05) {
      for (let fx = 0.15; fx <= 0.85; fx += 0.05) {
        const x = box.width * fx;
        const y = box.height * fy;
        if (m.queryRenderedFeatures([[x - 30, y - 30], [x + 30, y + 30]], { layers }).length) continue;
        const ax = box.left + x;
        const ay = box.top + y;
        if (markers.some((r) => ax > r.left - 44 && ax < r.right + 44 && ay > r.top - 44 && ay < r.bottom + 44)) continue;
        if (document.elementFromPoint(ax, ay) !== canvas) continue;
        return { x: ax, y: ay };
      }
    }
    return null;
  });
  expect(p, 'an empty spot on the map').not.toBeNull();
  return p!;
}

/** A point on Snagov's outline (page coordinates): the vertex nearest the canvas centre. */
async function snagovPoint(page: Page) {
  return mapEl(page).evaluate(async (el: HookEl, id) => {
    const m = el.__map!;
    const water = await (await fetch(`/ape-publice/api/water/${id}`)).json();
    const flat: [number, number][] = [];
    const walk = (c: unknown): void => {
      if (Array.isArray(c) && typeof c[0] === 'number') flat.push(c as [number, number]);
      else if (Array.isArray(c)) c.forEach(walk);
    };
    walk(water.geometry.coordinates);
    const box = m.getCanvas().getBoundingClientRect();
    let best = { x: 0, y: 0, d: Infinity };
    for (const v of flat) {
      const p = m.project(v);
      const d = Math.hypot(p.x - box.width / 2, p.y - box.height / 2);
      if (d < best.d) best = { x: p.x, y: p.y, d };
    }
    return { x: box.left + best.x, y: box.top + best.y };
  }, SNAGOV.id);
}

const geometryTitle = (page: Page) => page.getByRole('heading', { name: /^\d+ (apă|ape) în această zonă$/ });
const clustersTitle = (page: Page) => page.getByRole('heading', { name: 'Cele mai mari ape din zonă' });

test.describe('public-waters.harta-ape — the map', () => {
  test('public-waters.harta-ape.c1 c2 — the Bălți home switch opens Ape publice, with no «NOU» badge after 2026-09-06', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/balti');
    const toggle = page.getByRole('navigation', { name: 'Tip de apă' });
    await expect(toggle).toBeVisible();
    await expect(toggle.getByText('NOU')).toHaveCount(0);
    await toggle.getByRole('link', { name: 'Ape publice' }).click();
    await expect(page).toHaveURL(/\/ape-publice$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Ape publice' })).toBeVisible();
  });

  test('public-waters.harta-ape.c7 c10 c11 c12 s1 s2 s3 — the bands with hysteresis, the 150 / 1500 limits, the shapes in indigo, «Se încarcă apele…»', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const reads: URL[] = [];
    page.on('request', (r) => {
      if (/\/ape-publice\/api\/(viewport|markers)\?/.test(r.url())) reads.push(new URL(r.url()));
    });
    let release = () => {};
    const gate = new Promise<void>((r) => (release = r));
    await page.route('**/ape-publice/api/viewport?*', async (route) => {
      await gate;
      return route.fallback();
    });
    await page.setViewportSize(DESKTOP);
    await page.goto('/ape-publice');
    await mapReady(page);
    await expect(clustersTitle(page)).toBeVisible();
    // c11: the clusters band lists the 150 largest waters of the view.
    const markers = reads.find((u) => u.pathname.endsWith('/markers'))!;
    expect(markers.searchParams.get('limit')).toBe('150');

    // c7: 11.0 is still the clusters band.
    await jumpTo(page, SNAGOV.lng, SNAGOV.lat, 11.0);
    await expect(clustersTitle(page)).toBeVisible();
    expect(reads.some((u) => u.pathname.endsWith('/viewport'))).toBe(false);

    // ≥ 11.2 enters the geometry band; its first read in flight → the pill (c12, s3).
    await jumpTo(page, SNAGOV.lng, SNAGOV.lat, 11.3);
    await expect(page.getByText('Se încarcă apele…')).toBeVisible();
    release();
    await expect(geometryTitle(page)).toBeVisible();
    await expect(page.getByText('Se încarcă apele…')).toHaveCount(0);
    const viewport = reads.find((u) => u.pathname.endsWith('/viewport'))!;
    expect(viewport.searchParams.get('limit')).toBe('1500');
    expect(viewport.searchParams.get('types')).toBe(LAKE_TYPES);

    // c10 (s2): the shapes, in the accent indigo — lines, and lakes washed at 18%.
    await expect.poll(() => drawnIds(page), { timeout: 30_000 }).toContain(SNAGOV.id);
    const paint = await mapEl(page).evaluate((el: HookEl) => {
      const m = el.__map!;
      return {
        fillOpacity: m.getPaintProperty('pw-net-fill', 'fill-opacity'),
        fill: String(m.getPaintProperty('pw-net-fill', 'fill-color')),
        line: String(m.getPaintProperty('pw-net-line', 'line-color')),
        accent: getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim(),
      };
    });
    expect(paint.fillOpacity).toBe(0.18);
    expect(paint.fill).toBe(paint.accent);
    expect(paint.line).toBe(paint.accent);
    await expectNoA11yViolations(page);

    // c7: back to 11.0 stays in the geometry band (leaves only at ≤ 10.6) …
    await jumpTo(page, SNAGOV.lng, SNAGOV.lat, 11.0);
    await expect(geometryTitle(page)).toBeVisible();
    // … 10.5 is the clusters band again, and the shapes are gone.
    await jumpTo(page, SNAGOV.lng, SNAGOV.lat, 10.5);
    await expect(clustersTitle(page)).toBeVisible();
    await expect.poll(() => drawnIds(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('public-waters.harta-ape.c8 c9 — clusters: counted badges, never «1»; small clusters as pins from 8.5; a tap zooms in', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/ape-publice');
    await mapReady(page);
    await expect(clustersTitle(page)).toBeVisible();
    const clusters = page.getByRole('button', { name: /^\d+ ape — mărește harta aici$/ });
    await expect(clusters.first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^1 ape — / })).toHaveCount(0);
    for (const label of await clusters.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))) {
      expect(Number(label.split(' ')[0])).toBeGreaterThan(1);
    }

    // c9: a cluster tap zooms to max(expansion, current + 1.2), never past 11.5.
    await settled(page);
    const before = await camera(page);
    await clusters.first().click();
    await expect.poll(async () => (await camera(page)).fishZoom, { timeout: 20_000 }).toBeGreaterThan(before.fishZoom + 1.15);
    await settled(page);
    const after = await camera(page);
    expect(after.fishZoom).toBeLessThanOrEqual(11.5 + 0.05);

    // c8: from 8.5 the clusters of ≤ 4 waters are single icon pins; a pin selects its water.
    await jumpTo(page, 26.1, 44.6, 9);
    const pins = page.locator('[data-water-pin]');
    await expect(pins.first()).toBeVisible();
    await expect(pins.first()).toHaveAttribute('aria-label', /— selectează pe hartă$/);
    await pins.first().click();
    await expect(page.getByRole('article')).toBeVisible();
  });

  test('public-waters.harta-ape.c13 c16 c20 s6 — taps on the map: a shape selects, a miss closes and restores the camera; a pan keeps it', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/ape-publice');
    await mapReady(page);
    await jumpTo(page, SNAGOV.lng, SNAGOV.lat, 11.5);
    await expect(geometryTitle(page)).toBeVisible();
    await expect.poll(() => drawnIds(page), { timeout: 30_000 }).toContain(SNAGOV.id);
    await settled(page);
    const start = await camera(page);
    const card = page.getByRole('article', { name: 'Snagov' });

    // A tap on the lake's outline (≤ 14px tolerance) selects it: the card, the amber highlight.
    const onLake = await snagovPoint(page);
    await page.mouse.click(onLake.x, onLake.y);
    await expect(card).toBeVisible();
    await expect(mapEl(page).locator('xpath=..')).toHaveAttribute('data-selected-water', String(SNAGOV.id));
    await settled(page);
    const framed = await camera(page);
    expect(sameCamera(framed, start)).toBe(false);

    // c13 + c16: a tap on nothing closes the preview and puts the camera back where it was.
    const empty = await emptyPoint(page);
    await page.mouse.click(empty.x, empty.y);
    await expect(card).toHaveCount(0);
    await settled(page);
    expect(sameCamera(await camera(page), start)).toBe(true);

    // Again; this time the user pans during the preview: closing leaves the camera alone.
    await page.mouse.click(onLake.x, onLake.y);
    await expect(card).toBeVisible();
    await settled(page);
    const framedAgain = await camera(page);
    const from = await emptyPoint(page);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 80, from.y + 40, { steps: 8 });
    await page.mouse.up();
    await settled(page);
    const panned = await camera(page);
    expect(sameCamera(panned, framedAgain)).toBe(false);
    // c13: the selected water's own pin re-frames it.
    await page.getByRole('button', { name: 'Snagov — reîncadrează pe hartă' }).click();
    await expect.poll(async () => sameCamera(await camera(page), framedAgain), { timeout: 20_000 }).toBe(true);
    await settled(page);
    await card.getByRole('button', { name: 'Închide' }).click();
    await expect(card).toHaveCount(0);
    await settled(page);
    expect(sameCamera(await camera(page), framedAgain)).toBe(true);
  });

  test('public-waters.harta-ape.c13 c16 — clusters band: a tap on nothing closes the preview (camera back)', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/ape-publice');
    await mapReady(page);
    await expect(clustersTitle(page)).toBeVisible();
    await settled(page);
    const start = await camera(page);
    await page.locator('[data-t2-id] button').first().click();
    const card = page.getByRole('article', { name: 'Razim' });
    await expect(card).toBeVisible();
    await settled(page);
    const empty = await emptyPoint(page);
    await page.mouse.click(empty.x, empty.y);
    await expect(card).toHaveCount(0);
    await settled(page);
    expect(sameCamera(await camera(page), start)).toBe(true);
  });

  test('public-waters.harta-ape.c20 c24 s5 s6 — phone: the preview and the list sheet never share the screen; closing restores the sheet as it was', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/ape-publice');
    const row = page.locator('[data-t2-id] button').first();
    await expect(row).toContainText('Razim');
    // Sheet open → select: the sheet steps aside for the card; closing brings it back.
    await row.click();
    const card = page.getByRole('article', { name: 'Razim' });
    await expect(card).toBeVisible();
    await expect(row).not.toBeInViewport();
    await expect(page.getByRole('button', { name: /^Vezi lista \(\d+\)$/ })).toHaveCount(0);
    await card.getByRole('button', { name: 'Închide' }).click();
    await expect(card).toHaveCount(0);
    await expect(row).toBeInViewport();
    // Sheet hidden by a pan → select from a pin: closing leaves it hidden («Vezi lista» back).
    await mapReady(page);
    const box = (await page.locator('.maplibregl-canvas').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 200);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + 230, { steps: 6 });
    await page.mouse.up();
    const pill = page.getByRole('button', { name: /^Vezi lista \(\d+\)$/ });
    await expect(pill).toBeVisible();
    await jumpTo(page, 26.1, 44.6, 9);
    await page.locator('[data-water-pin]').first().click();
    await expect(page.getByRole('article')).toBeVisible();
    await expect(pill).toHaveCount(0);
    await page.getByRole('article').getByRole('button', { name: 'Închide' }).click();
    await expect(pill).toBeVisible();
    await expect(row).not.toBeInViewport();
  });

  test('public-waters.harta-ape.c25 — locate: 20 km around the user, then 5 km tighter per press, down to 5 km', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: SNAGOV.lat, longitude: SNAGOV.lng });
    await page.setViewportSize(DESKTOP);
    await page.goto('/ape-publice');
    await mapReady(page);
    const locate = page.getByRole('button', { name: 'Locația mea' });
    // The radius the camera shows: the larger of the half-spans, in km (fitBounds keeps the box whole).
    const radiusKm = async () => {
      const c = await camera(page);
      const lat = (c.n + c.s) / 2;
      return Math.max(((c.n - c.s) / 2) * 111, ((c.e - c.w) / 2) * 111 * Math.cos((lat * Math.PI) / 180));
    };
    const centred = async () => {
      const c = await camera(page);
      return c.w < SNAGOV.lng && SNAGOV.lng < c.e && c.s < SNAGOV.lat && SNAGOV.lat < c.n;
    };
    await locate.click();
    await expect(locate).toHaveAttribute('aria-pressed', 'true');
    await settled(page);
    expect(await centred()).toBe(true);
    const r20 = await radiusKm();
    expect(r20).toBeGreaterThan(19);
    for (const km of [15, 10, 5, 5]) {
      await locate.click();
      await settled(page);
      await expect.poll(async () => Math.round(((await radiusKm()) / r20) * 20)).toBe(km);
    }
    expect(await centred()).toBe(true);
  });

  test('public-waters.harta-ape.c15 s7 — a failed load returns silently to no selection', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: [/Failed to load resource/, /500/] });
    await page.setViewportSize(DESKTOP);
    await page.route('**/ape-publice/api/water/*', (route) => route.fulfill({ status: 500, body: '{}' }));
    await page.goto('/ape-publice');
    const row = page.locator('[data-t2-id] button').first();
    await expect(row).toContainText('Razim');
    await row.click();
    await expect(row).not.toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('article')).toHaveCount(0);
    await expect(page.locator(`[data-water-pin="${RAZIM.id}"][aria-pressed="true"]`)).toHaveCount(0);
    await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('public-waters.harta-ape.c14 c31 s8 — a claimed water opens its lake, from the list and from the search', async ({ page }) => {
    await page.route('**/feed/public-waters/claimed*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ linkCode: RAZIM.code, lakeDocumentId: CHITA }] }) }),
    );
    await page.setViewportSize(DESKTOP);
    // The claim map is read before the first tap can count (empty until loaded = no reroute).
    const claimRead = page.waitForResponse('**/feed/public-waters/claimed*');
    await page.goto('/ape-publice');
    await claimRead;
    const row = page.locator('[data-t2-id] button').first();
    await expect(row).toContainText('Razim');
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/balti/${CHITA}$`));

    await page.goto('/ape-publice');
    await page.getByRole('button', { name: 'Caută un râu sau lac' }).click();
    const dialog = page.getByRole('dialog', { name: 'Caută ape publice' });
    await dialog.getByRole('searchbox', { name: 'Caută un râu sau lac' }).fill('razim');
    await dialog.getByRole('button', { name: /^Razim Lac natural · Tulcea/ }).click();
    await expect(page).toHaveURL(new RegExp(`/balti/${CHITA}$`));
  });

  test('public-waters.harta-ape.c6 c19 c22 c23 s4 — Lacuri / Râuri types, «N județe», an empty area', async ({ page }) => {
    const reads: URL[] = [];
    page.on('request', (r) => {
      if (/\/ape-publice\/api\/markers\?/.test(r.url())) reads.push(new URL(r.url()));
    });
    let release = () => {};
    const gate = new Promise<void>((r) => (release = r));
    await page.route('**/ape-publice/api/markers?*', async (route) => {
      await gate;
      return route.fallback();
    });
    await page.setViewportSize(DESKTOP);
    await page.goto('/ape-publice');
    // c23: the list waits with a spinner while the read is in flight.
    await expect(page.getByRole('status').filter({ hasText: 'Se încarcă apele' }).first()).toBeAttached();
    release();
    const rows = page.locator('[data-t2-id] button');
    await expect(rows.first()).toContainText('Razim');
    expect(reads.at(-1)!.searchParams.get('types')).toBe(LAKE_TYPES);
    const lakes = await rows.allTextContents();
    expect(lakes.every((t) => t.trim().endsWith('Lac'))).toBe(true);
    // c22: area descending.
    const ha = lakes.map((t) => Number((t.match(/· ([\d.]+) ha/)?.[1] ?? '0').replace(/\./g, '')));
    expect(ha).toEqual([...ha].sort((a, b) => b - a));

    await page.getByRole('button', { name: 'Râuri' }).click();
    await expect.poll(() => reads.at(-1)!.searchParams.get('types')).toBe('river');
    await expect(rows.first()).toContainText('Râu');
    await expect.poll(async () => (await rows.allTextContents()).every((t) => t.trim().endsWith('Râu'))).toBe(true);
    // c19: a river over several counties says how many.
    await expect(rows.filter({ hasText: /^Dunarea/ })).toContainText('12 județe');

    // s4 / c21 / c23: an area with no water.
    await mapReady(page);
    await jumpTo(page, 31.5, 43.4, 9);
    await expect(page.getByRole('heading', { name: 'Nicio apă în această zonă' })).toBeVisible();
    await expect(page.getByText('Nicio apă publică în această zonă.').filter({ visible: true })).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
