import { collectConsoleErrors } from './helpers/console';
import { expectNoA11yViolations } from './helpers/a11y';
import { BASE_URL } from './helpers/base-url';
import { CMS, qaJwt, signIn } from './helpers/session';
import { expect, test, type Locator, type Page } from '@playwright/test';

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

const visible = (l: Locator) => l.locator('visible=true').first();
const h2 = (page: Page, name: string | RegExp) => visible(page.getByRole('heading', { level: 2, name }));
/** The visible <section> named by its heading. */
const section = (page: Page, name: string | RegExp) => visible(page.getByRole('region', { name }));

async function open(page: Page, viewport: { width: number; height: number }, signedIn: boolean) {
  await page.setViewportSize(viewport);
  if (signedIn) await signIn(page.context(), jwt);
  // A second load in the same page: leave the first one (its focus refresh may still be navigating).
  if (page.url() !== 'about:blank') await page.goto('about:blank');
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

      // One h1 per width: the greeting (fish profile card title). Signed out the same welcome at
      // every width (account.onboarding web replacement; the phone card's «Conectează-te» is the
      // sign-in, ProfileCard.tsx).
      const greeting = signedIn ? /^(Salut, .+!|Bine ai venit!)$/ : 'Bine ai venit pe Bluvi';
      await expect(visible(page.getByRole('heading', { level: 1, name: greeting }))).toBeVisible();

      for (const name of [/^Concursuri (live|viitoare)/, /^Bălți/, 'Noutăți', 'Sponsori', 'Instrumente', 'Ești la pescuit?', 'Nu găsești balta preferată?']) {
        await expect(h2(page, name)).toBeVisible();
      }
      if (vp.width >= 1280) await expect(page.getByRole('complementary', { name: 'Ce mă așteaptă' })).toBeVisible();

      if (signedIn) {
        await expect(h2(page, /^Balta mea/)).toBeVisible();
        await expect(visible(page.getByRole('button', { name: 'Contactează-ne' }))).toHaveCount(0);
        await expect(h2(page, 'Ce găsești pe Bluvi')).toHaveCount(0);
      } else {
        await expect(h2(page, 'Ce găsești pe Bluvi')).toBeVisible();
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
  // The card's title line (not a heading: the guest's h1 is «Bine ai venit pe Bluvi», above it).
  await expect(visible(page.getByRole('main').getByRole('link', { name: 'Conectează-te', exact: true }))).toHaveAttribute('href', '/intra');
  await expect(visible(page.getByRole('heading', { level: 1 }))).toHaveText('Bine ai venit pe Bluvi');
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

/* ---------- owner rule 4: when we don't know, we don't show (ROADMAP §4b) ---------- */

/** Copy that tells the viewer we do not know something — never on Acasă. */
const UNKNOWN_COPY = /nu am putut verifica|nu știm|nu stim|statistici(le)? (in|nu sunt )disponibile|nu am putut încărca (situația|bălțile)/i;

for (const signedIn of [false, true]) {
  for (const vp of [PHONE, DESKTOP]) {
    test(`owner rule 4 — no «unknown» copy on Acasă · ${vp.width}px · ${signedIn ? 'signed in' : 'signed out'}`, async ({ page }) => {
      await open(page, vp, signedIn);
      await expect(page.getByRole('main')).not.toContainText(UNKNOWN_COPY);
      // «Concursul meu» exists only for a signed-in viewer the CMS places in a live competition.
      if (!signedIn) await expect(page.getByRole('region', { name: /concursul meu/i })).toHaveCount(0);
    });
  }
}

test('owner rule 4 — «CONCURSUL MEU» shows only when the CMS says the user is in a live competition (fish DashboardSheet)', async ({ page, request }) => {
  const auth = { headers: { Authorization: `Bearer ${jwt}` } };
  const [liveRes, partidaRes] = await Promise.all([request.get(`${CMS}/competitions/live`, auth), request.get(`${CMS}/feed/sessions/active`, auth)]);
  expect(liveRes.ok()).toBeTruthy();
  const name = ((await liveRes.json()) as { competition?: { name?: string } | null }).competition?.name ?? null;
  // A live partidă takes the slot first (fish: the dock over the sheet), whatever the competition.
  const partida = partidaRes.ok() ? Boolean(((await partidaRes.json()) as { data?: { documentId?: string } | null }).data?.documentId) : false;

  for (const vp of [PHONE, DESKTOP]) {
    await open(page, vp, true);
    const block = page.locator('section[aria-labelledby^="acasa-concursul-meu"]').locator('visible=true');
    const partidaBlock = page.locator('section[aria-label="Partida activă"], section[aria-labelledby="acasa-partida-activa"]').locator('visible=true');
    if (!name && !partida) {
      // Never shown without a confirmed live competition — a timeout can only hide it.
      await expect(block).toHaveCount(0);
      continue;
    }
    // The page's own read is bounded (data.ts READ_BUDGET_MS); a read with no answer is finished in
    // the browser (LateBlocks.tsx), so the block arrives on the same load — no reload needed.
    const expected = partida ? partidaBlock : block;
    await expect(expected.first()).toBeVisible({ timeout: 20_000 });
    if (partida) await expect(block).toHaveCount(0);
    else await expect(block.first()).toContainText(name!);
  }
});

/*
 * Rule 4 in the states it is about: each per-user read put into «no answer». The session by a cookie
 * value the server cannot send as a bearer (the /users/me fetch throws: «unknown»); the server-side
 * reads by the dev-only fault cookie (data.ts FAULT_COOKIE: the named attempt() labels fail as a 5xx
 * would) — server reads cannot be page.route()d. Browser reads (the takeover of a failed server
 * read, LateBlocks.tsx) are routed as usual.
 */
const FAULT_COOKIE = 'bluvi_e2e_fault';
/** A session cookie whose value makes the server's /users/me fetch throw (invalid header byte). */
const UNREADABLE_SESSION = '%C8%99abc';

/** The signed-in precondition of a fault test: the session itself was read (else every block is trivially hidden). */
async function expectSignedIn(page: Page) {
  await expect(visible(page.getByRole('heading', { level: 1 }))).toHaveText(/^(Salut, .+!|Bine ai venit!)$/);
}

async function openWith(page: Page, viewport: { width: number; height: number }, cookies: Record<string, string>) {
  await page.setViewportSize(viewport);
  const { hostname } = new URL(BASE_URL);
  await page.context().addCookies(Object.entries(cookies).map(([name, value]) => ({ name, value, domain: hostname, path: '/', sameSite: 'Lax' as const })));
  if (page.url() !== 'about:blank') await page.goto('about:blank');
  const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
}

for (const vp of [PHONE, { width: 1280, height: 800 }]) {
  test(`owner rule 4 — session unknown · ${vp.width}px: no greeting, no guest prompts, tools kept`, async ({ page }) => {
    // Loads Acasă (two widths for some) and waits out the browser takeover's retries.
    test.slow();
    await openWith(page, vp, { bluvi_session: UNREADABLE_SESSION });
    const main = page.getByRole('main');
    // The page's h1 is neutral («Acasă»): neither the greeting nor the signed-out welcome.
    await expect(visible(page.getByRole('heading', { level: 1 }))).toHaveText('Acasă');
    await expect(page.getByRole('heading', { level: 1, name: /^(Salut|Bine ai venit|Conectează-te)/ })).toHaveCount(0);
    await expect(visible(main.getByText(/Conectează-te|Intră în cont|Intră ca să/))).toHaveCount(0);
    await expect(visible(main.getByRole('button', { name: 'Contactează-ne' }))).toHaveCount(0);
    await expect(visible(main.getByRole('link', { name: /Setări de confidențialitate/ }))).toHaveCount(0);
    for (const name of ['Ești la pescuit?', /^Balta mea/, 'Panou organizator', 'Pescari pe care îi poți urmări', 'Ce găsești pe Bluvi']) await expect(h2(page, name)).toHaveCount(0);
    // Session-independent: the tools (phone: main column; 1280: the aside) and the public sections.
    await expect(h2(page, 'Instrumente')).toBeVisible();
    for (const name of [/^Bălți/, 'Noutăți']) await expect(h2(page, name)).toBeVisible();
    // No bone that never resolves: the phone card is a slim row with the refresh, not a shimmer.
    await expect(visible(main.locator('.animate-shimmer'))).toHaveCount(0);
    await expect(visible(page.getByRole('button', { name: 'Reîmprospătează' }))).toBeVisible();
    await expect(main).not.toContainText(UNKNOWN_COPY);
  });
}

test('owner rule 4 — partidă probe with no answer: no «Începe o partidă» hero', async ({ page }) => {
  // Loads Acasă (two widths for some) and waits out the browser takeover's retries.
  test.slow();
  await signIn(page.context(), jwt);
  await openWith(page, PHONE, { [FAULT_COOKIE]: 'active partida' });
  await expectSignedIn(page);
  await expect(h2(page, /^Bălți/)).toBeVisible();
  await expect(h2(page, 'Ești la pescuit?')).toHaveCount(0);
  await expect(visible(page.getByRole('link', { name: 'Începe o partidă' }))).toHaveCount(0);
  await expect(page.getByRole('main')).not.toContainText(UNKNOWN_COPY);
});

test('owner rule 4 — live competition read with no answer: hidden until the browser read confirms it', async ({ page }) => {
  // Loads Acasă (two widths for some) and waits out the browser takeover's retries.
  test.slow();
  await signIn(page.context(), jwt);
  // The browser takeover's read fails too: nothing, at either width.
  await page.route('**/api/cms/competitions/live*', (r) => r.fulfill({ status: 503, body: '' }));
  for (const vp of [PHONE, { width: 1280, height: 800 }]) {
    await openWith(page, vp, { [FAULT_COOKIE]: 'live competition' });
    await expectSignedIn(page);
    await expect(h2(page, /^Bălți/)).toBeVisible();
    await expect(page.locator('section[aria-labelledby^="acasa-concursul-meu"]').locator('visible=true')).toHaveCount(0);
    await expect(page.getByRole('main')).not.toContainText(UNKNOWN_COPY);
  }
});

test('owner rule 4 — live competition read with no answer: the browser read brings «Concursul meu» on the same load', async ({ page }) => {
  // Loads Acasă (two widths for some) and waits out the browser takeover's retries.
  test.slow();
  await signIn(page.context(), jwt);
  const live = { competition: { documentId: 'e2e-live', name: 'Cupa E2E live', rankingType: 'classic' }, 'extra-scales': [] };
  await page.route('**/api/cms/competitions/live*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(live) }));
  await page.route('**/api/cms/**e2e-live**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"data":[]}' }));
  // The partidă probe fails too: the dock's precedence must not hide the competition.
  for (const vp of [PHONE, { width: 1280, height: 800 }]) {
    await openWith(page, vp, { [FAULT_COOKIE]: 'live competition,active partida' });
    await expectSignedIn(page);
    const block = page.locator('section[aria-labelledby^="acasa-concursul-meu"]').locator('visible=true');
    await expect(block).toHaveCount(1, { timeout: 20_000 });
    await expect(block).toContainText('Cupa E2E live');
    // Phone: the dock sticks to the bottom edge; 1280: the right column's last block.
    if (vp.width < 1280) {
      const box = await block.boundingBox();
      expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBeLessThanOrEqual(vp.height);
    } else {
      const aside = page.getByRole('complementary', { name: 'Ce mă așteaptă' });
      const last = await aside.locator('section').locator('visible=true').last().getAttribute('aria-labelledby');
      expect(last).toMatch(/^acasa-concursul-meu/);
    }
  }
});

for (const [label, heading, path, cmsPath] of [
  ['organizer dashboard', 'Panou organizator', '**/api/cms/competitions/organizer/dashboard*', '/competitions/organizer/dashboard'],
  ['owned lakes stats', /^(Balta mea|Bălțile mele)/, '**/api/cms/feed/owned-lakes/stats*', '/feed/owned-lakes/stats'],
] as const) {
  test(`owner rule 4 — ${label} with no answer: the browser read fills it in, or it stays hidden`, async ({ page }) => {
    // Loads Acasă (two widths for some) and waits out the browser takeover's retries.
    test.slow();
    await signIn(page.context(), jwt);
    // Browser read refused too: nothing (and not even a skeleton left behind).
    await page.route(path, (r) => r.fulfill({ status: 503, body: '' }));
    await openWith(page, PHONE, { [FAULT_COOKIE]: label });
    await expectSignedIn(page);
    await expect(h2(page, /^Bălți/)).toBeVisible();
    // The skeleton holds the place while the browser retries, then goes — nothing is left.
    const skeleton = page.getByRole('main').locator('[role="status"][aria-label="Se încarcă panoul organizator"], [role="status"]:has-text("Se încarcă balta ta")');
    await expect(skeleton.locator('visible=true')).toHaveCount(0, { timeout: 20_000 });
    await expect(h2(page, heading)).toHaveCount(0);
    await expect(page.getByRole('main')).not.toContainText(UNKNOWN_COPY);
    // Browser read answers: the block arrives on the same load (the QA user is an organiser and
    // operates Chita locally; skipped if the CMS says otherwise).
    await page.unroute(path);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const res = await page.request.get(`${CMS}${cmsPath}`, { headers: { Authorization: `Bearer ${jwt}` } });
    if (!res.ok()) test.skip(true, `${label}: no grant for the QA user locally`);
    await expect(h2(page, heading)).toBeVisible({ timeout: 20_000 });
  });
}

test('owner rule 4 — raffle participation with no answer: no join CTA, no «could not check» copy', async ({ page }) => {
  // Loads Acasă (two widths for some) and waits out the browser takeover's retries.
  test.slow();
  await signIn(page.context(), jwt);
  await openWith(page, PHONE, { [FAULT_COOKIE]: 'raffle participation' });
  await expectSignedIn(page);
  const raffle = visible(page.locator('section').filter({ has: page.getByRole('list', { name: 'Premii' }) }));
  if ((await raffle.count()) === 0) test.skip(true, 'no active raffle session locally');
  await expect(raffle.getByRole('link', { name: /Înscrie-te|Vezi șansele|Intră ca să participi/ })).toHaveCount(0);
  await expect(raffle).not.toContainText(UNKNOWN_COPY);
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
  // c18 (the panel) has its own tests below.
  await expect(tools.getByRole('button', { name: 'Vremea, în curând' })).toBeVisible();
  await expect(tools.getByRole('button', { name: 'Fazele Lunii, în curând' })).toBeVisible();
});

/* ---------- c18: the «În curând» interest panel (widget notifications) ---------- */

const WIDGET_ROUTE = '**/api/cms/feed/widget-notifications**';
const json = (body: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

/**
 * Answers GET mine with `registered` and POST with `post` (a status or a JSON answer), and records
 * every request. The CMS write is never sent: these are mocks, the GET's contract is in
 * tests/contract/social.contract.test.ts.
 */
async function mockWidgetNotifications(page: Page, init: { registered: boolean; post?: number | { delayMs: number } }) {
  let registered = init.registered;
  const post = init.post;
  const requests: { method: string; url: string; body: unknown }[] = [];
  await page.route(WIDGET_ROUTE, async (route) => {
    const req = route.request();
    requests.push({ method: req.method(), url: req.url(), body: req.postDataJSON() });
    const feature = new URL(req.url()).searchParams.get('feature') ?? (req.postDataJSON() as { data: { feature: string } } | null)?.data.feature;
    if (req.method() === 'GET') return route.fulfill(json({ data: { feature, registered, registeredAt: registered ? '2026-10-01T08:00:00.000Z' : null } }));
    if (typeof post === 'number') return route.fulfill({ status: post, contentType: 'application/json', body: '{"error":{"status":500,"message":"x"}}' });
    if (post?.delayMs) await new Promise((r) => setTimeout(r, post.delayMs));
    registered = true; // the CMS row now exists: the invalidated read says so
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { documentId: 'e2e', feature, registeredAt: '2026-10-07T08:00:00.000Z', created: true } }) });
  });
  return requests;
}

