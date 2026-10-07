import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { collectConsoleErrors } from './helpers/console';
import { qaJwt, signIn } from './helpers/session';
import { ALL_VARIANTS, booking, mockMine, mockToReview, page as body, REVIEW_MANY, REVIEW_ONE, VARIANTS } from './rezervari.fixtures';

/*
 * booking.rezervarile-mele (/rezervari, T1) + booking.b.legacy-cms-paging, booking.b.nou-badge.
 * fish: app/(app)/bookings/index.tsx, features/bookings/*.
 *
 * Data: the local QA user against the LOCAL CMS. One unmocked read of the real list; every bucket,
 * sub, row variant, empty and error state is a route mock of the browser's proxy calls
 * (/api/cms/feed/bookings/mine*, /feed/bookings/to-review). No writes: the cancel dialog is exercised
 * from the booking page (booking.rezervare, M3-B2).
 */

const PATH = '/rezervari';
const WIDTHS = [375, 1280, 1440, 1920] as const;
/** Mocked 5xx on purpose: the browser logs the failed resource. */
const EXPECTED_CONSOLE = [/Failed to load resource: the server responded with a status of 50\d/];

let jwt: string;
test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

async function open(page: Page, path = PATH, width = 375) {
  await page.setViewportSize({ width, height: 900 });
  await signIn(page.context(), jwt);
  await page.goto(path);
}

const h1 = (p: Page) => p.getByRole('heading', { level: 1, name: 'Rezervările mele' });
const tablist = (p: Page) => p.getByRole('tablist', { name: 'Rezervări' });
const tab = (p: Page, name: string | RegExp) => tablist(p).getByRole('tab', { name });
const chips = (p: Page) => p.getByRole('group', { name: /^Filtru / });
const chip = (p: Page, name: string) => chips(p).getByRole('button', { name, exact: true });
const cards = (p: Page) => p.locator('[data-booking]');
const card = (p: Page, id: string) => p.locator(`[data-booking="${id}"]`);
// The tab's own skeleton (the route's Suspense fallback can still be in the DOM while it streams out).
const skeleton = (p: Page) => p.getByRole('tabpanel').getByTestId('bookings-skeleton');

