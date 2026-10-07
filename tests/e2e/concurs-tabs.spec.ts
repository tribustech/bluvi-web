import { collectConsoleErrors } from './helpers/console';
import { expectNoA11yViolations } from './helpers/a11y';
import { CMS, qaJwt, signIn } from './helpers/session';
import { expect, test, type Locator, type Page, type Request } from '@playwright/test';
import { approvedRegistrationsByStand, extraScaleStand, registrationDisplayName } from '@/core/competitions/domain/competitionTabs';
import { formatCount } from '@/core/realtime/chat/format';

/*
 * Concurs · the route tabs (template T3) — parity docs/parity/areas/competition-page.yml, screens
 * competition-page.informatii, .participanti, .extra-cantare, .regulament. Each test names the
 * criterion / state ids it covers. Local CMS on :1337, QA user «Sim QA». States the local data
 * does not have (a long description, no contact, a request still «new») are served signed in,
 * where the browser re-reads the core / the list: the response is replaced with page.route.
 *
 * Fixtures are resolved, not pinned: beforeAll checks each fixture's shape (FIXTURES: the
 * predicate a test's assertions need) on the E2E_TABS_* override or the usual local id, and when
 * the local data has moved it searches the CMS's competitions for one that matches. A fixture with
 * no match skips the tests that use it (reading `ID.x` inside a test), with the reason, instead of
 * failing the whole file. Expected values come from the same CMS responses, never DB literals.
 */

type Reg = {
  documentId: string;
  registrationStatus: string;
  stand: { documentId: string; name: string } | null;
  participants: { documentId: string; username: string }[];
  teamName: string | null;
  guestName: string | null;
};
type Core = Record<string, unknown> & {
  documentId: string;
  name: string;
  competitionStatus: string;
  competitionType: string;
  rankingType: string;
  registerFee: string | number | null;
  bestOfFishCount: number | null;
  participantsLimit: number | null;
  teamParticipants: number | null;
  startDate: string;
  endDate: string;
  description: unknown[] | null;
  reward: unknown[] | null;
  regulation: unknown[] | null;
  banner: unknown;
  sponsors: { documentId: string; name: string }[] | null;
  referees: { username: string; phone: string | null }[] | null;
  author: { documentId: string; username: string; phone: string | null } | null;
  lake: { contact?: { name: string; phone: string | null }[] } | null;
  registrations: Reg[];
  sectors: { name: string; stands: { documentId: string }[] }[];
};
/** A request of the public extra-scale list (fish ScaleItem's fields). */
type ExtraReq = { extraStatus: string; stand: { documentId: string; name: string; sectors: { name: string }[] } | null; author: { username: string } | null };

type FixtureCtx = { c: Core; me: string; extra: () => Promise<ExtraReq[]> };
const blocks = (v: unknown) => Array.isArray(v) && v.length > 0;
const approvedRegs = (c: Core) => c.registrations.filter(r => r.registrationStatus === 'registered');
const sectorOfReg = (c: Core, r: Reg) => (r.stand ? (c.sectors.find(s => s.stands.some(st => st.documentId === r.stand!.documentId))?.name ?? null) : null);
const usedSectors = (c: Core) => [...new Set(approvedRegs(c).map(r => sectorOfReg(c, r)))].filter((s): s is string => !!s).sort();
const hours = (c: Core) => (new Date(c.endDate).getTime() - new Date(c.startDate).getTime()) / 3_600_000;

/** What each fixture must be for the tests that use it (the comment says why). */
const FIXTURES = {
  /** completed bestOf 15, fee 1500, 51 hours, description + reward + regulation, no banner / sponsor. */
  rich: {
    env: 'E2E_TABS_RICH',
    id: 'r4pofq9vbn7vufsw37wxrsu6',
    is: ({ c }: FixtureCtx) =>
      c.competitionStatus === 'completed' && c.competitionType === 'single' && Number(c.registerFee) === 1500 && c.bestOfFishCount === 15 && hours(c) === 51 &&
      blocks(c.description) && blocks(c.reward) && blocks(c.regulation) && !c.banner && !blocks(c.sponsors),
  },
  /** notStarted team (Echipe de 3, limit 10), 2 referees, a lake contact, 1 unallocated team of several users. */
  contacts: {
    env: 'E2E_TABS_CONTACTS',
    id: 'u9kd3xs4n91j2ktah78ke73q',
    is: ({ c }: FixtureCtx) => {
      const a = approvedRegs(c);
      return (
        c.competitionStatus === 'notStarted' && c.competitionType === 'team' && c.teamParticipants === 3 && c.participantsLimit === 10 && !Number(c.registerFee) &&
        (c.referees?.length ?? 0) === 2 && c.referees!.every(r => r.phone) && !!c.author?.phone && (c.lake?.contact?.length ?? 0) >= 1 && !!c.lake!.contact![0].phone &&
        c.registrations.length === 1 && a.length === 1 && !a[0].stand && a[0].participants.length > 1 && !a[0].teamName
      );
    },
  },
  /** completed fipsed team, banner, one sponsor, every place taken. */
  sponsors: {
    env: 'E2E_TABS_SPONSORS',
    id: 'vdsjq8ulsmwnr2b77j6q3jp4',
    is: ({ c }: FixtureCtx) =>
      c.competitionStatus === 'completed' && c.competitionType === 'team' && c.rankingType === 'fipsed' && !!c.banner && c.sponsors?.length === 1 &&
      c.participantsLimit != null && approvedRegs(c).length === c.participantsLimit && !Number(c.registerFee),
  },
  /** completed, a (logo-sized) banner, a description, one referee. */
  banner: {
    env: 'E2E_TABS_BANNER',
    id: 'k646t4o4x3wadzqxn1yqf49l',
    is: ({ c }: FixtureCtx) => c.competitionStatus === 'completed' && !!c.banner && blocks(c.description) && c.referees?.length === 1,
  },
  /** completed individual, users only, every one on a stand, one stand per sector (one ungrouped roster). */
  individuals: {
    env: 'E2E_TABS_INDIVIDUALS',
    id: 'k5c9427518736c92684018b9',
    is: ({ c }: FixtureCtx) => {
      const a = approvedRegs(c);
      return c.competitionStatus === 'completed' && c.competitionType === 'single' && a.length > 1 && a.every(r => r.participants.length === 1 && r.stand) && usedSectors(c).length === a.length;
    },
  },
  /** completed individual over several sectors (grouped), users and guests, one not approved; a done extra-scale request with its stand. */
  guests: {
    env: 'E2E_TABS_GUESTS',
    id: 'i8kzbi5k51vmbyq75dmyez3d',
    is: async ({ c, extra }: FixtureCtx) => {
      const a = approvedRegs(c);
      const sectors = usedSectors(c);
      return (
        c.competitionStatus === 'completed' && c.competitionType === 'single' && a.every(r => r.stand) && sectors.length > 1 && a.length / sectors.length > 1 &&
        a.filter(r => sectorOfReg(c, r) === sectors[0]).length > 1 && a.some(r => r.participants.length > 0) && a.some(r => r.participants.length === 0) &&
        c.registrations.length > a.length && (await extra()).some(r => r.extraStatus === 'done' && extraScaleStand(r as never) && r.author)
      );
    },
  },
  /** completed team of users, every team on a stand. */
  teams: {
    env: 'E2E_TABS_TEAMS',
    id: 'g5l98otx5ypg6wttowra9yww',
    is: ({ c }: FixtureCtx) => {
      const a = approvedRegs(c);
      return c.competitionStatus === 'completed' && c.competitionType === 'team' && a.length > 1 && a.every(r => r.stand && r.participants.length > 0);
    },
  },
  /** notStarted team, the QA user is its author, guest crews over several sectors (several in the first). */
  own: {
    env: 'E2E_TABS_OWN',
    id: 'a6xjl65ooe9eadrtvvqj9hn1',
    is: ({ c, me }: FixtureCtx) => {
      const a = approvedRegs(c);
      const sectors = usedSectors(c);
      return (
        c.competitionStatus === 'notStarted' && c.competitionType === 'team' && c.author?.documentId === me && a.length > 1 && a.every(r => r.participants.length === 0 && r.stand) &&
        sectors.length > 1 && a.filter(r => sectorOfReg(c, r) === sectors[0]).length > 1
      );
    },
  },
  /** completed (prerendered), the QA user is its author, approved registrations. */
  ownDone: {
    env: 'E2E_TABS_OWN_DONE',
    id: 'bi9ptgcag7nbakrglxh16vx4',
    is: ({ c, me }: FixtureCtx) => c.competitionStatus === 'completed' && c.author?.documentId === me && approvedRegs(c).length > 0,
  },
  /** notStarted, no registrations. */
  empty: {
    env: 'E2E_TABS_EMPTY',
    id: 'ld4l9nzlczisz2yexad8fm6p',
    is: ({ c }: FixtureCtx) => c.competitionStatus === 'notStarted' && c.registrations.length === 0,
  },
  /** completed, no regulation, an organizer without a phone. */
  plain: {
    env: 'E2E_TABS_PLAIN',
    id: 'uxxie29m6820wrpdv45w0m7q',
    is: ({ c }: FixtureCtx) => c.competitionStatus === 'completed' && !blocks(c.regulation) && !c.author?.phone,
  },
  /** started, approved registrations, no extra-scale request. */
  live: {
    env: 'E2E_TABS_LIVE',
    id: 'kee49a3e64b3f636b4b60daa',
    is: async ({ c, extra }: FixtureCtx) => c.competitionStatus === 'started' && approvedRegs(c).length > 0 && (await extra()).length === 0,
  },
  /** completed feeder legs, team (crews): the Clasament badge counts «echipe». */
  viewFeeder: {
    env: 'E2E_TABS_FEEDER',
    id: 'rg340d4r4gnwf2mbyhxvasnr',
    is: ({ c }: FixtureCtx) => c.competitionStatus === 'completed' && c.competitionType === 'team' && c.rankingType === 'feederRounds' && approvedRegs(c).length > 0,
  },
  /** completed nationalChampionship on stands: the Clasament badge counts the General table's clubs. */
  viewNc: {
    env: 'E2E_TABS_NC',
    id: 'z7rvhm55ziyr0tbblqwjp39q',
    is: ({ c }: FixtureCtx) => c.competitionStatus === 'completed' && c.rankingType === 'nationalChampionship' && approvedRegs(c).length > 0 && approvedRegs(c).every(r => r.stand),
  },
} satisfies Record<string, { env: string; id: string; is: (ctx: FixtureCtx) => boolean | Promise<boolean> }>;
type Fixture = keyof typeof FIXTURES;