async function openInterest(page: Page, title: 'Vremea' | 'Fazele Lunii') {
  await section(page, 'Instrumente').getByRole('button', { name: `${title}, în curând` }).click();
  // A fitted sheet below 768, a plain dismissible dialog from 768 (ResponsiveSurface intent
  // «info») — never an alertdialog: it is an informational offer, not a decision.
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  return dialog;
}

/** From 768 the dialog has the «Închide» X (a mouse user's way out); the sheet closes by its scrim / handle drag. */
async function expectCloseX(page: Page, dialog: Locator) {
  const width = page.viewportSize()?.width ?? 0;
  if (width >= 768) await expect(dialog.getByRole('button', { name: 'Închide' }).first()).toBeVisible();
}

const TABLET_900 = { width: 900, height: 1000 };

for (const vp of [PHONE, TABLET_900, DESKTOP]) {
  test(`home.acasa.c18 — signed out (${vp.width}px): image, title, description and «Intră în cont»; no read`, async ({ page }) => {
    const requests = await mockWidgetNotifications(page, { registered: false });
    await open(page, vp, false);
    const dialog = await openInterest(page, 'Fazele Lunii');
    // The name is the focal point, centred under the 64px artwork (the surface title is sr-only).
    await expect(dialog.locator('p', { hasText: /^Fazele Lunii$/ })).toHaveCSS('text-align', 'center');
    await expect(dialog.locator('img')).toHaveCSS('width', '64px');
    await expectCloseX(page, dialog);
    await expect(dialog.getByText('Urmărește fazele lunii și cele mai bune momente pentru pescuit. Lucrăm la asta!')).toBeVisible();
    await expect(dialog.locator('img')).toHaveCount(1);
    // fish: router.push('/sign-in') — sign-in returns to Acasă (lib/routes signIn: plain /intra for /).
    await expect(dialog.getByRole('link', { name: 'Intră în cont' })).toHaveAttribute('href', '/intra');
    await expect(dialog.getByRole('button', { name: 'Anunță-mă când e disponibil' })).toHaveCount(0);
    // fish: the read is enabled only signed in.
    expect(requests).toEqual([]);
    await expectNoA11yViolations(page);
  });

  test(`home.acasa.c18 — signed in (${vp.width}px), not registered: «Anunță-mă» POSTs, pending, then «Ești pe listă!» + «Închide»`, async ({ page }) => {
    const requests = await mockWidgetNotifications(page, { registered: false, post: { delayMs: 800 } });
    await open(page, vp, true);
    const dialog = await openInterest(page, 'Vremea');
    await expect(dialog.getByText(/^Prognoza meteo pentru spoturile tale de pescuit/)).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Intră în cont' })).toHaveCount(0);
    await expectCloseX(page, dialog);
    const notify = dialog.getByRole('button', { name: 'Anunță-mă când e disponibil' });
    await expect(notify).not.toHaveAttribute('aria-disabled', 'true');
    expect(requests.filter((r) => r.method === 'GET').map((r) => new URL(r.url).searchParams.get('feature'))).toEqual(['weather']);

    await notify.click();
    // Pending: one press, one write.
    const saving = dialog.getByRole('button', { name: 'Se salvează…' });
    await expect(saving).toHaveAttribute('aria-disabled', 'true');
    await saving.click({ force: true });

    await expect(dialog.getByText('Ești pe listă! 🎉 Te anunțăm imediat ce Vremea e disponibilă.')).toBeVisible();
    const posts = requests.filter((r) => r.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toEqual({ data: { feature: 'weather' } });
    await expect(dialog.locator('img')).toHaveCount(0);
    await expectNoA11yViolations(page);
    // The footer «Închide» (from 768 the header X is a second «Închide»: take the last, the CTA).
    await dialog.getByRole('button', { name: 'Închide' }).last().click();
    await expect(dialog).toBeHidden();
  });
}

test('home.acasa.c18 — signed in, already registered: check, «Ești pe listă!» and «Închide», no offer', async ({ page }) => {
  await mockWidgetNotifications(page, { registered: true });
  await open(page, PHONE, true);
  const dialog = await openInterest(page, 'Fazele Lunii');
  await expect(dialog.getByText('Ești pe listă! 🎉 Te anunțăm imediat ce Fazele Lunii sunt disponibile.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Anunță-mă când e disponibil' })).toHaveCount(0);
  await expect(dialog.getByText(/Lucrăm la asta!/)).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Închide' }).click();
  await expect(dialog).toBeHidden();
});