test.describe('booking.rezervarile-mele', () => {
  test('b.sign-in-gate: signed out → 307 /intra?next=%2Frezervari (query kept)', async ({ request, page }) => {
    const res = await request.get(PATH, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toMatch(/\/intra\?next=%2Frezervari$/);
    const q = await request.get(`${PATH}?tab=confirmate&filtru=azi`, { maxRedirects: 0 });
    expect(q.status()).toBe(307);
    expect(q.headers().location).toContain('/intra?next=%2Frezervari%3Ftab%3Dconfirmate%26filtru%3Dazi');
    await page.goto(PATH);
    await expect(page).toHaveURL(/\/intra\?next=%2Frezervari$/);
  });

  test('real list (unmocked): GET /feed/bookings/mine?bucket=all&page=1&pageSize=20, rows, noindex; axe at 4 widths', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const mine = page.waitForRequest((r) => /\/api\/cms\/feed\/bookings\/mine\?/.test(r.url()));
    const toReview = page.waitForRequest((r) => r.url().includes('/api/cms/feed/bookings/to-review'));
    await open(page);
    const url = new URL((await mine).url());
    expect(url.searchParams.get('bucket')).toBe('all');
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('pageSize')).toBe('20');
    expect(url.searchParams.has('sub')).toBe(false);
    await toReview;
    const real = await page.request.get('/api/cms/feed/bookings/mine?bucket=all&page=1&pageSize=20');
    const n = ((await real.json()) as { data: unknown[] }).data.length;
    await expect(h1(page)).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    if (n > 0) await expect(cards(page)).toHaveCount(n);
    else await expect(page.getByTestId('bookings-empty-hero')).toBeVisible();
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await expect(h1(page)).toBeVisible();
      await expectNoA11yViolations(page);
    }
    expect(errors).toEqual([]);
  });

  test('c1 the title scrolls away, the tabs stay pinned under the bar (never floating), at 375 and 1440', async ({ page }) => {
    await mockMine(page, () => ({ body: body([...ALL_VARIANTS]) }));
    await mockToReview(page, []);
    for (const width of [375, 1440]) {
      await open(page, PATH, width);
      await expect(cards(page)).toHaveCount(ALL_VARIANTS.length);
      await page.evaluate(() => window.scrollTo(0, 900));
      await page.waitForTimeout(700);
      const g = await page.evaluate(() => {
        const bar = document.querySelector('header')!.getBoundingClientRect();
        const chrome = document.querySelector('[data-list-chrome]')!.getBoundingClientRect();
        const title = document.querySelector('h1')!.getBoundingClientRect();
        return { bar: Math.max(0, Math.round(bar.bottom)), chrome: Math.round(chrome.top), title: Math.round(title.bottom) };
      });
      expect(Math.abs(g.chrome - g.bar)).toBeLessThanOrEqual(1);
      expect(g.title).toBeLessThan(g.chrome);
      await expect(tablist(page)).toBeInViewport();
    }
  });

  test('c2 c3 tabs: order, icons, «Toate» lands; pending count from the FIRST page only', async ({ page }) => {
    const calls = await mockMine(page, (q) =>
      q.page === 1
        ? { body: body(Array.from({ length: 20 }, (_, i) => booking(`p1-${i}`)), { pendingCount: 3 }) }
        : { body: body([booking('p2-0')], { pendingCount: 9, page: 2 }) }
    );
    await mockToReview(page, []);
    await open(page);
    await expect(cards(page)).toHaveCount(20);
    const names = await tablist(page).getByRole('tab').evaluateAll((els) => els.map((e) => e.textContent?.replace(/\d+/g, '').trim()));
    expect(names).toEqual(['Toate', 'În așteptare', 'Confirmate', 'Nefinalizate']);
    for (const t of await tablist(page).getByRole('tab').all()) await expect(t.locator('svg')).toHaveCount(1);
    await expect(tab(page, 'Toate')).toHaveAttribute('aria-selected', 'true');
    await expect(tab(page, 'În așteptare, 3')).toBeVisible();
    // Only «În așteptare» carries a count.
    await expect(tablist(page).locator('[aria-hidden="true"]', { hasText: /^\d+$/ })).toHaveCount(1);
    // Page 2 (pendingCount 9) does not move the badge.
    await page.getByRole('button', { name: 'Încarcă mai multe' }).scrollIntoViewIfNeeded();
    await expect(cards(page)).toHaveCount(21);
    expect(calls.some((c) => c.page === 2)).toBe(true);
    await expect(tab(page, 'În așteptare, 3')).toBeVisible();
  });

  test('c3 no count when pendingCount is 0', async ({ page }) => {
    await mockMine(page, () => ({ body: body([VARIANTS.tomorrow], { pendingCount: 0 }) }));
    await mockToReview(page, []);
    await open(page);
    await expect(cards(page)).toHaveCount(1);
    await expect(tab(page, 'În așteptare')).toHaveText('În așteptare');
  });

  test('c4 c5 subs per bucket, defaults, remembered per tab, URL, scroll to top; keyboard through tabs and chips', async ({ page }) => {
    const calls = await mockMine(page, (q) => ({ body: body([booking(`${q.bucket}-${q.sub ?? 'none'}`)]) }));
    await mockToReview(page, []);
    await open(page);
    await expect(cards(page)).toHaveCount(1);
    // «Toate» and «În așteptare»: no sub row.
    await expect(chips(page)).toHaveCount(0);
    // Keyboard: focus the selected tab, → to «În așteptare».
    await tab(page, 'Toate').focus();
    await page.keyboard.press('ArrowRight');
    await expect(tab(page, /^În așteptare/)).toHaveAttribute('aria-selected', 'true');
    await expect(tab(page, /^În așteptare/)).toBeFocused();
    await expect(page).toHaveURL(/\?tab=in-asteptare$/);
    await expect(chips(page)).toHaveCount(0);
    expect(calls.at(-1)).toMatchObject({ bucket: 'pending', sub: null });
    // «Confirmate»: Azi / Viitoare / Trecute, no unfiltered view, «Viitoare» by default.
    await page.keyboard.press('ArrowRight');
    await expect(tab(page, 'Confirmate')).toHaveAttribute('aria-selected', 'true');
    await expect(chips(page).getByRole('button')).toHaveText(['Azi', 'Viitoare', 'Trecute']);
    await expect(chip(page, 'Viitoare')).toHaveAttribute('aria-pressed', 'true');
    await expect(card(page, 'confirmed-upcoming')).toBeVisible();
    await expect(page).toHaveURL(/\?tab=confirmate$/);
    // Tab into the chips, pick «Trecute» with the keyboard.
    await page.keyboard.press('Tab');
    await expect(chip(page, 'Azi')).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(chip(page, 'Trecute')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(chip(page, 'Trecute')).toHaveAttribute('aria-pressed', 'true');
    await expect(card(page, 'confirmed-past')).toBeVisible();
    await expect(page).toHaveURL(/\?tab=confirmate&filtru=trecute$/);
    // «Nefinalizate»: Toate (unfiltered, default) / Respinse / Anulate / Neprezentări.
    await tab(page, 'Nefinalizate').click();
    await expect(chips(page).getByRole('button')).toHaveText(['Toate', 'Respinse', 'Anulate', 'Neprezentări']);
    await expect(chip(page, 'Toate')).toHaveAttribute('aria-pressed', 'true');
    await expect(card(page, 'unfinished-none')).toBeVisible();
    await expect(page).toHaveURL(/\?tab=nefinalizate$/);
    // A switch scrolls the list to the top (the title shows again).
    await page.evaluate(() => window.scrollTo(0, 400));
    await chip(page, 'Anulate').click();
    await expect(card(page, 'unfinished-cancelled')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(h1(page)).toBeInViewport();
    // Back on «Confirmate»: «Trecute» was remembered.
    await tab(page, 'Confirmate').click();
    await expect(chip(page, 'Trecute')).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/\?tab=confirmate&filtru=trecute$/);
    // A reload keeps the place (the URL is the state).
    await page.reload();
    await expect(tab(page, 'Confirmate')).toHaveAttribute('aria-selected', 'true');
    await expect(chip(page, 'Trecute')).toHaveAttribute('aria-pressed', 'true');
    // A foreign sub in the URL falls back to the default.
    await page.goto(`${PATH}?tab=confirmate&filtru=neprezentari`);
    await expect(chip(page, 'Viitoare')).toHaveAttribute('aria-pressed', 'true');
    await expectNoA11yViolations(page);
  });

  test('c6 paging: 20 a page, next page near the end with a spinner footer, a short page is the last; previous tab rows not kept', async ({ page }) => {
    const calls = await mockMine(page, (q) => {
      if (q.bucket === 'pending') return { body: body([VARIANTS.pending], { pendingCount: 1 }), delayMs: 1500 };
      if (q.page === 1) return { body: body(Array.from({ length: 20 }, (_, i) => booking(`a${i}`))) };
      return { body: body(Array.from({ length: 5 }, (_, i) => booking(`b${i}`)), { page: 2 }), delayMs: 800 };
    });
    await mockToReview(page, []);
    await open(page);
    await expect(cards(page)).toHaveCount(20);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByTestId('list-footer-spinner')).toBeVisible();
    await expect(cards(page)).toHaveCount(25);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    expect(calls.filter((c) => c.bucket === 'all').map((c) => c.page)).toEqual([1, 2]);
    expect(calls.every((c) => c.pageSize === 20)).toBe(true);
    // An uncached tab: the skeleton at once, none of the previous tab's rows.
    await tab(page, /^În așteptare/).click();
    await expect(skeleton(page)).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
    await expect(cards(page)).toHaveCount(1);
  });

  test('c7 first load → 3 card skeletons under the chrome; error → inline error + retry, no sign-out', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    let fail = true;
    await mockMine(page, () => (fail ? { status: 503, delayMs: 400 } : { body: body([VARIANTS.tomorrow]) }));
    await mockToReview(page, []);
    await open(page);
    await expect(skeleton(page)).toBeVisible();
    await expect(skeleton(page).locator('li')).toHaveCount(3);
    await expect(tablist(page)).toBeVisible();
    const alert = page.getByRole('alert').filter({ hasText: 'Nu am putut încărca rezervările.' });
    await expect(alert).toContainText('Nu am putut încărca rezervările.', { timeout: 20_000 });
    await expect(alert).toContainText('Verifică conexiunea și încearcă din nou.');
    await expect(page.getByRole('button', { name: /Deconectează/ })).toHaveCount(0);
    await expectNoA11yViolations(page);
    fail = false;
    await page.getByRole('button', { name: 'Încearcă din nou' }).click();
    await expect(cards(page)).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('c8 c9 empty account → hero + three rows; «Caută o baltă» → /balti?rezervari=1 (bookable filter)', async ({ page }) => {
    await mockMine(page, () => ({ body: body([]) }));
    await mockToReview(page, []);
    for (const width of WIDTHS) {
      await open(page, PATH, width);
      const hero = page.getByTestId('bookings-empty-hero');
      await expect(hero.getByRole('heading', { name: 'Rezervările tale, într-un loc' })).toBeVisible();
      await expect(hero).toContainText('Rezervi standul din pagina bălții și le găsești pe toate aici: dată, oră, stand și total.');
      // Rule 4: no promise of a code or of cancelling until the booking page ships (B2).
      await expect(page.locator('main')).not.toContainText(/anulezi|codul rezervării|cod și anulare/);
      // The three rows: beside the hero below 1280, in the docked right column from 1280.
      const rows = width < 1280 ? page.getByTestId('bookings-hero-features') : page.getByRole('complementary', { name: 'Pentru tine' }).getByTestId('bookings-hero-features-aside');
      await expect(rows).toBeVisible();
      await expect(page.getByTestId(width < 1280 ? 'bookings-hero-features-aside' : 'bookings-hero-features').locator('visible=true')).toHaveCount(0);
      await expect(page.getByTestId('find-lake-card').locator('visible=true')).toHaveCount(0);
      for (const [t, b] of [
        ['Alegi standul', 'Vezi ce e liber pe zile și ore, direct în pagina bălții.'],
        ['Primești confirmarea', 'Administratorul acceptă cererea, tu primești notificare.'],
        ['Le ții pe toate aici', 'Data, standul și totalul de plată, într-un singur loc.'],
      ]) {
        await expect(rows).toContainText(t);
        await expect(rows).toContainText(b);
      }
      await expect(hero.getByRole('link', { name: 'Caută o baltă' })).toHaveAttribute('href', '/balti?rezervari=1');
      await expectNoA11yViolations(page);
    }
    await page.getByTestId('bookings-empty-hero').getByRole('link', { name: 'Caută o baltă' }).click();
    await expect(page).toHaveURL(/\/balti\?rezervari=1$/);
  });

  test('c10 empty narrower tab → one line per bucket/sub; nothing while fetching', async ({ page }) => {
    await mockMine(page, (q) => ({ body: body([]), delayMs: q.bucket === 'pending' ? 1200 : 0 }));
    await mockToReview(page, []);
    const cases: [string, string][] = [
      ['?tab=in-asteptare', 'Nicio cerere în așteptare.'],
      ['?tab=confirmate&filtru=azi', 'Nicio rezervare astăzi.'],
      ['?tab=confirmate', 'Nicio rezervare viitoare.'],
      ['?tab=confirmate&filtru=trecute', 'Nicio rezervare încheiată.'],
      ['?tab=nefinalizate&filtru=respinse', 'Nicio rezervare respinsă.'],
      ['?tab=nefinalizate&filtru=anulate', 'Nicio rezervare anulată.'],
      ['?tab=nefinalizate&filtru=neprezentari', 'Nicio neprezentare.'],
      ['?tab=nefinalizate', 'Nimic nefinalizat.'],
    ];
    await open(page);
    await expect(page.getByTestId('bookings-empty-hero')).toBeVisible();
    for (const [q, text] of cases) {
      await page.goto(`${PATH}${q}`);
      await expect(page.getByTestId('bookings-empty')).toHaveText(text);
      await expect(page.getByTestId('bookings-empty-hero')).toHaveCount(0);
    }
    // A first fetch with nothing settled: no empty line until the answer.
    await page.goto(`${PATH}?tab=confirmate`);
    await expect(page.getByTestId('bookings-empty')).toHaveText('Nicio rezervare viitoare.');
    await tab(page, /^În așteptare/).click();
    await expect(page.getByTestId('bookings-skeleton')).toBeVisible();
    await expect(page.getByTestId('bookings-empty')).toHaveCount(0);
    await expect(page.getByTestId('bookings-empty')).toHaveText('Nicio cerere în așteptare.');
    // A background refetch (Reîmprospătează, window focus) keeps the settled empty line: no flash.
    const refetch = page.waitForResponse((r) => /\/api\/cms\/feed\/bookings\/mine\?.*bucket=pending/.test(r.url()));
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    for (let i = 0; i < 5; i++) {
      await expect(page.getByTestId('bookings-empty')).toHaveText('Nicio cerere în așteptare.');
      await page.waitForTimeout(150);
    }
    await refetch;
    await expect(page.getByTestId('bookings-empty')).toHaveText('Nicio cerere în așteptare.');
  });

  test('c11 review prompt: one lake / several (plural), «Scrie» → review form with the booking; above the list on the phone, right column from 1280', async ({ page }) => {
    await mockMine(page, () => ({ body: body([VARIANTS.tomorrow]) }));
    let lakes = REVIEW_ONE;
    await mockToReview(page, () => lakes);
    await open(page);
    const visible = page.getByTestId('review-prompt').locator('visible=true');
    await expect(visible.getByRole('heading', { name: 'Cum a fost la Chita Lake?' })).toBeVisible();
    await expect(visible).toContainText('Ai fost acolo, dar n-ai lăsat încă o recenzie.');
    await expect(visible.getByRole('link', { name: /^Scrie/ })).toHaveAttribute('href', '/balti/lake-chita/recenzie?rezervare=b-done');
    // Phone: above the list.
    const promptY = (await visible.boundingBox())!.y;
    const listY = (await cards(page).first().boundingBox())!.y;
    expect(promptY).toBeLessThan(listY);
    // From 1280: in the right column, beside the list.
    for (const width of [1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const box = (await page.getByRole('complementary', { name: 'Pentru tine' }).getByTestId('review-prompt').boundingBox())!;
      const c = (await cards(page).first().boundingBox())!;
      expect(box.x).toBeGreaterThan(c.x + c.width);
    }
    lakes = REVIEW_MANY(2);
    await page.setViewportSize({ width: 375, height: 900 });
    await page.reload();
    await expect(visible).toContainText('Ai fost acolo și n-ai lăsat recenzie. Încă 1 baltă așteaptă.');
    lakes = REVIEW_MANY(21);
    await page.reload();
    await expect(visible).toContainText('Încă 20 de bălți așteaptă.');
    lakes = REVIEW_MANY(4);
    await page.reload();
    await expect(visible).toContainText('Încă 3 bălți așteaptă.');
    await expectNoA11yViolations(page);
    lakes = [];
    await page.reload();
    await expect(cards(page)).toHaveCount(1);
    await expect(page.getByTestId('review-prompt')).toHaveCount(0);
  });

  test('c11 a failed review read hides the prompt (rule 4)', async ({ page }) => {
    const errors = collectConsoleErrors(page, { ignore: EXPECTED_CONSOLE });
    await mockMine(page, () => ({ body: body([VARIANTS.tomorrow]) }));
    await mockToReview(page, 503);
    await open(page);
    await expect(cards(page)).toHaveCount(1);
    await page.waitForTimeout(4000);
    await expect(page.getByTestId('review-prompt')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('c12 «Reîmprospătează» refetches the list and the review prompt', async ({ page }) => {
    const calls = await mockMine(page, () => ({ body: body([VARIANTS.tomorrow]) }));
    const review = await mockToReview(page, REVIEW_ONE);
    await open(page);
    await expect(cards(page)).toHaveCount(1);
    const [m, r] = [calls.length, review.n];
    await page.getByRole('button', { name: 'Reîmprospătează' }).click();
    await expect.poll(() => calls.length).toBe(m + 1);
    await expect.poll(() => review.n).toBe(r + 1);
  });

  test('c13–c19 row variants; c20 plain rows (no link, no actions) until the booking page ships', async ({ page }) => {
    await mockMine(page, () => ({ body: body([...ALL_VARIANTS], { pendingCount: 1 }) }));
    await mockToReview(page, []);
    await open(page);
    await expect(cards(page)).toHaveCount(ALL_VARIANTS.length);
    const pill = (id: string) => card(page, id).locator('[data-tone]');

    // c13 thumb (photo / placeholder), lake, stand, extras, period · hours, price with the unit spaced.
    const tomorrow = card(page, 'tomorrow');
    await expect(tomorrow.locator('[data-thumb="photo"]')).toHaveCount(1);
    await expect(card(page, 'today').locator('[data-thumb="placeholder"]')).toHaveCount(1);
    await expect(tomorrow).toContainText('Chita Lake');
    await expect(tomorrow).toContainText('Standul 5');
    await expect(tomorrow).toContainText('Barcă');
    await expect(tomorrow).toContainText('Noapte');
    await expect(tomorrow).toContainText(/\w\w \d+ \w+ 06:00 → \w\w \d+ \w+ 18:00 · 12h/);
    await expect(card(page, 'pending')).toContainText('1.250 lei');
    await expect(card(page, 'unknown')).toContainText('Lac');
    // End minus the checkout buffer (30 min).
    await expect(card(page, 'buffer')).toContainText(/→ \w\w \d+ \w+ 17:30 · 12h/);

    // c14 pills.
    await expect(pill('pending')).toHaveText('În așteptare');
    await expect(pill('pending')).toHaveAttribute('data-tone', 'warning');
    await expect(pill('tomorrow')).toHaveText('Confirmată');
    await expect(pill('tomorrow')).toHaveAttribute('data-tone', 'success');
    await expect(pill('completed')).toHaveText('Încheiată');
    await expect(pill('completed')).toHaveAttribute('data-tone', 'outline');
    await expect(pill('rejected')).toHaveText('Respinsă');
    await expect(pill('cancme')).toHaveText('Anulată de tine');
    await expect(pill('canclake')).toHaveText('Anulată de baltă');
    await expect(pill('cancauto')).toHaveText('Anulare automată');
    await expect(pill('noshow')).toHaveText('Nu a venit');
    await expect(pill('noshow')).toHaveAttribute('data-tone', 'danger');
    await expect(pill('unknown')).toHaveText('În așteptare');

    // c15 quiet cards.
    for (const id of ['rejected', 'cancme', 'canclake', 'cancauto', 'noshow', 'noshownote']) {
      await expect(card(page, id)).toHaveAttribute('data-quiet', '');
      await expect(card(page, id).locator('[data-thumb]')).toHaveClass(/opacity-55/);
    }
    for (const id of ['pending', 'tomorrow', 'completed', 'live']) await expect(card(page, id)).not.toHaveAttribute('data-quiet', '');

    // c16 live: no hours suffix, progress «3h din 12h».
    const live = card(page, 'live');
    await expect(live).toHaveAttribute('data-live', '');
    await expect(live.getByTestId('booking-progress')).toContainText('3h din 12h');
    await expect(live).not.toContainText('· 12h');
    await expect(live).not.toContainText('Începe');

    // c17 starts-in (owner plural rule: «25 de zile»); none on quiet / live / started.
    await expect(card(page, 'today')).toContainText('Începe astăzi');
    await expect(tomorrow).toContainText('Începe mâine');
    await expect(card(page, 'pending')).toContainText('Începe în 3 zile');
    await expect(card(page, 'indays')).toContainText('Începe în 25 de zile');
    await expect(card(page, 'canclake')).not.toContainText('Începe');
    await expect(card(page, 'completed')).not.toContainText('Începe');

    // c18 dead reasons, two lines at most; the default no-show note is not repeated.
    await expect(card(page, 'cancme').getByTestId('booking-dead-reason')).toHaveText('Nu mai pot ajunge, s-a schimbat programul.');
    await expect(card(page, 'rejected').getByTestId('booking-dead-reason')).toHaveText('Standul nu este disponibil pe acest interval.');
    await expect(card(page, 'canclake').getByTestId('booking-dead-reason')).toHaveClass(/line-clamp-2/);
    await expect(card(page, 'noshow').getByTestId('booking-dead-reason')).toHaveCount(0);
    await expect(card(page, 'noshownote').getByTestId('booking-dead-reason')).toHaveText('A sunat la 5 dimineața că nu mai vine.');

    // c19 the pending warning, on pending requests only.
    const warning = 'Locul nu e al tău până confirmă administratorul. Primești notificare.';
    await expect(card(page, 'pending')).toContainText(warning);
    await expect(card(page, 'unknown')).not.toContainText(warning);
    await expect(tomorrow).not.toContainText(warning);

    // c20 (B1 half): no link to the 404, no action buttons in the list.
    await expect(page.locator('a[href^="/rezervari/"]')).toHaveCount(0);
    await expect(cards(page).locator('button, a')).toHaveCount(0);

    // Never «capot».
    await expect(page.locator('body')).not.toContainText(/capot/i);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoA11yViolations(page);
    }
  });

  test('c2 at 375 the selected tab is scrolled into view (deep link, reload, switch); the overflowing row fades its hidden edge', async ({ page }) => {
    await mockMine(page, () => ({ body: body([]) }));
    await mockToReview(page, []);
    const inView = async (name: string | RegExp) => {
      const t = (await tab(page, name).boundingBox())!;
      const row = (await page.getByTestId('bookings-tabs-row').boundingBox())!;
      return t.x >= row.x - 1 && t.x + t.width <= row.x + row.width + 1;
    };
    await open(page, `${PATH}?tab=nefinalizate`, 375);
    await expect(tab(page, 'Nefinalizate')).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => inView('Nefinalizate')).toBe(true);
    // Scrolled to the end: the hidden tabs are on the left, the fade is on the left only.
    await expect(page.getByTestId('bookings-tabs-row')).toHaveAttribute('data-fade', 'left');
    // The row runs to the screen edges (the chip row's bleed).
    const row = (await page.getByTestId('bookings-tabs-row').boundingBox())!;
    expect(Math.round(row.x)).toBe(0);
    expect(Math.round(row.width)).toBe(375);
    await page.reload();
    await expect.poll(() => inView('Nefinalizate')).toBe(true);
    // A switch back to the first tab brings it into view; the fade moves to the right edge.
    await tab(page, 'Toate').click();
    await expect.poll(() => inView('Toate')).toBe(true);
    await expect(page.getByTestId('bookings-tabs-row')).toHaveAttribute('data-fade', 'right');
    // Wide enough for every tab: no fade.
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByTestId('bookings-tabs-row')).not.toHaveAttribute('data-fade', /./);
  });

  test('T1 aside (≥1280): no skeleton after the first answer, never empty on the hero, the main column never changes width', async ({ page }) => {
    await mockMine(page, (q) => ({ body: body(q.bucket === 'all' ? [] : [VARIANTS.tomorrow]), delayMs: q.bucket === 'all' ? 0 : 1200 }));
    await mockToReview(page, []);
    await open(page, PATH, 1440);
    await expect(page.getByTestId('bookings-empty-hero')).toBeVisible();
    const aside = page.getByRole('complementary', { name: 'Pentru tine' });
    await expect(aside.getByTestId('bookings-hero-features-aside')).toBeVisible();
    const panel = page.locator('#rezervari-lista');
    const w0 = (await panel.boundingBox())!.width;
    // An uncached tab: the list is a skeleton, the right column keeps its content (no AsideSkeleton).
    await tab(page, 'Confirmate').click();
    await expect(page.getByTestId('bookings-skeleton')).toBeVisible();
    await expect(aside).not.toHaveAttribute('aria-busy', 'true');
    await expect(aside.getByTestId('find-lake-card')).toBeVisible();
    expect((await panel.boundingBox())!.width).toBe(w0);
    await expect(cards(page)).toHaveCount(1);
    expect((await panel.boundingBox())!.width).toBe(w0);
    await tab(page, 'Toate').click();
    await expect(page.getByTestId('bookings-empty-hero')).toBeVisible();
    expect((await panel.boundingBox())!.width).toBe(w0);
  });

  test('desktop (rules 5, 14): a grid of cards — one column on the phone, 2 at 1280/1440, 3 at 1920', async ({ page }) => {
    await mockMine(page, () => ({ body: body([...ALL_VARIANTS]) }));
    await mockToReview(page, REVIEW_ONE);
    await open(page);
    await expect(cards(page)).toHaveCount(ALL_VARIANTS.length);
    const columns = () =>
      page.evaluate(() => new Set([...document.querySelectorAll('[data-booking]')].map((e) => Math.round(e.getBoundingClientRect().x))).size);
    expect(await columns()).toBe(1);
    for (const [width, n] of [[1280, 2], [1440, 2], [1920, 3]] as const) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(columns).toBe(n);
    }
  });

  test('b.legacy-cms-paging: a CMS without meta → pendingCount 0 and a short page ends the list', async ({ page }) => {
    // fish's fallback is pageSize = max(rows, 20): a legacy answer under 20 rows is one page. With 20
    // or more rows the same rule asks for page 2 (fish does too) — flagged in the parity note.
    const calls = await mockMine(page, () => ({ body: { data: Array.from({ length: 12 }, (_, i) => booking(`l${i}`, { bookingStatus: 'pending' })) } }));
    await mockToReview(page, []);
    await open(page);
    await expect(cards(page)).toHaveCount(12);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
    expect(calls.map((c) => c.page)).toEqual([1]);
    await expect(page.getByRole('button', { name: 'Încarcă mai multe' })).toHaveCount(0);
    await expect(tab(page, 'În așteptare')).toHaveText('În așteptare');
  });

  test('c21 b.nou-badge: the visit writes @bluvi/bookings/visited/v1', async ({ page }) => {
    await mockMine(page, () => ({ body: body([]) }));
    await mockToReview(page, []);
    await open(page);
    await expect(page.getByTestId('bookings-empty-hero')).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('@bluvi/bookings/visited/v1'))).toBe('1');
  });

  test('c21 storage blocked: the page still renders', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get: () => { throw new Error('blocked'); } });
    });
    await mockMine(page, () => ({ body: body([VARIANTS.tomorrow]) }));
    await mockToReview(page, []);
    await open(page);
    await expect(cards(page)).toHaveCount(1);
    expect(errors.filter((e) => !/blocked/.test(e))).toEqual([]);
  });
});