const resolved: Partial<Record<Fixture, string>> = {};
const unresolved: Partial<Record<Fixture, string>> = {};
/**
 * The fixtures' competition ids. Read inside a test: a fixture the local data does not have
 * skips that test with the reason (never at module scope — loops take fixture keys).
 */
const ID = new Proxy({} as Record<Fixture, string>, {
  get(_, key: string) {
    const id = resolved[key as Fixture];
    if (id) return id;
    test.skip(true, unresolved[key as Fixture] ?? `fixture ${key} not resolved`);
    return '';
  },
});

const PHONE = { width: 375, height: 812 };
const TABLET = { width: 768, height: 1024 };
const LAPTOP = { width: 1280, height: 900 };
const DESKTOP = { width: 1440, height: 900 };
const WIDE = { width: 1920, height: 1080 };
/** Participanți's roster with the person popover (from 1024, owner rules 17–18). */
const CARDS = { width: 1024, height: 900 };

const core = new Map<string, Core>();
let jwt = '';

test.describe.configure({ timeout: 180_000 });

test.beforeAll(async ({ request }) => {
  test.setTimeout(180_000);
  jwt = await qaJwt(request);
  const meRes = await request.get(`${CMS}/users/me`, { headers: { Authorization: `Bearer ${jwt}` } });
  expect(meRes.ok(), 'the QA user reads /users/me').toBeTruthy();
  const me = (await meRes.json()).documentId as string;

  const details = new Map<string, Promise<Core | null>>();
  const detail = (id: string) => {
    if (!details.has(id)) details.set(id, request.get(`${CMS}/feed/competitions/${id}`).then(async r => (r.ok() ? ((await r.json()).data as Core) : null)));
    return details.get(id)!;
  };
  const extras = new Map<string, Promise<ExtraReq[]>>();
  const extraOf = (id: string) => {
    if (!extras.has(id)) extras.set(id, request.get(`${CMS}/competitions/${id}/extra-scale`).then(async r => (r.ok() ? ((await r.json()) as ExtraReq[]) : [])));
    return extras.get(id)!;
  };
  let all: string[] | null = null;
  const everyId = async () => {
    if (all) return all;
    all = [];
    for (let page = 1; ; page++) {
      const res = await request.get(`${CMS}/feed/competitions?page=${page}&pageSize=100`);
      if (!res.ok()) break;
      const body = (await res.json()) as { data: { documentId: string }[]; meta: { pagination: { pageCount: number } } };
      all.push(...body.data.map(c => c.documentId));
      if (page >= body.meta.pagination.pageCount) break;
    }
    return all;
  };
  const matches = async (key: Fixture, id: string) => {
    const c = await detail(id);
    return !!c && (await FIXTURES[key].is({ c, me, extra: () => extraOf(id) }));
  };

  for (const key of Object.keys(FIXTURES) as Fixture[]) {
    const preferred = process.env[FIXTURES[key].env] ?? FIXTURES[key].id;
    let id: string | undefined = (await matches(key, preferred)) ? preferred : undefined;
    for (const candidate of id ? [] : await everyId()) {
      if (candidate !== preferred && !Object.values(resolved).includes(candidate) && (await matches(key, candidate))) {
        id = candidate;
        break;
      }
    }
    if (id) {
      resolved[key] = id;
      core.set(id, (await detail(id))!);
    } else {
      unresolved[key] = `no local competition matches fixture «${key}» (${FIXTURES[key].env}; see FIXTURES)`;
    }
  }
});

const visible = (l: Locator) => l.locator('visible=true').first();
const settle = (page: Page) => page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

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

