import { expectNoA11yViolations } from './helpers/a11y';
import { CMS, qaJwt, signIn } from './helpers/session';
import { expect, test, type ConsoleMessage, type Locator, type Page, type Request } from '@playwright/test';

/*
 * Concurs · the route tabs (template T3) — parity docs/parity/areas/competition-page.yml, screens
 * competition-page.informatii, .participanti, .extra-cantare, .regulament. Each test names the
 * criterion / state ids it covers. Local CMS on :1337, QA user «Sim QA» (author of the upcoming
 * «SIM3 Cupa C&B Ed 8»). States the local data does not have (a long description, no contact, a
 * request still «new») are served signed in, where the browser re-reads the core / the list: the
 * response is replaced with page.route. Override the ids with E2E_TABS_* when the local data moves.
 */

const ID = {
  /** completed bestOf 15, fee 1500, description + reward + regulation, 2 species. */
  rich: process.env.E2E_TABS_RICH ?? 'r4pofq9vbn7vufsw37wxrsu6',
  /** notStarted team (Echipe de 3), 2 referees, a lake contact, 1 team of 3 users, no stand. */
  contacts: process.env.E2E_TABS_CONTACTS ?? 'u9kd3xs4n91j2ktah78ke73q',
  /** completed fipsed team, banner, one sponsor, 99 registrations. */
  sponsors: process.env.E2E_TABS_SPONSORS ?? 'vdsjq8ulsmwnr2b77j6q3jp4',
  /** completed, banner, one referee. */
  banner: process.env.E2E_TABS_BANNER ?? 'k646t4o4x3wadzqxn1yqf49l',
  /** completed individual, 24 users on stands A1…X1. */
  individuals: process.env.E2E_TABS_INDIVIDUALS ?? 'k5c9427518736c92684018b9',
  /** completed individual: guests + users, 1 rejected; two done extra-scale requests. */
  guests: process.env.E2E_TABS_GUESTS ?? 'i8kzbi5k51vmbyq75dmyez3d',
  /** completed team of users (Nada Grea…). */
  teams: process.env.E2E_TABS_TEAMS ?? 'g5l98otx5ypg6wttowra9yww',
  /** notStarted, QA user is its author, 20 guest teams. */
  own: process.env.E2E_TABS_OWN ?? 'a6xjl65ooe9eadrtvvqj9hn1',
  /** completed (prerendered), QA user is its author, 6 approved registrations. */
  ownDone: process.env.E2E_TABS_OWN_DONE ?? 'bi9ptgcag7nbakrglxh16vx4',
  /** notStarted, no registrations. */
  empty: process.env.E2E_TABS_EMPTY ?? 'ld4l9nzlczisz2yexad8fm6p',
  /** completed, no regulation, no extra-scale request. */
  plain: process.env.E2E_TABS_PLAIN ?? 'uxxie29m6820wrpdv45w0m7q',
  /** started, no extra-scale request. */
  live: process.env.E2E_TABS_LIVE ?? 'kee49a3e64b3f636b4b60daa',
};

const PHONE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const LAPTOP = { width: 1280, height: 900 };
const DESKTOP = { width: 1440, height: 900 };

type Core = Record<string, unknown> & {
  documentId: string;
  name: string;
  competitionStatus: string;
  competitionType: string;
  registrations: { registrationStatus: string; stand: { name: string } | null; participants: { documentId: string; username: string }[]; teamName: string | null; guestName: string | null }[];
};
const core = new Map<string, Core>();
let jwt = '';

test.describe.configure({ timeout: 180_000 });

test.beforeAll(async ({ request }) => {
  for (const id of Object.values(ID)) {
    const res = await request.get(`${CMS}/feed/competitions/${id}`);
    expect(res.ok(), `competition ${id} exists in the local CMS`).toBeTruthy();
    core.set(id, (await res.json()).data);
  }
  jwt = await qaJwt(request);
});

const visible = (l: Locator) => l.locator('visible=true').first();
const settle = (page: Page) => page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
  return errors;
}

function track(page: Page, pattern: RegExp, method?: string) {
  const seen: Request[] = [];
  page.on('request', r => {
    if (pattern.test(r.url()) && (!method || r.method() === method)) seen.push(r);
  });
  return seen;
}

