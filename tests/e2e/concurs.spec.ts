import { collectConsoleErrors } from './helpers/console';
import { expectNoA11yViolations } from './helpers/a11y';
import { CMS, qaJwt, signIn } from './helpers/session';
import { expect, test, type Locator, type Page, type Request } from '@playwright/test';
import { ON_WEB } from '@/lib/routes';

/*
 * Concurs · Clasament (/concursuri/[id], template T3) — parity inventory
 * docs/parity/areas/competition-page.yml, screens competition-page.shell and
 * competition-page.clasament. Each test names the criterion ids it covers. Local CMS on :1337,
 * QA user «Sim QA» (operator of Chita, author of the upcoming «SIM3 Cupa C&B Ed 8», a follower of
 * the live «[CHAT25]» competition — the follow tests leave it following again).
 *
 * Phone (375): the kit RankingRow list (Fundații §07) and the bottom action bar, the whole table
 * behind «Tot ecranul»; from 768 the T3 header actions and the kit ranking table. Only one of the
 * two renders is displayed, so locators are narrowed to their visible match. Criteria the web does
 * not meet yet (status todo in the yml) keep their fish expectations as `test.fixme`. Override the
 * ids with E2E_COMPETITION_* when the local data moves.
 */

const ID = {
  /** started, quantity, 24 sectors × 1 stand, a penalty on A1, QA user follows it. */
  live: process.env.E2E_COMPETITION_LIVE ?? 'kee49a3e64b3f636b4b60daa',
  /** completed, quantity, one sector, prerendered (generateStaticParams). */
  completed: process.env.E2E_COMPETITION_COMPLETED ?? 'uxxie29m6820wrpdv45w0m7q',
  /** notStarted, the QA user is its author. */
  upcomingOwn: process.env.E2E_COMPETITION_UPCOMING_OWN ?? 'a6xjl65ooe9eadrtvvqj9hn1',
  /** started, no ranking rows. */
  liveEmpty: process.env.E2E_COMPETITION_LIVE_EMPTY ?? 'uql25w776iris1wqnsc20wyg',
  quality: process.env.E2E_COMPETITION_QUALITY ?? 'k5c9427518736c92684018b9',
  quantityQuality: process.env.E2E_COMPETITION_QQ ?? 'k646t4o4x3wadzqxn1yqf49l',
  bestOf: process.env.E2E_COMPETITION_BESTOF ?? 'r4pofq9vbn7vufsw37wxrsu6',
  bestOfTiers: process.env.E2E_COMPETITION_BESTOF_TIERS ?? 'wyjmy091opw9wat92j7i9xc5',
  cmmc: process.env.E2E_COMPETITION_CMMC ?? 'zezs90mcm86kjchbhzdc5xkr',
  /** cancelled (quantityQuality). */
  cancelled: process.env.E2E_COMPETITION_CANCELLED ?? 'y1a8131h7otw6ivnohz72ob2',
};

const PHONE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const DESKTOP = { width: 1440, height: 900 };

type Core = {
  name: string;
  viewers: number;
  competitionStatus: string;
  author: { username: string } | null;
  lake: { documentId: string; name: string } | null;
};
const core = new Map<string, Core>();
let jwt = '';

test.describe.configure({ timeout: 120_000 });

test.beforeAll(async ({ request }) => {
  for (const id of [ID.live, ID.completed, ID.upcomingOwn]) {
    const res = await request.get(`${CMS}/feed/competitions/${id}`);
    expect(res.ok(), `competition ${id} exists in the local CMS`).toBeTruthy();
    core.set(id, (await res.json()).data);
  }
  jwt = await qaJwt(request);
});

const path = (id: string) => `/concursuri/${id}`;
const visible = (l: Locator) => l.locator('visible=true').first();
/** From 768: the kit ranking table (inline, General). */
const grid = (page: Page) => page.getByRole('region', { name: 'Clasament general' });
/** Phone: the RankingRow list. */
const phoneList = (page: Page) => page.getByRole('list', { name: 'Clasament', exact: true });
const followButton = (page: Page) => page.getByRole('button', { name: /^(Urmăresc|Urmărește)$/ });
const followersPill = (page: Page) => page.getByRole('button', { name: /^\d+ urmăritor(i)?$/ });

function track(page: Page, pattern: RegExp, method?: string) {
  const seen: Request[] = [];
  page.on('request', r => {
    if (pattern.test(r.url()) && (!method || r.method() === method)) seen.push(r);
  });
  return seen;
}