test(`competition-page.informatii.c4 competition-page.informatii.c5 competition-page.informatii.c8 competition-page.informatii.c9 competition-page.informatii.s2 competition-page.informatii.s3 — fee, type badges, species (fish artwork cards), prizes`, async ({ page }) => {
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
  // fish FishSpeciesList: one card per species with fish's artwork (getFishImage), loaded.
  const art = species.locator('img');
  await expect(art).toHaveCount(2);
  for (const img of await art.all()) {
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate(el => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0)).toBe(true);
  }
  await expect(art.first()).toHaveAttribute('src', /crap/);
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
  // The organiser, the referees and the lake contact, as the CMS names them.
  const c = core.get(ID.contacts)!;
  const people = [c.author!, ...c.referees!.map(r => ({ username: r.username, phone: r.phone })), { username: c.lake!.contact![0].name, phone: c.lake!.contact![0].phone }];
  for (const p of people) {
    await expect(contact.getByRole('link', { name: `Sună pe ${p.username}: ${p.phone}` })).toHaveAttribute('href', `tel:${p.phone!.replace(/\s/g, '')}`);
  }

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
  const [sponsor] = core.get(ID.sponsors)!.sponsors!;
  await expect(aside.getByRole('link', { name: sponsor.name })).toHaveAttribute('href', `/sponsori/${sponsor.documentId}`);
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
/** The phone's list: fish's cards (kit CardShell articles), opening on their stats. */
const cards = (page: Page) => page.getByRole('article');
/** From 768 the designed roster (owner rule 18, ParticipantsRoster): one surface per sector. */
const roster = (page: Page) => page.locator('[data-participants="roster"]');
/** The roster's entries: one list item per approved registration. */
const entries = (page: Page) => roster(page).getByRole('listitem');
/** A sector's surface in the roster (a region named by its «Sector X» heading). */
const sectorOf = (page: Page, name: string) => roster(page).getByRole('region', { name: new RegExp(`^Sector ${name}$`) });
/** The roster's stand labels, in reading order. */
const standLabels = (scope: Locator) => scope.locator('[data-stand]').evaluateAll(els => els.map(e => e.getAttribute('data-stand') ?? ''));
const SIGN_IN_HINT = 'Statisticile pescarilor se văd după ce';
const GUEST_LINE = 'Statisticile nu sunt disponibile pentru utilizatorii adăugați manual.';
/** The phone card's corner tag (fish: «Stand X» / «Nealocat»), found by its text, never by DOM position. */
const TAG = /^(Stand .+|Nealocat)$/;
const tagOf = (card: Locator) => card.getByText(TAG);
/** Every phone card's corner tag text, in order (one tag per card). */
const cardTags = (page: Page) =>
  cards(page).evaluateAll((els, source) => {
    const re = new RegExp(source);
    return els.map(e => [...e.querySelectorAll('span')].map(n => n.textContent?.trim() ?? '').filter(t => re.test(t)).join(' | '));
  }, TAG.source);

/** The approved registrations as the page lists them: by stand, naturally, unallocated first (core). */
const approvedOf = (id: string) => approvedRegistrationsByStand(core.get(id)!.registrations as unknown as Parameters<typeof approvedRegistrationsByStand>[0]) as unknown as Core['registrations'];
/** A registration's name as the page shows it (core), for a team or an individual competition. */
const displayNameOf = (r: Core['registrations'][number], type: 'team' | 'single') => registrationDisplayName(r as unknown as Parameters<typeof registrationDisplayName>[0], type);
/** The sector a registration's stand belongs to, from the same core (null: unallocated). */
function sectorNameOf(id: string, r: Core['registrations'][number]) {
  const stand = (r as { stand: { documentId?: string } | null }).stand?.documentId;
  if (!stand) return null;
  return core.get(id)!.sectors.find(s => s.stands.some(st => st.documentId === stand))?.name ?? null;
}

test(`competition-page.participanti.c3 competition-page.participanti.c5 competition-page.participanti.s5 competition-page.participanti.s6 — approved only, by stand; the stand / «Nealocat»; individual names`, async ({ page }) => {
  // ID.individuals: one stand per sector over 24 sectors — one ungrouped roster, by stand.
  await open(page, participants(ID.individuals), CARDS);
  const approved = approvedOf(ID.individuals);
  await expect(entries(page)).toHaveCount(approved.length);
  expect(await standLabels(roster(page))).toEqual(approved.map(r => r.stand!.name));
  await expect(entries(page).first()).toContainText(approved[0].participants[0].username);
  // The phone: fish's corner tag «Stand X», the same order.
  await page.setViewportSize(PHONE);
  await expect(cards(page)).toHaveCount(approved.length);
  expect(await cardTags(page)).toEqual(approved.map(r => `Stand ${r.stand!.name}`));

  // A rejected registration is not listed.
  await open(page, participants(ID.guests), CARDS);
  const all = core.get(ID.guests)!.registrations;
  expect(all.length, 'ID.guests keeps a registration that is not approved').toBeGreaterThan(approvedOf(ID.guests).length);
  await expect(entries(page)).toHaveCount(approvedOf(ID.guests).length);
});

test(`competition-page.participanti.c5 competition-page.participanti.s5 competition-page.participanti.s6 — a team: its name, the members under it, stacked faces; unallocated`, async ({ page }) => {
  const [team] = approvedOf(ID.contacts);
  const members = team.participants.map(p => p.username).join(', ');
  await open(page, participants(ID.contacts), PHONE);
  const card = cards(page).first();
  await expect(card).toContainText('Nealocat');
  // No team name, no club: «–», with the members as the subtitle.
  await expect(card).toContainText('–');
  await expect(card).toContainText(members);
  // From 768 the roster's entry says the same; its faces overlap (fish's stack: two, then «+N»).
  await page.setViewportSize(CARDS);
  const entry = entries(page).first();
  await expect(entry).toContainText('Nealocat');
  await expect(entry).toContainText('–');
  await expect(entry).toContainText(members);
  if (team.participants.length > 1) {
    // A stack only from two members (one member: a single avatar, no ring).
    const faces = entry.locator('.border-surface');
    await expect(faces).toHaveCount(Math.min(team.participants.length, 2) + (team.participants.length > 2 ? 1 : 0));
    const [a, b] = [(await faces.nth(0).boundingBox())!, (await faces.nth(1).boundingBox())!];
    expect(b.x).toBeLessThan(a.x + a.width);
    if (team.participants.length > 2) await expect(faces.last()).toHaveText(`+${team.participants.length - 2}`);
  }

  // The first team by stand, named as core names it (never a local-DB literal).
  const firstTeam = displayNameOf(approvedOf(ID.teams)[0], 'team');
  await open(page, participants(ID.teams), PHONE);
  await expect(cards(page).first()).toContainText(firstTeam);
  await page.setViewportSize(CARDS);
  await expect(entries(page).first()).toContainText(firstTeam);
});

test(`competition-page.participanti.c3 c5 c7 c8 competition-page.participanti.s5 s7 s8 — from 768 (owner rules 14, 18): grouped by sector, signed out the sign-in line once`, async ({ page }) => {
  // ID.guests: approved over 3 sectors, stands numbered across them (1, 4, 7… in A).
  await open(page, participants(ID.guests), TABLET);
  const approved = approvedOf(ID.guests);
  const sectors = [...new Set(approved.map(r => sectorNameOf(ID.guests, r)))].filter((s): s is string => !!s).sort();
  expect(sectors.length, 'ID.guests spreads over several sectors').toBeGreaterThan(1);
  for (const sector of sectors) {
    await expect(roster(page).getByRole('heading', { name: `Sector ${sector}`, level: 3 })).toBeVisible();
    const inSector = approved.filter(r => sectorNameOf(ID.guests, r) === sector);
    await expect(sectorOf(page, sector).getByRole('listitem')).toHaveCount(inSector.length);
    // By stand inside a sector.
    expect(await standLabels(sectorOf(page, sector))).toEqual(inSector.map(r => r.stand!.name));
  }
  await expect(entries(page)).toHaveCount(approved.length);
  // The counts read as Romanian counts (formatCount: «21 de participanți aprobați», «24 de înscrieri»).
  await expect(page.getByText(formatCount(approved.length, 'participant aprobat', 'participanți aprobați'), { exact: true })).toBeVisible();
  for (const sector of sectors) {
    const n = approved.filter(r => sectorNameOf(ID.guests, r) === sector).length;
    await expect(sectorOf(page, sector).getByText(formatCount(n, 'înscriere', 'înscrieri'), { exact: true })).toBeVisible();
  }
  // No disclosure, no stats; signed out the hint is said once, above the roster (not in each entry).
  await expect(roster(page).getByRole('button')).toHaveCount(0);
  await expect(roster(page).getByText(/^CMMC/)).toHaveCount(0);
  await expect(page.getByText(SIGN_IN_HINT)).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'intri în cont' })).toHaveAttribute('href', `/intra?next=${encodeURIComponent(participants(ID.guests))}`);
  // The entries of a row share its height.
  const boxes = await sectorOf(page, sectors[0]).getByRole('listitem').evaluateAll(els => els.map(e => ({ top: Math.round(e.getBoundingClientRect().top), h: Math.round(e.getBoundingClientRect().height) })));
  const rows = new Map<number, Set<number>>();
  for (const b of boxes) rows.set(b.top, (rows.get(b.top) ?? new Set()).add(b.h));
  expect([...rows.values()].some(h => h.size > 1)).toBe(false);
  expect(rows.size, 'several entries share a row').toBeLessThan(boxes.length);
  await expectNoA11yViolations(page);
  // The phone keeps fish's flat list by stand.
  await page.setViewportSize(PHONE);
  await expect(page.getByRole('heading', { name: /^Sector A/, level: 3 })).toHaveCount(0);
  expect(await cardTags(page)).toEqual(approved.map(r => (r.stand ? `Stand ${r.stand.name}` : 'Nealocat')));
});