/** Layout-shift observer from the first paint (CLS without recent input). */
async function probeShifts(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver(list => {
      for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
        if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  return () => page.evaluate(() => (window as unknown as { __cls: number }).__cls);
}

async function open(page: Page, path: string, viewport = PHONE) {
  await page.setViewportSize(viewport);
  const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

/**
 * A route tab's skeleton as a reader sees it: from the page's Clasament, the tab is opened over a
 * slow network (the browser's own throttling), so the server's stream shows the tab's loading UI
 * for seconds before the rest arrives. Resolves once the tab's bones are on screen; `release`
 * lifts the throttling.
 */
async function holdTabSkeleton(page: Page, id: string, segment: string, label: string, viewport = DESKTOP, from = `/concursuri/${id}`) {
  await open(page, from, viewport);
  await settle(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: 4000, uploadThroughput: -1 });
  await page.getByRole('navigation', { name: 'Secțiunile concursului' }).getByRole('link', { name: new RegExp(`^${label}`) }).click();
  const key = segment === 'extra-cantare' ? 'extraCantare' : segment;
  await expect(page.locator(`[data-skeleton-tab="${key}"] [data-bone]`).locator('visible=true').first()).toBeVisible({ timeout: 45_000 });
  return () => cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
}

/** The visible bones of a kind inside a tab's skeleton. */
const bonesOf = (page: Page, tab: string, kind: string) => page.locator(`[data-skeleton-tab="${tab}"] [data-bone="${kind}"]`).locator('visible=true');

/** Signed in, the browser re-reads the core: serve it changed by `patch`. */
async function patchCore(page: Page, id: string, patch: Record<string, unknown>) {
  const data = { ...core.get(id)!, ...patch };
  await page.route(new RegExp(`/api/cms/feed/competitions/${id}(\\?|$)`), route => route.fulfill({ json: { data, meta: {} } }));
}

const TABS = [
  ['informatii', 'Informații'],
  ['participanti', 'Participanți'],
  ['extra-cantare', 'Extra Cântare'],
  ['regulament', 'Regulament'],
] as const;

/* ------------------------------------------------------------------ */
/* Smoke: every tab at the four widths, signed out and in, axe          */
/* ------------------------------------------------------------------ */

for (const [segment, label] of TABS) {
  for (const signedIn of [false, true]) {
    // Every width signed out; signed in, the phone and the widest (the per-viewer parts only).
    for (const vp of signedIn ? [PHONE, DESKTOP] : [PHONE, TABLET, LAPTOP, DESKTOP]) {
      test(`smoke /${segment} · ${vp.width}px · ${signedIn ? 'signed in' : 'signed out'} — competition-page.shell.c17, axe, no console errors`, async ({ page, context }) => {
        if (signedIn) await signIn(context, jwt);
        const errors = collectConsoleErrors(page);
        const id = segment === 'extra-cantare' ? ID.guests : segment === 'participanti' ? ID.teams : ID.rich;
        await open(page, `/concursuri/${id}/${segment}`, vp);
        const nav = page.getByRole('navigation', { name: 'Secțiunile concursului' });
        await expect(nav.locator('[aria-current="page"]')).toHaveText(new RegExp(`^${label}`));
        // Every tab is a link now (no «curând»).
        await expect(nav.getByRole('link')).toHaveCount(5);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/concursuri/${id}/${segment}$`));
        await expect(page).toHaveTitle(new RegExp(`^${label} · `));
        await settle(page);
        await expectNoA11yViolations(page);
        expect(errors, errors.join('\n')).toEqual([]);
      });
    }
  }
}

test('competition-page.b.tab-deep-links — the tab strip navigates between the tab pages', async ({ page }) => {
  await open(page, `/concursuri/${ID.rich}`, DESKTOP);
  const nav = page.getByRole('navigation', { name: 'Secțiunile concursului' });
  for (const [segment, label] of TABS) {
    await nav.getByRole('link', { name: new RegExp(`^${label}`) }).click();
    await expect(page).toHaveURL(new RegExp(`/concursuri/${ID.rich}/${segment}$`));
    await expect(nav.locator('[aria-current="page"]')).toHaveText(new RegExp(`^${label}`));
  }
  await nav.getByRole('link', { name: /^Clasament/ }).click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${ID.rich}$`));
});

/* ------------------------------------------------------------------ */
/* competition-page.informatii                                         */
/* ------------------------------------------------------------------ */

const info = (id: string) => `/concursuri/${id}/informatii`;

for (const vp of [PHONE, DESKTOP]) {
  test(`competition-page.informatii.c1 competition-page.informatii.s1 — the tab’s skeleton has the loaded tab’s shape (facts left / tiles, Durata, contact) (${vp.width}px)`, async ({ page }) => {
    const release = await holdTabSkeleton(page, ID.rich, 'informatii', 'Informații', vp);
    await expect(bonesOf(page, 'informatii', 'durata')).toHaveCount(1);
    if (vp === DESKTOP) {
      // ≥1280: the three columns — Detalii on the left, the contact card on the right; no tiles.
      await expect(bonesOf(page, 'informatii', 'facts-aside')).toHaveCount(1);
      await expect(bonesOf(page, 'informatii', 'contact')).toHaveCount(1);
      await expect(bonesOf(page, 'informatii', 'fact')).toHaveCount(0);
    } else {
      // Below 1280 the four fact tiles in the centre, no left column.
      await expect(bonesOf(page, 'informatii', 'fact')).toHaveCount(4);
      await expect(bonesOf(page, 'informatii', 'facts-aside')).toHaveCount(0);
    }
    await release();
    await expect(page.getByRole('region', { name: /^Durata concursului/ })).toBeVisible();
  });
}

test(`competition-page.informatii.c4 competition-page.informatii.c5 competition-page.informatii.c8 competition-page.informatii.c9 competition-page.informatii.s2 competition-page.informatii.s3 — fee, type badges, species (fish glyphs), prizes`, async ({ page }) => {
  await open(page, info(ID.rich), DESKTOP);
  const left = page.getByRole('complementary', { name: 'Detalii' });
  await expect(left.getByText('Taxă de înscriere')).toBeVisible();
  await expect(left.getByText('1500 lei')).toBeVisible();
  await expect(left.getByText('Tipul de concurs')).toBeVisible();
  await expect(left.getByText('Best of 15')).toBeVisible();
  await expect(left.getByText('Tipul de participare')).toBeVisible();
  await expect(left.getByText('Individual', { exact: true })).toBeVisible();
  const species = page.getByRole('list', { name: 'Pești de prins' });
  await expect(species.getByRole('listitem')).toHaveText(['Crap', 'Crap Oglinda']);
  // fish's species artwork (the 1:1 glyph port) for a species that has one.
  await expect(species.locator('[data-fish-glyph]').first()).toBeAttached();
  await expect(page.getByRole('region', { name: 'Premii' })).toContainText('Premii');
  await expect(page.getByRole('region', { name: 'Descriere' })).toContainText('Descrierea');
});

test(`competition-page.informatii.c4 competition-page.informatii.c5 competition-page.informatii.c6 competition-page.informatii.s3 — free entry, «Echipe de 3», «Echipe înscrise 1 / 10» opens Participanți`, async ({ page }) => {
  await open(page, info(ID.contacts), PHONE);
  await expect(visible(page.getByText('Intrare gratuită'))).toBeVisible();
  await expect(visible(page.getByText('Echipe de 3'))).toBeVisible();
  await expect(visible(page.getByText('Echipe înscrise'))).toBeVisible();
  const row = visible(page.getByRole('link', { name: /1 \/ 10/ }));
  await expect(row).toBeVisible();
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${ID.contacts}/participanti$`));
});

test(`competition-page.informatii.c6 competition-page.informatii.s4 — «(N în așteptare)» only before the start; limit 21 when none`, async ({ page, context }) => {
  await signIn(context, jwt);
  const c = core.get(ID.contacts)!;
  const pending = { ...c.registrations[0], documentId: 'p1', registrationStatus: 'pending' };
  await patchCore(page, ID.contacts, { participantsLimit: null, registrations: [...c.registrations, pending, { ...pending, documentId: 'p2' }] });
  await open(page, info(ID.contacts), DESKTOP);
  const left = page.getByRole('complementary', { name: 'Detalii' });
  await expect(left.getByText('2 în așteptare')).toBeVisible();
  await expect(left.getByText('1 / 21')).toBeVisible();
});

test(`competition-page.informatii.c7 competition-page.informatii.s4 — duration («51 de ore»), the meter and the start / end markers in sentence case`, async ({ page }) => {
  await open(page, info(ID.rich), DESKTOP);
  // 15 May 17:17 → 17 May 20:17 (Bucharest): 51 hours; completed → 100%.
  // Romanian agreement: «51 de ore» (fish: «51 ore»).
  await expect(page.getByRole('heading', { name: 'Durata concursului (51 de ore)' })).toBeVisible();
  const bar = page.getByRole('progressbar', { name: 'Timp scurs din concurs' });
  await expect(bar).toHaveAttribute('aria-valuenow', '100');
  // Sentence case (no all-caps): the full day from 768.
  await expect(page.getByText('vineri, 15 mai 2026')).toBeVisible();
  await expect(page.getByText('17:17', { exact: true })).toBeVisible();
  await expect(page.getByText('duminică, 17 mai 2026')).toBeVisible();
  await expect(page.getByText('20:17', { exact: true })).toBeVisible();
  // The bar's ends line up with the start / end markers.
  const track = (await bar.boundingBox())!;
  const startMark = (await page.getByText('17:17', { exact: true }).boundingBox())!;
  const endMark = (await page.getByText('20:17', { exact: true }).boundingBox())!;
  expect(Math.abs(startMark.x - track.x)).toBeLessThan(2);
  expect(Math.abs(endMark.x + endMark.width - (track.x + track.width))).toBeLessThan(2);

  // The phone: the short day, still sentence case.
  await open(page, info(ID.rich), PHONE);
  await expect(page.getByText('vin, 15 mai 2026')).toBeVisible();

  await open(page, info(ID.contacts), DESKTOP);
  await expect(page.getByRole('progressbar', { name: 'Timp scurs din concurs' })).toHaveAttribute('aria-valuenow', '0');
});

test(`competition-page.informatii.c7 competition-page.informatii.s4 — running: the elapsed share`, async ({ page, context }) => {
  await signIn(context, jwt);
  const start = new Date(Date.now() - 60 * 60_000).toISOString();
  const end = new Date(Date.now() + 3 * 60 * 60_000).toISOString();
  await patchCore(page, ID.rich, { competitionStatus: 'started', startDate: start, endDate: end });
  await open(page, info(ID.rich), DESKTOP);
  await expect(page.getByRole('progressbar', { name: 'Timp scurs din concurs' })).toHaveAttribute('aria-valuenow', '25');
});

test(`competition-page.informatii.c10 competition-page.informatii.s2 — contact: organiser, «Arbitri», the lake contact, tel: links`, async ({ page }) => {
  await open(page, info(ID.contacts), DESKTOP);
  // The right column's card: an h3 after the centre's h2s, its groups h4s.
  const contact = page.getByRole('complementary', { name: 'Contact și sponsori' });
  await expect(contact.getByRole('heading', { name: 'Contact', level: 3 })).toBeVisible();
  await expect(contact.getByRole('heading', { name: 'Organizator Concurs', level: 4 })).toBeVisible();
  await expect(contact.getByRole('heading', { name: 'Arbitri' })).toBeVisible();
  await expect(contact.getByRole('heading', { name: 'Rezervări' })).toBeVisible();
  await expect(contact.getByRole('link', { name: 'Sună pe Andrew R: 0725356639' })).toHaveAttribute('href', 'tel:0725356639');
  await expect(contact.getByRole('link', { name: 'Sună pe Andrei Popescu: 0712345678' })).toHaveAttribute('href', 'tel:0712345678');
  await expect(contact.getByRole('link', { name: 'Sună pe Administrator: 0744123456' })).toHaveAttribute('href', 'tel:0744123456');

  // One referee: «Arbitru».
  await open(page, info(ID.banner), DESKTOP);
  await expect(page.getByRole('complementary', { name: 'Contact și sponsori' }).getByRole('heading', { name: 'Arbitru', exact: true })).toBeVisible();
});

test(`competition-page.informatii.c10 competition-page.informatii.s5 — no phone: «–» (not a link); no contact at all: the empty line`, async ({ page, context }) => {
  await signIn(context, jwt);
  const c = core.get(ID.contacts)! as Core & { author: Record<string, unknown> };
  await patchCore(page, ID.contacts, { author: { ...c.author, phone: null }, referees: [], lake: { ...(c.lake as object), contact: [] } });
  await open(page, info(ID.contacts), DESKTOP);
  const contact = page.getByRole('complementary', { name: 'Contact și sponsori' });
  // The same dash as a missing name; read out as «fără telefon».
  await expect(contact.getByRole('listitem').first()).toContainText('–');
  await expect(contact.getByText('fără telefon')).toBeAttached();
  await expect(contact.getByRole('link')).toHaveCount(0);

  await page.unrouteAll();
  await patchCore(page, ID.contacts, { author: null, referees: [], lake: { ...(c.lake as object), contact: [] } });
  await page.reload();
  await expect(page.getByRole('complementary', { name: 'Contact și sponsori' }).getByText('Nu există date de contact pentru acest concurs.')).toBeVisible();
});

test(`competition-page.informatii.c11 competition-page.informatii.s2 — sponsors open the sponsor page; hidden when none`, async ({ page }) => {
  await open(page, info(ID.sponsors), DESKTOP);
  const aside = page.getByRole('complementary', { name: 'Contact și sponsori' });
  await expect(aside.getByRole('heading', { name: 'Sponsori', level: 3 })).toBeVisible();
  await expect(aside.getByRole('link', { name: 'Fipsed' })).toHaveAttribute('href', '/sponsori/o3f5zh1zwok74l5cib2924wi');
  await open(page, info(ID.rich), DESKTOP);
  await expect(page.getByRole('heading', { name: 'Sponsori' })).toHaveCount(0);
});

test(`competition-page.informatii.c2 competition-page.informatii.s2 — the banner first, never blown up past its own size; none without one`, async ({ page }) => {
  const img = (p: Page) => p.getByRole('img', { name: /^Afișul concursului/ });
  // A large banner (1024×652): full width on the phone, at its own ratio (fish).
  await open(page, info(ID.sponsors), PHONE);
  await expect(img(page)).toBeVisible();
  expect((await img(page).boundingBox())!.width).toBeGreaterThan(300);
  // A logo-sized one (100×100): never blown up — at its own size at every width.
  for (const vp of [PHONE, TABLET, LAPTOP, DESKTOP]) {
    await open(page, info(ID.banner), vp);
    await expect(img(page)).toBeVisible();
    const box = (await img(page).boundingBox())!;
    expect(box.width, `${vp.width}px`).toBeLessThanOrEqual(100.5);
  }
  await open(page, info(ID.rich), PHONE);
  await expect(img(page)).toHaveCount(0);
});

for (const vp of [LAPTOP, DESKTOP]) {
  test(`competition-page.informatii.c2 competition-page.informatii.s2 — from 1280 the banner takes the centre column, no layout shift (${vp.width}px)`, async ({ page }) => {
    const cls = await probeShifts(page);
    await open(page, info(ID.sponsors), vp);
    await settle(page);
    const img = page.getByRole('img', { name: /^Afișul concursului/ });
    await expect(img).toBeVisible();
    const column = (await page.getByRole('region', { name: /^Durata concursului/ }).boundingBox())!;
    const stage = (await img.locator('xpath=..').boundingBox())!;
    expect(Math.abs(stage.width - column.width)).toBeLessThan(2);
    expect(await cls()).toBeLessThan(0.01);
  });
}

for (const vp of [PHONE, TABLET]) {
  test(`competition-page.informatii.c2 competition-page.informatii.c3 — below 1280 fish's order: banner, Descriere, Detalii, Durata (${vp.width}px)`, async ({ page }) => {
    await open(page, info(ID.banner), vp);
    const y = async (l: Locator) => (await visible(l).boundingBox())!.y;
    const banner = await y(page.getByRole('img', { name: /^Afișul concursului/ }));
    const description = await y(page.getByRole('region', { name: 'Descriere' }));
    const facts = await y(page.getByRole('heading', { name: 'Detalii' }));
    const duration = await y(page.getByRole('region', { name: /^Durata concursului/ }));
    expect(banner).toBeLessThan(description);
    expect(description).toBeLessThan(facts);
    expect(facts).toBeLessThan(duration);
  });
}

for (const vp of [PHONE, DESKTOP]) {
  test(`competition-page.informatii.c3 competition-page.informatii.c9 competition-page.informatii.s6 — a long description is clamped; «Vezi mai mult» opens it titled «Descriere» (${vp.width}px)`, async ({ page, context }) => {
    await signIn(context, jwt);
    const para = (n: number) => ({ type: 'paragraph', children: [{ type: 'text', text: `Paragraful ${n}: ${'regulile de pescuit și premiile '.repeat(6)}` }] });
    await patchCore(page, ID.rich, { description: Array.from({ length: 8 }, (_, i) => para(i + 1)), reward: [para(1)] });
    await open(page, info(ID.rich), vp);
    const section = page.getByRole('region', { name: 'Descriere' });
    await expect(section.getByText('Paragraful 8', { exact: false }).first()).toBeAttached();
    const more = section.getByRole('button', { name: /Vezi mai mult/ });
    await expect(more).toBeVisible();
    // The short reward is not clamped: no «Vezi mai mult» there.
    await expect(page.getByRole('region', { name: 'Premii' }).getByRole('button', { name: /Vezi mai mult/ })).toHaveCount(0);
    await more.click();
    const overlay = page.getByRole('dialog', { name: 'Descriere' });
    await expect(overlay).toBeVisible();
    await expect(overlay.getByText(/Paragraful 8/)).toBeVisible();
    // The page behind is inert under the modal (and faded by the scrim): scan the overlay, once its
    // opening fade has finished.
    await expect(overlay).toHaveCSS('opacity', '1');
    await expectNoA11yViolations(page, { include: 'dialog[open]' });
    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
  });
}

for (const vp of [PHONE, TABLET]) {
  test(`competition-page.informatii.c4 competition-page.informatii.c5 competition-page.informatii.c6 competition-page.informatii.s3 — the four fact tiles share one rhythm: values at the tile’s edge, labels on one baseline (${vp.width}px)`, async ({ page }) => {
    await open(page, info(ID.sponsors), vp);
    const tiles = page.getByRole('heading', { name: 'Detalii' }).locator('xpath=ancestor::section[1]').locator('dl > div');
    await expect(tiles).toHaveCount(4);
    const geo = await tiles.evaluateAll(els =>
      els.map(el => {
        const dt = el.querySelector('dt')!.getBoundingClientRect();
        const dd = el.querySelector('dd')!.getBoundingClientRect();
        const first = el.querySelector('dd')!.getBoundingClientRect();
        const tile = el.getBoundingClientRect();
        // No badge fill behind a value: plain text on the tile.
        const fills = [...el.querySelectorAll('dd *')].filter(n => getComputedStyle(n).backgroundColor !== 'rgba(0, 0, 0, 0)').length;
        return { tileX: tile.x, tileY: tile.y, ddX: first.x, ddH: dd.height, dtX: dt.x, dtTop: dt.top - tile.top, fills };
      }),
    );
    for (const g of geo) {
      expect(g.fills).toBe(0);
      // The value starts where its label starts (no badge padding).
      expect(Math.abs(g.ddX - g.dtX)).toBeLessThan(1);
    }
    // Every label sits the same distance under its value (no padded link box); one-line values
    // («1500 lei», «Echipe», «99 / 99») put their labels on one baseline.
    const under = geo.map(g => g.dtTop - g.ddH);
    expect(Math.max(...under) - Math.min(...under)).toBeLessThan(1);
    const oneLine = Math.min(...geo.map(g => g.ddH));
    const tops = geo.filter(g => g.ddH === oneLine).map(g => g.dtTop);
    expect(tops.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1);
    // The ranking type in the accent ink, the registrations a link to Participanți.
    await expect(tiles.nth(1).locator('dd .text-accent-ink')).toHaveText('Campionat Mondial FIPSed');
    await expect(tiles.nth(3).getByRole('link', { name: /99 \/ 99/ })).toHaveAttribute('href', `/concursuri/${ID.sponsors}/participanti`);
  });
}

test(`competition-page.informatii.c2 competition-page.informatii.s2 — a large banner: edge to edge on the phone, a card at its own ratio from 768 (no grey stage)`, async ({ page }) => {
  const img = page.getByRole('img', { name: /^Afișul concursului/ });
  await open(page, info(ID.sponsors), PHONE);
  let box = (await img.boundingBox())!;
  expect(box.x).toBe(0);
  expect(box.width).toBe(PHONE.width);
  expect(await img.evaluate(el => getComputedStyle(el).borderTopLeftRadius)).toBe('0px');
  // The first block sits 8px under the tabs, like every other gap of the phone body.
  const body = (await page.locator('[data-t3="body"]').boundingBox())!;
  expect(Math.round(box.y - body.y)).toBe(8);

  await open(page, info(ID.sponsors), TABLET);
  box = (await img.boundingBox())!;
  // 1024×652 at its own ratio, a rounded card with the e0 shadow — no letterbox bands.
  expect(Math.abs(box.height / box.width - 652 / 1024)).toBeLessThan(0.01);
  expect(await img.evaluate(el => getComputedStyle(el).borderTopLeftRadius)).not.toBe('0px');
  expect(await img.evaluate(el => getComputedStyle(el).boxShadow)).not.toBe('none');
});

test(`competition-page.informatii.c3 competition-page.informatii.s6 — a link in the clamped part of a long description: focusing it lifts the clamp (never a hidden focus)`, async ({ page, context }) => {
  await signIn(context, jwt);
  const para = (n: number) => ({ type: 'paragraph', children: [{ type: 'text', text: `Paragraful ${n}: ${'regulile de pescuit și premiile '.repeat(6)}` }] });
  const link = { type: 'paragraph', children: [{ type: 'link', url: 'https://bluvi.ro', children: [{ type: 'text', text: 'Regulamentul complet' }] }] };
  await patchCore(page, ID.rich, { description: [...Array.from({ length: 8 }, (_, i) => para(i + 1)), link] });
  await open(page, info(ID.rich), DESKTOP);
  const section = page.getByRole('region', { name: 'Descriere' });
  const more = section.getByRole('button', { name: /Vezi mai mult/ });
  await expect(more).toBeVisible();
  // Shift+Tab from «Vezi mai mult» lands on the last link of the clamped text.
  await more.focus();
  await page.keyboard.press('Shift+Tab');
  const target = section.getByRole('link', { name: 'Regulamentul complet' });
  await expect(target).toBeFocused();
  // The clamp lifted: the focused link lies inside its (now unclamped) text box, on screen.
  const text = section.locator('[id]').filter({ has: page.getByRole('link', { name: 'Regulamentul complet' }) }).first();
  await expect(text).toHaveCSS('max-height', 'none');
  const linkBox = (await target.boundingBox())!;
  const textBox = (await text.boundingBox())!;
  expect(linkBox.y + linkBox.height).toBeLessThanOrEqual(textBox.y + textBox.height + 1);
  await expect(target).toBeInViewport();
});

test(`competition-page.informatii.c12 — coming back after a while re-reads the competition and the statute`, async ({ page, context }) => {
  await signIn(context, jwt);
  await page.clock.install();
  await open(page, info(ID.rich), DESKTOP);
  await settle(page);
  const competition = track(page, new RegExp(`/feed/competitions/${ID.rich}(\\?|$)`));
  const statute = track(page, /\/statute$/);
  await page.clock.fastForward(31_000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => competition.length).toBeGreaterThan(0);
  await expect.poll(() => statute.length).toBeGreaterThan(0);
});

/* ------------------------------------------------------------------ */
/* competition-page.participanti                                       */
/* ------------------------------------------------------------------ */

const participants = (id: string) => `/concursuri/${id}/participanti`;
const cards = (page: Page) => page.getByRole('article');

test(`competition-page.participanti.c3 competition-page.participanti.c5 competition-page.participanti.s5 competition-page.participanti.s6 — approved only, by stand; «Stand X» / «Nealocat»; individual names`, async ({ page }) => {
  await open(page, participants(ID.individuals), DESKTOP);
  const c = core.get(ID.individuals)!;
  const approved = c.registrations.filter(r => r.registrationStatus === 'registered');
  await expect(cards(page)).toHaveCount(approved.length);
  const stands = await cards(page).evaluateAll(els => els.map(e => e.querySelector('span')?.textContent ?? ''));
  const expected = approved.map(r => `Stand ${r.stand!.name}`).sort((a, b) => a.localeCompare(b, 'ro', { numeric: true }));
  expect(stands).toEqual(expected);
  await expect(cards(page).first()).toContainText(approved.find(r => r.stand?.name === 'A1')!.participants[0].username);

  // A rejected registration is not listed.
  await open(page, participants(ID.guests), DESKTOP);
  const g = core.get(ID.guests)!;
  await expect(cards(page)).toHaveCount(g.registrations.filter(r => r.registrationStatus === 'registered').length);
});

test(`competition-page.participanti.c5 competition-page.participanti.s5 competition-page.participanti.s6 — a team: its name, the members under it, stacked faces; unallocated`, async ({ page }) => {
  await open(page, participants(ID.contacts), PHONE);
  const card = cards(page).first();
  await expect(card).toContainText('Nealocat');
  // No team name, no club: «–», with the members as the subtitle.
  await expect(card).toContainText('–');
  await expect(card).toContainText('Andrei Popescu, Andrew, Andrew R');
  await open(page, participants(ID.teams), PHONE);
  await expect(cards(page).first()).toContainText('Nada Grea');
});

test(`competition-page.participanti.c4 competition-page.participanti.s4 — no approved registrations`, async ({ page }) => {
  await open(page, participants(ID.empty), PHONE);
  await expect(page.getByText('Încă nu s-au înregistrat participanți pentru această competiție.')).toBeVisible();
  await expectNoA11yViolations(page);
});

test(`competition-page.participanti.c6 competition-page.participanti.c7 competition-page.participanti.s7 competition-page.participanti.s8 — signed out: the header toggles (no profile on the web yet), stats ask to sign in`, async ({ page }) => {
  const batch = track(page, /\/user\/statistics\/batch/);
  await open(page, participants(ID.individuals), PHONE);
  await settle(page);
  const card = cards(page).first();
  const toggle = card.getByRole('button', { name: /Arată detaliile/ });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(card.getByRole('button', { name: /Restrânge detaliile/ })).toHaveAttribute('aria-expanded', 'true');
  await expect(card.getByText('Trebuie să fii autentificat pentru a vedea statisticile pescarilor.')).toBeVisible();
  await expect(card.getByRole('link', { name: 'Intră în cont' })).toHaveAttribute('href', `/intra?next=${encodeURIComponent(participants(ID.individuals))}`);
  // c9: signed out the batch is never asked for.
  expect(batch).toHaveLength(0);
  // Keyboard: Enter folds it again.
  await card.getByRole('button', { name: /Restrânge detaliile/ }).focus();
  await page.keyboard.press('Enter');
  await expect(card.getByRole('button', { name: /Arată detaliile/ })).toHaveAttribute('aria-expanded', 'false');
});

test(`competition-page.participanti.c8 competition-page.participanti.c9 competition-page.participanti.s7 — signed in: one batch for every approved participant; Capturi / CMMC / Concursuri`, async ({ page, context }) => {
  await signIn(context, jwt);
  const batch = track(page, /\/user\/statistics\/batch/, 'POST');
  await open(page, participants(ID.individuals), DESKTOP);
  await settle(page);
  expect(batch).toHaveLength(1);
  const sent = (batch[0].postDataJSON() as { documentIds: string[] }).documentIds;
  const c = core.get(ID.individuals)!;
  const ids = [...new Set(c.registrations.filter(r => r.registrationStatus === 'registered').flatMap(r => r.participants.map(p => p.documentId)))].sort();
  expect(sent).toEqual(ids);
  const card = cards(page).first();
  await card.getByRole('button', { name: /Arată detaliile/ }).click();
  const stats = card.getByRole('list', { name: 'Statistici' });
  await expect(stats.getByRole('listitem')).toHaveCount(3);
  await expect(stats).toContainText('Capturi');
  await expect(stats).toContainText('CMMC');
  await expect(stats).toContainText('Concursuri');
  await expect(stats).toContainText(/(\d+(,\d+)? kg|–)/);
  // The opened panel is the card's own white (not the page grey), its tiles the T3 inset tile (no shadow).
  const bg = (l: Locator) => l.evaluate(el => getComputedStyle(el).backgroundColor);
  const panelBox = stats.locator('xpath=ancestor::div[contains(@class,"border-t")][1]');
  expect(await bg(panelBox)).toBe(await bg(card));
  expect(await stats.getByRole('listitem').first().evaluate(el => getComputedStyle(el).boxShadow)).toBe('none');
  // Folded again: the panel closes (inert, nothing focusable inside).
  await card.getByRole('button', { name: /Restrânge detaliile/ }).click();
  await expect.poll(async () => (await card.locator('[inert]').boundingBox())?.height ?? 0).toBeLessThan(1);
  await expect(stats.getByRole('listitem').first()).not.toBeInViewport();
});

test(`competition-page.participanti.c8 competition-page.participanti.s5 competition-page.participanti.s7 — a guest: «Statisticile nu sunt disponibile…»; a team: one block per member`, async ({ page, context }) => {
  await signIn(context, jwt);
  await open(page, participants(ID.own), PHONE);
  await settle(page);
  const guest = cards(page).first();
  await guest.getByRole('button', { name: /Arată detaliile/ }).click();
  await expect(guest.getByText('Statisticile nu sunt disponibile pentru utilizatorii adăugați manual.')).toBeVisible();

  await open(page, participants(ID.contacts), PHONE);
  await settle(page);
  const team = cards(page).first();
  await team.getByRole('button', { name: /Arată detaliile/ }).click();
  await expect(team.getByRole('list', { name: 'Statistici' })).toHaveCount(3);
  for (const name of ['Andrei Popescu', 'Andrew', 'Andrew R']) await expect(team.getByText(name, { exact: true })).toBeVisible();
});

test(`competition-page.participanti.c8 — the batch fails: the page’s retry in the card, never zeros`, async ({ page, context }) => {
  await signIn(context, jwt);
  await page.route(/\/api\/cms\/user\/statistics\/batch/, route => route.fulfill({ status: 500, json: { error: { message: 'x' } } }));
  await open(page, participants(ID.individuals), PHONE);
  await settle(page); // hydrated, the batch has failed (and its one retry)
  const card = cards(page).first();
  await card.getByRole('button', { name: /Arată detaliile/ }).click();
  await expect(card.getByText('Statisticile nu au putut fi încărcate.')).toBeVisible();
  const retry = card.getByRole('button', { name: 'Încearcă din nou' });
  await expect(retry).toBeVisible();
  // The page's retry (QueryRetry): says so when it fails again.
  await retry.click();
  await expect(card.getByRole('status').filter({ hasText: 'Tot nu s-a putut încărca.' })).toBeAttached();
});

test('competition-page.participanti.c5 competition-page.participanti.s5 — a guest team whose subtitle only echoes its name shows the name once', async ({ page, context }) => {
  await signIn(context, jwt);
  const c = core.get(ID.own)!;
  const regs = c.registrations.filter(r => r.registrationStatus === 'registered');
  const echo = { ...regs[0], teamName: 'Bibanu si Paul Sarbu', guestName: 'Bibanul și Paul Sârbu', participants: [] };
  const other = { ...regs[1], teamName: 'Rechinii', guestName: 'Ion și Vasile', participants: [] };
  await patchCore(page, ID.own, { registrations: [echo, other, ...c.registrations.filter(r => r !== regs[0] && r !== regs[1])] });
  await open(page, participants(ID.own), PHONE);
  const echoCard = page.getByRole('article', { name: 'Bibanu si Paul Sarbu' });
  await expect(echoCard).toBeVisible();
  await expect(echoCard.getByText('Bibanul și Paul Sârbu')).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'Rechinii' }).getByText('Ion și Vasile')).toBeVisible();
});

