import { expectNoA11yViolations } from './helpers/a11y';
import { CMS, qaJwt, signIn } from './helpers/session';
import { expect, test, type ConsoleMessage, type Locator, type Page } from '@playwright/test';

/*
 * Acasă (/) — parity inventory docs/parity/areas/home.yml, screen home.acasa (template T5). Each
 * test names the criterion ids it covers. QA user (local CMS on :1337): operator of the local lake
 * Chita, no active partidă, no live competition of their own.
 *
 * Below 1280 the single fish-order column renders, from 1280 the main column + «Ce mă așteaptă»;
 * below 768 the profile card is the header, from 768 the T5 header. Only one composition is
 * displayed, so every locator is narrowed to its visible match.
 *
 * Blocks that depend on local data (organiser banner, poll, raffle, a live competition) are asserted
 * when present and skipped with a note when the local CMS has nothing for them.
 */

const PHONE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1440, height: 900 };

let jwt = '';

test.beforeAll(async ({ request }) => {
  jwt = await qaJwt(request);
});

function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

const visible = (l: Locator) => l.locator('visible=true').first();
const h2 = (page: Page, name: string | RegExp) => visible(page.getByRole('heading', { level: 2, name }));
/** The visible <section> named by its heading. */
const section = (page: Page, name: string | RegExp) => visible(page.getByRole('region', { name }));

async function open(page: Page, viewport: { width: number; height: number }, signedIn: boolean) {
  await page.setViewportSize(viewport);
  if (signedIn) await signIn(page.context(), jwt);
  const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  // Actions need the page hydrated (and the streamed blocks in).
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
}

/* ---------- smoke: every width × session, landmarks, axe, console ---------- */

for (const signedIn of [false, true]) {
  for (const vp of [PHONE, TABLET, { width: 1280, height: 800 }, DESKTOP]) {
    test(`/ · ${vp.width}px · ${signedIn ? 'signed in' : 'signed out'} · home.acasa.c58 blocks + axe`, async ({ page }) => {
      const errors = collectConsoleErrors(page);
      await open(page, vp, signedIn);

      // One h1 per width: the greeting (fish profile card title). Signed out from 768 the T5
      // header welcomes instead (the top bar's «Intră» is the sign-in there; ProfileCard.tsx).
      const greeting = signedIn ? /^(Salut, .+!|Bine ai venit!)$/ : vp.width < 768 ? 'Conectează-te' : 'Bine ai venit pe Bluvi';
      await expect(visible(page.getByRole('heading', { level: 1, name: greeting }))).toBeVisible();

      for (const name of [/^Concursuri (live|viitoare)/, /^Bălți/, 'Noutăți', 'Sponsori', 'Instrumente', 'Ești la pescuit?', 'Nu găsești balta preferată?']) {
        await expect(h2(page, name)).toBeVisible();
      }
      if (vp.width >= 1280) await expect(page.getByRole('complementary', { name: 'Ce mă așteaptă' })).toBeVisible();

      if (signedIn) {
        await expect(h2(page, /^Balta mea/)).toBeVisible();
        await expect(visible(page.getByRole('button', { name: 'Contactează-ne' }))).toHaveCount(0);
      } else {
        await expect(visible(page.getByRole('button', { name: 'Contactează-ne' }))).toBeVisible();
        await expect(visible(page.getByRole('link', { name: /Setări de confidențialitate/ }))).toBeVisible();
        await expect(h2(page, /^Balta mea/)).toHaveCount(0);
        await expect(h2(page, 'Pescari pe care îi poți urmări')).toHaveCount(0);
      }

      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
      await expectNoA11yViolations(page);
      expect(errors, errors.join('\n')).toEqual([]);
    });
  }
}