test(`competition-page.participanti.c5 c8 competition-page.participanti.s5 s7 — from 1280 (owner rules 16, 18): entries with the headline stats inline; a guest carries «Adăugat manual», no stats paragraph`, async ({ page, context }) => {
  await signIn(context, jwt);
  await open(page, participants(ID.guests), DESKTOP);
  await settle(page);
  const approved = approvedOf(ID.guests);
  const users = approved.filter(r => r.participants.length > 0);
  const guests = approved.filter(r => r.participants.length === 0);
  expect(users.length && guests.length, 'ID.guests mixes users and guests').toBeTruthy();
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(cards(page)).toHaveCount(0);
  await expect(entries(page)).toHaveCount(approved.length);
  // An angler with an account: catches, CMMC («kg» apart, «–» unknown) and competitions on one line.
  const user = entries(page).filter({ hasText: users[0].participants[0].username });
  await expect(user).toContainText(/\d+ (de )?(capturi|captură)/);
  await expect(user).toContainText(/CMMC\s*(\d+(,\d+)?\s*kg|–)/);
  await expect(user).toContainText(/\d+\s*conc\./);
  await expect(roster(page).getByText(/^CMMC/)).toHaveCount(users.length);
  // A guest: «Adăugat manual», never the stats paragraph.
  await expect(roster(page).getByText('Adăugat manual', { exact: true })).toHaveCount(guests.length);
  await expect(page.getByText(GUEST_LINE)).toHaveCount(0);
  await expect(page.getByText(SIGN_IN_HINT)).toHaveCount(0);
  // Rule 16: an entry never stretches (at most 384px).
  for (const w of await entries(page).evaluateAll(els => els.map(e => e.getBoundingClientRect().width))) expect(w).toBeLessThanOrEqual(384.5);
  await expectNoA11yViolations(page);
});

test(`competition-page.participanti.c8 competition-page.participanti.s7 — only guests (the author's guest crews): the guest line once above the list, no stats part on any card or entry`, async ({ page, context }) => {
  await signIn(context, jwt);
  expect(approvedOf(ID.own).every(r => r.participants.length === 0), 'ID.own lists guests only').toBe(true);
  for (const vp of [CARDS, DESKTOP]) {
    await open(page, participants(ID.own), vp);
    await settle(page);
    await expect(page.getByText(GUEST_LINE), `${vp.width}px`).toHaveCount(1);
    await expect(page.getByText('Adăugat manual', { exact: true }), `${vp.width}px`).toHaveCount(0);
    await expect(roster(page).getByText(/^CMMC/), `${vp.width}px`).toHaveCount(0);
    await expect(page.getByRole('list', { name: 'Statistici' }), `${vp.width}px`).toHaveCount(0);
  }
});

test(`competition-page.participanti.c3 c5 competition-page.participanti.s5 — from 1280 (owner rules 16, 18): several entries per line, the sectors by name (as Cântare)`, async ({ page, context }) => {
  await signIn(context, jwt);
  // ID.own: guest crews; the CMS lists its sectors out of order (C, A, B, D).
  await open(page, participants(ID.own), DESKTOP);
  await settle(page);
  const approved = approvedOf(ID.own);
  const names = [...new Set(approved.map(r => sectorNameOf(ID.own, r)))].filter((s): s is string => !!s).sort();
  const headings = roster(page).getByRole('heading', { level: 3 });
  await expect(headings).toHaveCount(names.length);
  expect(await headings.allInnerTexts()).toEqual(names.map(n => `Sector ${n}`));
  await expect(entries(page)).toHaveCount(approved.length);
  // Several entries on a line, not one row across the page.
  const tops = await sectorOf(page, names[0]).getByRole('listitem').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().top)));
  expect(tops.length).toBeGreaterThan(1);
  expect(new Set(tops).size).toBeLessThan(tops.length);
  await expectNoA11yViolations(page);
});

test(`competition-page.participanti.c5 — a national championship from 768: the stand reads as Cântare names it («A1» / «A3(1)», not «1» under «Sector A»); the phone keeps fish's «Stand 1»`, async ({ page }) => {
  // The roster's label once the allocation (the draw position) has been read: «A1» undrawn, «A3(1)» drawn.
  const ncLabel = /^A(\d+\(1\)|1)$/;
  for (const vp of [LAPTOP, CARDS]) {
    await open(page, participants(ID.viewNc), vp);
    await expect.poll(() => standLabels(roster(page)), { timeout: 30_000 }).toContainEqual(expect.stringMatching(ncLabel));
    // Every stand carries its sector's letter (never a bare number).
    for (const label of await standLabels(roster(page))) expect(label, `${vp.width}px`).toMatch(/^[A-Z]\d/);
  }
  await open(page, participants(ID.viewNc), PHONE);
  await expect(cards(page).first()).toContainText(/Stand \d+/);
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
  await open(page, participants(ID.individuals), CARDS);
  await settle(page);
  expect(batch).toHaveLength(1);
  const sent = (batch[0].postDataJSON() as { documentIds: string[] }).documentIds;
  const c = core.get(ID.individuals)!;
  const ids = [...new Set(c.registrations.filter(r => r.registrationStatus === 'registered').flatMap(r => r.participants.map(p => p.documentId)))].sort();
  expect(sent).toEqual(ids);
  // From 768 (owner rules 14, 18) the headline stats are inline on every entry: no disclosure to press.
  await expect(roster(page).getByRole('button', { name: /Arată detaliile/ })).toHaveCount(0);
  await expect(roster(page).getByText(/^CMMC/)).toHaveCount(approvedOf(ID.individuals).length);
  const entry = entries(page).first();
  await expect(entry).toContainText(/\d+ (de )?(capturi|captură)/);
  await expect(entry).toContainText(/CMMC\s*(\d+(,\d+)?\s*kg|–)/);
  await expect(entry).toContainText(/\d+\s*conc\./);
  // The phone keeps fish's card: Capturi / CMMC / Concursuri, opened on press, folded again (inert, nothing focusable inside).
  await page.setViewportSize(PHONE);
  const card = cards(page).first();
  const stats = card.getByRole('list', { name: 'Statistici' });
  await card.getByRole('button', { name: /Arată detaliile/ }).click();
  await expect(stats.getByRole('listitem')).toHaveCount(3);
  await expect(stats).toContainText('Capturi');
  await expect(stats).toContainText('CMMC');
  await expect(stats).toContainText('Concursuri');
  await expect(stats).toContainText(/(\d+(,\d+)? kg|–)/);
  // The stats part is the card's own white (not the page grey), its tiles the T3 inset tile (no shadow).
  const bg = (l: Locator) => l.evaluate(el => getComputedStyle(el).backgroundColor);
  const panelBox = stats.locator('xpath=ancestor::div[contains(@class,"border-t")][1]');
  expect(await bg(panelBox)).toBe(await bg(card));
  expect(await stats.getByRole('listitem').first().evaluate(el => getComputedStyle(el).boxShadow)).toBe('none');
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
  // One block per member, named as core lists them.
  const members = approvedOf(ID.contacts)[0].participants.map(p => p.username);
  await expect(team.getByRole('list', { name: 'Statistici' })).toHaveCount(members.length);
  for (const name of members) await expect(team.getByText(name, { exact: true })).toBeVisible();
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
  // From 768 the roster says it once above the entries, with the same retry; no entry reads zeros.
  await page.setViewportSize(CARDS);
  const alert = page.getByRole('alert').filter({ hasText: 'Statisticile nu au putut fi încărcate.' });
  await expect(alert).toHaveCount(1);
  await expect(alert.getByRole('button', { name: /Încearcă din nou/ })).toBeVisible();
  await expect(entries(page)).toHaveCount(approvedOf(ID.individuals).length);
  await expect(roster(page).getByText(/^CMMC/)).toHaveCount(0);
  await expect(roster(page).getByText(/capturi?$/)).toHaveCount(0);
});