test('competition-page.participanti.c1 competition-page.participanti.s1 competition-page.participanti.s2 — loading bones in the list’s shape (six cards on the list grid); a missing competition is the not-found page', async ({ page }) => {
  // ID.guests (21 approved): a competition whose tab streams its loading UI on the dev server — the
  // prerendered «individuals» one arrives whole over the throttled link (no prefetch in dev), so its
  // skeleton never paints there.
  const release = await holdTabSkeleton(page, ID.guests, 'participanti', 'Participanți', DESKTOP);
  const cardsBones = bonesOf(page, 'participanti', 'card');
  await expect(cardsBones).toHaveCount(6);
  // The kit grid's columns (T1 listGridClass lg: 340px minimum, 16px gutter): 3 at 1440, as the list.
  const xs = new Set(await cardsBones.evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().x))));
  expect(xs.size).toBe(3);
  await release();
  await expect(cards(page).first()).toBeVisible();
  const loadedXs = new Set(await cards(page).evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().x))));
  expect([...loadedXs].sort()).toEqual([...xs].sort());
  await page.goto(participants('nu-exista-acest-concurs'));
  await expect(page.getByRole('heading', { name: 'Concursul nu a fost găsit' })).toBeVisible();
});

for (const [label, id, count] of [
  ['upcoming', ID.own, 20],
  ['completed, prerendered', ID.ownDone, 6],
] as const) {
  test(`competition-page.participanti.c2 competition-page.participanti.s3 — the author (${label}): the organizer notice over the list, revealed with it (no shift); the app’s Participanți deep link`, async ({ page, context }) => {
    await signIn(context, jwt);
    const cls = await probeShifts(page);
    await open(page, participants(id), LAPTOP);
    const notice = page.getByRole('region', { name: 'Ești organizatorul acestui concurs' });
    await expect(notice).toBeVisible();
    // The kit section (title step t-title2), not a one-off surface.
    await expect(notice.getByRole('heading', { level: 2 })).toHaveClass(/t-title2/);
    await settle(page);
    // The notice and the list share one Suspense boundary: they land together.
    expect(await cls()).toBeLessThan(0.01);
    const link = notice.getByRole('link', { name: /(Gestionează|Aprobă-le) în aplicație/ });
    await expect(link).toHaveAttribute('href', new RegExp(`^https://bluvi-app\\.wearetribus\\.com/competitions/${id}\\?activeTabId=participanti`));
    await expect(cards(page)).toHaveCount(count);
  });
}

