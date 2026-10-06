import { collectConsoleErrors as watchConsole } from './helpers/console';
import { BASE_URL as BASE } from './helpers/base-url';
import { expectNoA11yViolations } from './helpers/a11y';
import { lakeCompetitionCounts, lakeHasPartide } from './helpers/fixtures';
import { CMS, qaJwt, signIn } from './helpers/session';
import { expect, test, type Locator, type Page } from '@playwright/test';

/*
 * Baltă (/balti/[id], template T3) — parity inventory docs/parity/areas/lakes.yml, screens
 * lakes.detail and lakes.share, plus the two dialogs the page opens (lakes.booking-interest,
 * lakes.claim). Each test names the criterion / state ids it covers. Local CMS on :1337.
 *
 * Lakes (override with E2E_LAKE_*):
 *  - Chita (QA user's lake): booking enabled, an operator with a profile id, one review, Partide
 *    activity (a record, no one live), two upcoming competitions, no facilities / prices / phones;
 *  - Belin: facilities, prices, a phone, no booking, no operator, no reviews;
 *  - Pondum: legacy phone reservations.
 * The page's reads are server-side: its failures and the states the local DB has no lake for (no
 * photos s4, an operator without a profile id s8, no coordinates s9, a slow / failing lake s1 s2,
 * a failing section c24) are set through the dev-only fault switch (POST /balti/<id>/e2e-fault,
 * app/(site)/balti/[id]/_components/e2e-faults.ts), always cleared after the test.
 * The Partide polling (c21) is driven in the browser: the client query's request is intercepted.
 * Targets the web does not have yet (rezervă, a partidă, a profile) are asserted as «unavailable»,
 * never as links (availability.ts); the subpages (galerie, concursuri, partide, statistici, hartă,
 * recenzii — tests/e2e/balta-subpagini*.spec.ts) are on the web and asserted as links.
 */

test.describe.configure({ timeout: 120_000 });

const ID = {
  chita: process.env.E2E_LAKE_CHITA ?? 's84u55lo4n9z0emngozttt6e',
  belin: process.env.E2E_LAKE_FULL ?? 'g14bobjsal2dbks2jg38v0oi',
  pondum: process.env.E2E_LAKE_LEGACY ?? 'l5do45bhkv1nisaqd4wxknuc',
};

const PHONE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1440, height: 900 };

type Lake = {
  documentId: string;
  name: string;
  images: unknown[];
  facility: { id: number; name: string }[];
  fishSpecies: { fish: { Name: string } }[];
  price: { header: string | null; price: number | null }[];
  contact: { header: string | null; name: string | null; phone: string | null }[];
  coordinates: { lat: string; long: string } | null;
  address: string | null;
  website: string | null;
  reviewsMeta: { count: number; overall?: number } | null;
  ownerName?: string | null;
  ownerDocumentId?: string | null;
};
const lakes = new Map<string, Lake>();
let catchesTotal = 0;
let upcoming: { documentId: string; name: string }[] = [];
/** Live + Viitoare per lake (fish LakeCompetitionsSection's two lists), read when the run starts. */
const competitionCounts = new Map<string, { live: number; upcoming: number }>();
/** Whether each lake's Partide section shows (fish hasPartideActivity — this month's activity moves too). */
const partideShown = new Map<string, boolean>();
let jwt = '';
const base = () => BASE;

/** Sets the dev-only faults for one lake (an empty list clears them). */
async function faults(page: Page, id: string, list: string[]) {
  const res = await page.request.post(`${BASE}/balti/${id}/e2e-fault`, { data: { faults: list } });
  expect(res.ok(), 'the dev-only fault switch answers (development server)').toBeTruthy();
}
test.afterEach(async ({ page }) => {
  for (const id of Object.values(ID)) await faults(page, id, []);
});

test.beforeAll(async ({ request }) => {
  for (const id of Object.values(ID)) {
    const res = await request.get(`${CMS}/feed/lakes/${id}`);
    expect(res.ok(), `lake ${id} exists in the local CMS`).toBeTruthy();
    lakes.set(id, (await res.json()).data);
  }
  catchesTotal = (await (await request.get(`${CMS}/feed/community/lakes/${ID.chita}/catches?page=1&pageSize=1`)).json()).meta.pagination.total;
  // Competitions start and end with time: the Concursuri section / chip follow what the CMS has now.
  for (const id of Object.values(ID)) {
    const { live, upcoming: next, upcomingList } = await lakeCompetitionCounts(id);
    competitionCounts.set(id, { live, upcoming: next });
    partideShown.set(id, await lakeHasPartide(id));
    if (id === ID.chita) upcoming = upcomingList;
  }
  jwt = await qaJwt(request);
});

function collectConsoleErrors(page: Page) {
  // Map tiles are a third party: a tile that fails to load is not the page's error.
  return watchConsole(page, { ignore: /openfreemap|tiles\./ });
}

/** The page's analytics events (app/(site)/balti/[id]/_components/analytics.ts), kept across navigations. */
async function recordAnalytics(page: Page) {
  await page.addInitScript(() => {
    window.addEventListener('bluvi:analytics', e => {
      const list = JSON.parse(sessionStorage.getItem('__events') ?? '[]');
      list.push((e as CustomEvent).detail);
      sessionStorage.setItem('__events', JSON.stringify(list));
    });
  });
  return () =>
    page.evaluate(() => JSON.parse(sessionStorage.getItem('__events') ?? '[]') as { name: string; params: Record<string, unknown> }[]).catch(() => []);
}

/** Lets the open dialog finish its entry transition (axe would read the half-faded colours). */
const settleDialog = (page: Page) =>
  page.locator('dialog[open]').evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished)));
const settle = (page: Page) => page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
async function open(page: Page, id: string, viewport = PHONE) {
  await page.setViewportSize(viewport);
  const res = await page.goto(`/balti/${id}`, { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: lakes.get(id)!.name })).toBeVisible();
  // Hydrated before any interaction (a click on a server-rendered button before React attaches is lost).
  await settle(page);
}

const visible = (l: Locator) => l.locator('visible=true').first();
const chips = (page: Page) => page.getByRole('navigation', { name: 'Secțiunile bălții' });
const tiles = (page: Page) => visible(page.getByRole('list', { name: 'Acțiuni rapide' }));

/** fish buildLakeSectionChips for what the CMS says about the lake (Partide / Concursuri known). */
function expectedChips(l: Lake, partide: boolean, competitions: boolean) {
  return [
    'Prezentare',
    ...(l.facility.length ? ['Facilități'] : []),
    ...(l.fishSpecies.length ? ['Pești'] : []),
    ...(partide ? ['Partide'] : []),
    ...(l.price.length ? ['Prețuri'] : []),
    ...(competitions ? ['Concursuri'] : []),
    'Recenzii',
    ...(l.address || l.website || l.contact.length || l.coordinates ? ['Contact'] : []),
  ];
}

/* ------------------------------------------------------------------ */
/* Smoke + axe at the widths, signed out and in                        */
/* ------------------------------------------------------------------ */