test('home.acasa.c58 — phone order follows fish', async ({ page }) => {
  await open(page, PHONE, true);
  await expect(h2(page, 'Noutăți')).toBeVisible();
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('main h1, main h2')]
      .filter((h) => (h as HTMLElement).offsetParent !== null)
      .map((h) => h.textContent?.trim() ?? ''),
  );
  const want = [/^Salut|^Bine ai venit/, /^Panou organizator$/, /^Balta mea|^Bălțile mele/, /^Instrumente$/, /^Ești la pescuit\?$/, /^Concursuri/, /^Bălți/, /^Nu găsești/, /^Sponsori$/, /^Noutăți$/];
  let at = -1;
  for (const re of want) {
    const i = order.findIndex((t, j) => j > at && re.test(t));
    if (re.source.includes('organizator') && i === -1) continue; // not an organiser locally
    expect(i, `${re} after position ${at} in ${JSON.stringify(order)}`).toBeGreaterThan(at);
    at = i;
  }
});

/* ---------- profile card / header ---------- */

test('home.acasa.c1 c4 c5 — signed-in profile card: greeting, profile link, bell', async ({ page, request }) => {
  await open(page, PHONE, true);
  const title = visible(page.getByRole('heading', { level: 1 }));
  await expect(title).toHaveText(/^(Salut, .+!|Bine ai venit!)$/);
  await expect(title.getByRole('link')).toHaveAttribute('href', '/profil');
  // c5: the bell lives in the top bar at every width (ROADMAP §4), never repeated in the card.
  await expect(visible(page.getByRole('main').getByRole('link', { name: /^Notificări/ }))).toHaveCount(0);
  const bell = visible(page.getByRole('banner').getByRole('link', { name: /^Notificări/ }));
  await expect(bell).toHaveAttribute('href', '/notificari');
  // The dot is announced in the name exactly when the unread count is > 0.
  const res = await request.get(`${CMS}/notification-users/unread`, { headers: { Authorization: `Bearer ${jwt}` } });
  expect(res.ok()).toBeTruthy();
  const count = Number((await res.json()).count);
  await expect(bell).toHaveAttribute('aria-label', count > 0 ? 'Notificări, ai notificări noi' : 'Notificări');
});

test('home.acasa.c2 c4 — signed-out profile card opens sign-in', async ({ page }) => {
  await open(page, PHONE, false);
  const title = visible(page.getByRole('heading', { level: 1, name: 'Conectează-te' }));
  await expect(title.getByRole('link')).toHaveAttribute('href', '/intra');
  await expect(visible(page.getByRole('main').getByRole('link', { name: /^Notificări/ }))).toHaveCount(0);
  const slogans = [
    'Creează-ți cont pentru a te alătura comunității',
    'Intră în contul tău să te poți înscrie la competiții',
    'Creează-ți cont pentru a primi cele mai noi știri',
  ];
  await expect(visible(page.getByText(new RegExp(`^(${slogans.join('|')})$`)))).toBeVisible();
});

test('home.acasa.c3 — the slogan advances on every visit', async ({ page }) => {
  await open(page, DESKTOP, true);
  const caption = page.locator('main header p').first();
  await page.waitForTimeout(1500);
  const first = await caption.textContent();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await expect(caption).not.toHaveText(first ?? '');
});

test('home.acasa.c9 — the refresh action refetches and reports', async ({ page }) => {
  await open(page, DESKTOP, true);
  const refresh = visible(page.getByRole('button', { name: 'Reîmprospătează' }));
  await expect(refresh).toBeVisible();
  const reads = new Set<string>();
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.pathname.includes('/competition-cards') || u.pathname.includes('/feed/lakes') || u.pathname.includes('/announcements')) reads.add(u.pathname);
    if (u.pathname.includes('suggested')) reads.add('SUGGESTED');
  });
  await refresh.click();
  await expect(page.getByRole('status').filter({ hasText: /^Actualizat$/ })).toBeAttached({ timeout: 20_000 });
  expect([...reads].some((p) => p.includes('competition-cards')), [...reads].join(',')).toBeTruthy();
  expect([...reads].some((p) => p.includes('lakes')), [...reads].join(',')).toBeTruthy();
  expect(reads.has('SUGGESTED'), 'the suggested rail is never refetched by a refresh').toBeFalsy();
});

/* ---------- operator, tools, partidă hero ---------- */

test('home.acasa.c10 — organiser banner (when the QA user is an organiser)', async ({ page }) => {
  await open(page, PHONE, true);
  const banner = section(page, 'Panou organizator');
  if ((await banner.count()) === 0) test.skip(true, 'QA user is not an organiser in the local CMS');
  await expect(banner.getByRole('link', { name: 'Panou organizator' })).toHaveAttribute('href', '/organizator');
  for (const label of ['Viitoare', 'În așteptare', 'Locuri libere']) await expect(banner.getByText(label, { exact: true })).toBeVisible();
});