test(`competition-page.participanti.c2 competition-page.participanti.s3 — the author with pending registrations: «N înscrieri în așteptare» + «Aprobă-le în aplicație» on fish’s pending filter`, async ({ page, context }) => {
  await signIn(context, jwt);
  const c = core.get(ID.own)!;
  const pending = { ...c.registrations[0], documentId: 'p1', registrationStatus: 'pending' };
  await patchCore(page, ID.own, { registrations: [...c.registrations, pending, { ...pending, documentId: 'p2' }] });
  await open(page, participants(ID.own), PHONE);
  const notice = page.getByRole('region', { name: 'Ești organizatorul acestui concurs' });
  await expect(notice.getByText('2 înscrieri în așteptare')).toBeVisible();
  await expect(notice.getByRole('link', { name: 'Aprobă-le în aplicație' })).toHaveAttribute(
    'href',
    `https://bluvi-app.wearetribus.com/competitions/${ID.own}?activeTabId=participanti&participantsFilter=pending`,
  );
});

test(`competition-page.participanti.c5 competition-page.participanti.s5 — a photo that fails to load falls back to the initials (no broken-image glyph)`, async ({ page, context }) => {
  await signIn(context, jwt);
  const c = core.get(ID.individuals)!;
  const regs = c.registrations.map((r, i) => (i === 0 ? { ...r, participants: r.participants.map(p => ({ ...p, avatar: { url: 'http://localhost:1337/uploads/nu-exista.jpg' } })) } : r));
  await patchCore(page, ID.individuals, { registrations: regs });
  await open(page, participants(ID.individuals), PHONE);
  const name = c.registrations[0].participants[0].username;
  const card = page.getByRole('article', { name });
  await expect(card.locator('img')).toHaveCount(0);
  await expect(card.getByText(/^[A-ZĂÂÎȘȚ]{1,2}$/).first()).toBeVisible();
});