for (const [label, reply] of [
  ['403', { status: 403, json: { data: null, error: { status: 403, name: 'ForbiddenError', message: 'Forbidden', details: {} } } }],
  ['bluCode USER_NOT_LOGGED_IN', { status: 400, json: { data: null, error: { status: 400, name: 'ApplicationError', message: 'x', details: { bluCode: 'GET_STATISTICS_BATCH:USER_NOT_LOGGED_IN' } } } }],
] as const) {
  test(`competition-page.participanti.c7 competition-page.participanti.s8 — signed in, the stats are unauthorized (${label}): the sign-in prompt, never a retry (fish useParticipantStatisticsBatch)`, async ({ page, context }) => {
    await signIn(context, jwt);
    await page.route(/\/api\/cms\/user\/statistics\/batch/, route => route.fulfill(reply));
    await open(page, participants(ID.individuals), PHONE);
    await settle(page);
    const card = cards(page).first();
    await card.getByRole('button', { name: /Arată detaliile/ }).click();
    await expect(card.getByText('Trebuie să fii autentificat pentru a vedea statisticile pescarilor.')).toBeVisible();
    await expect(card.getByRole('link', { name: 'Intră în cont' })).toBeVisible();
    await expect(card.getByRole('button', { name: /Încearcă din nou/ })).toHaveCount(0);
    await expect(card.getByText('Statisticile nu au putut fi încărcate.')).toHaveCount(0);
    // From 768 the roster says it once above the entries; no entry reads stats, no retry.
    await page.setViewportSize(CARDS);
    await expect(page.getByText(SIGN_IN_HINT)).toHaveCount(1);
    await expect(page.getByRole('button', { name: /Încearcă din nou/ })).toHaveCount(0);
    await expect(roster(page).getByText(/^CMMC/)).toHaveCount(0);
  });
}

test('competition-page.participanti.c5 competition-page.participanti.s5 — a guest team whose subtitle only echoes its name shows the name once', async ({ page, context }) => {
  await signIn(context, jwt);
  // Names no local registration carries (a real team may share a literal), the echo rule's own case.
  const [ECHO_NAME, ECHO_SUB, OTHER_NAME, OTHER_SUB] = ['Ecoul Testarii E2E si Paul', 'Ecoul Testării E2E și Paul', 'Rechinii E2E Test', 'Ion E2E și Vasile E2E'];
  const c = core.get(ID.own)!;
  const regs = c.registrations.filter(r => r.registrationStatus === 'registered');
  const echo = { ...regs[0], teamName: ECHO_NAME, guestName: ECHO_SUB, participants: [] };
  const other = { ...regs[1], teamName: OTHER_NAME, guestName: OTHER_SUB, participants: [] };
  await patchCore(page, ID.own, { registrations: [echo, other, ...c.registrations.filter(r => r !== regs[0] && r !== regs[1])] });
  await open(page, participants(ID.own), PHONE);
  const echoCard = page.getByRole('article', { name: ECHO_NAME });
  await expect(echoCard).toBeVisible();
  await expect(echoCard.getByText(ECHO_SUB)).toHaveCount(0);
  await expect(page.getByRole('article', { name: OTHER_NAME }).getByText(OTHER_SUB)).toBeVisible();
  // From 768 the roster applies the same rule (ParticipantsRoster: members only when they do not echo the name).
  await page.setViewportSize(CARDS);
  const echoEntry = entries(page).filter({ hasText: ECHO_NAME });
  await expect(echoEntry).toHaveCount(1);
  await expect(echoEntry).not.toContainText(ECHO_SUB);
  await expect(entries(page).filter({ hasText: OTHER_NAME })).toContainText(OTHER_SUB);
});

test('competition-page.participanti.c1 competition-page.participanti.s1 competition-page.participanti.s2 — loading bones in the list’s shape (from 768 the roster’s sector surface); a missing competition is the not-found page', async ({ page }) => {
  // ID.guests: a competition whose tab streams its loading UI on the dev server — the
  // prerendered «individuals» one arrives whole over the throttled link (no prefetch in dev), so its
  // skeleton never paints there.
  const release = await holdTabSkeleton(page, ID.guests, 'participanti', 'Participanți', DESKTOP);
  const rosterBones = bonesOf(page, 'participanti', 'roster');
  await expect(rosterBones).toHaveCount(1);
  await expect(bonesOf(page, 'participanti', 'card')).toHaveCount(0);
  // The bones start where the roster lands, as wide as it.
  const bone = (await rosterBones.first().boundingBox())!;
  await release();
  const list = roster(page).locator('visible=true');
  await expect(list).toBeVisible();
  const loaded = (await list.boundingBox())!;
  expect(Math.abs(loaded.x - bone.x)).toBeLessThan(1);
  expect(Math.abs(loaded.width - bone.width)).toBeLessThan(1);
  await page.goto(participants('nu-exista-acest-concurs'));
  await expect(page.getByRole('heading', { name: 'Concursul nu a fost găsit' })).toBeVisible();
});

for (const [label, key] of [
  ['upcoming', 'own'],
  ['completed, prerendered', 'ownDone'],
] as const) {
  test(`competition-page.participanti.c2 competition-page.participanti.s3 — the author (${label}): the organizer notice over the list, revealed with it (no shift); the app’s Participanți deep link`, async ({ page, context }) => {
    const id = ID[key];
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
    // Under it the roster, one entry per approved registration.
    await expect(entries(page)).toHaveCount(approvedOf(id).length);
  });
}

test(`competition-page.participanti.c2 competition-page.participanti.s3 — the author with pending registrations: «N înscrieri în așteptare» + «Aprobă-le în aplicație» on fish’s pending filter`, async ({ page, context }) => {
  await signIn(context, jwt);
  const c = core.get(ID.own)!;
  const pending = { ...c.registrations[0], documentId: 'p1', registrationStatus: 'pending' };
  await patchCore(page, ID.own, { registrations: [...c.registrations, pending, { ...pending, documentId: 'p2' }] });
  await open(page, participants(ID.own), PHONE);
  const notice = page.getByRole('region', { name: 'Ești organizatorul acestui concurs' });
  await expect(notice.getByText(/^2 (de )?înscrieri în așteptare$/)).toBeVisible();
  await expect(notice.getByRole('link', { name: 'Aprobă-le în aplicație' })).toHaveAttribute(
    'href',
    `https://bluvi-app.wearetribus.com/competitions/${ID.own}?activeTabId=participanti&participantsFilter=pending`,
  );
});

test(`competition-page.participanti.c5 competition-page.participanti.s5 — a photo that fails to load falls back to the initials (no broken-image glyph)`, async ({ page, context }) => {
  await signIn(context, jwt);
  const c = core.get(ID.individuals)!;
  const target = approvedRegs(c)[0];
  const regs = c.registrations.map(r => (r === target ? { ...r, participants: r.participants.map(p => ({ ...p, avatar: { url: 'http://localhost:1337/uploads/nu-exista.jpg' } })) } : r));
  await patchCore(page, ID.individuals, { registrations: regs });
  await open(page, participants(ID.individuals), PHONE);
  const name = target.participants[0].username;
  const card = page.getByRole('article', { name });
  await expect(card.locator('img')).toHaveCount(0);
  await expect(card.getByText(/^[A-ZĂÂÎȘȚ]{1,2}$/).first()).toBeVisible();
  // The roster's entry too (from 768).
  await page.setViewportSize(CARDS);
  const entry = entries(page).filter({ hasText: name });
  await expect(entry).toHaveCount(1);
  await expect(entry.locator('img')).toHaveCount(0);
  await expect(entry.getByText(/^[A-ZĂÂÎȘȚ]{1,2}$/).first()).toBeVisible();
});