test('home.acasa.c11 c12 c13 c15 — operator card', async ({ page }) => {
  await open(page, PHONE, true);
  const card = section(page, /^(Balta mea · .+|Bălțile mele · \d+ bălți)$/);
  await expect(card).toBeVisible();
  const single = /^Balta mea/.test((await card.getByRole('heading', { level: 2 }).textContent()) ?? '');
  // fish «{booked} / {total} standuri»; the web says what the ratio counts («ocupate»).
  await expect(card.getByText(/^\d+ \/ \d+ standuri ocupate$/)).toBeVisible();
  // Either the pending summary or the quiet line with tomorrow's count.
  const pending = card.getByText(/^(1 cerere așteaptă răspuns|\d+ cereri așteaptă răspuns)$/);
  if (await pending.count()) {
    await expect(card.getByRole('link', { name: 'Vezi cererile în așteptare' })).toHaveAttribute('href', /\/rezervari\?status=pending$/);
  } else {
    await expect(card.getByText('Nicio rezervare de aprobat')).toBeVisible();
    const tomorrow = card.getByText(/^(0 rezervări mâine|1 rezervare mâine|\d+ rezervări mâine)$/);
    await expect(tomorrow).toBeVisible();
    // «Vezi ziua» (the panel) when someone comes tomorrow, else «Vezi grila» (the calendar; fish /walk-in).
    if ((await tomorrow.textContent())?.startsWith('0 ')) {
      await expect(card.getByRole('link', { name: 'Vezi grila', exact: true })).toHaveAttribute('href', single ? /^\/operator\/[^/]+\/calendar$/ : /^\/operator$/);
    } else {
      await expect(card.getByRole('link', { name: 'Vezi ziua', exact: true })).toHaveAttribute('href', single ? /^\/operator\/[^/]+$/ : /^\/operator$/);
    }
  }
  const shortcuts = card.getByRole('list', { name: 'Scurtături operator' });
  const base = single ? /^\/operator\/[^/]+/ : /^\/operator$/;
  await expect(shortcuts.getByRole('link', { name: /^Panou/ })).toHaveAttribute('href', base);
  await expect(shortcuts.getByRole('link', { name: /^Calendar/ })).toHaveAttribute('href', single ? /\/calendar$/ : /^\/operator$/);
  await expect(shortcuts.getByRole('link', { name: /^Rezervări/ })).toHaveAttribute('href', single ? /\/rezervari(\?status=pending)?$/ : /^\/operator$/);
});