test(`competition-page.participanti.c5 competition-page.participanti.s5 — a team list: the names start on one line whatever the member count; a long name never runs under the stand tag`, async ({ page, context }) => {
  await signIn(context, jwt);
  const c = core.get(ID.teams)!;
  const longName = 'Echipa Crapilor Nemuritori din Valea Argeșului de Jos';
  const regs = c.registrations.map((r, i) => (i === 0 ? { ...r, teamName: longName } : r));
  await patchCore(page, ID.teams, { registrations: regs });
  for (const vp of [PHONE, DESKTOP]) {
    await open(page, participants(ID.teams), vp);
    await expect(page.getByRole('article', { name: longName })).toBeVisible();
    const xs = await cards(page).evaluateAll(els => els.map(e => Math.round(e.querySelector('.line-clamp-2')!.getBoundingClientRect().x - e.getBoundingClientRect().x)));
    expect(new Set(xs).size, `${vp.width}px`).toBe(1);
    // The name block ends left of the corner tag.
    for (const card of await cards(page).all()) {
      const tag = (await card.locator('span').first().boundingBox())!;
      const nameBox = (await card.locator('.line-clamp-2').first().boundingBox())!;
      expect(nameBox.x + nameBox.width, `${vp.width}px`).toBeLessThanOrEqual(tag.x + 0.5);
    }
  }
});