test(`competition-page.participanti.c5 competition-page.participanti.s5 — a team list: the names start on one line whatever the member count; a long name never runs under the stand tag`, async ({ page, context }) => {
  await signIn(context, jwt);
  const c = core.get(ID.teams)!;
  const longName = 'Echipa Crapilor Nemuritori din Valea Argeșului de Jos';
  const regs = c.registrations.map((r, i) => (i === 0 ? { ...r, teamName: longName } : r));
  await patchCore(page, ID.teams, { registrations: regs });
  // The phone: fish's cards, the stand tag in the corner.
  await open(page, participants(ID.teams), PHONE);
  await expect(page.getByRole('article', { name: longName })).toBeVisible();
  const xs = await cards(page).evaluateAll(els => els.map(e => Math.round(e.querySelector('.line-clamp-2')!.getBoundingClientRect().x - e.getBoundingClientRect().x)));
  expect(new Set(xs).size).toBe(1);
  // The name block ends left of the corner tag.
  for (const card of await cards(page).all()) {
    const tag = (await tagOf(card).boundingBox())!;
    const nameBox = (await card.locator('.line-clamp-2').first().boundingBox())!;
    expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(tag.x + 0.5);
  }
  // From 768 the roster: the stand leads, then the face(s) in a fixed slot, so every name starts on
  // one line; a long name is cut inside its entry (one line, never under the next entry).
  for (const vp of [TABLET, CARDS, DESKTOP, WIDE]) {
    await page.setViewportSize(vp);
    await expect(entries(page).filter({ hasText: longName })).toHaveCount(1);
    const geo = await entries(page).evaluateAll(els =>
      els.map(e => {
        const box = e.getBoundingClientRect();
        const name = e.querySelector('.t-body-strong') as HTMLElement;
        const n = name.getBoundingClientRect();
        const stand = e.querySelector('[data-stand]')!.getBoundingClientRect();
        return { row: Math.round(box.top), dx: Math.round(n.x - box.x), right: n.right - box.right, afterStand: n.x - stand.right, oneLine: name.scrollHeight <= name.clientHeight + 1, standTop: stand.top, nameTop: n.top };
      }),
    );
    expect(new Set(geo.map(g => g.dx)).size, `${vp.width}px`).toBe(1);
    // One vertical rhythm per row: the stand blocks and the names of a row's entries share their tops.
    const rows = new Map<number, typeof geo>();
    for (const g of geo) rows.set(g.row, [...(rows.get(g.row) ?? []), g]);
    for (const row of rows.values()) {
      for (const g of row) {
        expect(Math.abs(g.standTop - row[0].standTop), `${vp.width}px stand top`).toBeLessThan(1);
        expect(Math.abs(g.nameTop - row[0].nameTop), `${vp.width}px name top`).toBeLessThan(1);
      }
    }
    for (const g of geo) {
      expect(g.right, `${vp.width}px`).toBeLessThanOrEqual(0.5);
      expect(g.afterStand, `${vp.width}px`).toBeGreaterThan(0);
      expect(g.oneLine, `${vp.width}px`).toBe(true);
    }
  }
});

test(`competition-page.participanti.c5 competition-page.participanti.s5 — a mixed individual list signed out: an account holder (one line) and a guest («Adăugat manual») start their names on one line`, async ({ page }) => {
  const approved = approvedOf(ID.guests);
  expect(approved.some(r => r.participants.length) && approved.some(r => !r.participants.length), 'ID.guests mixes users and guests').toBe(true);
  for (const vp of [LAPTOP, DESKTOP, WIDE]) {
    await open(page, participants(ID.guests), vp);
    await expect(entries(page)).toHaveCount(approved.length);
    const geo = await entries(page).evaluateAll(els =>
      els.map(e => {
        const name = (e.querySelector('.t-body-strong') as HTMLElement).getBoundingClientRect();
        const stand = e.querySelector('[data-stand]')!.getBoundingClientRect();
        return { row: Math.round(e.getBoundingClientRect().top), nameTop: name.top, standTop: stand.top, guest: /Adăugat manual/.test(e.textContent ?? '') };
      }),
    );
    const rows = new Map<number, typeof geo>();
    for (const g of geo) rows.set(g.row, [...(rows.get(g.row) ?? []), g]);
    // At least one row holds an account holder beside a guest (the case that drifted ~9px).
    expect([...rows.values()].some(r => r.some(g => g.guest) && r.some(g => !g.guest)), `${vp.width}px: a mixed row`).toBe(true);
    for (const row of rows.values()) {
      for (const g of row) {
        expect(Math.abs(g.nameTop - row[0].nameTop), `${vp.width}px name top`).toBeLessThan(1);
        expect(Math.abs(g.standTop - row[0].standTop), `${vp.width}px stand top`).toBeLessThan(1);
      }
    }
  }
});

test(`competition-page.participanti.c8 competition-page.participanti.s7 — an opened team card: one block per member, hairlines between`, async ({ page, context }) => {
  await signIn(context, jwt);
  await open(page, participants(ID.contacts), PHONE);
  await settle(page);
  const team = cards(page).first();
  await team.getByRole('button', { name: /Arată detaliile/ }).click();
  const count = approvedOf(ID.contacts)[0].participants.length;
  expect(count, 'ID.contacts lists a team of several users').toBeGreaterThan(1);
  const members = team.locator('[id] ul').first().locator(':scope > li');
  await expect(members).toHaveCount(count);
  // A hairline between members (Tailwind 4 divide: under every member but the last).
  expect(await members.nth(0).evaluate(el => getComputedStyle(el).borderBottomWidth)).toBe('1px');
  expect(await members.nth(count - 1).evaluate(el => getComputedStyle(el).borderBottomWidth)).toBe('0px');
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
  // The expected rows come from the same public list the page reads (never the local DB's values).
  const res = await page.request.get(`${CMS}/competitions/${ID.guests}/extra-scale`);
  expect(res.ok()).toBeTruthy();
  const list = (await res.json()) as ExtraReq[];
  // A request opens its stand only with the stand data core asks for (extraScaleStand): those are links.
  const withStand = list.filter(r => extraScaleStand(r as never));
  const done = withStand.find(r => r.extraStatus === 'done' && r.author);
  expect(done, 'ID.guests has a done request with its stand and author').toBeTruthy();
  const label = `Sector ${done!.stand!.sectors[0].name} Stand ${done!.stand!.name}`;
  const stand = done!.stand!.documentId;
  await open(page, extra(ID.guests), DESKTOP);
  const heading = page.getByRole('heading', { name: 'Cereri de extra cântar' });
  const items = heading.locator('xpath=ancestor::section[1]').getByRole('link');
  await expect(items).toHaveCount(withStand.length);
  // The row by its name (stand, author, «finalizat»), never by its index in the CMS list.
  const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const first = items.and(page.getByRole('link', { name: new RegExp(`^${esc(label)}, ${esc(done!.author!.username)}, finalizat la `) })).first();
  await expect(first).toContainText(label);
  await expect(first).toContainText(done!.author!.username);
  await expect(first).toContainText('Finalizat la');
  // Done, still a readable row (ink text) with its chevron: it opens the stand.
  const title = first.getByText(label, { exact: true });
  expect(await title.evaluate(el => getComputedStyle(el).color)).toBe(await heading.evaluate(el => getComputedStyle(el).color));
  // The scale icon, the check by «Finalizat la», the chevron.
  await expect(first.locator('svg')).toHaveCount(3);
  const href = `/concursuri/${ID.guests}/cantare?stand=${stand}`;
  await expect(first).toHaveAttribute('href', href);
  await first.click();
  await expect(page).toHaveURL(new RegExp(`/concursuri/${ID.guests}/cantare\\?stand=${stand}$`));
  // The Cântare view opens on that stand: from 1280 its table brings the stand's row into view
  // (owner rule 15: a table, nothing to unfold)…
  await expect(visible(page.locator(`#stand-${stand}`))).toBeInViewport({ timeout: 30_000 });
  // …and the phone's stand cards open it.
  await open(page, href, PHONE);
  await expect(visible(page.locator(`#stand-${stand}`).getByRole('button', { expanded: true }))).toBeVisible({ timeout: 30_000 });
});