test('home.acasa.c16 c17 c18 — Instrumente: Rezervări, «În curând» interest panel', async ({ page }) => {
  await open(page, PHONE, true);
  const tools = section(page, 'Instrumente');
  await expect(tools.getByRole('link', { name: /^Rezervări/ })).toHaveAttribute('href', '/rezervari');
  // After 2026-10-01 the «NOU» pill never shows.
  await expect(tools.getByText('NOU', { exact: true })).toHaveCount(0);
  await tools.getByRole('button', { name: 'Vremea, în curând' }).click();
  const dialog = page.getByRole('dialog', { name: 'Vremea' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Prognoza meteo/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('home.acasa.c18 — signed out, the interest panel asks to sign in', async ({ page }) => {
  await open(page, PHONE, false);
  await section(page, 'Instrumente').getByRole('button', { name: 'Fazele Lunii, în curând' }).click();
  const dialog = page.getByRole('dialog', { name: 'Fazele Lunii' });
  await expect(dialog.getByRole('link', { name: 'Intră în cont' })).toHaveAttribute('href', '/intra');
});

for (const signedIn of [false, true]) {
  test(`home.acasa.c19 — partidă hero (${signedIn ? 'signed in' : 'guest → sign-in'})`, async ({ page }) => {
    await open(page, PHONE, signedIn);
    const hero = section(page, 'Ești la pescuit?');
    await expect(hero.getByText('Capturi, lansete și cronometre — totul notat într-o singură partidă.')).toBeVisible();
    await expect(hero.getByRole('link', { name: 'Începe o partidă' })).toHaveAttribute('href', signedIn ? '/partide/incepe' : '/intra');
    await expect(hero.getByRole('link', { name: 'Intră cu cod' })).toHaveAttribute('href', signedIn ? '/partide/intra' : '/intra');
  });
}

/* ---------- competition rail ---------- */

for (const vp of [PHONE, DESKTOP]) {
  test(`home.acasa.c23 c25 c26 c29 — competition rail · ${vp.width}px`, async ({ page }) => {
    await open(page, vp, false);
    const rail = section(page, /^Concursuri (live|viitoare)/);
    if ((await rail.count()) === 0) test.skip(true, 'no live or upcoming competition locally');
    const title = (await rail.getByRole('heading', { level: 2 }).textContent()) ?? '';
    expect(title).toMatch(/^Concursuri (live|viitoare)( \(\d+\))?$/);
    const live = title.startsWith('Concursuri live');
    await expect(rail.getByRole('link', { name: /^Vezi toate: / })).toHaveAttribute('href', `/concursuri?status=${live ? 'started' : 'notStarted'}`);

    const cards = rail.getByRole('list', { name: live ? 'Concursuri live' : 'Concursuri viitoare' }).getByRole('listitem');
    await expect(cards.first()).toBeVisible();
    const first = cards.first();
    await expect(first.getByRole('link').first()).toHaveAttribute('href', /^\/concursuri\/[^/]+$/);
    await expect(first.getByText(/^(Individual|Echipe)$/)).toBeVisible();
    if (live) {
      await expect(first.getByText('LIVE', { exact: true })).toBeVisible();
      await expect(first.getByText(/(capturi|captură|Încă nu sunt capturi|Statistici indisponibile)/).first()).toBeVisible();
    }
    // c29: equal heights.
    const heights = await cards.evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 1).map((e) => Math.round(e.getBoundingClientRect().height)));
    expect(new Set(heights).size, JSON.stringify(heights)).toBe(1);
  });
}

/* ---------- poll ---------- */

for (const signedIn of [false, true]) test(`home.acasa.c30 c31 c32 c35 — poll (when one is current) · ${signedIn ? 'signed in' : 'guest'}`, async ({ page }) => {
  // Locally the Public role has no /polls/current grant: guests see no poll (skipped below).
  await open(page, PHONE, signedIn);
  const share = visible(page.getByRole('button', { name: 'Distribuie sondajul' }));
  if ((await share.count()) === 0) test.skip(true, 'no current poll (or no Public grant) in the local CMS');
  const poll = visible(page.locator('section').filter({ has: page.getByRole('button', { name: 'Distribuie sondajul' }) }));
  const votes = poll.getByText(/^\d+ (vot|voturi)$/);
  expect(await votes.count()).toBeGreaterThan(0);
  // Sorted by votes, descending.
  const counts = (await votes.allTextContents()).map((t) => Number(t.split(' ')[0]));
  expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  // c32: a guest's option goes to sign-in, back to the poll page (when voting is open).
  const optionLink = poll.getByRole('link', { name: /intră în cont ca să votezi/ });
  if (await optionLink.count()) await expect(optionLink.first()).toHaveAttribute('href', '/intra?next=%2Fsondaje');
  // c32: a closed poll's options do nothing (disabled); an open one arms the option with «Votează» /
  // «Schimbă votul» and a second press disarms it (no vote is cast here).
  const options = poll.getByRole('button', { pressed: false }).filter({ hasText: /%/ });
  if (signedIn && (await options.count())) {
    const first = options.first();
    if (await first.isDisabled()) {
      await first.click({ force: true });
      await expect(poll.getByRole('button', { name: /^(Votează|Schimbă votul)$/ })).toHaveCount(0);
      await expect(poll.getByText(/^Sugerează o opțiune$/)).toHaveCount(0);
    } else {
      await first.click();
      await expect(poll.getByRole('button', { name: /^(Votează|Schimbă votul)$/ })).toBeVisible();
      await poll.getByRole('button', { pressed: true }).first().click();
      await expect(poll.getByRole('button', { name: /^(Votează|Schimbă votul)$/ })).toHaveCount(0);
    }
  }
  // c35: the share text and the poll page link.
  await page.evaluate(() => {
    (window as unknown as { __shared: unknown }).__shared = null;
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (d: unknown) => ((window as unknown as { __shared: unknown }).__shared = d) });
  });
  await share.click();
  const shared = (await page.evaluate(() => (window as unknown as { __shared: unknown }).__shared)) as { text: string; url: string };
  // fish opens with 🗳️; the web drops it (Fundații: no emoji — inventory note on c35).
  expect(shared.text).toMatch(/^Votează în sondajul comunității Bluvi:\n\n.+/);
  expect(shared.url).toMatch(/\/sondaje$/);
});