test(`competition-page.participanti.c8 competition-page.participanti.s7 — an opened team card: one block per member, hairlines between`, async ({ page, context }) => {
  await signIn(context, jwt);
  await open(page, participants(ID.contacts), PHONE);
  await settle(page);
  const team = cards(page).first();
  await team.getByRole('button', { name: /Arată detaliile/ }).click();
  const members = team.locator('[id] ul').first().locator(':scope > li');
  await expect(members).toHaveCount(3);
  // A hairline between members (Tailwind 4 divide: under every member but the last).
  expect(await members.nth(0).evaluate(el => getComputedStyle(el).borderBottomWidth)).toBe('1px');
  expect(await members.nth(2).evaluate(el => getComputedStyle(el).borderBottomWidth)).toBe('0px');
  // Inside a block (name → stats) tighter than between blocks.
  const gap = async (i: number) => {
    const a = (await members.nth(i).getByRole('list', { name: 'Statistici' }).boundingBox())!;
    const b = (await members.nth(i + 1).boundingBox())!;
    return b.y - (a.y + a.height);
  };
  expect(await gap(0)).toBeGreaterThan(8);
});

test(`competition-page.informatii.c1 competition-page.participanti.c1 competition-page.regulament.c1 — signed in on the phone: a route tab’s skeleton already has the Chat bar, where the loaded bar lands`, async ({ page, context }) => {
  await signIn(context, jwt);
  const release = await holdTabSkeleton(page, ID.rich, 'informatii', 'Informații', PHONE);
  // CompetitionScreen's rule (barHasActions): a signed-in reader always has Chat in the bar.
  await expect(page.locator('[data-bone="chat-bar"]')).toBeVisible();
  const bar = page.getByRole('region', { name: 'Bara de acțiuni' });
  const boneBar = (await bar.boundingBox())!;
  await release();
  await expect(page.getByRole('region', { name: /^Durata concursului/ })).toBeVisible();
  await settle(page);
  await expect(bar.getByRole('button', { name: /Chat/ })).toBeVisible();
  const loadedBar = (await bar.boundingBox())!;
  expect(Math.abs(loadedBar.y - boneBar.y)).toBeLessThan(1);
  expect(Math.abs(loadedBar.height - boneBar.height)).toBeLessThan(1);
});

test(`competition-page.participanti.c10 — coming back after a while re-reads the competition, the statute and the stats`, async ({ page, context }) => {
  await signIn(context, jwt);
  await page.clock.install();
  await open(page, participants(ID.individuals), DESKTOP);
  await settle(page);
  const competition = track(page, new RegExp(`/feed/competitions/${ID.individuals}(\\?|$)`));
  const batch = track(page, /\/user\/statistics\/batch/);
  await page.clock.fastForward(31_000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => competition.length).toBeGreaterThan(0);
  await expect.poll(() => batch.length).toBeGreaterThan(0);
});

/* ------------------------------------------------------------------ */
/* competition-page.extra-cantare                                      */
/* ------------------------------------------------------------------ */

const extra = (id: string) => `/concursuri/${id}/extra-cantare`;
const extraRoute = (id: string) => new RegExp(`/api/cms/competitions/${id}/extra-scale(\\?|$)`);

test(`competition-page.extra-cantare.c1 competition-page.extra-cantare.s1 competition-page.extra-cantare.s2 — the list loads with bones; on error a retry re-reads it`, async ({ page }) => {
  let fail = true;
  let release: () => void = () => {};
  const gate = new Promise<void>(r => (release = r));
  await page.route(extraRoute(ID.guests), async route => {
    await gate;
    if (fail) return route.fulfill({ status: 500, json: { error: { message: 'x' } } });
    return route.continue();
  });
  await open(page, extra(ID.guests), PHONE);
  await expect(page.getByRole('status').filter({ hasText: 'Se încarcă cererile de extra cântar…' })).toBeAttached();
  release();
  await expect(page.getByText('Cererile de extra cântar nu au putut fi încărcate.')).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(page.getByRole('heading', { name: 'Cereri de extra cântar' })).toBeVisible();
});