test('home.acasa.c18 — a failed save toasts «Nu am putut salva. Încearcă din nou.» and keeps the offer', async ({ page }) => {
  await mockWidgetNotifications(page, { registered: false, post: 500 });
  await open(page, PHONE, true);
  const dialog = await openInterest(page, 'Vremea');
  await dialog.getByRole('button', { name: 'Anunță-mă când e disponibil' }).click();
  await expect(page.getByText('Nu am putut salva. Încearcă din nou.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Anunță-mă când e disponibil' })).toBeVisible();
  await expect(dialog.getByText(/Ești pe listă/)).toHaveCount(0);
});

/**
 * Mocks GET mine with a delayed or failing answer (POST succeeds). The delay is released by the
 * returned function, so the test sees the busy state for as long as it needs.
 */
async function mockMineRead(page: Page, mode: 'hold' | 500) {
  let release = () => {};
  const held = new Promise<void>((r) => (release = r));
  const posts: unknown[] = [];
  const counts = { gets: 0 };
  await page.route(WIDGET_ROUTE, async (route) => {
    const req = route.request();
    const feature = new URL(req.url()).searchParams.get('feature') ?? 'weather';
    if (req.method() === 'GET') counts.gets++;
    if (req.method() === 'POST') {
      posts.push(req.postDataJSON());
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { documentId: 'e2e', feature: 'weather', registeredAt: '2026-10-07T08:00:00.000Z', created: true } }) });
    }
    if (mode === 500) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"status":500,"message":"x"}}' });
    await held;
    return route.fulfill(json({ data: { feature, registered: false, registeredAt: null } }));
  });
  return {
    release,
    posts,
    get gets() {
      return counts.gets;
    },
  };
}