test(`competition-page.extra-cantare.c4 competition-page.extra-cantare.c5 competition-page.extra-cantare.s5 competition-page.extra-cantare.s6 — a new request while running: «acum …» + chevron; «Sector B Stand 12»; no stand data → toast`, async ({ page }) => {
  const created = new Date(Date.now() - 5 * 60_000).toISOString();
  const stand = { id: 1, documentId: 'st-new', name: '12', sectors: [{ id: 2, documentId: 'sec', name: 'B' }], sectorDrawPosition: 3 };
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
  // fish ScaleItem: «Sector <name> Stand <name>», the sector named once.
  await expect(link.getByText('Sector B Stand 12', { exact: true })).toBeVisible();
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
    const stand = { id: 1, documentId: 'st-new', name: '12', sectors: [{ id: 2, documentId: 'sec', name: 'B' }], sectorDrawPosition: 3 };
    const created = new Date(Date.now() - 5 * 60_000).toISOString();
    await page.route(extraRoute(ID.live), route =>
      route.fulfill({ json: [{ id: 1, documentId: 'x1', createdAt: created, updatedAt: created, extraStatus: 'new', author: { id: 9, documentId: 'a', username: 'Pescar Nou' }, stand }] }),
    );
    await open(page, extra(ID.live), PHONE);
    const link = page.getByRole('link', { name: /Pescar Nou/ });
    await expect(link.getByText(expected, { exact: true })).toBeVisible();
    if (rankingType === 'nationalChampionship') await expect(link).not.toContainText('Stand');
  });
}

test(`competition-page.extra-cantare.c1 competition-page.extra-cantare.c6 competition-page.extra-cantare.s2 — a live re-read that fails after the list loaded: the list stays, says it could not update, and the retry recovers`, async ({ page }) => {
  await page.clock.install();
  const created = new Date(Date.now() - 5 * 60_000).toISOString();
  const stand = { id: 1, documentId: 'st-new', name: '12', sectors: [{ id: 2, documentId: 'sec', name: 'B' }], sectorDrawPosition: 3 };
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
  // The help agrees with the list beside it, which keeps the finalised requests («Finalizat la»).
  await expect(aside).toContainText('Cererile rămân în listă și după ce sunt finalizate.');
  await expect(aside).not.toContainText(/până când este finalizat/);
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

/* ------------------------------------------------------------------ */
/* The four ranking views read as tabs (owner rule 20)                 */
/* ------------------------------------------------------------------ */

/** Largest channel difference between two computed `rgb(…)` colours (0–255). */
const rgbDelta = (a: string, b: string) => {
  const ch = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  const [x, y] = [ch(a), ch(b)];
  return Math.max(...x.map((v, i) => Math.abs(v - (y[i] ?? 0))));
};
/** The colour the tablist sits on: the first ancestor with a fill. */
const groundOf = (l: Locator) =>
  l.evaluate(el => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
    }
    return getComputedStyle(document.body).backgroundColor;
  });