test(`competition-page.extra-cantare.c2 competition-page.extra-cantare.s3 — before the start: the explanation, without reading the list`, async ({ page }) => {
  const list = track(page, /\/competitions\/[^/]+\/extra-scale/);
  await open(page, extra(ID.own), PHONE);
  await expect(visible(page.getByText('După începerea competiției, cererile pentru extra cântar vor fi afișate în această secțiune.'))).toBeVisible();
  await settle(page);
  expect(list).toHaveLength(0);
});

test('competition-page.b.live-refresh competition-page.extra-cantare.c6 — while running the list is re-read with the live parts', async ({ page }) => {
  await page.clock.install();
  const list = track(page, new RegExp(`/competitions/${ID.live}/extra-scale`));
  await open(page, extra(ID.live), DESKTOP);
  await settle(page);
  const first = list.length;
  expect(first).toBeGreaterThan(0);
  await page.clock.runFor(46_000);
  await expect.poll(() => list.length).toBeGreaterThan(first);
});

test('competition-page.extra-cantare.c1 competition-page.extra-cantare.s2 — the error row sits in the state cards’ frame', async ({ page }) => {
  await page.route(extraRoute(ID.guests), route => route.fulfill({ status: 500, json: { error: { message: 'x' } } }));
  await open(page, extra(ID.guests), DESKTOP);
  const alert = page.getByRole('alert').filter({ hasText: 'Cererile de extra cântar nu au putut fi încărcate.' });
  await expect(alert).toBeVisible();
  expect((await alert.boundingBox())!.width).toBeLessThanOrEqual(721);
});

test(`competition-page.extra-cantare.c3 competition-page.extra-cantare.s4 — no requests`, async ({ page }) => {
  await open(page, extra(ID.live), PHONE);
  await expect(page.getByRole('heading', { name: 'Nu există nicio cerere de extra cântar.' })).toBeVisible();
});