for (const id of [ID.chita, ID.belin]) {
  for (const signed of [false, true]) {
    for (const vp of [PHONE, TABLET, DESKTOP]) {
      test(`lakes.detail.c8 lakes.detail.c9 lakes.detail.c10 lakes.detail.c32 lakes.detail.s7 — smoke /balti/${id} · ${vp.width}px · ${signed ? 'signed in' : 'signed out'}, axe`, async ({ page, context }) => {
        if (signed) await signIn(context, jwt, base());
        const errors = collectConsoleErrors(page);
        await open(page, id, vp);
        const l = lakes.get(id)!;
        // c8: the rating beside the name, a link to Recenzii with fish's accessible label.
        const count = l.reviewsMeta?.count ?? 0;
        const rating = page.getByRole('link', { name: count ? /^Recenzii: \d,\d\d din 5, \d+ recenzi[ei]$/ : 'Recenzii: fără recenzii' }).first();
        await expect(rating).toBeVisible();
        await expect(rating).toHaveAttribute('href', '#recenzii');
        // c9: the location line under the name.
        await expect(visible(page.getByTestId('lake-location'))).toContainText(l.address ?? '');
        // c32: the streamed sections arrive (the hero never waited for them).
        await expect(page.locator('#recenzii')).toBeVisible();
        await settle(page);
        // c10: the chips, in fish order — at every width (owner rule 1: no section index column).
        const partide = partideShown.get(id)!;
        // fish: the chip is there while Live + Viitoare hold something (the lake's own CMS state).
        const counts = competitionCounts.get(id)!;
        const competitions = counts.live + counts.upcoming > 0;
        await expect(chips(page).getByRole('link')).toHaveText(expectedChips(l, partide, competitions));
        await expectNoA11yViolations(page, {
          // MapLibre's own canvas region (the mini map is aria-hidden; its attribution is ours).
          exclude: ['.maplibregl-canvas-container'],
        });
        expect(errors, errors.join('\n')).toEqual([]);
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/* Hero + title (phone)                                                */
/* ------------------------------------------------------------------ */

test('lakes.detail.c4 lakes.detail.c5 lakes.detail.c6 lakes.detail.c7 — hero photos (no gallery link yet), share, «Rezervă acum», photo count', async ({ page }) => {
  await open(page, ID.chita);
  const l = lakes.get(ID.chita)!;
  const strip = page.getByRole('list', { name: `Fotografii ${l.name}` });
  // c4: every lake photo; the gallery is not on the web yet, so they are pictures, not dead links.
  await expect(strip.getByRole('listitem')).toHaveCount(l.images.length);
  await expect(strip.getByRole('link')).toHaveCount(0);
  // c5: the share chip over the photo.
  await expect(visible(page.getByRole('button', { name: 'Distribuie balta' }))).toBeVisible();
  // c6: «Rezervă acum» bottom-left on the photo — the kit primary, one colour at every width (a
  // button while the booking flow is not on the web: it opens «Rezervă din aplicația Bluvi»).
  const cta = visible(page.getByRole('button', { name: 'Rezervă acum' }));
  await expect(cta).toBeVisible();
  await expect(cta).toHaveClass(/bg-accent/);
  await expect(cta).not.toHaveClass(/status-live/);
  // c7: images + community catches; the pill opens the gallery (/balti/[id]/galerie).
  const n = l.images.length + catchesTotal;
  const pill = page.getByRole('link', { name: `Galerie: ${n} ${n === 1 ? 'fotografie' : 'fotografii'}` });
  await expect(pill).toBeVisible();
  await expect(pill).toHaveAttribute('href', `/balti/${ID.chita}/galerie`);
});

test('lakes.detail.s4 lakes.detail.c4 — no photos: the token placeholder, chips on the page ground, the catches count on the surface pill', async ({ page }) => {
  await faults(page, ID.chita, ['no-photos']);
  await open(page, ID.chita);
  await expect(page.getByText('Nicio fotografie încă')).toBeVisible();
  await expect(page.locator('[data-t3="photo"]')).toHaveAttribute('data-empty', 'true');
  await expect(page.locator('[data-t3="photo"] img')).toHaveCount(0);
  await expect(visible(page.getByRole('button', { name: 'Distribuie balta' }))).not.toHaveClass(/photo-scrim/);
  if (catchesTotal > 0) await expect(page.getByRole('link', { name: /^Galerie/ })).toHaveClass(/bg-surface/);
  else await expect(page.getByRole('link', { name: /^Galerie/ })).toHaveCount(0);
  // From 768 nothing at all (the header carries back / share).
  await page.setViewportSize(TABLET);
  await expect(page.locator('[data-t3="photo"]')).toBeHidden();
});

test('lakes.detail.c3 — opening the page records the lake as the newest recently viewed (max 10)', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('recentViewedLakeIds', JSON.stringify(Array.from({ length: 10 }, (_, i) => `lake-${i}`)));
      sessionStorage.setItem('seeded', '1');
    }
  });
  await open(page, ID.chita);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('recentViewedLakeIds') ?? '[]'))).toEqual([
    ...Array.from({ length: 9 }, (_, i) => `lake-${i + 1}`),
    ID.chita,
  ]);
});

/* ------------------------------------------------------------------ */
/* Section nav                                                          */
/* ------------------------------------------------------------------ */