/* ---------- raffle ---------- */

test('home.acasa.c36 c37 c38 — raffle card (when a session runs)', async ({ page }) => {
  await open(page, PHONE, false);
  const raffle = visible(page.locator('section').filter({ has: page.getByRole('list', { name: 'Premii' }) }));
  if ((await raffle.count()) === 0) test.skip(true, 'no active raffle session locally');
  await expect(raffle.getByText(/^\d+ participanți$/)).toBeVisible();
  await expect(raffle.getByRole('img', { name: 'Bluvi' })).toBeVisible();
  await expect(raffle.getByRole('img', { name: 'PescarMania' })).toBeVisible();
  // Each prize row renders its registrations twice (narrow / wide card layouts), one displayed.
  await expect(visible(raffle.getByText(/^\d+ înscriși$/))).toBeVisible();
  const cta = raffle.getByRole('link', { name: 'Intră ca să participi' });
  if (await cta.count()) await expect(cta).toHaveAttribute('href', '/intra');
});

/* ---------- suggested anglers (signed in) ---------- */

test('home.acasa.c40 c41 c42 — suggested anglers: follow round-trip, dismiss', async ({ page }) => {
  await open(page, PHONE, true);
  const rail = section(page, 'Pescari pe care îi poți urmări');
  if ((await rail.count()) === 0) test.skip(true, 'fewer than 3 suggestions locally');
  await expect(rail.getByRole('link', { name: /^Vezi toate: / })).toHaveAttribute('href', '/pescari/sugerati');
  const cards = rail.getByRole('article');
  const before = await cards.count();
  const card = cards.first();
  await expect(card.getByRole('link').first()).toHaveAttribute('href', /^\/pescari\/[^/]+$/);
  await expect(card.getByText(/^(fără urmăritori|1 urmăritor|[\d.]+ urmăritori)$/)).toBeVisible();

  // Follow → «Urmăresc» → unfollow (idempotent round-trip).
  const follow = card.getByRole('button', { name: /^Urmărește pe / });
  if (await follow.count()) {
    await follow.click();
    await expect(card.getByRole('button', { name: /^Nu mai urmări pe / })).toHaveAttribute('aria-pressed', 'true');
    await card.getByRole('button', { name: /^Nu mai urmări pe / }).click();
    await expect(card.getByRole('button', { name: /^Urmărește pe / })).toBeVisible();
  }

  // Dismiss: the card goes, for this page's life.
  const name = (await card.getByRole('heading').textContent()) ?? '';
  const href = (await card.getByRole('link').first().getAttribute('href')) ?? '';
  await card.getByRole('button', { name: `Ascunde sugestia: ${name}` }).click();
  if (before - 1 >= 3) {
    await expect(cards).toHaveCount(before - 1);
    // By documentId: two local anglers can share a name.
    await expect(rail.locator(`a[href="${href}"]`)).toHaveCount(0);
  } else {
    await expect(rail).toHaveCount(0);
  }
});

test('home.acasa.c41 — a followed suggestion reads «Urmăresc» (fish FollowButton)', async ({ page }) => {
  // Known failure: the kit FollowButton (components/cards/FollowButton.tsx) reads «Urmărești».
  test.fail(true, 'home.acasa.c41 is todo until the kit label is fixed');
  await open(page, PHONE, true);
  const rail = section(page, 'Pescari pe care îi poți urmări');
  if ((await rail.count()) === 0) test.skip(true, 'fewer than 3 suggestions locally');
  const card = rail.getByRole('article').first();
  const follow = card.getByRole('button', { name: /^Urmărește pe / });
  if ((await follow.count()) === 0) test.skip(true, 'first suggestion already followed');
  await follow.click();
  const following = card.getByRole('button', { name: /^Nu mai urmări pe / });
  try {
    await expect(following).toHaveText('Urmăresc', { timeout: 5_000 });
  } finally {
    await following.click();
    await expect(card.getByRole('button', { name: /^Urmărește pe / })).toBeVisible();
  }
});