async function open(page: Page, id: string, viewport = PHONE) {
  await page.setViewportSize(viewport);
  const res = await page.goto(path(id), { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

/** Lets the client queries (viewer overlay, statute, weighings) settle. */
const settle = (page: Page) => page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

/* ------------------------------------------------------------------ */
/* Smoke + axe at the four widths, signed in and out                   */
/* ------------------------------------------------------------------ */

for (const id of [ID.completed, ID.live]) {
  for (const signedIn of [false, true]) {
    for (const vp of [PHONE, TABLET, { width: 1280, height: 900 }, DESKTOP]) {
      test(`smoke ${path(id)} · ${vp.width}px · ${signedIn ? 'signed in' : 'signed out'} — shell.c1 c17, clasament.c4, axe`, async ({
        page,
        context,
      }) => {
        if (signedIn) await signIn(context, jwt);
        const errors = collectConsoleErrors(page);
        await open(page, id, vp);
        const c = core.get(id)!;

        // shell.c1: the name is the page heading, the organiser and the lake follow it.
        await expect(page.getByRole('heading', { level: 1, name: c.name })).toBeVisible();
        await expect(visible(page.getByText(`Organizat de ${c.author?.username || 'Necunoscut'}`))).toBeVisible();
        // shell.c17: the route tabs, in fish order, Clasament current.
        const sections = page.getByRole('navigation', { name: 'Secțiunile concursului' });
        await expect(sections.getByRole('listitem')).toHaveText([/^Clasament/, /^Informații/, /^Participanți/, /^Extra Cântare/, /^Regulament/]);
        await expect(sections.locator('[aria-current="page"]')).toHaveText('Clasament');
        // clasament.c4: the four views, Clasament selected.
        const tablist = visible(page.getByRole('tablist', { name: 'Vederi clasament' }));
        await expect(tablist.getByRole('tab')).toHaveText([/Clasament/, /Cântare/, /Statistici/, /Toți peștii/]);
        await expect(tablist.getByRole('tab', { selected: true })).toContainText('Clasament');
        if (vp.width < 768) {
          await expect(phoneList(page).getByRole('listitem').first()).toBeVisible();
          await expect(page.getByRole('navigation', { name: 'Acțiuni concurs' })).toBeVisible();
        } else {
          await expect(grid(page).locator('tbody tr').first()).toBeVisible();
        }

        await settle(page);
        await expectNoA11yViolations(page);
        expect(errors, errors.join('\n')).toEqual([]);
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/* competition-page.shell                                              */
/* ------------------------------------------------------------------ */

test('shell.c1 c2 — lake link opens the lake page', async ({ page }) => {
  await open(page, ID.live, DESKTOP);
  const lake = core.get(ID.live)!.lake!;
  const link = visible(page.getByRole('link', { name: lake.name }));
  await expect(link).toHaveAttribute('href', `/balti/${lake.documentId}`);
});

test('shell.c3 c5 — started: Live, the followers pill with the count, the follow button', async ({ page }) => {
  await open(page, ID.live);
  const c = core.get(ID.live)!;
  const header = page.locator('[data-t3="header"]');
  // Fundații StatusPill «LIVE» (fish «Live»), with the pulsing dot.
  await expect(header.getByText(/^live$/i)).toBeVisible();
  await expect(followersPill(page)).toHaveText(`${c.viewers} ${c.viewers === 1 ? 'urmăritor' : 'urmăritori'}`);
  await expect(followButton(page)).toBeVisible();
});

test('shell.c4 c5 — completed: the followers pill only (singular «urmăritor»)', async ({ page }) => {
  await open(page, ID.completed);
  const c = core.get(ID.completed)!;
  await expect(followersPill(page)).toHaveText(`${c.viewers} ${c.viewers === 1 ? 'urmăritor' : 'urmăritori'}`);
  await expect(followButton(page)).toHaveCount(0);
  await expect(page.locator('[data-t3="header"]').getByText(/^live$/i)).toHaveCount(0);
  // fish badges no other status: no «Încheiat» pill (header and the pinned mini row).
  await expect(page.getByText('Încheiat', { exact: true })).toHaveCount(0);
});

test('shell.c4 — notStarted: the followers pill and the follow button, no Live', async ({ page }) => {
  await open(page, ID.upcomingOwn);
  await expect(followersPill(page)).toBeVisible();
  await expect(followButton(page)).toBeVisible();
  await expect(page.locator('[data-t3="header"]').getByText(/^live$/i)).toHaveCount(0);
  await expect(page.getByText('Viitor', { exact: true })).toHaveCount(0);
});

for (const vp of [PHONE, DESKTOP]) {
  test(`shell.c4 b.status-fallback — cancelled (${vp.width}px): no badge row at all (no state pill, no followers, no follow)`, async ({ page }) => {
    await open(page, ID.cancelled, vp);
    await settle(page);
    await expect(followersPill(page)).toHaveCount(0);
    await expect(followButton(page)).toHaveCount(0);
    await expect(page.getByText(/^(live|Anulat|Viitor|Încheiat)$/i)).toHaveCount(0);
    await expectNoA11yViolations(page);
  });
}

for (const vp of [PHONE, DESKTOP]) {
  test(`shell.c6 — the followers list (${vp.width}px): title, «N urmăresc», rows (to the angler page once it ships)`, async ({ page }) => {
    await open(page, ID.live, vp);
    await settle(page); // hydrated: the pill's handler is attached
    await followersPill(page).click();
    const dialog = page.getByRole('dialog', { name: 'Urmăritori' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/^\d+ urmăresc$/)).toBeVisible();
    await expect(dialog.getByRole('listitem').first()).toBeVisible();
    // /pescari/[id] is M2 (lib/routes.ts ON_WEB.angler): until then a row is the person, never a dead link.
    if (ON_WEB.angler) await expect(dialog.getByRole('link').first()).toHaveAttribute('href', /^\/pescari\/[a-z0-9]+$/);
    else await expect(dialog.locator('a[href^="/pescari/"]')).toHaveCount(0);
    await expectNoA11yViolations(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
}

test('shell.c7 c8 c29 — signed out: «Urmărește», a press sends nothing and asks to sign in; /my-status is never read', async ({ page }) => {
  const myStatus = track(page, /\/my-status/);
  const follows = track(page, /\/follow$/, 'POST');
  await open(page, ID.live);
  await settle(page);
  await expect(followButton(page)).toHaveText('Urmărește');
  await followButton(page).click();
  // fish's copy without its 😭 (Fundații §05: no emoji in the product UI).
  await expect(page.getByRole('alert').getByText('Ooops.. Intră în contul tău pentru a urmări competițiile live!')).toBeVisible();
  expect(follows).toHaveLength(0);
  expect(myStatus).toHaveLength(0);
});

test('shell.c7 c9 — the author sees «Urmăresc»; a press sends nothing and says they are already in', async ({ page, context }) => {
  await signIn(context, jwt);
  const follows = track(page, /\/follow$/, 'POST');
  await open(page, ID.upcomingOwn);
  await expect(followButton(page)).toHaveText('Urmăresc');
  await followButton(page).click();
  await expect(page.getByText('Faci deja parte din această competiție și vei fi la curent cu toate evenimentele!')).toBeVisible();
  expect(follows).toHaveLength(0);
});

test('shell.c29 c14 — signed in: /my-status is read, and the follow pill waits for the statute', async ({ page, context }) => {
  await signIn(context, jwt);
  const myStatus = track(page, /\/my-status/);
  let release!: () => void;
  const held = new Promise<void>(r => (release = r));
  await page.route(/\/user\/profile\/competition\/[^/]+\/statute/, async route => {
    await held;
    await route.continue();
  });
  await open(page, ID.live);
  await page.waitForTimeout(1500);
  // While the statute is loading, the pill is a bone (fish header skeleton).
  await expect(followButton(page)).toHaveCount(0);
  release();
  await expect(followButton(page)).toBeVisible();
  expect(myStatus.length).toBeGreaterThan(0);
});

test('shell.c10 c12 c13 — follow toggles once per burst, a follow opens the preferences, «Salvează» saves', async ({ page, context }) => {
  await signIn(context, jwt);
  const follows = track(page, /\/competitions\/[^/]+\/follow$/, 'POST');
  const prefsWrites = track(page, /\/notification-preferences/, 'PUT');
  await open(page, ID.live, DESKTOP);
  const button = followButton(page);
  await expect(button).toHaveText(/Urmăresc|Urmărește/);
  await settle(page);

  // Start from «following» (the QA user's state); unfollow with a double press: one request.
  if ((await button.innerText()) === 'Urmărește') {
    await button.click();
    await page.getByRole('dialog', { name: 'Te-ai abonat' }).getByRole('button', { name: 'Salvează' }).click();
    await expect(button).toHaveText('Urmăresc');
    follows.length = 0;
  }
  await button.dblclick();
  await expect(button).toHaveText('Urmărește');
  await page.waitForTimeout(500);
  expect(follows).toHaveLength(1);
  expect(follows[0].postDataJSON()).toEqual({ follow: false });

  // Follow again: optimistic label, then the preferences dialog (not dismissable by Escape).
  await button.click();
  await expect(button).toHaveText('Urmăresc');
  const prefs = page.getByRole('dialog', { name: 'Te-ai abonat' });
  await expect(prefs).toBeVisible();
  await expect(prefs.getByText('Alege ce notificări vrei să primești.')).toBeVisible();
  await expect(prefs.getByRole('switch').first()).toBeVisible();
  expect(follows.at(-1)!.postDataJSON()).toEqual({ follow: true });
  await page.keyboard.press('Escape');
  await expect(prefs).toBeVisible();
  await expectNoA11yViolations(page);
  await prefs.getByRole('button', { name: 'Salvează' }).click();
  await expect(prefs).toBeHidden();
  expect(prefsWrites.length).toBeGreaterThan(0);
});

test('shell.c10 — a failed follow rolls back and shows the error', async ({ page, context }) => {
  await signIn(context, jwt);
  await page.route(/\/competitions\/[^/]+\/follow$/, route => route.fulfill({ status: 500, body: '{}' }));
  await open(page, ID.live, DESKTOP);
  await settle(page);
  const button = followButton(page);
  const before = await button.innerText();
  await button.click();
  await expect(page.getByRole('alert').filter({ hasText: /\S/ }).first()).toBeVisible();
  await expect(button).toHaveText(before);
});

/** Collects the `bluvi:analytics` events (lib/analytics.ts) from the first paint. */
async function collectEvents(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __events: unknown[] };
    w.__events = [];
    window.addEventListener('bluvi:analytics', e => w.__events.push((e as CustomEvent).detail));
  });
  return () => page.evaluate(() => (window as unknown as { __events: { name: string; params: Record<string, unknown> }[] }).__events);
}

test('shell.c21 — share: the header chip and the desktop button share the fish text and the page URL, and log share_competition', async ({ page, context }) => {
  const events = await collectEvents(page);
  await context.addInitScript(() => {
    (window as unknown as { __shared: unknown[] }).__shared = [];
    Object.defineProperty(navigator, 'share', {
      value: (data: unknown) => {
        (window as unknown as { __shared: unknown[] }).__shared.push(data);
        return Promise.resolve();
      },
    });
  });
  const c = core.get(ID.live)!;
  await open(page, ID.live);
  await settle(page);
  await page.getByRole('button', { name: 'Distribuie competiția' }).click();
  await page.setViewportSize(DESKTOP);
  await expect(visible(page.getByRole('button', { name: 'Distribuie', exact: true }))).toBeVisible();
  await visible(page.getByRole('button', { name: 'Distribuie', exact: true })).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared.length)).toBe(2);
  const shared = await page.evaluate(() => (window as unknown as { __shared: { text: string; url: string }[] }).__shared);
  expect(shared).toHaveLength(2);
  for (const s of shared) {
    expect(s.text).toBe(`Intră în Bluvi să vezi competiția de pescuit ${c.name} de pe balta ${c.lake!.name}`);
    expect(s.url).toMatch(new RegExp(`/concursuri/${ID.live}$`));
  }
  // fish handleShareCompetition: share_competition { competition_id, competition_name } per share.
  const shares = (await events()).filter(e => e.name === 'share_competition');
  expect(shares).toEqual([
    { name: 'share_competition', params: { competition_id: ID.live, competition_name: c.name } },
    { name: 'share_competition', params: { competition_id: ID.live, competition_name: c.name } },
  ]);
});

test('shell.c18 — changing tab logs competition_page_tab_pressed with fish\'s tab ids; the current tab logs nothing', async ({ page }) => {
  const events = await collectEvents(page);
  const c = core.get(ID.completed)!;
  await open(page, ID.completed, DESKTOP);
  await settle(page);
  const tabs = page.getByRole('navigation', { name: 'Secțiunile concursului' });
  await tabs.getByRole('link', { name: /^Clasament/ }).click(); // the current tab
  await tabs.getByRole('link', { name: /^Extra Cântare/ }).click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${ID.completed}/extra-cantare$`));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await settle(page);
  await page.getByRole('navigation', { name: 'Secțiunile concursului' }).getByRole('link', { name: /^Informații/ }).click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${ID.completed}/informatii$`));
  await expect
    .poll(async () => (await events()).filter(e => e.name === 'competition_page_tab_pressed').map(e => e.params))
    .toEqual([
      { competition_id: ID.completed, competition_name: c.name, tab_id: 'extracantare' },
      { competition_id: ID.completed, competition_name: c.name, tab_id: 'informatii' },
    ]);
});

test('shell.c27 b.publish-redirect — ?fromPublish=1 plays a one-shot confetti that never blocks input, and the param is dropped', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const res = await page.goto(`${path(ID.live)}?fromPublish=1`, { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  const confetti = page.locator('[data-publish-confetti]');
  await expect(confetti).toBeAttached({ timeout: 45_000 });
  await expect(page).toHaveURL(new RegExp(`/concursuri/${ID.live}$`));
  // Over the page, click-through and hidden from assistive tech.
  expect(await confetti.evaluate(e => getComputedStyle(e).pointerEvents)).toBe('none');
  await expect(confetti).toHaveAttribute('aria-hidden', 'true');
  await expect(followersPill(page)).toBeVisible();
  await followersPill(page).click();
  await expect(page.getByRole('dialog', { name: 'Urmăritori' })).toBeVisible();
  // One shot: it goes away by itself.
  await expect(confetti).toHaveCount(0, { timeout: 10_000 });
});

test('shell.c27 — reduced motion: no confetti, the param still dropped; without the param nothing plays', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize(PHONE);
  await page.goto(`${path(ID.live)}?fromPublish=1`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(new RegExp(`/concursuri/${ID.live}$`), { timeout: 45_000 });
  await expect(page.locator('[data-publish-confetti]')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page, ID.live);
  await settle(page);
  await expect(page.locator('[data-publish-confetti]')).toHaveCount(0);
});

test('shell.c22 — the phone back control returns to the previous page', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.goto(path(ID.completed), { waitUntil: 'domcontentloaded' });
  await settle(page); // hydrated: the chip's handler is attached
  await page.getByRole('button', { name: 'Înapoi' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('shell.c28 — on Clasament the phone action bar replaces «Acțiuni»', async ({ page }) => {
  await open(page, ID.live);
  await expect(page.getByRole('navigation', { name: 'Acțiuni concurs' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Acțiuni', exact: true })).toHaveCount(0);
});

// A soft 404 (not-found.tsx: loading.tsx commits the 200 first; ROADMAP §8 «Production 404s»).
test('shell «unknown id» — the T3 not-found card, noindex', async ({ page }) => {
  const res = await page.goto('/concursuri/nu-exista-0000', { waitUntil: 'domcontentloaded' });
  expect([200, 404]).toContain(res?.status());
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1, name: 'Concursul nu a fost găsit' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mergi la Acasă' })).toHaveAttribute('href', '/');
});

/* ------------------------------------------------------------------ */
/* competition-page.clasament                                          */
/* ------------------------------------------------------------------ */

// Every ranking type of the local CMS now renders (feeder legs and the club rankings too:
// concurs-clasamente.spec.ts); the unknown-type path (load.ts `unsupported`) has no local data —
// verified in code. Set E2E_COMPETITION_UNKNOWN_TYPE to a competition of a newer type to run it.
const UNKNOWN_TYPE = process.env.E2E_COMPETITION_UNKNOWN_TYPE;
test('clasament.c2 — a ranking type the web cannot render says so instead of a table', async ({ page }) => {
  test.skip(!UNKNOWN_TYPE, 'no local competition of a ranking type core does not know');
  await open(page, UNKNOWN_TYPE!, DESKTOP);
  await expect(page.getByText('Clasamentul acestui tip de concurs nu este încă disponibil pe web.')).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Vederi clasament' })).toHaveCount(0);
});

test('clasament.c4 c5 — the views are a tablist with arrow keys; switching refetches that view', async ({ page, context }) => {
  // Signed in: the weighings summary behind «Cântare» is a signed-in read.
  await signIn(context, jwt);
  await open(page, ID.live, DESKTOP);
  await settle(page);
  const rankings = track(page, /\/competitions\/[^/]+\/ranking$/);
  const weighings = track(page, /\/weighings-summary/);
  const tablist = visible(page.getByRole('tablist', { name: 'Vederi clasament' }));
  await tablist.getByRole('tab', { name: /Clasament/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(tablist.getByRole('tab', { selected: true })).toContainText('Cântare');
  await expect(tablist.getByRole('tab', { name: /Cântare/ })).toBeFocused();
  await expect.poll(() => weighings.length).toBeGreaterThan(0);
  await page.keyboard.press('ArrowLeft');
  await expect(tablist.getByRole('tab', { selected: true })).toContainText('Clasament');
  await expect.poll(() => rankings.length).toBeGreaterThan(0);
});

test('clasament.c6 — coming back to the tab after a while refetches the ranking', async ({ page }) => {
  await page.clock.install();
  await open(page, ID.live, DESKTOP);
  await settle(page);
  const rankings = track(page, /\/competitions\/[^/]+\/ranking$/);
  await page.clock.fastForward(31_000);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(() => rankings.length).toBeGreaterThan(0);
});

const COLUMNS: [keyof typeof ID, string, RegExp[]][] = [
  ['live', 'c7', [/^Stand$/, /^Participant$/, /^C\.M\.M\.C$/, /^Cantitate$/, /^Nr\. Buc$/, /^Puncte cantitate$/, /^Poziție sector$/, /^Poziție generală$/]],
  ['quality', 'c8', [/^Stand$/, /^Participant$/, /^1$/, /^2$/, /\d/, /\d/, /\d/, /\d/, /\d/, /^Calitate$/, /^Nr\. Buc$/, /^Poziție sector$/, /^Poziție generală$/]],
  [
    'quantityQuality',
    'c9',
    [/^Stand$/, /^Participant$/, /^1$/, /^2$/, /\d/, /\d/, /\d/, /^Calitate$/, /^Cantitate$/, /^Nr\. Buc$/, /^Puncte calitate$/, /^Puncte cantitate$/, /^Puncte total$/, /^Poziție sector$/, /^Poziție generală$/],
  ],
  ['bestOf', 'c10', [/^Stand$/, /^Participant$/, /^Nr buc\.$/, /^1$/, /^2$/, /^Medie \(kg\)$/, /^Poziție generală$/]],
  ['bestOfTiers', 'c11', [/^Stand$/, /^Participant$/, /^1$/, /^2$/, /^3$/, /^Nr\. Buc$/, /^Best 3$/, /^Best 5$/, /^Best 7$/, /^Best 9$/, /^Poziție generală$/]],
  [
    'cmmc',
    'c13',
    [/^Stand$/, /^Participant$/, /^1$/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /^Calitate$/, /^Cantitate$/, /^C\.M\.M\.C$/, /^Nr\. Buc$/, /^Pct\. Cal\.$/, /^Pct\. Cant\.$/, /^Pct\. CMMC$/, /^Puncte total$/, /^Poziție sector$/, /^Poziție generală$/],
  ],
];
// fish getTableColumns: the builders' titles and order, as they are (CompetitionRankingTable).
for (const [key, criterion, titles] of COLUMNS) {
  test(`competition-page.clasament.${criterion} — ${key} columns in fish order, in the inline table and in «Clasament complet»`, async ({ page }) => {
    await open(page, ID[key], DESKTOP);
    await expect(grid(page).locator('thead th')).toHaveText(titles);
    await visible(page.getByRole('button', { name: 'Clasament complet' })).click();
    await expect(page.getByRole('region', { name: 'Clasament complet' }).locator('thead th')).toHaveText(titles);
  });
}

/** Answers the browser's ranking reads with `edit(real ranking)`, then makes the page re-read (a focus after 30 s, clasament.c6). */
async function fakeRanking(page: Page, id: string, edit: (ranking: { metadata: Record<string, unknown>; rankings: Record<string, unknown>[] }) => void, viewport = DESKTOP) {
  const real = await (await page.request.get(`/api/cms/competitions/${id}/ranking`)).json();
  edit(real);
  await page.route(new RegExp(`/api/cms/competitions/${id}/ranking(\\?|$)`), route => route.fulfill({ json: real }));
  await page.clock.install({ time: new Date() });
  await open(page, id, viewport);
  await settle(page);
  await page.clock.runFor(31_000);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

test('competition-page.clasament.c12 — calitateCalitate columns in fish order (no local competition of the type: its ranking answered through the proxy)', async ({ page }) => {
  await fakeRanking(page, ID.cmmc, r => {
    r.metadata.rankingType = 'calitateCalitate';
    // The calitateCalitate row's own points (the CMMC rows carry calitate / cmmc points).
    for (const row of r.rankings) {
      row.quality1Points = row.calitatePoints ?? 0;
      row.quality2Points = row.cmmcPoints ?? 0;
      row.quality2 = row.biggestFish ?? 0;
      row.hasGrid = false;
    }
  });
  await expect(grid(page).locator('thead th')).toHaveText(
    [/^Stand$/, /^Participant$/, /^1$/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /\d/, /^Calitate 1$/, /^C\.M\.M\.C$/, /^Nr\. Buc$/, /^Puncte Cal\. 1$/, /^Puncte Cal\. 2$/, /^Puncte total$/, /^Poziție sector$/, /^Poziție generală$/],
    { timeout: 15_000 },
  );
});

test('competition-page.clasament.c14 competition-page.clasament.c15 competition-page.clasament.c17 competition-page.clasament.c18 — the cells: stand + sector edge, the name, three-decimal weights, the winner pill (no fill under text)', async ({ page }) => {
  await open(page, ID.cmmc, DESKTOP);
  const rows = grid(page).locator('tbody tr');
  const first = rows.first();
  // c14: the Stand cell reads the sector and the stand (spoken «Sector A, stand 1»), the name is the row header.
  await expect(first.locator('td').first()).toHaveText('Sector A, stand 1A1');
  await expect(first.locator('th[scope=row]')).toHaveText('Andrew R');
  // c15: weights with three decimals (decimal comma), «–» for no value.
  await expect(first.locator('td').nth(1)).toHaveText(/^\d+,\d{3}$/);
  await expect(rows.filter({ hasText: 'Cucu' }).locator('td').nth(1)).toHaveText('–');
  // c17: the sector is the 4px edge on the Stand cell; no cell of the row is tinted with it.
  const edge = first.locator('td').first().locator('span[aria-hidden]').first();
  expect((await edge.boundingBox())!.width).toBeCloseTo(4, 0);
  const sectorColor = await edge.evaluate(e => getComputedStyle(e).backgroundColor);
  expect(sectorColor).not.toBe('rgba(0, 0, 0, 0)');
  for (const cell of await first.locator('td, th').all()) {
    expect(await cell.evaluate(e => getComputedStyle(e).backgroundColor)).not.toBe(sectorColor);
  }
  // c18: winners (generalPosition ≤ numberOfSectors = 3) carry the place pill, the others a plain number.
  const place = (name: string) => rows.filter({ hasText: name }).locator('td').last();
  await expect(place('Andrew R')).toContainText('câștigător');
  await expect(place('Cici')).toContainText('câștigător');
  await expect(place('Bubu')).not.toContainText('câștigător');
  await expectNoA11yViolations(page);
});

test('competition-page.clasament.c19 — the competition’s biggest catch is gold with bold dark text, on the phone too', async ({ page }) => {
  await open(page, ID.cmmc, DESKTOP);
  const biggest = grid(page).locator('td[data-biggest]');
  await expect(biggest).toHaveCount(1);
  await expect(biggest).toHaveText('Cea mai mare captură: 29,000');
  await expect(biggest).toHaveClass(/bg-medal-gold/);
  expect(Number(await biggest.evaluate(e => getComputedStyle(e).fontWeight))).toBeGreaterThanOrEqual(700);
  await expect(page.getByRole('list', { name: 'Legendă' })).toContainText('C.M.M.C a concursului');
  await page.setViewportSize(PHONE);
  const mark = phoneList(page).locator('.bg-medal-gold');
  await expect(mark).toHaveCount(1);
  await expect(mark).toHaveText('Cea mai mare captură: CMMC 29,000');
});

test('competition-page.clasament.c11 — bestOfTiers: the Best-N block is one indigo band (deeper on winner rows), the won cell solid green, bold', async ({ page }) => {
  await open(page, ID.bestOfTiers, DESKTOP);
  const table = grid(page);
  await expect(table.locator('thead th.bg-indigo-4')).toHaveText([/^Best 3$/, /^Best 5$/, /^Best 7$/, /^Best 9$/]);
  const won = table.locator('td[data-tier-win]').first();
  await expect(won).toHaveClass(/bg-success/);
  expect(Number(await won.evaluate(e => getComputedStyle(e).fontWeight))).toBeGreaterThanOrEqual(700);
  await expect(table.locator('td.bg-accent-tint-2, td.bg-accent-tint-3').first()).toBeVisible();
});

test('competition-page.clasament.c23 — one penalty marker per row beside the name: yellow «Echipa are penalizări», red «Echipa este eliminată» (an ELIMINATE answered through the proxy)', async ({ page }) => {
  await fakeRanking(
    page,
    ID.live,
    r => {
      const b = r.rankings.find(x => x.standName === 'B1')!;
      b.penalties = [
        { documentId: 'pen-e2e-1', action: 'WARNING', value: null, reason: 'avertisment', createdAt: '2026-09-10T08:00:00.000Z' },
        { documentId: 'pen-e2e-2', action: 'ELIMINATE', value: null, reason: 'fraudă', createdAt: '2026-09-10T08:01:00.000Z' },
      ];
    },
    PHONE,
  );
  const list = phoneList(page);
  const a1 = list.getByRole('listitem').filter({ hasText: 'A · Stand 1 ·' });
  await expect(list.getByRole('img', { name: 'Echipa are penalizări' })).toHaveCount(1, { timeout: 15_000 });
  await expect(a1.getByRole('img', { name: 'Echipa are penalizări' })).toHaveAttribute('title', /nadă în exces/);
  // Two penalties, one of them ELIMINATE: one red marker, not one per penalty.
  await expect(list.getByRole('img', { name: 'Echipa este eliminată' })).toHaveCount(1);
  await page.setViewportSize(DESKTOP);
  await expect(grid(page).getByRole('img', { name: 'Echipa este eliminată' })).toHaveCount(1);
  await expect(grid(page).getByRole('img', { name: 'Echipa are penalizări' })).toHaveCount(1);
});

test('competition-page.clasament.c16 — the phone list opens in stand order; Sortare → Poziția în clasament orders by place', async ({ page }) => {
  await open(page, ID.live);
  const items = phoneList(page).getByRole('listitem');
  await expect(items.first()).toBeVisible();
  const stands = (await items.locator('p.t-caption').allTextContents()).map(t => {
    const m = /^Sector ([A-X]) · Stand (\d+)/.exec(t);
    expect(m, t).not.toBeNull();
    return [m![1], Number(m![2])] as const;
  });
  expect(stands).toEqual([...stands].sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1]));

  await page.getByRole('button', { name: 'Sortare clasament' }).click();
  await page.getByRole('navigation', { name: 'Sortare clasament' }).getByRole('button', { name: 'Poziția în clasament' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Sortarea clasamentului după poziția în clasament a fost efectuată.' })).toHaveCount(1);
  // The place pill: «Locul » (sr-only) then the number.
  const places = (await items.evaluateAll(lis => lis.map(li => li.querySelector('.sr-only')?.parentElement?.textContent ?? ''))).map(t =>
    Number(t.replace(/[^\d]/g, '')),
  );
  expect(places.length).toBeGreaterThan(1);
  expect(places).toEqual([...places].sort((a, b) => a - b));
});

test('competition-page.clasament.c22 — in «Tot ecranul» on the phone the Stand column stays while the others scroll', async ({ page }) => {
  await open(page, ID.quality);
  await page.getByRole('button', { name: 'Vezi clasamentul pe tot ecranul' }).click();
  const table = page.getByRole('region', { name: 'Clasament complet' });
  await expect(table.locator('tbody tr').first()).toBeVisible();
  const stand = table.locator('tbody tr').first().locator('td').first();
  await expect(stand).toHaveCSS('position', 'sticky');
  const before = (await stand.boundingBox())!.x;
  await table.evaluate(r => (r.scrollLeft = 300));
  await expect.poll(() => table.evaluate(r => r.scrollLeft)).toBeGreaterThan(0);
  expect(Math.abs((await stand.boundingBox())!.x - before)).toBeLessThan(1);
});

test('competition-page.clasament.c21 — catch cells past the sector minimum are grey and empty', async ({ page }) => {
  await open(page, ID.quality, DESKTOP);
  const cell = grid(page).locator('td[aria-label="nu se punctează"]').first();
  await expect(cell).toHaveText('');
  const bg = await cell.evaluate(e => getComputedStyle(e).backgroundColor);
  const row = await cell.evaluate(e => getComputedStyle(e.previousElementSibling!).backgroundColor);
  expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  expect(bg).not.toBe(row);
  expect(await cell.evaluate(e => getComputedStyle(e, '::after').content)).toBe('none');
});

test('competition-page.clasament.c16 — from 768 the table opens by stand too (sector A→Z, then stand number); «Poziție generală» orders by place (fish Sortare)', async ({ page }) => {
  await open(page, ID.live, DESKTOP);
  const table = grid(page);
  await expect(table.locator('thead th').first()).toHaveAttribute('aria-sort', 'ascending');
  const stands = await table.locator('tbody tr td:first-child .sr-only').allTextContents();
  const parsed = stands.map(t => /Sector ([A-X]), stand [A-X]?(\d+)/.exec(t)!).map(m => [m[1], Number(m[2])] as const);
  expect(parsed).toEqual([...parsed].sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1]));
  const placeHead = table.locator('thead th').last();
  await expect(async () => {
    await placeHead.getByRole('button').click();
    await expect(placeHead).toHaveAttribute('aria-sort', 'ascending', { timeout: 1000 });
  }).toPass();
  const places = (await table.locator('tbody tr td:last-child').allInnerTexts()).map(t => Number(t.replace(/\D/g, '')));
  expect(places).toEqual([...places].sort((a, b) => a - b));
});

test('clasament.c25 — a ranking with no rows says «Nu există date de afișat»', async ({ page }) => {
  await open(page, ID.liveEmpty);
  await expect(page.getByText('Nu există date de afișat')).toBeVisible();
});