test('lakes.detail.c11 lakes.detail.c12 — a chip jumps under the sticky nav and is active; scrolling moves it; the pinned row', async ({ page }) => {
  await open(page, ID.chita);
  await settle(page);
  const nav = chips(page);
  await nav.getByRole('link', { name: 'Recenzii' }).click();
  await expect(nav.getByRole('link', { name: 'Recenzii' })).toHaveAttribute('aria-current', 'location');
  // The section lands just below the pinned rows (top bar 56 + mini row 46 + chips 58 + 12).
  await expect
    .poll(async () => Math.round((await page.locator('#recenzii').boundingBox())!.y))
    .toBeLessThanOrEqual(175);
  await expect.poll(async () => Math.round((await page.locator('#recenzii').boundingBox())!.y)).toBeGreaterThanOrEqual(150);
  // c12: the pinned row — name, rating meta (a link to Recenzii), share.
  await expect(nav).toHaveAttribute('data-pinned', 'true');
  await expect(nav.getByText(lakes.get(ID.chita)!.name)).toBeVisible();
  await expect(nav.getByRole('link', { name: /^Recenzii: / })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Distribuie balta' })).toBeVisible();
  // Scrolling back to the top hands the highlight back to Prezentare.
  await page.mouse.wheel(0, -20000);
  await expect(nav.getByRole('link', { name: 'Prezentare' })).toHaveAttribute('aria-current', 'location');
});

/* ------------------------------------------------------------------ */
/* Prezentare                                                          */
/* ------------------------------------------------------------------ */

test('lakes.detail.c13 — «Vezi mai mult» opens the whole description titled «Descriere»', async ({ page }) => {
  await open(page, ID.chita, TABLET);
  await page.getByRole('button', { name: 'Vezi mai mult' }).click();
  const dialog = page.getByRole('dialog', { name: 'Descriere' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('CHITA LAKE');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('lakes.detail.c14 lakes.detail.c15 — quick actions in fish order, every subpage a tile; no «NOU»', async ({ page }) => {
  await open(page, ID.chita);
  const l = lakes.get(ID.chita)!;
  const list = tiles(page);
  await expect(list.getByRole('listitem')).toHaveText([
    'Rezervă',
    ...(l.price.length ? ['Prețuri'] : []),
    'Partide',
    'Statistici',
    'Concursuri',
    ...(l.coordinates ? ['Direcții', 'Hartă'] : []),
    'Recenzii',
  ]);
  await expect(page.getByTestId('quick-actions-later')).toHaveCount(0);
  await expect(list.getByRole('link', { name: 'Partide' })).toHaveAttribute('href', `/balti/${ID.chita}/partide`);
  await expect(list.getByRole('link', { name: 'Statistici' })).toHaveAttribute('href', `/balti/${ID.chita}/statistici`);
  if (l.coordinates) await expect(list.getByRole('link', { name: 'Hartă' })).toHaveAttribute('href', `/balti/${ID.chita}/harta`);
  await expect(list.getByRole('link', { name: 'Concursuri' })).toHaveAttribute('href', `/balti/${ID.chita}/concursuri`);
  await expect(list.getByRole('link', { name: 'Recenzii' })).toHaveAttribute('href', '#recenzii');
  await expect(list.getByText('NOU')).toHaveCount(0);
  // c11 for a tile: «Recenzii» jumps like its chip — the chip is active at once, focus on the section.
  await list.getByRole('link', { name: 'Recenzii' }).click();
  await expect(chips(page).getByRole('link', { name: 'Recenzii', exact: true })).toHaveAttribute('aria-current', 'location');
  await expect(page.locator('#recenzii')).toBeFocused();
  // From 1024 the tiles leave for the summary card beside them (owner rule 1): its buttons and its
  // Partide / Statistici links carry the pages no section links to.
  await page.setViewportSize(DESKTOP);
  await expect(page.getByRole('list', { name: 'Acțiuni rapide' })).toBeHidden();
  const more = page.getByRole('complementary', { name: 'Pe scurt' }).getByRole('list', { name: 'Mai multe despre baltă' });
  await expect(more.getByRole('link', { name: 'Partide' })).toHaveAttribute('href', `/balti/${ID.chita}/partide`);
  await expect(more.getByRole('link', { name: 'Statistici' })).toHaveAttribute('href', `/balti/${ID.chita}/statistici`);
  await page.setViewportSize(PHONE);
  // Prețuri scrolls to its section (Belin has prices).
  await open(page, ID.belin);
  await expect(tiles(page).getByRole('link', { name: 'Prețuri' })).toHaveAttribute('href', '#preturi');
});

test('lakes.detail.s9 lakes.detail.c14 — no coordinates: no Direcții / Hartă, no mini map', async ({ page }) => {
  await faults(page, ID.belin, ['no-coordinates']);
  await open(page, ID.belin);
  await expect(tiles(page).getByRole('listitem')).not.toContainText(['Direcții']);
  await expect(tiles(page).getByRole('listitem')).not.toContainText(['Hartă']);
  await expect(page.getByTestId('quick-actions-later')).toHaveCount(0);
  await expect(page.getByTestId('lake-mini-map')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Direcții' })).toHaveCount(0);
});

test('lakes.detail.c31 — «Direcții» offers Google Maps, Waze and Apple Maps to the coordinates, at every width', async ({ page }) => {
  const { lat, long } = lakes.get(ID.chita)!.coordinates!;
  const dialog = page.getByRole('dialog', { name: 'Direcții' });
  const expectApps = async () => {
    await expect(dialog.getByRole('link', { name: /Google Maps/ })).toHaveAttribute('href', new RegExp(`destination=${lat},${long}`));
    await expect(dialog.getByRole('link', { name: /Waze/ })).toHaveAttribute('href', new RegExp(`ll=${lat},${long}`));
    await expect(dialog.getByRole('link', { name: /Apple Maps/ })).toHaveAttribute('href', new RegExp(`daddr=${lat},${long}`));
  };
  await open(page, ID.chita);
  await tiles(page).getByRole('button', { name: 'Direcții' }).click();
  await expectApps();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  // Desktop: the summary card and Locație & contact (under the mini map) carry «Direcții» too.
  await open(page, ID.chita, DESKTOP);
  await page.getByRole('complementary', { name: 'Pe scurt' }).getByRole('button', { name: 'Direcții' }).click();
  await expectApps();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.locator('#contact').getByRole('button', { name: 'Direcții' }).click();
  await expectApps();
});

test('lakes.detail.c17 lakes.detail.c18 lakes.detail.c19 — characteristics, facilities with icons, fish species', async ({ page }) => {
  await open(page, ID.belin);
  const l = lakes.get(ID.belin)!;
  const prez = page.locator('#prezentare');
  await expect(prez.getByRole('heading', { name: 'Caracteristici' })).toBeVisible();
  const fac = page.locator('#facilitati');
  await expect(fac.getByRole('listitem')).toHaveText(l.facility.map(f => f.name));
  await expect(fac.locator('svg')).toHaveCount(l.facility.length);
  if (l.fishSpecies.length) await expect(page.locator('#pesti').getByRole('listitem')).toHaveText(l.fishSpecies.map(f => f.fish.Name));
  await open(page, ID.chita);
  await expect(page.locator('#prezentare dl').first()).toContainText('10 ha');
  await expect(page.locator('#prezentare dl').first()).toContainText('21 locuri');
  await expect(page.locator('#prezentare dl').first()).toContainText('Pontoane');
});

/* ------------------------------------------------------------------ */
/* Booking affordance                                                   */
/* ------------------------------------------------------------------ */

test('lakes.detail.c16 lakes.detail.c6 lakes.detail.c33 lakes.detail.s6 lakes.detail.s7 — booking enabled, flow not on the web: the same «Rezervă acum» for everyone, leading to the app', async ({ page, context }) => {
  const events = await recordAnalytics(page);
  const l = lakes.get(ID.chita)!;
  const dialog = page.getByRole('dialog', { name: 'Rezervă din aplicația Bluvi' });
  // Signed out, then signed in: the hero, the header, the tile and the ≥1280 card never change with
  // the session (the page is static; nothing swaps after the probe answers) and none is disabled.
  for (const signed of [false, true]) {
    if (signed) await signIn(context, jwt, base());
    await open(page, ID.chita);
    await expect(page.locator(`a[href="/balti/${ID.chita}/rezerva"]`)).toHaveCount(0);
    await expect(page.getByText('Rezervări · în curând pe web')).toHaveCount(0);
    const hero = visible(page.getByRole('button', { name: 'Rezervă acum' }));
    await expect(hero).toHaveClass(/bg-accent/);
    await expect(tiles(page).getByRole('button', { name: 'Rezervă' })).toBeVisible();
    await hero.click();
    await expect(dialog).toContainText(`${l.name} primește rezervări prin Bluvi.`);
    await expect(dialog.getByRole('link', { name: /App Store/ })).toHaveAttribute('href', /apps\.apple\.com/);
    await expect(dialog.getByRole('link', { name: /Google Play/ })).toHaveAttribute('href', /play\.google\.com/);
    await expect(page).toHaveURL(new RegExp(`/balti/${ID.chita}$`));
    await settleDialog(page);
    await expectNoA11yViolations(page, { include: 'dialog[open]' });
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    for (const vp of [TABLET, DESKTOP]) {
      await page.setViewportSize(vp);
      const button = visible(page.getByRole('button', { name: 'Rezervă acum' }));
      await expect(button).not.toHaveAttribute('aria-disabled', 'true');
      await expect(button).toHaveClass(/bg-accent/);
    }
    // From 1024 the summary card says why, under the same button.
    await expect(page.getByRole('complementary', { name: 'Pe scurt' })).toContainText(
      'Rezervarea online e în curând pe web; până atunci rezervă din aplicația Bluvi.',
    );
  }
  await expect
    .poll(events)
    .toContainEqual({ name: 'lake_booking_cta_pressed', params: { lake_id: ID.chita, lake_name: l.name, source: 'hero_cta', booking_state: 'enabled' } });
});

test('lakes.detail.c16 lakes.detail.c14 lakes.detail.s6 — the booking controls are in the server HTML, whatever the session (no shift when it answers)', async ({ page, context }) => {
  for (const signed of [false, true]) {
    if (signed) await signIn(context, jwt, base());
    const html = await (await page.request.get(`/balti/${ID.chita}`)).text();
    expect(html).toContain('data-tile="rezerva"');
    expect(html).toContain('Rezervă acum');
    expect(html).not.toContain('Rezervări · în curând pe web');
  }
});

test('lakes.detail.c16 lakes.detail.s6 — legacy phone reservations jump to Contact and move focus there (keyboard)', async ({ page }) => {
  await open(page, ID.pondum);
  const cta = visible(page.getByRole('link', { name: 'Rezervă acum' }));
  await expect(cta).toHaveAttribute('href', '#contact');
  await cta.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#contact$/);
  await expect(page.locator('#contact')).toBeFocused();
  // The next Tab continues inside Contact, not back in the hero.
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('#contact'))).toBe(true);
});

test('lakes.detail.c16 lakes.detail.s6 lakes.booking-interest.c1 lakes.booking-interest.c3 lakes.booking-interest.c6 lakes.booking-interest.c7 — no booking opens «Rezervări prin Bluvi»; guest submit → /intra', async ({ page }) => {
  const events = await recordAnalytics(page);
  await open(page, ID.belin);
  const l = lakes.get(ID.belin)!;
  await visible(page.getByRole('button', { name: 'Rezervă acum' })).click();
  const dialog = page.getByRole('dialog', { name: 'Rezervări prin Bluvi' });
  await expect(dialog).toContainText(`${l.name} nu acceptă încă rezervări prin Bluvi.`);
  await expect(dialog).toContainText('Ești administratorul bălții?');
  await expect(dialog).toContainText('Ia legătura cu noi — îți putem crește numărul de rezervări.');
  await settleDialog(page);
  await expectNoA11yViolations(page, { include: 'dialog[open]' });
  await expect.poll(events).toContainEqual({ name: 'lake_booking_interest_sheet_viewed', params: { lake_id: ID.belin, source: 'hero_cta' } });
  await dialog.getByRole('button', { name: 'Închide' }).click();
  await expect(dialog).toBeHidden();
  await tiles(page).getByRole('button', { name: 'Rezervă' }).click();
  await expect.poll(events).toContainEqual({ name: 'lake_booking_interest_sheet_viewed', params: { lake_id: ID.belin, source: 'quick_action' } });
  await dialog.getByRole('button', { name: 'Aș vrea să pot rezerva aici' }).click();
  await expect(page).toHaveURL(/\/intra$/);
});

test('lakes.booking-interest.c2 lakes.claim.c7 — a guest\'s «Contactează-ne» signs in first, never the claim form', async ({ page }) => {
  await open(page, ID.belin);
  await visible(page.getByRole('button', { name: 'Rezervă acum' })).click();
  const dialog = page.getByRole('dialog', { name: 'Rezervări prin Bluvi' });
  await dialog.getByRole('button', { name: 'Contactează-ne' }).click();
  await expect(page).toHaveURL(/\/intra$/);
  await expect(page.getByRole('dialog', { name: 'Ești administratorul acestei bălți?' })).toHaveCount(0);
});

test('lakes.booking-interest.c2 — signed in: «Contactează-ne» closes the dialog and opens the claim', async ({ page, context }) => {
  await signIn(context, jwt, base());
  await open(page, ID.belin);
  await visible(page.getByRole('button', { name: 'Rezervă acum' })).click();
  await page.getByRole('dialog', { name: 'Rezervări prin Bluvi' }).getByRole('button', { name: 'Contactează-ne' }).click();
  await expect(page.getByRole('dialog', { name: 'Ești administratorul acestei bălți?' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Rezervări prin Bluvi' })).toBeHidden();
});

test('lakes.booking-interest.c3 lakes.booking-interest.c4 lakes.booking-interest.c5 — signed in: posts the signal, toasts, then the confirmed row', async ({ page, context }) => {
  await signIn(context, jwt, base());
  const events = await recordAnalytics(page);
  let calls = 0;
  let body: unknown = null;
  await page.route('**/api/cms/feed/lake-booking-interests', async route => {
    calls += 1;
    body = route.request().postDataJSON();
    if (calls === 1) return route.fulfill({ status: 500, json: { error: { status: 500, message: 'x' } } });
    return route.fulfill({ json: { data: { documentId: 'x', alreadyRegistered: true } } });
  });
  await open(page, ID.belin);
  await visible(page.getByRole('button', { name: 'Rezervă acum' })).click();
  const dialog = page.getByRole('dialog', { name: 'Rezervări prin Bluvi' });
  await dialog.getByRole('button', { name: 'Aș vrea să pot rezerva aici' }).click();
  await expect(page.getByText('Nu am putut trimite. Încearcă din nou.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Aș vrea să pot rezerva aici' }).click();
  await expect(page.getByText('Ne-ai spus deja — te anunțăm când balta acceptă rezervări.')).toBeVisible();
  await expect(dialog.getByRole('status')).toHaveText('Am notat că ai vrea să rezervi aici. Te anunțăm când balta acceptă rezervări.');
  await expect(dialog.getByRole('button', { name: 'Aș vrea să pot rezerva aici' })).toHaveCount(0);
  expect(body).toEqual({ data: { lake: ID.belin, source: 'hero_cta' } });
  expect(calls).toBe(2);
  await expect.poll(events).toContainEqual({ name: 'lake_booking_interest_submitted', params: { lake_id: ID.belin, source: 'hero_cta', already_registered: true } });
});

/* ------------------------------------------------------------------ */
/* Partide (c20 – c22)                                                  */
/* ------------------------------------------------------------------ */

test('lakes.detail.c20 — the Partide section: idle card, the 7-month activity, «Vezi tot» and «Vezi toate partidele» to the Partide page', async ({ page }) => {
  await open(page, ID.chita, DESKTOP);
  const section = page.locator('#partide');
  await expect(section.getByRole('heading', { name: 'Partide la această baltă' })).toBeVisible();
  await expect(section.getByRole('link', { name: 'Vezi tot' })).toHaveAttribute('href', `/balti/${ID.chita}/partide`);
  await expect(section.getByRole('link', { name: 'Vezi toate partidele' })).toHaveAttribute('href', `/balti/${ID.chita}/partide`);
  await expect(section.getByText(/în curând/)).toHaveCount(0);
  await expect(section.getByTestId('live-partide-card')).toContainText('luna aceasta');
  await expect(section.getByText('Activitate')).toBeVisible();
  await expect(section.getByText(/ultimele \d luni/)).toBeVisible();
});

const LIVE_SECTION = {
  data: {
    stats: { activeNow: 1, catchesThisMonth: 3, recordKg: 3 },
    activeSessions: [
      {
        documentId: 'sess-e2e',
        startedAt: '2026-10-05T06:00:00.000Z',
        members: [{ uid: 'u-e2e', name: 'Mario Gheorghe', avatarUrl: null }],
        catchCount: 3,
        maxKg: 6.4,
        totalKg: 15.2,
        standName: '2',
      },
    ],
    monthlyActivity: [{ month: 'OCT', count: 1 }],
  },
};

test('lakes.detail.c21 lakes.detail.c20 lakes.detail.s10 — a lake without activity keeps polling: a partidă that starts while the page is open appears', async ({ page }) => {
  await page.clock.install();
  let live = false;
  await page.route('**/feed/community/lakes/*', route => (live ? route.fulfill({ json: LIVE_SECTION }) : route.continue()));
  await open(page, ID.belin, DESKTOP);
  // s10: no activity — no section, no chip.
  await expect(page.locator('#partide')).toHaveCount(0);
  await expect(chips(page).getByRole('link', { name: 'Partide', exact: true })).toHaveCount(0);
  live = true;
  await page.clock.fastForward(61_000);
  await expect(page.locator('#partide').getByTestId('live-partide-card')).toContainText('1 ACTIVI ACUM');
});

test('lakes.detail.c21 lakes.detail.c22 — polls every 60s, keeps the last good data on a failed refresh; live rows are not links until /partide/[id] lands', async ({ page }) => {
  await page.clock.install();
  let mode: 'pass' | 'fail' | 'live' = 'pass';
  await page.route('**/feed/community/lakes/*', async route => {
    if (mode === 'pass') return route.continue();
    if (mode === 'fail') return route.fulfill({ status: 503, json: { error: { status: 503, message: 'down' } } });
    return route.fulfill({ json: LIVE_SECTION });
  });
  await open(page, ID.chita, DESKTOP);
  const card = page.locator('#partide').getByTestId('live-partide-card');
  await expect(card).toContainText('luna aceasta');
  mode = 'fail';
  await page.clock.fastForward(61_000);
  await page.waitForTimeout(500);
  await expect(card).toContainText('luna aceasta');
  mode = 'live';
  await page.clock.fastForward(61_000);
  await expect(card).toContainText('1 ACTIVI ACUM');
  await expect(card).toContainText('15,2 kg');
  await expect(card).toContainText('Stand 2');
  await expect(card).toContainText('cea mai mare');
  await expect(card.getByTestId('live-row-sess-e2e')).not.toHaveAttribute('href', /.*/);
  await expect(card.getByRole('link')).toHaveCount(0);
});

/* ------------------------------------------------------------------ */
/* Prețuri, Concursuri, Recenzii, Contact                              */
/* ------------------------------------------------------------------ */

test('lakes.detail.c23 — prices: header, description, «N RON»', async ({ page }) => {
  await open(page, ID.belin);
  const l = lakes.get(ID.belin)!;
  const rows = page.locator('#preturi').getByRole('listitem');
  await expect(rows).toHaveCount(l.price.length);
  const first = l.price[0];
  if (first.header) await expect(rows.first()).toContainText(first.header);
  if (first.price != null) await expect(rows.first()).toContainText(`${first.price} RON`);
});

test('lakes.detail.c24 lakes.detail.s11 — Concursuri: Viitoare cards to /concursuri/[id], «Vezi tot» to the lake competitions (tab), Live hidden when empty', async ({ page }) => {
  test.skip(!upcoming.length, 'no upcoming competition on the local Chita');
  await open(page, ID.chita, DESKTOP);
  const section = page.locator('#concursuri');
  await expect(section.getByRole('heading', { name: 'Viitoare' })).toBeVisible();
  // Live is hidden only while the lake has no started competition (the local data moves with time).
  if (competitionCounts.get(ID.chita)!.live === 0) await expect(section.getByRole('heading', { name: 'Live', exact: true })).toHaveCount(0);
  await expect(section.getByText(/în curând/)).toHaveCount(0);
  // The section header and the Viitoare rail both open /balti/[id]/concursuri (the rail on its tab).
  await expect(section.getByRole('link', { name: 'Vezi tot' })).toHaveCount(2);
  await expect(section.locator(`a[href="/balti/${ID.chita}/concursuri?tab=viitoare"]`)).toHaveText('Vezi tot');
  await expect(section.locator(`a[href="/balti/${ID.chita}/concursuri"]`)).toHaveText('Vezi tot');
  await expect(section.locator(`a[href="/concursuri/${upcoming[0].documentId}"]`).first()).toBeVisible();
  // s11: Belin has none — once the counts are known, no section and no chip.
  const belin = competitionCounts.get(ID.belin)!;
  test.skip(belin.live + belin.upcoming > 0, 's11 needs a lake without competitions: the local Belin has some now');
  await open(page, ID.belin);
  await settle(page);
  await expect(page.locator('#concursuri')).toHaveCount(0);
  await expect(chips(page).getByRole('link', { name: 'Concursuri' })).toHaveCount(0);
});

test('lakes.detail.c24 — one failed list errors on its own, the other still shows; «Încearcă din nou» reads again and focuses the section', async ({ page }) => {
  test.skip(!upcoming.length, 'no upcoming competition on the local Chita');
  await faults(page, ID.chita, ['competitions-live']);
  await open(page, ID.chita, DESKTOP);
  const section = page.locator('#concursuri');
  const error = section.getByTestId('competitions-error-live');
  await expect(error).toContainText('A apărut o eroare la încărcarea datelor.');
  await expect(section.getByRole('heading', { name: 'Viitoare' })).toBeVisible();
  await faults(page, ID.chita, []);
  await error.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(error).toHaveCount(0);
  await expect(section.getByRole('heading', { name: 'Viitoare' })).toBeVisible();
  // The retry button is gone: focus is on the section's heading, not thrown to <body>.
  await expect(page.locator('#concursuri-titlu')).toBeFocused();
});

test('lakes.detail.c25 lakes.detail.c26 lakes.detail.c27 lakes.detail.s5 — the review summary, the explainer, the latest review; no reviews', async ({ page }) => {
  await open(page, ID.chita);
  const section = page.locator('#recenzii');
  await expect(section).toContainText('4,33');
  await expect(section).toContainText('1 recenzie');
  for (const label of ['Pescuit', 'Facilități', 'Atmosferă']) await expect(section.getByText(label, { exact: true }).first()).toBeVisible();
  await section.getByRole('button', { name: 'Vezi cum funcționează recenziile' }).click();
  const info = page.getByRole('dialog', { name: 'Cum funcționează recenziile' });
  await expect(info.getByRole('heading', { level: 3 })).toHaveText(['Pescuit', 'Facilități', 'Atmosferă']);
  await expect(info).toContainText('Șansele reale de a prinde pește');
  await page.keyboard.press('Escape');
  await expect(section.getByTestId('lake-review')).toHaveCount(1);
  // The reviews page: the section's header action.
  await expect(section.getByRole('link', { name: 'Vezi recenzia' })).toHaveAttribute('href', `/balti/${ID.chita}/recenzii`);
  await expect(section.getByText(/în curând/)).toHaveCount(0);
  // The verdict is a state: the round StatusPill.
  await expect(section.getByTestId('lake-review').getByText('Recomandă')).toHaveClass(/rounded-full/);
  // The author's profile is not on the web yet: not a link.
  await expect(section.getByTestId('lake-review').getByRole('link')).toHaveCount(0);
  // An empty star is visible (text-faint, not the hairline): Atmosferă reads 3 of 5.
  await expect(section.getByTestId('lake-review').locator('svg.text-hairline')).toHaveCount(0);
  // s5: no reviews.
  await open(page, ID.belin);
  await expect(page.locator('#recenzii')).toContainText('Această baltă nu are încă recenzii.');
  await expect(page.locator('#recenzii').getByRole('link', { name: 'Scrie prima recenzie' })).toHaveAttribute('href', `/balti/${ID.belin}/recenzii`);
  await expect(page.locator('#recenzii [aria-hidden="true"].grid')).toHaveCount(0);
  await expect(visible(page.getByRole('link', { name: 'Recenzii: fără recenzii' }))).toContainText('Fără recenzii');
});

test('lakes.detail.c25 lakes.detail.c27 — the latest reviews fail on their own; «Încearcă din nou» reads again and focuses the section', async ({ page }) => {
  await faults(page, ID.chita, ['reviews']);
  await open(page, ID.chita);
  const section = page.locator('#recenzii');
  await expect(section).toContainText('Recenziile nu au putut fi încărcate.');
  await expect(section).toContainText('4,33');
  await faults(page, ID.chita, []);
  await section.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(section.getByTestId('lake-review')).toHaveCount(1);
  await expect(page.locator('#recenzii-titlu')).toBeFocused();
});

test('lakes.detail.c28 — mini map (a link to the map page), address, phones (tel:), readable website', async ({ page }) => {
  await open(page, ID.belin);
  const l = lakes.get(ID.belin)!;
  const section = page.locator('#contact');
  await expect(section.getByRole('heading', { name: 'Locație & contact' })).toBeVisible();
  await expect(section.getByTestId('lake-mini-map')).toBeVisible();
  await expect(section.getByRole('link', { name: `Deschide harta: ${l.name}` })).toHaveAttribute('href', `/balti/${ID.belin}/harta`);
  if (l.address) await expect(section.getByText('Adresă')).toBeVisible();
  const phone = l.contact.find(c => c.phone)!;
  await expect(section.getByText(phone.header || 'Telefon', { exact: true })).toBeVisible();
  await expect(section.locator(`a[href^="tel:"]`).first()).toHaveText(phone.name ? `${phone.name} · ${phone.phone}` : phone.phone!);
  if (l.website) {
    const site = section.locator(`a[href="${l.website}"]`);
    await expect(site).toBeVisible();
    // Decoded, without the protocol / www / trailing slash; the full address on hover.
    const text = (await site.innerText()).replace(' (se deschide într-o filă nouă)', '');
    expect(text).not.toMatch(/^https?:|%[0-9A-F]{2}|\/$/i);
    await expect(site).toHaveAttribute('title', decodeURI(l.website));
  }
});

test('lakes.detail.c29 lakes.detail.s7 lakes.detail.s8 — the operator card: never a link to a page the web does not have (guest and signed in)', async ({ page, context }) => {
  const l = lakes.get(ID.chita)!;
  expect(l.ownerDocumentId, 'Chita has an operator with a profile id').toBeTruthy();
  for (const signed of [false, true]) {
    if (signed) await signIn(context, jwt, base());
    await open(page, ID.chita);
    await expect(page.getByTestId('lake-owner-static')).toContainText('Administrează această baltă în Bluvi');
    await expect(page.getByRole('link', { name: `${l.ownerName!.trim()} — vezi profilul` })).toHaveCount(0);
    await expect(page.locator('a[href^="/pescari/"]')).toHaveCount(0);
  }
});

test('lakes.detail.c29 lakes.detail.s8 — an operator without a profile id: the static card, not a link', async ({ page }) => {
  await faults(page, ID.chita, ['owner-without-profile']);
  await open(page, ID.chita);
  const l = lakes.get(ID.chita)!;
  await expect(page.getByTestId('lake-owner-static')).toContainText(l.ownerName!.trim());
  await expect(page.getByRole('link', { name: `${l.ownerName!.trim()} — vezi profilul` })).toHaveCount(0);
});

test('lakes.detail.c30 lakes.detail.s8 lakes.claim.c7 — no operator: the take-over link (a guest signs in first)', async ({ page }) => {
  await open(page, ID.belin);
  const section = page.locator('#contact');
  await expect(section).toContainText('Această baltă nu are încă un administrator în Bluvi.');
  await expect(section.getByRole('link', { name: 'Ești administratorul acestei bălți?' })).toHaveAttribute('href', '/intra');
});

test('lakes.claim.c1 lakes.claim.c2 lakes.claim.c3 lakes.claim.c4 lakes.claim.c5 lakes.claim.c6 — the claim form: copy, prefill, validation, errors, success', async ({ page, context }) => {
  await signIn(context, jwt, base());
  const l = lakes.get(ID.belin)!;
  const replies = [
    { status: 400, json: { error: { status: 400, message: 'x', details: { bluCode: 'CLAIM_EXISTS' } } } },
    { status: 400, json: { error: { status: 400, message: 'x', details: { bluCode: 'LAKE_HAS_OWNER' } } } },
    { status: 500, json: { error: { status: 500, message: 'x' } } },
    { status: 200, json: { data: { documentId: 'c1', claimStatus: 'pending' } } },
  ];
  let body: unknown = null;
  await page.route('**/api/cms/feed/lake-claims', route => {
    body = route.request().postDataJSON();
    return route.fulfill(replies.shift()!);
  });
  await open(page, ID.belin, TABLET);
  await page.locator('#contact').getByRole('button', { name: 'Ești administratorul acestei bălți?' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ești administratorul acestei bălți?' });
  await expect(dialog).toContainText(`Spune-ne cine ești și te contactăm ca să preiei administrarea pentru ${l.name} în Bluvi.`);
  await settleDialog(page);
  await expectNoA11yViolations(page, { include: 'dialog[open]' });
  const name = dialog.getByLabel('Nume și prenume');
  // c2: the name is prefilled from the profile.
  await expect(name).not.toHaveValue('');
  await name.fill('ab');
  await dialog.getByLabel('Număr de telefon').fill('0712');
  await dialog.getByRole('button', { name: 'Trimite cererea' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Numele și un număr de telefon valid sunt obligatorii.');
  await name.fill('Sim QA');
  await dialog.getByLabel('Număr de telefon').fill('0712345678');
  await dialog.getByLabel('Mesaj (opțional)').fill('Salut');
  await dialog.getByRole('button', { name: 'Trimite cererea' }).click();
  await expect(page.getByText('Ai deja o cerere în așteptare pentru această baltă.')).toBeVisible();
  expect(body).toEqual({ data: { lake: ID.belin, name: 'Sim QA', phone: '0712345678', message: 'Salut' } });
  await dialog.getByRole('button', { name: 'Trimite cererea' }).click();
  await expect(page.getByText('Balta are deja un administrator în Bluvi.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Trimite cererea' }).click();
  await expect(page.getByText('Cererea nu a putut fi trimisă. Încearcă din nou.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Trimite cererea' }).click();
  await expect(page.getByText('Cerere trimisă — te contactăm noi.')).toBeVisible();
  await expect(dialog).toBeHidden();
  // c6: «Înapoi» closes without sending.
  await page.locator('#contact').getByRole('button', { name: 'Ești administratorul acestei bălți?' }).click();
  await dialog.getByRole('button', { name: 'Înapoi' }).click();
  await expect(dialog).toBeHidden();
});

/* ------------------------------------------------------------------ */
/* Share (lakes.share)                                                  */
/* ------------------------------------------------------------------ */

test('lakes.share.c1 lakes.share.c2 lakes.share.c3 lakes.share.c4 lakes.share.c5 lakes.share.c6 lakes.detail.c5 lakes.detail.c33 — preview, edited message, copy, share', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const events = await recordAnalytics(page);
  await open(page, ID.chita, DESKTOP);
  const l = lakes.get(ID.chita)!;
  await page.getByRole('button', { name: /Distribuie/ }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Distribuie balta' });
  await expect.poll(events).toContainEqual({ name: 'share_lake_button_pressed', params: { lake_id: ID.chita, lake_name: l.name } });
  // c1: Prieten's question and the outgoing bubble (message, «🎣 name», the link).
  await expect(dialog).toContainText('Prieten');
  await expect(dialog).toContainText('Salut! Ce faci sâmbătă? 🎣');
  const preview = dialog.getByTestId('share-preview');
  await expect(preview).toContainText('Mergem la pescuit aici?');
  await expect(preview).toContainText(`🎣 ${l.name}`);
  await expect(preview).toContainText(`/balti/${ID.chita}`);
  await settleDialog(page);
  await expectNoA11yViolations(page, { include: 'dialog[open]' });
  // c2: the preview follows the field as it is typed (fish handleChangeMessage), without a blur.
  const input = dialog.getByLabel('Mesajul tău');
  await expect(input).toHaveValue('Mergem la pescuit aici?');
  await input.fill('Hai sâmbătă?');
  await expect(input).toBeFocused();
  await expect(preview).toContainText('Hai sâmbătă?');
  await expect(preview).not.toContainText('Mergem la pescuit aici?');
  // c3 c4: the copied text and the toast.
  await dialog.getByRole('button', { name: 'Copiază' }).click();
  await expect(page.getByText('Mesaj copiat în clipboard')).toBeVisible();
  const origin = new URL(page.url()).origin;
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`Hai sâmbătă?\n\n🎣 ${l.name}\n${origin}/balti/${ID.chita}`);
  await expect.poll(events).toContainEqual({ name: 'copy_lake_share_text', params: { lake_id: ID.chita, lake_name: l.name } });
  // c5: the system share with the same text, then the dialog closes.
  await page.evaluate(() => {
    (navigator as unknown as { share: (d: unknown) => Promise<void> }).share = async d => {
      (window as unknown as { __shared: unknown }).__shared = d;
    };
  });
  await dialog.getByRole('button', { name: 'Distribuie' }).click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as { __shared: unknown }).__shared)).toEqual({
    title: l.name,
    text: `Hai sâmbătă?\n\n🎣 ${l.name}\n${origin}/balti/${ID.chita}`,
  });
  await expect.poll(events).toContainEqual({ name: 'share_lake', params: { lake_id: ID.chita, lake_name: l.name } });
});

test('lakes.share.s3 lakes.share.c5 lakes.share.c6 — phone sheet: no Web Share API copies instead and closes; a dismissed system share logs nothing', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const events = await recordAnalytics(page);
  await page.addInitScript(() => {
    // A browser without the Web Share API (most desktop browsers).
    Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true });
  });
  await open(page, ID.chita, PHONE);
  const l = lakes.get(ID.chita)!;
  await visible(page.getByRole('button', { name: 'Distribuie balta' })).click();
  const dialog = page.getByRole('dialog', { name: 'Distribuie balta' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Distribuie', exact: true }).click();
  await expect(page.getByText('Mesaj copiat în clipboard')).toBeVisible();
  await expect(dialog).toBeHidden();
  const origin = new URL(page.url()).origin;
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`Mergem la pescuit aici?\n\n🎣 ${l.name}\n${origin}/balti/${ID.chita}`);
  await expect.poll(events).toContainEqual({ name: 'copy_lake_share_text', params: { lake_id: ID.chita, lake_name: l.name } });
  // A system share the user dismisses: the dialog closes, share_lake is not logged.
  await page.evaluate(() => {
    (navigator as unknown as { share: () => Promise<void> }).share = () => Promise.reject(new DOMException('cancel', 'AbortError'));
  });
  await visible(page.getByRole('button', { name: 'Distribuie balta' })).click();
  await dialog.getByRole('button', { name: 'Distribuie', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect((await events()).filter(e => e.name === 'share_lake')).toEqual([]);
});

/* ------------------------------------------------------------------ */
/* States                                                               */
/* ------------------------------------------------------------------ */

test('lakes.detail.c1 lakes.detail.s1 — while the lake is read: the lake skeleton with a working back', async ({ page }) => {
  await faults(page, ID.belin, ['lake-slow']);
  await page.setViewportSize(PHONE);
  await page.goto('/balti');
  await settle(page);
  // An in-app navigation (the common way in): loading.tsx is shown, hydrated, while the lake is read.
  await page.evaluate(id => (window as unknown as { next: { router: { push: (h: string) => void } } }).next.router.push(`/balti/${id}`), ID.belin);
  await expect(page.getByRole('status').filter({ hasText: 'Se încarcă balta' })).toBeAttached();
  const back = visible(page.getByRole('button', { name: 'Înapoi' }));
  await expect(back).toBeVisible();
  await back.click();
  await expect(page).toHaveURL(/\/balti$/);
});

test('lakes.detail.c2 lakes.detail.s2 — the lake read fails: the error card; «Încearcă din nou» is busy, says when it fails again, then recovers with focus on the title', async ({ page }) => {
  await faults(page, ID.belin, ['lake']);
  await page.setViewportSize(PHONE);
  await page.goto(`/balti/${ID.belin}`);
  await expect(page.getByRole('heading', { name: 'Balta nu a putut fi încărcată' })).toBeVisible();
  await settle(page);
  await page.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(page.getByText('Tot nu s-a putut încărca.').first()).toBeAttached();
  await faults(page, ID.belin, []);
  await page.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(page.getByRole('heading', { level: 1, name: lakes.get(ID.belin)!.name })).toBeVisible();
  await expect(page.locator('#balta-titlu')).toBeFocused();
});

test('lakes.detail.c2 lakes.detail.s3 — an unknown id is the not-found page with the way to the lakes list', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/balti/nu-exista-balta-e2e');
  await expect(page.getByRole('heading', { name: 'Balta nu a fost găsită' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Vezi bălțile' })).toHaveAttribute('href', '/balti');
  await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('lakes.detail.s12 lakes.detail.c10 lakes.detail.c28 — optional sections empty: no Facilități, Pești, Prețuri, Contact — sections and chips gone', async ({ page }) => {
  await faults(page, ID.belin, ['no-optional']);
  await open(page, ID.belin);
  for (const id of ['facilitati', 'pesti', 'preturi', 'contact']) await expect(page.locator(`#${id}`)).toHaveCount(0);
  await settle(page);
  const belin = competitionCounts.get(ID.belin)!;
  await expect(chips(page).getByRole('link')).toHaveText([
    'Prezentare',
    ...(partideShown.get(ID.belin) ? ['Partide'] : []),
    ...(belin.live + belin.upcoming > 0 ? ['Concursuri'] : []),
    'Recenzii',
  ]);
  await expect(tiles(page).getByRole('listitem')).toHaveText(['Rezervă', 'Partide', 'Statistici', 'Concursuri', 'Recenzii']);
  await expect(page.getByRole('button', { name: 'Direcții' })).toHaveCount(0);
});

test('lakes.detail.c32 — a slow section read: the shaped placeholder first, then the cards, without shifting the page', async ({ page }) => {
  test.skip(!upcoming.length, 'no upcoming competition on the local Chita');
  await faults(page, ID.chita, ['competitions-live-slow', 'competitions-upcoming-slow']);
  await page.addInitScript(() => {
    (window as unknown as { __shifts: number[] }).__shifts = [];
    new PerformanceObserver(list => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
        if (!e.hadRecentInput) (window as unknown as { __shifts: number[] }).__shifts.push(e.value);
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.setViewportSize(TABLET);
  // `commit`: DOMContentLoaded only fires once the streamed document has ended (bones replaced).
  await page.goto(`/balti/${ID.chita}`, { waitUntil: 'commit' });
  const section = page.locator('#concursuri');
  // The hero never waited: the title is there while Concursuri is still the placeholder.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(section.getByRole('status')).toHaveText('Se încarcă…');
  await expect(section.getByRole('heading', { name: 'Viitoare' })).toBeVisible({ timeout: 10_000 });
  await settle(page);
  const cls = await page.evaluate(() => (window as unknown as { __shifts: number[] }).__shifts.reduce((a, b) => a + b, 0));
  expect(cls).toBeLessThan(0.02);
});

test('lakes.detail.c32 lakes.detail.c24 — a section read that hangs past its timeout fails on its own with a retry', async ({ page }) => {
  await faults(page, ID.chita, ['competitions-live-hang']);
  await open(page, ID.chita, DESKTOP);
  await expect(page.locator('#concursuri').getByTestId('competitions-error-live')).toContainText('A apărut o eroare la încărcarea datelor.', { timeout: 15_000 });
});

test('lakes.detail.c13 — the description preview and «Vezi mai mult» are in the server HTML (no shift after hydration)', async ({ page }) => {
  const html = await (await page.request.get(`/balti/${ID.chita}`)).text();
  expect(html).toContain('Vezi mai mult');
  expect(html).toContain('mask-image');
});

test('lakes.detail.c11 lakes.detail.c12 — keyboard: a focused control never lands under the pinned rows (WCAG 2.4.11)', async ({ page }) => {
  for (const vp of [PHONE, DESKTOP]) {
    await open(page, ID.chita, vp);
    await page.mouse.wheel(0, 20000);
    await page.waitForTimeout(800);
    const target = page.locator('#recenzii').getByRole('button', { name: 'Vezi cum funcționează recenziile' });
    await target.focus();
    // The page may scroll smoothly: measure once it has settled.
    await page.waitForTimeout(800);
    const top = Math.round((await target.boundingBox())!.y);
    // Phone: bar 56 + pinned title 46 + chips 58; desktop: the 64px bar + the chips (58).
    expect(top).toBeGreaterThanOrEqual(vp === PHONE ? 160 : 122);
  }
});

test('lakes.detail.c2 SEO — metadata, canonical and JSON-LD (TouristAttraction + BreadcrumbList)', async ({ page }) => {
  await open(page, ID.chita, DESKTOP);
  const l = lakes.get(ID.chita)!;
  await expect(page).toHaveTitle(new RegExp(l.name));
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/balti/${ID.chita}$`));
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{20,}/);
  const scripts = await page.locator('script[type="application/ld+json"]').evaluateAll(els => els.map(e => e.textContent ?? ''));
  const ld = JSON.parse(scripts.find(t => t.includes('TouristAttraction'))!);
  expect(ld[0]).toMatchObject({ '@type': 'TouristAttraction', name: l.name });
  expect(ld[1]).toMatchObject({ '@type': 'BreadcrumbList' });
});

test('lakes.detail.c11 — keyboard: Tab moves along the chips; Enter on a chip focuses its section', async ({ page }) => {
  await open(page, ID.chita, TABLET);
  const nav = chips(page);
  await nav.getByRole('link', { name: 'Prezentare' }).focus();
  await page.keyboard.press('Tab');
  await expect(nav.getByRole('link').nth(1)).toBeFocused();
  await nav.getByRole('link', { name: 'Recenzii' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#recenzii')).toBeFocused();
});