test(`competition-page.extra-cantare.c4 competition-page.extra-cantare.c5 competition-page.extra-cantare.s5 — done requests: «Finalizat la», still readable rows with a chevron, open the stand’s weighings`, async ({ page }) => {
  await open(page, extra(ID.guests), DESKTOP);
  const items = page.getByRole('heading', { name: 'Cereri de extra cântar' }).locator('xpath=ancestor::section[1]').getByRole('link');
  await expect(items).toHaveCount(2);
  const first = items.first();
  await expect(first).toContainText('Sector A Stand 1');
  await expect(first).toContainText('Toni Radulescu');
  await expect(first).toContainText('Finalizat la');
  // Done, still a readable row (ink text) with its chevron: it opens the stand.
  const title = first.getByText('Sector A Stand 1');
  expect(await title.evaluate(el => getComputedStyle(el).color)).toBe(await page.getByRole('heading', { name: 'Cereri de extra cântar' }).evaluate(el => getComputedStyle(el).color));
  await expect(first.locator('svg')).toHaveCount(3);
  await expect(first).toHaveAttribute('href', `/concursuri/${ID.guests}/cantare?stand=nk68e93zjbs6sme020znr4pi`);
  await first.click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${ID.guests}/cantare\\?stand=nk68e93zjbs6sme020znr4pi$`));
  // The Cântare view opens on that stand.
  await expect(visible(page.locator('#stand-nk68e93zjbs6sme020znr4pi').getByRole('button', { expanded: true }))).toBeVisible();
});

test(`competition-page.extra-cantare.c4 competition-page.extra-cantare.c5 competition-page.extra-cantare.s5 competition-page.extra-cantare.s6 — a new request while running: «acum …» + chevron; «Sector B Stand 12»; no stand data → toast`, async ({ page }) => {
  const created = new Date(Date.now() - 5 * 60_000).toISOString();
  const stand = { id: 1, documentId: 'st-new', name: '12', sectors: [{ id: 2, documentId: 'sec', name: 'Sector B' }], sectorDrawPosition: 3 };
  await page.route(extraRoute(ID.live), route =>
    route.fulfill({
      json: [
        { id: 1, documentId: 'x1', createdAt: created, updatedAt: created, extraStatus: 'new', author: { id: 9, documentId: 'a', username: 'Pescar Nou' }, stand },
        { id: 2, documentId: 'x2', createdAt: created, updatedAt: created, extraStatus: 'new', author: null, stand: { ...stand, name: '', sectors: [] } },
      ],
    }),
  );
  await open(page, extra(ID.live), PHONE);
  const link = page.getByRole('link', { name: /Sector B Stand 12/ });
  await expect(link).toContainText('Pescar Nou');
  await expect(link).toContainText('acum 5 minute');
  await expect(page.getByText('2 cereri · 2 în așteptare')).toBeVisible();
  const broken = page.getByRole('button', { name: /Cont șters/ });
  await broken.click();
  await expect(page.getByText('Nu există suficiente date pentru a deschide acest stand')).toBeVisible();
  await expectNoA11yViolations(page);
});

for (const [rankingType, expected] of [
  ['nationalChampionship', 'B3(12)'],
  ['fipsed', 'Sector B Stand 12'],
] as const) {
  test(`competition-page.extra-cantare.c4 competition-page.extra-cantare.s5 — the stand label for ${rankingType}: «${expected}» (fish: the draw label for the national championship only)`, async ({ page, context }) => {
    await signIn(context, jwt);
    await patchCore(page, ID.live, { rankingType });
    const stand = { id: 1, documentId: 'st-new', name: '12', sectors: [{ id: 2, documentId: 'sec', name: 'Sector B' }], sectorDrawPosition: 3 };
    const created = new Date(Date.now() - 5 * 60_000).toISOString();
    await page.route(extraRoute(ID.live), route =>
      route.fulfill({ json: [{ id: 1, documentId: 'x1', createdAt: created, updatedAt: created, extraStatus: 'new', author: { id: 9, documentId: 'a', username: 'Pescar Nou' }, stand }] }),
    );
    await open(page, extra(ID.live), PHONE);
    const link = page.getByRole('link', { name: /Pescar Nou/ });
    await expect(link).toContainText(expected);
    if (rankingType === 'nationalChampionship') await expect(link).not.toContainText('Stand');
  });
}

test(`competition-page.extra-cantare.c1 competition-page.extra-cantare.c6 competition-page.extra-cantare.s2 — a live re-read that fails after the list loaded: the list stays, says it could not update, and the retry recovers`, async ({ page }) => {
  await page.clock.install();
  const created = new Date(Date.now() - 5 * 60_000).toISOString();
  const stand = { id: 1, documentId: 'st-new', name: '12', sectors: [{ id: 2, documentId: 'sec', name: 'Sector B' }], sectorDrawPosition: 3 };
  let fail = false;
  await page.route(extraRoute(ID.live), route =>
    fail
      ? route.fulfill({ status: 500, json: { error: { message: 'x' } } })
      : route.fulfill({ json: [{ id: 1, documentId: 'x1', createdAt: created, updatedAt: created, extraStatus: 'new', author: { id: 9, documentId: 'a', username: 'Pescar Nou' }, stand }] }),
  );
  await open(page, extra(ID.live), DESKTOP);
  await expect(page.getByRole('link', { name: /Pescar Nou/ })).toBeVisible();
  await expect(page.getByText('Lista nu s-a putut actualiza.')).toHaveCount(0);
  let failures = 0;
  page.on('requestfinished', r => void (fail && extraRoute(ID.live).test(r.url()) && failures++));
  fail = true;
  // The next poll (LIVE_POLL_MS) and its one retry (600 ms later) fail.
  await page.clock.runFor(46_000);
  await expect.poll(() => failures).toBeGreaterThanOrEqual(1);
  await page.clock.runFor(1_000);
  await expect.poll(() => failures).toBeGreaterThanOrEqual(2);
  const stale = page.getByRole('alert').filter({ hasText: 'Lista nu s-a putut actualiza.' });
  await expect(stale).toBeVisible();
  await expect(page.getByRole('link', { name: /Pescar Nou/ })).toBeVisible();
  fail = false;
  await stale.getByRole('button', { name: 'Încearcă din nou' }).click();
  await expect(page.getByText('Lista nu s-a putut actualiza.')).toHaveCount(0);
});

test(`competition-page.extra-cantare.c4 competition-page.extra-cantare.s5 — from 1280 the right column: «Cum funcționează» and the counts; the list keeps the centre`, async ({ page }) => {
  await open(page, extra(ID.guests), DESKTOP);
  const aside = page.getByRole('complementary', { name: 'Despre extra cântare' });
  await expect(aside.getByRole('heading', { name: 'Cum funcționează' })).toBeVisible();
  await expect(aside.getByText('Finalizate')).toBeVisible();
  await open(page, extra(ID.guests), PHONE);
  await expect(page.getByRole('complementary', { name: 'Despre extra cântare' })).toBeHidden();
});

test(`competition-page.extra-cantare.c6 — coming back after a while re-reads the list and the competition`, async ({ page }) => {
  await page.clock.install();
  await open(page, extra(ID.guests), DESKTOP);
  await settle(page);
  const list = track(page, /\/competitions\/[^/]+\/extra-scale/);
  await page.clock.fastForward(31_000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => list.length).toBeGreaterThan(0);
});

/* ------------------------------------------------------------------ */
/* competition-page.regulament                                         */
/* ------------------------------------------------------------------ */

const rules = (id: string) => `/concursuri/${id}/regulament`;

test(`competition-page.regulament.c2 competition-page.regulament.s2 — without a regulation: fish’s line, as wide as the Contact card under it; no dead «jump» action`, async ({ page }) => {
  for (const vp of [PHONE, TABLET, { width: 1024, height: 900 }]) {
    await open(page, rules(ID.plain), vp);
    const heading = page.getByRole('heading', { name: 'Nu există regulament actualizat pentru această competiție' });
    await expect(heading).toBeVisible();
    // The organizer has no phone: no action (the Contact card is right there).
    await expect(page.getByRole('link', { name: 'Vezi contactele' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Sună organizatorul' })).toHaveCount(0);
    const state = (await heading.locator('xpath=ancestor::div[contains(@class,"bg-surface")][1]').boundingBox())!;
    const contact = (await page.getByRole('heading', { name: 'Întrebări despre regulament?' }).locator('xpath=ancestor::section[1]').boundingBox())!;
    expect(Math.abs(state.x - contact.x), `${vp.width}px`).toBeLessThan(1);
    expect(Math.abs(state.width - contact.width), `${vp.width}px`).toBeLessThan(1);
  }
});

test(`competition-page.regulament.c2 competition-page.regulament.s2 — without a regulation, an organizer with a phone: «Sună organizatorul» calls them`, async ({ page, context }) => {
  await signIn(context, jwt);
  const c = core.get(ID.plain)! as Core & { author: Record<string, unknown> };
  await patchCore(page, ID.plain, { author: { ...c.author, phone: '0712 345 678' } });
  await open(page, rules(ID.plain), PHONE);
  await expect(page.getByRole('link', { name: 'Sună organizatorul' })).toHaveAttribute('href', 'tel:0712345678');
});

test(`competition-page.regulament.c3 competition-page.regulament.s3 — the regulation as rich text (headings, lists, links, bold / italic)`, async ({ page, context }) => {
  await open(page, rules(ID.rich), DESKTOP);
  await expect(page.getByRole('region', { name: 'Regulament', exact: true })).toContainText('Regulmentul competitiei');

  await signIn(context, jwt);
  await patchCore(page, ID.rich, {
    regulation: [
      { type: 'heading', level: 2, children: [{ type: 'text', text: 'Art. 1 Standuri' }] },
      { type: 'paragraph', children: [{ type: 'text', text: 'Tragerea ', bold: true }, { type: 'text', text: 'la sorți', italic: true }] },
      { type: 'list', format: 'unordered', children: [{ type: 'list-item', children: [{ type: 'text', text: 'Un fir' }] }] },
      { type: 'paragraph', children: [{ type: 'link', url: 'https://bluvi.ro', children: [{ type: 'text', text: 'detalii' }] }] },
      { type: 'heading', level: 2, children: [{ type: 'text', text: 'Art. 2 Contact' }] },
      { type: 'paragraph', children: [{ type: 'link', url: 'tel0712345678', children: [{ type: 'text', text: 'Sună arbitrul' }] }] },
    ],
  });
  await page.reload();
  const region = page.getByRole('region', { name: 'Regulament', exact: true });
  await expect(region.getByRole('heading', { name: 'Art. 1 Standuri' })).toBeVisible();
  await expect(region.locator('strong', { hasText: 'Tragerea' })).toBeVisible();
  await expect(region.locator('em', { hasText: 'la sorți' })).toBeVisible();
  await expect(region.getByRole('listitem')).toHaveText(['Un fir']);
  await expect(region.getByRole('link', { name: 'detalii' })).toHaveAttribute('href', 'https://bluvi.ro');
  // fish CustomBlocksRenderer: «tel…» is a phone link, not a relative page.
  await expect(region.getByRole('link', { name: 'Sună arbitrul' })).toHaveAttribute('href', 'tel:0712345678');
  // From 1280: the headings as an index on the left, the contact card on the right; the text card
  // is about the reading measure wide (never stretched around capped text).
  const toc = page.getByRole('navigation', { name: 'Cuprins' });
  await expect(toc.getByRole('link')).toHaveText(['Art. 1 Standuri', 'Art. 2 Contact']);
  await toc.getByRole('link', { name: 'Art. 2 Contact' }).click();
  await expect(page).toHaveURL(/#regulament-2$/);
  await expect(page.getByRole('complementary', { name: 'Contact' }).getByRole('heading', { name: 'Întrebări despre regulament?' })).toBeVisible();
  expect((await region.boundingBox())!.width).toBeLessThanOrEqual(800);
});

for (const vp of [PHONE, DESKTOP]) {
  test(`competition-page.regulament.c1 competition-page.regulament.s1 — the tab’s skeleton: one reading card, the contact card, the left column from 1280 (${vp.width}px)`, async ({ page }) => {
    const release = await holdTabSkeleton(page, ID.rich, 'regulament', 'Regulament', vp);
    await expect(bonesOf(page, 'regulament', 'reading')).toHaveCount(1);
    await expect(bonesOf(page, 'regulament', 'contact')).toHaveCount(1);
    await expect(bonesOf(page, 'regulament', 'facts-aside')).toHaveCount(vp === DESKTOP ? 1 : 0);
    await release();
    await expect(page.getByRole('region', { name: 'Regulament', exact: true })).toBeVisible();
  });
}

test(`competition-page.regulament.c4 — coming back after a while re-reads the competition and the statute`, async ({ page, context }) => {
  await signIn(context, jwt);
  await page.clock.install();
  await open(page, rules(ID.rich), DESKTOP);
  await settle(page);
  const competition = track(page, new RegExp(`/feed/competitions/${ID.rich}(\\?|$)`));
  const statute = track(page, /\/statute$/);
  await page.clock.fastForward(31_000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => competition.length).toBeGreaterThan(0);
  await expect.poll(() => statute.length).toBeGreaterThan(0);
});