for (const vp of [PHONE, LAPTOP, DESKTOP, WIDE]) {
  test(`competition-page.b.view-tabs — owner rule 20: Clasament / Cântare / Statistici / Toți peștii are one tab container, the selected one filled, hover and focus, counts as badges (${vp.width}px)`, async ({ page }) => {
    await open(page, `/concursuri/${ID.live}`, vp);
    const tablist = page.getByRole('tablist', { name: 'Vederi clasament' }).locator('visible=true');
    await expect(tablist).toHaveCount(1);
    const tabs = tablist.getByRole('tab');
    await expect(tabs).toHaveCount(4);
    await expect(tabs).toHaveText([/^Clasament/, /^Cântare/, /^Statistici/, /^Toți peștii/]);
    // One container: its own fill, every tab inside its box.
    const container = await tablist.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(container).not.toBe('rgba(0, 0, 0, 0)');
    // …with an edge that visibly differs from the ground under it, at every width: a real border
    // (a soft-fill track on the white phone ground was ~1.08:1 — only the filled chip read as a
    // control; on the grey page the hairline ring is lighter than the page).
    const ground = await groundOf(tablist);
    const border = await tablist.evaluate(el => ({ w: parseFloat(getComputedStyle(el).borderTopWidth), c: getComputedStyle(el).borderTopColor }));
    expect(border.w).toBeGreaterThanOrEqual(1);
    expect(rgbDelta(border.c, ground)).toBeGreaterThanOrEqual(24);
    const box = (await tablist.boundingBox())!;
    for (const tab of await tabs.all()) {
      const b = (await tab.boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(box.x);
      expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
      // Rule 16: from 768 a content-sized segmented control, never a quarter of the column.
      if (vp.width >= 768) expect(b.width).toBeLessThanOrEqual(230);
    }
    // A strong selected state: the selected tab is filled (not the container's colour, not clear).
    const selected = tablist.getByRole('tab', { selected: true });
    await expect(selected).toContainText('Clasament');
    const fill = (l: Locator) => l.evaluate(el => getComputedStyle(el).backgroundColor);
    const selectedFill = await fill(selected);
    expect(selectedFill).not.toBe('rgba(0, 0, 0, 0)');
    expect(selectedFill).not.toBe(container);
    // Counts as badges: anglers and catches on their tabs, spoken with their noun.
    await expect(tablist.getByRole('tab', { name: /^Clasament\s*,\s*\d+ (de )?pescari$/ })).toBeVisible({ timeout: 30_000 });
    await expect(tablist.getByRole('tab', { name: /^Toți peștii\s*,\s*\d+ (de )?capturi$/ })).toBeVisible();
    // Hover: an unselected tab takes a visible fill (the accent tint).
    const other = tablist.getByRole('tab', { name: /^Statistici/ });
    const before = await fill(other);
    await other.hover();
    // Polled until it is a fill (a clear tab against a white track also «differs» by 255).
    await expect.poll(async () => {
      const now = await fill(other);
      return now !== before && !now.startsWith('rgba') ? rgbDelta(now, container) : 0;
    }).toBeGreaterThanOrEqual(10);
    // Keyboard: Right moves selection and focus; the focus ring shows on the focused tab.
    await page.waitForFunction(() => Object.keys(document.querySelector('h1')!).some(k => k.startsWith('__react')));
    await selected.focus();
    await page.keyboard.press('ArrowRight');
    const cantare = tablist.getByRole('tab', { name: /^Cântare/ });
    await expect(cantare).toHaveAttribute('aria-selected', 'true');
    await expect(cantare).toBeFocused();
    expect(await cantare.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
    await expect.poll(() => fill(cantare)).toBe(selectedFill);
    await expectNoA11yViolations(page, { include: '[role="tablist"][aria-label="Vederi clasament"]' });
  });
}

for (const [kind, key, noun] of [
  ['feeder (team)', 'viewFeeder', /echip(ă|e)/],
  ['national championship', 'viewNc', /club(uri)?/],
] as const) {
  for (const vp of [PHONE, DESKTOP]) {
    test(`competition-page.b.view-tabs — owner rule 20, ${kind}: the Clasament badge counts the table shown, spoken with its noun (${vp.width}px)`, async ({ page }) => {
      const id = ID[key];
      await open(page, `/concursuri/${id}`, vp);
      const tablist = page.getByRole('tablist', { name: 'Vederi clasament' }).locator('visible=true');
      const clasament = tablist.getByRole('tab', { name: /^Clasament/ });
      await expect(clasament).toHaveAccessibleName(new RegExp(`^Clasament\\s*,\\s*\\d+ (de )?${noun.source}$`), { timeout: 30_000 });
      await expect(clasament).not.toHaveAccessibleName(/pescari/);
    });
  }
}

for (const [kind, key] of [
  ['live', 'live'],
  ['feeder', 'viewFeeder'],
  ['national championship', 'viewNc'],
] as const) {
  for (const vp of [LAPTOP, WIDE]) {
    test(`competition-page.b.view-tabs — the view switcher stays at the same y on every view (${kind}, ${vp.width}px)`, async ({ page }) => {
      const id = ID[key];
      const strip = page.getByRole('group', { name: 'Concursul pe scurt' });
      const tablist = page.getByRole('tablist', { name: 'Vederi clasament' }).locator('visible=true');
      const yOn = async (path: string) => {
        await open(page, path, vp);
        await expect(strip).toBeVisible({ timeout: 30_000 });
        await settle(page);
        return (await tablist.boundingBox())!.y;
      };
      const onClasament = await yOn(`/concursuri/${id}`);
      const onStatistici = await yOn(`/concursuri/${id}/statistici`);
      expect(Math.abs(onStatistici - onClasament)).toBeLessThan(1);
      // Pressing «Statistici» never moves the bar from under the pointer.
      await open(page, `/concursuri/${id}`, vp);
      await expect(strip).toBeVisible({ timeout: 30_000 });
      await page.waitForFunction(() => Object.keys(document.querySelector('h1')!).some(k => k.startsWith('__react')));
      const before = (await tablist.boundingBox())!.y;
      await tablist.getByRole('tab', { name: /^Statistici/ }).click();
      await expect(tablist.getByRole('tab', { name: /^Statistici/ })).toHaveAttribute('aria-selected', 'true');
      await settle(page);
      expect(Math.abs((await tablist.boundingBox())!.y - before)).toBeLessThan(1);
    });
  }
}

test('competition-page.b.view-tabs — owner rule 20, 375: a four-digit count stays a badge inside its chip («999+», the full count spoken)', async ({ page }) => {
  await page.clock.install();
  // The ranking re-read (after its five minutes) says 1.284 catches: the Toți peștii badge.
  await page.route(new RegExp(`/competitions/${ID.live}/ranking(\\?|$)`), async route => {
    const res = await route.fetch();
    const json = await res.json();
    json.metadata.totalCatchesCount = 1284;
    await route.fulfill({ response: res, json });
  });
  await open(page, `/concursuri/${ID.live}`, PHONE);
  await settle(page);
  const tablist = page.getByRole('tablist', { name: 'Vederi clasament' }).locator('visible=true');
  const all = tablist.getByRole('tab', { name: /^Toți peștii/ });
  await expect(all).toBeVisible({ timeout: 30_000 });
  await page.clock.fastForward(5 * 60_000 + 1000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(all).toHaveAccessibleName(/1\.284 (de )?capturi$/, { timeout: 30_000 });
  const badge = all.locator('.rounded-full').filter({ hasText: '999+' });
  await expect(badge).toBeVisible();
  for (const tab of await tablist.getByRole('tab').all()) {
    const t = (await tab.boundingBox())!;
    const pill = tab.locator('.rounded-full');
    if (!(await pill.count())) continue;
    const b = (await pill.first().boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(t.x);
    expect(b.x + b.width).toBeLessThanOrEqual(t.x + t.width + 0.5);
    // The pill keeps its figure on one line, never cut inside it.
    expect(await pill.first().evaluate(el => el.scrollWidth <= el.clientWidth + 0.5)).toBe(true);
  }
});

/**
 * The Clasament route's own skeleton (CompetitionRoute's fallback, `ranking` variant) as a reader
 * sees it: from Informații, Clasament is opened over a slow network (20 kB/s: slower, and the band's
 * own shell holds the screen until the release), so its stream shows the skeleton for seconds. Resolves once the skeleton's view switcher is on screen.
 */
async function holdRankingSkeleton(page: Page, id: string, viewport: { width: number; height: number }) {
  await open(page, `/concursuri/${id}/informatii`, viewport);
  await settle(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: 20_000, uploadThroughput: -1 });
  await page.getByRole('navigation', { name: 'Secțiunile concursului' }).getByRole('link', { name: /^Clasament/ }).click();
  await expect(page.locator('[data-skeleton-views]').locator('visible=true')).toBeVisible({ timeout: 60_000 });
  return () => cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
}

for (const vp of [PHONE, DESKTOP]) {
  test(`competition-page.b.view-tabs — the page skeleton draws the view switcher's own box (y and height), so nothing under it jumps when it lands (${vp.width}px)`, async ({ page }) => {
    const release = await holdRankingSkeleton(page, ID.live, vp);
    const bones = page.locator('[data-skeleton-views]').locator('visible=true');
    const bone = (await bones.boundingBox())!;
    // The shape too: the phone's track is the full row; from 768 a content-sized control.
    if (vp.width < 768) expect(bone.width).toBeGreaterThan(vp.width - 40);
    else expect(bone.width).toBeLessThan(800);
    await release();
    const tablist = page.getByRole('tablist', { name: 'Vederi clasament' }).locator('visible=true');
    await expect(tablist).toBeVisible({ timeout: 45_000 });
    if (vp.width >= 768) await expect(page.getByRole('group', { name: 'Concursul pe scurt' })).toBeVisible({ timeout: 30_000 });
    await settle(page);
    const loaded = (await tablist.boundingBox())!;
    expect(Math.abs(loaded.height - bone.height)).toBeLessThan(1);
    expect(Math.abs(loaded.y - bone.y)).toBeLessThan(1);
    if (vp.width < 768) expect(Math.abs(loaded.width - bone.width)).toBeLessThan(1);
  });
}

test('competition-page.b.view-tabs — signed out, a weighing open in the public statistics: the strip says «Cântar în curs» and the Cântare tab carries the live dot (one rule for both)', async ({ page }) => {
  await page.clock.install();
  let open = false;
  await page.route(new RegExp(`/competitions/${ID.live}/weighing-statistics`), async route => {
    const res = await route.fetch();
    const body = await res.json();
    if (open && body.data?.length) {
      const last = body.data[body.data.length - 1];
      body.data.push({ ...last, id: 999_999, documentId: 'e2e-open-weighing', startDate: new Date(Date.now() - 5 * 60_000).toISOString(), endDate: null, weighingType: 'normal' });
    }
    await route.fulfill({ response: res, json: body });
  });
  await page.setViewportSize(DESKTOP);
  await page.goto(`/concursuri/${ID.live}`, { waitUntil: 'domcontentloaded' });
  const strip = page.getByRole('group', { name: 'Concursul pe scurt' });
  const tab = page.getByRole('tablist', { name: 'Vederi clasament' }).getByRole('tab', { name: /^Cântare/ });
  await expect(tab).toBeVisible({ timeout: 45_000 });
  await expect(strip).toBeVisible({ timeout: 45_000 });
  // Before: no session open — neither says so.
  await expect(strip.getByText('Cântar în curs')).toHaveCount(0);
  await expect(tab).not.toContainText('cântar în curs');
  // The live poll re-reads the public statistics, now with an open session.
  open = true;
  await page.clock.runFor(61_000);
  await expect(strip.getByText('Cântar în curs')).toBeVisible({ timeout: 30_000 });
  await expect(tab).toContainText('cântar în curs');
});