test('home.acasa.c18 — while «am I registered?» loads: a busy, disabled offer (spinner, aria-busy), then the live offer', async ({ page }) => {
  const read = await mockMineRead(page, 'hold');
  await open(page, PHONE, true);
  const dialog = await openInterest(page, 'Vremea');
  const notify = dialog.getByRole('button', { name: 'Anunță-mă când e disponibil' });
  await expect(notify).toHaveAttribute('aria-disabled', 'true');
  await expect(notify).toHaveAttribute('aria-busy', 'true');
  await expect(notify.locator('svg.animate-spin')).toHaveCount(1);
  // A press while busy writes nothing (force skips the actionability wait, so wait for the sheet
  // to dock first: it slides up from below the viewport and is a clipped box, not a scroller).
  await expect(notify).toBeInViewport({ ratio: 1 });
  await notify.click({ force: true });
  expect(read.posts).toEqual([]);
  read.release();
  await expect(notify).not.toHaveAttribute('aria-disabled', 'true');
  await expect(notify).not.toHaveAttribute('aria-busy', 'true');
  await expect(notify.locator('svg')).toHaveCount(0);
});

test('home.acasa.c18 — a failed read (500) still offers «Anunță-mă», and the save works', async ({ page }) => {
  const read = await mockMineRead(page, 500);
  await open(page, PHONE, true);
  const dialog = await openInterest(page, 'Vremea');
  const notify = dialog.getByRole('button', { name: 'Anunță-mă când e disponibil' });
  // The read does not retry: the offer is live within 1s, not after ~3s of backoff (agreed web
  // divergence, home.acasa.c18 — fish has no gate at all).
  await expect(notify).not.toHaveAttribute('aria-disabled', 'true', { timeout: 1_000 });
  expect(read.gets).toBe(1);
  await notify.click();
  await expect(dialog.getByText('Ești pe listă! 🎉 Te anunțăm imediat ce Vremea e disponibilă.')).toBeVisible();
  expect(read.posts).toEqual([{ data: { feature: 'weather' } }]);
});