/* ---------- lakes, lake request ---------- */

test('home.acasa.c43 c44 — lakes rail', async ({ page }) => {
  await open(page, PHONE, false);
  const lakes = section(page, /^Bălți/);
  await expect(lakes.getByRole('heading', { level: 2 })).toHaveText(/^Bălți( \(\d+\))?$/);
  await expect(lakes.getByRole('link', { name: /^Vezi toate: Bălți/ })).toHaveAttribute('href', '/balti');
  const items = lakes.getByRole('list', { name: 'Bălți' }).locator(':scope > li').filter({ has: page.getByRole('link') });
  expect(await items.count()).toBeGreaterThan(0);
  expect(await items.count()).toBeLessThanOrEqual(10 * 13);
  await expect(items.first().getByRole('link').first()).toHaveAttribute('href', /^\/balti\/[^/]+$/);
  // c44: the rating is a badge on the photo only when the lake has reviews — never «no reviews» copy.
  await expect(lakes.getByText('Fără recenzii')).toHaveCount(0);
  // At most four facility icons, then «+n».
  for (const list of await lakes.getByRole('list', { name: 'Facilități' }).all()) {
    expect(await list.locator('li[title]').count()).toBeLessThanOrEqual(4);
  }
});

test('home.acasa.c45 — lake request banner, signed out', async ({ page }) => {
  await open(page, PHONE, false);
  const banner = section(page, 'Nu găsești balta preferată?');
  await expect(banner.getByText('Pentru a putea sugera o baltă intră în contul tău.')).toBeVisible();
  await expect(banner.getByRole('link', { name: 'Intră ca să sugerezi' })).toHaveAttribute('href', '/intra');
});

test('home.acasa.c45 c46 c47 — lake suggestion form (validation, live search, reset)', async ({ page }) => {
  await open(page, PHONE, true);
  const banner = section(page, 'Nu găsești balta preferată?');
  await expect(banner.getByText('Îți vom trimite un mesaj după ce o adăugăm.')).toBeVisible();
  await banner.getByRole('button', { name: 'Sugerează baltă' }).click();
  const dialog = page.getByRole('dialog', { name: 'Sugerează o baltă nouă' });
  await expect(dialog).toBeVisible();
  // Required name.
  await dialog.getByRole('button', { name: 'Trimite cerere' }).click();
  await expect(dialog.getByText('Te rugăm să introduci numele bălții')).toBeVisible();
  // Live search after 2 characters: up to four matches.
  await dialog.getByLabel('Numele bălții').fill('Ch');
  await expect(dialog.getByText('Aceasta este balta pe care o cauți?')).toBeVisible({ timeout: 10_000 });
  expect(await dialog.locator('a[href^="/balti/"]').count()).toBeLessThanOrEqual(4);
  await expect(dialog.getByRole('switch', { name: 'Ești administratorul bălții?' })).not.toBeChecked();
  // Max 1000: a longer paste is cut at the cap.
  await dialog.getByLabel('Detalii despre baltă').fill('a'.repeat(1005));
  await expect(dialog.getByLabel('Detalii despre baltă')).toHaveValue('a'.repeat(1000));
  // Closing resets the form.
  await dialog.getByRole('button', { name: 'Închide' }).first().click();
  await expect(dialog).toBeHidden();
  await banner.getByRole('button', { name: 'Sugerează baltă' }).click();
  await expect(page.getByRole('dialog', { name: 'Sugerează o baltă nouă' }).getByLabel('Numele bălții')).toHaveValue('');
});

/* ---------- sponsors, news ---------- */

test('home.acasa.c48 c49 — sponsors and news', async ({ page }) => {
  await open(page, DESKTOP, false);
  const sponsors = section(page, 'Sponsori');
  await expect(sponsors.getByRole('link').first()).toHaveAttribute('href', /^\/sponsori\/[^/]+$/);
  const news = section(page, 'Noutăți');
  await expect(news.getByRole('link', { name: /^Vezi toate: Noutăți/ })).toHaveAttribute('href', '/stiri');
  const first = news.getByRole('list', { name: 'Noutăți' }).locator(':scope > li').first();
  await expect(first.getByRole('link').first()).toHaveAttribute('href', /^\/stiri\/[^/]+$/);
  await expect(first.locator('time')).toHaveText(/^\d{2} [A-ZĂÂÎȘȚ]+ \d{4}$/);
});

/* ---------- feedback, contact ---------- */

test('home.acasa.c50 — feedback form validation', async ({ page }) => {
  await open(page, PHONE, true);
  await section(page, 'Sugestii sau întrebări?').getByRole('button', { name: 'Scrie-ne' }).click();
  const dialog = page.getByRole('dialog', { name: 'Lasă-ne feedback' });
  await dialog.getByRole('button', { name: 'Trimite feedback' }).click();
  await expect(dialog.getByText('Nota este obligatorie')).toBeVisible();
  await expect(dialog.getByText('Te rugăm să selectezi o categorie')).toBeVisible();
  await dialog.getByText('5', { exact: true }).click();
  await expect(dialog.getByText('Experiență: Excelentă')).toBeVisible();
  await expect(dialog.getByText('Nota este obligatorie')).toHaveCount(0);
  for (const c of ['Funcționalitate nouă', 'Problemă tehnică', 'Conținut', 'Cont', 'Interfață', 'Altele']) {
    await expect(dialog.getByRole('radio', { name: c, exact: true })).toBeVisible();
  }
  await dialog.getByRole('textbox', { name: 'Detalii:' }).fill('a'.repeat(505));
  await expect(dialog.getByRole('textbox', { name: 'Detalii:' })).toHaveValue('a'.repeat(500));
  await dialog.getByRole('button', { name: 'Închide' }).click();
  await expect(dialog).toBeHidden();
});

test('home.acasa.c51 — sent feedback closes the form with the success toast', async ({ page }) => {
  await open(page, PHONE, true);
  // The CMS write is answered here: feedback is not an idempotent round-trip.
  let body: Record<string, unknown> | null = null;
  await page.route('**/api/cms/feedbacks*', async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":{"documentId":"e2e"}}' });
  });
  await section(page, 'Sugestii sau întrebări?').getByRole('button', { name: 'Scrie-ne' }).click();
  const dialog = page.getByRole('dialog', { name: 'Lasă-ne feedback' });
  await dialog.getByText('4', { exact: true }).click();
  await dialog.getByRole('radio', { name: 'Interfață' }).check();
  await dialog.getByRole('button', { name: 'Trimite feedback' }).click();
  await expect(page.getByText('Feedback-ul tău a fost trimis cu succes!')).toBeVisible();
  await expect(dialog).toBeHidden();
  expect(JSON.stringify(body)).toContain('"metadata"');
});

test('home.acasa.c52 c53 — guest contact and privacy cards', async ({ page }) => {
  await open(page, PHONE, false);
  await visible(page.getByRole('button', { name: 'Contactează-ne' })).click();
  const dialog = page.getByRole('dialog', { name: 'Contact' });
  await expect(dialog.getByText('Ai nevoie de ajutor sau ai întrebări? Suntem aici pentru tine!')).toBeVisible();
  await expect(dialog.locator('a[href^="tel:"]')).toBeVisible();
  await expect(dialog.locator('a[href^="mailto:"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(visible(page.getByRole('link', { name: /Setări de confidențialitate/ }))).toBeVisible();
});

/* ---------- keyboard ---------- */

test('home.acasa keyboard — skip link, rail arrows, header refresh reachable', async ({ page }) => {
  await open(page, DESKTOP, true);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Sari la conținut' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main#continut')).toBeFocused();
  // The refresh is the first control of the page body.
  await page.keyboard.press('Tab');
  await expect(visible(page.getByRole('button', { name: 'Reîmprospătează' }))).toBeFocused();
});