test('home.acasa.c18 — unknown session (a cookie whose read fails): no «Intră în cont», the offer instead', async ({ page }) => {
  test.slow();
  const requests = await mockWidgetNotifications(page, { registered: false });
  // The session is unknown, never a guest (owner rule 4).
  await page.setViewportSize(PHONE);
  await openWith(page, PHONE, { bluvi_session: UNREADABLE_SESSION });
  const dialog = await openInterest(page, 'Vremea');
  await expect(dialog.getByRole('link', { name: 'Intră în cont' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Anunță-mă când e disponibil' })).toBeVisible();
  expect(requests.filter((r) => r.method === 'GET')).toHaveLength(1);
});

for (const vp of [PHONE, DESKTOP]) {
  test(`home.acasa.c18 — keyboard (${vp.width}px): Enter opens with focus inside, Esc closes, focus returns to the tile`, async ({ page }) => {
    await mockWidgetNotifications(page, { registered: true });
    await open(page, vp, true);
    const tile = section(page, 'Instrumente').getByRole('button', { name: 'Vremea, în curând' });
    await tile.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Vremea' });
    await expect(dialog).toBeVisible();
    await expect.poll(() => dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(tile).toBeFocused();

    // Again, closed with the registered state's «Închide» (the footer CTA).
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Închide' }).last().click();
    await expect(dialog).toBeHidden();
    await expect(tile).toBeFocused();
  });

  test(`home.acasa.c18 — keyboard (${vp.width}px): Enter on «Anunță-mă» saves and focus stays on the same CTA, now «Închide»`, async ({ page }) => {
    await mockWidgetNotifications(page, { registered: false });
    await open(page, vp, true);
    const tile = section(page, 'Instrumente').getByRole('button', { name: 'Vremea, în curând' });
    await tile.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Vremea' });
    const notify = dialog.getByRole('button', { name: 'Anunță-mă când e disponibil' });
    await expect(notify).not.toHaveAttribute('aria-disabled', 'true');
    await notify.focus();
    await page.keyboard.press('Enter');
    await expect(dialog.getByText(/^Ești pe listă!/)).toBeVisible();
    // The same node, relabelled: focus never falls to <body> behind the open dialog.
    await expect(dialog.getByRole('button', { name: 'Închide' }).last()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(tile).toBeFocused();
  });
}

// Sheet owner (components/surfaces/Sheet.tsx): on a `fit` sheet the handle's «Extinde» takes the
// first focus and snaps the short offer to 90dvh. Enable once the fit sheet drops the expand toggle
// from the tab order and the initial focus goes to the CTA.
test.fixme('home.acasa.c18 — phone sheet: focus starts on the CTA and the fitted sheet does not jump', async ({ page }) => {
  await mockWidgetNotifications(page, { registered: false });
  await open(page, PHONE, true);
  const tile = section(page, 'Instrumente').getByRole('button', { name: 'Vremea, în curând' });
  await tile.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Vremea' });
  const notify = dialog.getByRole('button', { name: 'Anunță-mă când e disponibil' });
  await expect(notify).toBeFocused();
  const before = (await dialog.boundingBox())!.height;
  await expect(dialog.getByRole('button', { name: 'Extinde' })).toHaveCount(0);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(400);
  expect(Math.abs((await dialog.boundingBox())!.height - before)).toBeLessThan(2);
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
    await expect(rail.getByRole('link', { name: /^Vezi toate: / })).toHaveAttribute('href', `/concursuri/${live ? 'live' : 'viitoare'}`);

    const cards = rail.getByRole('list', { name: live ? 'Concursuri live' : 'Concursuri viitoare' }).getByRole('listitem');
    await expect(cards.first()).toBeVisible();
    const first = cards.first();
    await expect(first.getByRole('link').first()).toHaveAttribute('href', /^\/concursuri\/[^/]+$/);
    await expect(first.getByText(/^(Individual|Echipe)$/)).toBeVisible();
    if (live) {
      await expect(first.getByText('LIVE', { exact: true })).toBeVisible();
      await expect(first.getByText(/(capturi|captură|Încă nu sunt capturi)/).first()).toBeVisible();
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
    await expect(card.getByRole('button', { name: /^Urmăresc pe / })).toHaveText('Urmăresc');
    await card.getByRole('button', { name: /^Urmăresc pe / }).click();
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
  await open(page, PHONE, true);
  const rail = section(page, 'Pescari pe care îi poți urmări');
  if ((await rail.count()) === 0) test.skip(true, 'fewer than 3 suggestions locally');
  const card = rail.getByRole('article').first();
  const follow = card.getByRole('button', { name: /^Urmărește pe / });
  if ((await follow.count()) === 0) test.skip(true, 'first suggestion already followed');
  await follow.click();
  const following = card.getByRole('button', { name: /^Urmăresc pe / });
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
  // Owner rule 5 (no empty footer space): the facilities are named (first two, then «+n») on the
  // card's last line, never a row of bare glyphs that stays blank when a lake lists none.
  await expect(lakes.getByRole('list', { name: 'Facilități' })).toHaveCount(0);
  await expect(visible(lakes.getByText(/^(Facilități|Specii|Regim): $/)).first()).toBeAttached();
});

test('owner rule 5 — at most two rails from 1280; Bălți and Noutăți are full-row grids, Sponsori a strip', async ({ page }) => {
  for (const vp of [{ width: 1280, height: 800 }, DESKTOP]) {
    await open(page, vp, true);
    // A rail is a list that scrolls sideways (HorizontalRail: snap-x, overflow-x auto).
    const rails = await page.getByRole('main').locator('ul').evaluateAll((els) =>
      els.filter((e) => (e as HTMLElement).offsetParent !== null && getComputedStyle(e).overflowX === 'auto').map((e) => e.getAttribute('aria-label'))
    );
    expect(rails.length, JSON.stringify(rails)).toBeLessThanOrEqual(2);
    for (const [name, rows] of [['Bălți', 2], ['Noutăți', 1]] as const) {
      const grid = visible(page.getByRole('list', { name, exact: true }));
      const tops = await grid.locator(':scope > li').evaluateAll((els) =>
        els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => Math.round(e.getBoundingClientRect().top))
      );
      const perRow = new Map<number, number>();
      for (const t of tops) perRow.set(t, (perRow.get(t) ?? 0) + 1);
      expect(perRow.size, `${name} rows ${JSON.stringify([...perRow])}`).toBeLessThanOrEqual(rows);
      // Whole rows only: every row holds as many cards as the first.
      expect(new Set(perRow.values()).size, `${name} rows ${JSON.stringify([...perRow])}`).toBe(1);
    }
    // Sponsori: one chip height, no arrows, no held space for a link.
    const sponsors = section(page, 'Sponsori');
    if (await sponsors.count()) {
      await expect(sponsors.getByRole('button')).toHaveCount(0);
      const heights = await sponsors.getByRole('link').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
      expect(new Set(heights).size, JSON.stringify(heights)).toBe(1);
      expect(heights[0]).toBeLessThanOrEqual(64);
    }
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

/* ---------- account.onboarding (mobile only): the web replacement ---------- */

test('account.onboarding.c1 c2 c3 c4 replaced — a first visit to / never redirects; the signed-out home is the landing, «Intră» leads to /intra', async ({ browser }) => {
  // A brand-new visitor: no cookies, no storage (fish's ONBOARDING_COMPLETE flag has no web twin).
  for (const vp of [PHONE, { width: 1280, height: 800 }]) {
    const context = await browser.newContext({ viewport: vp });
    const page = await context.newPage();
    const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);
    expect(res?.request().redirectedFrom()).toBeNull();
    expect(new URL(page.url()).pathname).toBe('/');
    // No onboarding pager («Sari peste», «Continuă»): the home itself is the landing.
    await expect(page.getByRole('button', { name: 'Sari peste' })).toHaveCount(0);
    await expect(visible(page.getByRole('heading', { level: 1, name: 'Bine ai venit pe Bluvi' }))).toBeVisible();
    // c4 — the landing says what Bluvi is: fish's four onboarding pillars (app/onboarding.tsx
    // STORIES, kicker + headline), under the header card on the phone, heading the right column from 1280.
    const pillars = visible(page.getByRole('region', { name: 'Ce găsești pe Bluvi' }));
    await expect(pillars).toBeVisible();
    for (const [kicker, headline] of [
      ['DESCOPERĂ', 'Următoarea partidă începe aici.'],
      ['TRĂIEȘTE PARTIDA', 'Fiecare lansetă. Fiecare moment.'],
      ['INTRĂ ÎN COMPETIȚIE', 'Emoția concursului. Captură cu captură.'],
      ['ÎNȚELEGE PESCUITUL', 'Mai mult decât o captură.'],
    ]) {
      await expect(pillars.getByText(kicker, { exact: true })).toBeVisible();
      await expect(pillars.getByText(headline, { exact: true })).toBeVisible();
    }
    if (vp.width < 768) {
      // Under the header card: the sign-in card's «Conectează-te» comes first.
      const card = visible(page.getByRole('main').getByRole('link', { name: 'Conectează-te', exact: true }));
      const [cardBox, pillarsBox] = [await card.boundingBox(), await pillars.boundingBox()];
      expect(pillarsBox!.y).toBeGreaterThan(cardBox!.y);
    } else {
      // In «Ce mă așteaptă», above Instrumente: what Bluvi is before its coming-soon tools.
      const tools = section(page, 'Instrumente');
      const [toolsBox, pillarsBox] = [await tools.boundingBox(), await pillars.boundingBox()];
      expect(pillarsBox!.y).toBeLessThan(toolsBox!.y);
      expect(Math.abs(pillarsBox!.x - toolsBox!.x)).toBeLessThan(2);
    }
    const intra = visible(page.getByRole('banner').getByRole('link', { name: 'Intră', exact: true }));
    await expect(intra).toHaveAttribute('href', '/intra');
    await intra.click();
    await expect(page).toHaveURL(/\/intra$/);
    await context.close();
  }
});
