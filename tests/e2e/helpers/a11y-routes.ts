import { expect, type Locator, type Page } from '@playwright/test';
import { getLakeAvailability, getOwnedLakes, getMyBookingsPage, getLakeBookings, offeredExtras } from '@/core/booking';
import { getCompetition, getCompetitionRegistrations, getCompetitionsByStatus, registrationAction, type CompetitionStatus } from '@/core/competitions';
import { getNews } from '@/core/news';
import { findSectorForStand, getOrganizerCompetitions, getWeighings, getAllocatedParticipants, supportsPenalties } from '@/core/organizer';
import { getCommunityHistory, getSessionCatches } from '@/core/partide';
import { getAnglerFollowers, getAnglerFollowing, getAnglerProfile, getProfile, getSuggestedAnglers } from '@/core/social';
import { createTestTransport } from '../../transport';
import { chatMessage, installFakeChat, minutesAgo, systemMessage } from './fake-chat';

/*
 * The route table of the M8 accessibility audit (tests/e2e/a11y-audit.spec.ts, parity
 * global.b.a11y-audit): every page.tsx under app/(site), one row per route pattern, with
 *  - `auth`: who opens it — guest (signed out), user (the QA account), organizer / operator (the
 *    same QA account: it holds the Organizer role and owns the local Chita lake);
 *  - `path(ids)`: the concrete URL, ids resolved below through core/ against the local CMS (the
 *    same reads the app makes), like helpers/fixtures.ts — a pinned id is only a hint;
 *  - `expectPath`: where the page must still be after it settled. Default: the requested pathname —
 *    a row that redirects never scans the screen it is named after. Only a route whose whole job is
 *    to redirect (/operator, /partide/sesiune/*) declares where it lands;
 *  - `setup`: read mocks installed before the navigation (a state the local data does not have:
 *    a running competition, a pending booking, a chat thread — READS only, writes are answered by
 *    the spec's readOnly and Firestore never sees a request);
 *  - `ready`: what must be on screen before the scan (the table, not the empty state);
 *  - `states`: extra UI states scanned after the page (dialogs, sheets, a refused submit…).
 *
 * A row whose id the local DB does not have FAILS (the spec asserts the path), unless it is marked
 * `optional` — then it skips and the run's summary names it. `ROUTE_FILES` is the page.tsx list the
 * spec compares against the folder tree, so a new page without a row fails the audit.
 */

export type Auth = 'guest' | 'user' | 'organizer' | 'operator';

export type Ids = {
  competition: Record<CompetitionStatus, string | null>;
  /**
   * A competition whose stand has weighings (scale history / revisions), and a registration on an
   * allocated stand of one of its sectors (the penalty form; resolveApplyTarget's «ready»).
   */
  scale: { competition: string; stand: string; weighing: string; registration: string | null } | null;
  /** A free Chita stand that offers extras, for two nights (stand/start/end query of the booking and walk-in steps). */
  slot: string | null;
  /** A not-started competition the QA user organizes (edit wizard). */
  ownUpcoming: string | null;
  /** A not-started competition the QA user organizes that still has a free seat (the guest form, not «Concursul este complet»). */
  ownOpen: string | null;
  /** A not-started competition the QA user can still register for (the form, not «Înscrierea nu este disponibilă»). */
  registrable: string | null;
  lake: string;
  water: string;
  news: string | null;
  sponsor: string | null;
  /** A finished community partidă with ≥ 2 catches and photos (the table, its max row, the gallery). */
  partida: string | null;
  /** Another angler — never the QA user (the follow button, someone else's connections). */
  angler: string | null;
  self: string | null;
  booking: string | null;
  operatorBooking: string | null;
};

export type UiState = {
  name: string;
  /** Opens the state; resolves to the scope the scan is limited to (a dialog), or null = whole page. */
  open: (page: Page, ids: Ids) => Promise<string | null>;
  /** Only at these widths (the control lives in one breakpoint's layout). Default: every width. */
  widths?: number[];
};

export type A11yRoute = {
  /** The app/(site) route pattern, as its folder path (route groups dropped). */
  pattern: string;
  auth: Auth;
  path: (ids: Ids) => string | null;
  /** Where the page settles. Default: exactly the requested pathname. */
  expectPath?: RegExp;
  /** A fixture the local DB may lack without failing the run (named in the summary). */
  optional?: true;
  /** Read mocks before the navigation (see the header). */
  setup?: (page: Page, ids: Ids) => Promise<void>;
  /** Asserts the screen holds what the row is about before it is scanned. */
  ready?: (page: Page, width: number) => Promise<void>;
  states?: UiState[];
  /** CSS selectors axe leaves out — each with the reason (third-party canvas, CMS-authored HTML). */
  exclude?: string[];
  note?: string;
  /** Tells two rows of one pattern apart in the test title (a competition's status). */
  variant?: string;
};

/** maplibre-gl draws into a <canvas> with its own control markup (third party): not ours to fix. */
export const MAPLIBRE = '.maplibregl-map';

/**
 * An open modal or popover: the kit's native <dialog> (Dialog, Sheet, ModalSurface), the FilterBar's
 * role=dialog panel, a role=alertdialog popover (Contactează-ne on desktop). axe skips the hidden ones.
 */
export const OPEN_DIALOG = 'dialog[open], [role="dialog"], [role="alertdialog"]';

/** Waits for a VISIBLE modal: a closed panel that stays mounted (focus return) is never the one scanned. */
export async function waitForOpenDialog(page: Page) {
  await page.locator(OPEN_DIALOG).locator('visible=true').first().waitFor({ state: 'visible', timeout: 10_000 });
}

const visible = (l: Locator) => l.locator('visible=true').first();

const dialog = (name: RegExp | string): UiState['open'] => async (page) => {
  await visible(page.getByRole('button', { name })).click({ timeout: 10_000 });
  await waitForOpenDialog(page);
  return OPEN_DIALOG;
};

/**
 * A refused submit (ROADMAP §5: the error state is where aria-invalid / aria-describedby / the
 * summary's links break): `prepare` empties what must be filled, `submit` is the primary action
 * (a write would be answered by the spec's readOnly — validation refuses first), `shown` is what
 * the refusal puts on screen. The whole page is scanned.
 */
function refusedSubmit(
  submit: (page: Page) => Locator,
  shown: (page: Page) => Locator = (page) => page.locator('[aria-invalid="true"]'),
  prepare?: (page: Page) => Promise<void>,
  name = 'submit empty',
): UiState {
  return {
    name,
    open: async (page) => {
      if (prepare) await prepare(page);
      await visible(submit(page)).click({ timeout: 10_000 });
      await expect(visible(shown(page))).toBeVisible({ timeout: 10_000 });
      return null;
    },
  };
}

/** Opens the consent preferences dialog from the page's «Setări de confidențialitate» entry. */
const consentDialog: UiState = {
  name: 'consent preferences dialog',
  open: async (page) => {
    await visible(page.getByRole('link', { name: /Setări de confidențialitate/ })).click({ timeout: 10_000 });
    await waitForOpenDialog(page);
    return OPEN_DIALOG;
  },
};

/**
 * «N urmăritori»: a Sheet / Dialog under 1280, the non-modal docked SidePanel (<aside>) from 1280
 * (Followers.tsx DockedPanel) — the scan covers whichever opened.
 */
const followers: UiState = {
  name: 'followers',
  open: async (page) => {
    await visible(page.getByRole('button', { name: /urmăritor/ })).click({ timeout: 10_000 });
    const panel = page.getByRole('complementary', { name: 'Urmăritori' });
    await page.locator(OPEN_DIALOG).locator('visible=true').first().or(panel).first().waitFor({ state: 'visible', timeout: 10_000 });
    return `${OPEN_DIALOG}, aside[aria-labelledby]`;
  },
};

/* ——— read mocks (GET only: the spec's readOnly answers every write) ——— */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/** Edits a real GET through /api/cms (the CMS answers, the test changes what the page reads). */
async function patchGet(page: Page, pathname: string | ((p: string) => boolean), edit: (body: Json) => Json) {
  const hit = (p: string) => (typeof pathname === 'string' ? p === pathname : pathname(p));
  await page.route(
    (url) => hit(url.pathname),
    async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const res = await route.fetch();
      return route.fulfill({ response: res, json: edit(await res.json()) });
    },
  );
}

/** The viewer's statute in a competition (author: the organizer actions; participant: the member rooms). */
async function statute(page: Page, userRole: 'author' | 'participant') {
  await page.route(
    (url) => url.pathname.startsWith('/api/cms/user/profile/competition/') && url.pathname.endsWith('/statute'),
    (route) => route.fulfill({ json: { userRole, isReferee: false, isParticipant: userRole === 'participant' } }),
  );
}

/** The competition read served as running (a penalty, a weighing entry only exist while it runs). */
const running = (page: Page, competition: string) =>
  patchGet(page, `/api/cms/feed/competitions/${competition}`, (b) => ({ ...b, data: { ...b.data, competitionStatus: 'started' } }));

/**
 * A booking read served as a pending request five days ahead, cancellable (the local QA user has
 * none): the angler's «Anulează» and the operator's «Refuză» / «Acceptă» need one.
 */
async function pendingBooking(page: Page, id: string) {
  const start = new Date(Date.now() + 5 * 86_400_000);
  start.setHours(18, 0, 0, 0);
  const end = new Date(start.getTime() + 2 * 86_400_000);
  await patchGet(page, `/api/cms/feed/bookings/${id}`, (body) => {
    const b = body?.data ?? body;
    const next = {
      ...b,
      bookingStatus: 'pending',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      // Optional in the schema (not nullable): left out, as the CMS sends a live booking.
      cancelledBy: undefined,
      cancelledAt: undefined,
      cancelReason: undefined,
      noShow: false,
      lake: b?.lake ? { ...b.lake, minCancelNoticeHours: 0 } : b?.lake,
    };
    return body?.data ? { ...body, data: next } : next;
  });
}

const OPERATOR_SHEET = `${OPEN_DIALOG}, aside:has([data-testid="booking-detail-actions"])`;

/** The operator's booking sheet over the inbox (?rezervare=, the URL the row writes). */
async function openOperatorSheet(page: Page, ids: Ids) {
  const url = new URL(page.url());
  if (url.searchParams.get('rezervare') !== ids.operatorBooking) {
    url.searchParams.set('rezervare', ids.operatorBooking!);
    await page.goto(`${url.pathname}${url.search}`, { waitUntil: 'domcontentloaded' });
  }
  // A sheet / dialog under 1280, the docked side panel (<aside>) from 1280 (ResponsiveSurface).
  const sheet = page.getByRole('dialog', { name: 'Detalii rezervare' }).or(page.getByRole('complementary', { name: 'Detalii rezervare' }));
  await expect(sheet).toBeVisible({ timeout: 30_000 });
  await expect(sheet.getByTestId('booking-detail-actions')).toBeVisible({ timeout: 30_000 });
  return sheet;
}

/** A coloured photo as a data URL (no network) — concurs-chat-mesaje.spec.ts's. */
function photo(id: string, w = 1200, h = 900, tone = '6265f1') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#${tone}"/></svg>`;
  const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  return { id, url, thumbnailUrl: url, width: w, height: h, blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj' };
}

/**
 * The chat thread through helpers/fake-chat.ts (reads only: the fake serves every read and records
 * any write, the Firebase hosts are aborted): text from others and from me, a referee, a photo, a
 * reply, event cards — what the bubbles, the event cards and the photo viewer render.
 */
async function chatThread(page: Page, ids: Ids) {
  const fake = await installFakeChat(page);
  const me = { senderId: ids.self ?? 'u-me', senderName: 'Sim QA' };
  const messages = [
    systemMessage('competition:start', '🏁 Concursul a început', { id: 'e-start', createdAt: minutesAgo(120) }),
    systemMessage('competition:participants-allocation', '📍 Alocarea pe standuri a fost publicată', { id: 'e-alloc', createdAt: minutesAgo(110), link: { kind: 'allocation' } }),
    chatMessage({ id: 'a11y-1', text: 'Salut, pescari! Cum merge?', createdAt: minutesAgo(60) }),
    chatMessage({ id: 'a11y-2', text: 'Atenție la start', senderId: 'u-ref', senderName: 'Radu Arbitru', senderRole: 'referee', createdAt: minutesAgo(50) }),
    chatMessage({ id: 'a11y-3', text: 'Prima captură a zilei', createdAt: minutesAgo(40), attachments: [photo('ph1')] }),
    chatMessage({ id: 'a11y-4', text: 'Bravo!', createdAt: minutesAgo(30), ...me, replyTo: { messageId: 'a11y-3', senderId: 'u-ion', senderName: 'Ion Pescaru', text: 'Prima captură a zilei', hasAttachments: true } }),
    systemMessage('competition:weighing-end', '⚖️ A3 · Ion Pescaru: 2 pești, 12,450 kg', { id: 'e-w1', createdAt: minutesAgo(20), link: { kind: 'weighing', id: 'w-1', params: { standId: 's-a3', standName: 'A3', sectorName: 'A' } } }),
    chatMessage({ id: 'a11y-5', text: 'Mulțumesc, mai încerc o dată la stand.', createdAt: minutesAgo(5), ...me }),
  ];
  // A member lands on «Participanți» (participant.chat.c5): the thread is there; General has one line.
  await fake.seed({ rooms: { participants: { messages }, general: { messages: [chatMessage({ id: 'g-1', text: 'Pentru toată lumea', createdAt: minutesAgo(10) })] } }, consent: 'present' });
  await statute(page, 'participant');
  await page.route(
    (url) => /^\/api\/cms\/feed\/competitions\/[^/]+\/my-status$/.test(url.pathname),
    (route) => route.fulfill({ json: { data: { isFollowing: true, userRegistrationStatus: 'registered' } } }),
  );
  await page.route(
    (url) => /^\/api\/cms\/feed\/competitions\/[^/]+\/notification-preferences$/.test(url.pathname),
    (route) => (route.request().method() === 'GET' ? route.fulfill({ json: { groups: [], extraMuted: [] } }) : route.fallback()),
  );
}

const comp = (s: CompetitionStatus, tail = '') => (ids: Ids) => (ids.competition[s] ? `/concursuri/${ids.competition[s]}${tail}` : null);

export const A11Y_ROUTES: A11yRoute[] = [
  // ——— Public
  {
    pattern: '/',
    auth: 'guest',
    path: () => '/',
// The top bar's search: from 768 (the phone has fish's chrome, no top bar — §4b rule 25).
    states: [consentDialog, { name: 'contact', open: dialog(/^Contactează-ne/) }, { name: 'search palette', open: dialog(/^Caută( bălți, concursuri, pescari)?$/), widths: [768, 1280] }],
  },
  { pattern: '/', auth: 'user', path: () => '/' },
  { pattern: '/[...rest]', auth: 'guest', path: () => '/nu-exista-pagina-asta' },
  { pattern: '/cookie-uri', auth: 'guest', path: () => '/cookie-uri' },
  { pattern: '/intra', auth: 'guest', path: () => '/intra' },
  { pattern: '/stiri', auth: 'guest', path: () => '/stiri' },
  { pattern: '/stiri/[id]', auth: 'guest', path: (i) => (i.news ? `/stiri/${i.news}` : null), exclude: [], note: 'CMS rich text' },
  { pattern: '/sponsori/[id]', auth: 'guest', path: (i) => (i.sponsor ? `/sponsori/${i.sponsor}` : null) },
  {
    pattern: '/concursuri',
    auth: 'guest',
    path: () => '/concursuri',
    states: [{ name: 'filters', open: dialog(/^Filtre/) }, followers],
  },
  { pattern: '/concursuri/live', auth: 'guest', path: () => '/concursuri/live' },
  { pattern: '/concursuri/viitoare', auth: 'guest', path: () => '/concursuri/viitoare' },
  { pattern: '/concursuri/rezultate', auth: 'guest', path: () => '/concursuri/rezultate' },
  { pattern: '/concursuri/[id]', auth: 'guest', path: comp('started'), variant: 'live', states: [followers] },
  { pattern: '/concursuri/[id]', auth: 'guest', path: comp('completed'), variant: 'încheiat' },
  { pattern: '/concursuri/[id]', auth: 'user', path: comp('notStarted'), variant: 'viitor' },
  { pattern: '/concursuri/[id]/clasament', auth: 'guest', path: comp('completed', '/clasament') },
  { pattern: '/concursuri/[id]/clasament/imagine', auth: 'guest', path: comp('completed', '/clasament/imagine') },
  { pattern: '/concursuri/[id]/cantare', auth: 'guest', path: comp('completed', '/cantare') },
  { pattern: '/concursuri/[id]/capturi', auth: 'guest', path: comp('completed', '/capturi') },
  { pattern: '/concursuri/[id]/extra-cantare', auth: 'guest', path: comp('completed', '/extra-cantare') },
  { pattern: '/concursuri/[id]/informatii', auth: 'guest', path: comp('notStarted', '/informatii') },
  { pattern: '/concursuri/[id]/participanti', auth: 'guest', path: comp('notStarted', '/participanti') },
  { pattern: '/concursuri/[id]/regulament', auth: 'guest', path: comp('notStarted', '/regulament'), note: 'CMS rich text' },
  { pattern: '/concursuri/[id]/sectoare', auth: 'organizer', path: (i) => (i.scale ? `/concursuri/${i.scale.competition}/sectoare` : null) },
  { pattern: '/concursuri/[id]/statistici', auth: 'guest', path: comp('completed', '/statistici') },
  { pattern: '/concursuri/[id]/statistici/cronologie', auth: 'guest', path: comp('completed', '/statistici/cronologie') },
  { pattern: '/balti', auth: 'guest', path: () => '/balti', states: [{ name: 'filters', open: dialog(/^Filtre/) }, { name: 'species', open: dialog(/^Specie/), widths: [1280] }, { name: 'search', open: dialog(/^Deschide căutarea pentru bălți/), widths: [375] }] },
  { pattern: '/balti/harta', auth: 'guest', path: () => '/balti/harta', exclude: [MAPLIBRE] },
  {
    pattern: '/balti/[id]',
    auth: 'guest',
    path: (i) => `/balti/${i.lake}`,
    states: [
      { name: 'share', open: dialog(/^Distribuie balta/) },
      { name: 'directions', open: dialog(/^Direcții/) },
      // <768 the hero is a link to /galerie (its viewer is scanned on that row).
      { name: 'photo viewer', open: dialog(/^Deschide fotografia 1/), widths: [1280] },
    ],
  },
  {
    pattern: '/balti/[id]/galerie',
    auth: 'guest',
    path: (i) => `/balti/${i.lake}/galerie`,
    states: [{ name: 'photo viewer', open: dialog(/^Deschide fotografia bălții/) }],
  },
  ...['capturi', 'clasament', 'concursuri', 'partide', 'recenzii', 'standuri', 'statistici'].map(
    (tab): A11yRoute => ({ pattern: `/balti/[id]/${tab}`, auth: 'guest', path: (i) => `/balti/${i.lake}/${tab}` }),
  ),
  { pattern: '/balti/[id]/harta', auth: 'guest', path: (i) => `/balti/${i.lake}/harta`, exclude: [MAPLIBRE] },
  { pattern: '/ape-publice', auth: 'guest', path: () => '/ape-publice', exclude: [MAPLIBRE] },
  { pattern: '/ape-publice/[id]', auth: 'guest', path: (i) => `/ape-publice/${i.water}`, exclude: [MAPLIBRE] },
  ...['capturi', 'clasament', 'partide', 'statistici'].map(
    (tab): A11yRoute => ({ pattern: `/ape-publice/[id]/${tab}`, auth: 'guest', path: (i) => `/ape-publice/${i.water}/${tab}` }),
  ),
  { pattern: '/ape-publice/[id]/harta', auth: 'guest', path: (i) => `/ape-publice/${i.water}/harta`, exclude: [MAPLIBRE] },
  { pattern: '/partide', auth: 'guest', path: () => '/partide' },
  { pattern: '/partide', auth: 'user', path: () => '/partide' },
  { pattern: '/partide/exploreaza', auth: 'guest', path: () => '/partide/exploreaza' },
  { pattern: '/partide/clasament', auth: 'guest', path: () => '/partide/clasament' },
  { pattern: '/partide/[id]', auth: 'guest', path: (i) => (i.partida ? `/partide/${i.partida}` : null) },
  {
    pattern: '/partide/[id]/capturi',
    auth: 'guest',
    path: (i) => (i.partida ? `/partide/${i.partida}/capturi` : null),
    // The catches themselves (CatchesTable from 768 — «–» + sr-only «necântărită», the max row — the
    // day list under it), never the empty state.
    ready: async (page, width) => {
      const list = page.getByTestId(width >= 768 ? 'catches-table' : 'catches-list');
      await expect(list).toBeVisible({ timeout: 30_000 });
      await expect(width >= 768 ? list.locator('tbody tr').first() : list.locator('li').first()).toBeVisible();
      // The max row's highlight (the table's «Cea mai mare» badge).
      if (width >= 768) await expect(list.getByText('Cea mai mare')).toBeVisible();
    },
  },
  {
    pattern: '/partide/[id]/galerie',
    auth: 'guest',
    path: (i) => (i.partida ? `/partide/${i.partida}/galerie` : null),
    ready: async (page) => {
      await expect(page.getByTestId('gallery-body').getByRole('button').first()).toBeVisible({ timeout: 30_000 });
    },
    states: [
      {
        name: 'photo viewer',
        open: async (page) => {
          await page.getByTestId('gallery-body').getByRole('button').first().click();
          await waitForOpenDialog(page);
          return OPEN_DIALOG;
        },
      },
    ],
  },
  { pattern: '/pescari', auth: 'user', path: () => '/pescari' },
  // Signed out, someone's profile is the sign-in fallback (AnglerProfileFallback).
  { pattern: '/pescari/[id]', auth: 'guest', path: (i) => (i.angler ? `/pescari/${i.angler}` : null) },
  {
    pattern: '/pescari/[id]',
    auth: 'user',
    path: (i) => (i.angler ? `/pescari/${i.angler}` : null),
    // Another angler's profile: the follow control is there (never the own-profile view).
    ready: async (page) => {
      await expect(visible(page.getByRole('button', { name: /^(Urmărește|Urmăresc)/ }))).toBeVisible({ timeout: 30_000 });
    },
  },
  { pattern: '/pescari/[id]/conexiuni', auth: 'user', path: (i) => (i.angler ? `/pescari/${i.angler}/conexiuni` : null) },
  { pattern: '/sondaje', auth: 'guest', path: () => '/sondaje' },
  { pattern: '/sondaje/anterioare', auth: 'guest', path: () => '/sondaje/anterioare' },

  // ——— Signed in (the QA user)
  { pattern: '/notificari', auth: 'user', path: () => '/notificari' },
  { pattern: '/profil', auth: 'user', path: () => '/profil' },
  {
    pattern: '/profil/completeaza',
    auth: 'user',
    path: () => '/profil/completeaza',
    states: [refusedSubmit((p) => p.getByRole('button', { name: 'Finalizează' }), undefined, (p) => visible(p.getByLabel('Nume utilizator*')).fill(''), 'submit without a username')],
  },
  { pattern: '/setari', auth: 'user', path: () => '/setari', states: [consentDialog] },
  {
    pattern: '/setari/profil',
    auth: 'user',
    path: () => '/setari/profil',
    states: [refusedSubmit((p) => p.getByRole('button', { name: 'Finalizează' }), undefined, (p) => visible(p.getByLabel('Nume utilizator*')).fill(''), 'submit without a username')],
  },
  { pattern: '/setari/notificari', auth: 'user', path: () => '/setari/notificari' },
  { pattern: '/setari/notificari/concursuri', auth: 'user', path: () => '/setari/notificari/concursuri' },
  { pattern: '/pescari/sugerati', auth: 'user', path: () => '/pescari/sugerati' },
  { pattern: '/rezervari', auth: 'user', path: () => '/rezervari' },
  {
    pattern: '/rezervari/[id]',
    auth: 'user',
    path: (i) => (i.booking ? `/rezervari/${i.booking}` : null),
    // The QA user's bookings are all past: the read is served as a pending one ahead (cancellable).
    setup: (page, i) => pendingBooking(page, i.booking!),
    states: [{ name: 'cancel confirm', open: dialog(/^Anulează$/) }],
  },
  { pattern: '/balti/[id]/rezerva', auth: 'user', path: (i) => `/balti/${i.lake}/rezerva` },
  {
    pattern: '/balti/[id]/rezerva/extra',
    auth: 'user',
    path: (i) => (i.slot ? `/balti/${i.lake}/rezerva/extra?${i.slot}` : null),
    ready: async (page) => {
      await expect(page.getByRole('checkbox').first()).toBeVisible({ timeout: 30_000 });
    },
  },
  { pattern: '/balti/[id]/rezerva/confirmare', auth: 'user', path: (i) => (i.slot ? `/balti/${i.lake}/rezerva/confirmare?${i.slot}` : null) },
  {
    pattern: '/balti/[id]/recenzie',
    auth: 'user',
    path: (i) => `/balti/${i.lake}/recenzie`,
    states: [refusedSubmit((p) => p.getByTestId('review-submit'))],
  },
  { pattern: '/partide/ale-mele', auth: 'user', path: () => '/partide/ale-mele' },
  { pattern: '/partide/capturile-mele', auth: 'user', path: () => '/partide/capturile-mele' },
  { pattern: '/partide/istoric', auth: 'user', path: () => '/partide/istoric' },
  { pattern: '/partide/statistici', auth: 'user', path: () => '/partide/statistici' },
  {
    pattern: '/partide/sesiune/[clientId]',
    auth: 'user',
    path: () => '/partide/sesiune/e2e-a11y-unknown',
    expectPath: /^\/partide\/ale-mele$/,
    note: 'resolves and replaces itself (unknown id → Ale mele)',
  },
  {
    pattern: '/concursuri/[id]/inscriere',
    auth: 'user',
    path: (i) => (i.registrable ? `/concursuri/${i.registrable}/inscriere` : null),
    ready: async (page) => {
      await expect(visible(page.getByTestId('registration-submit'))).toBeVisible({ timeout: 30_000 });
    },
    // A profile without a phone: the form asks for it, so a submit is refused (error summary + field).
    setup: (page) => patchGet(page, '/api/cms/user/profile', (b) => ({ ...b, phone: null })),
    states: [refusedSubmit((p) => p.getByTestId('registration-submit'), (p) => p.getByRole('group', { name: /câmp(uri)? trebuie corectat/ }))],
  },
  { pattern: '/concursuri/[id]/inscriere/echipa', auth: 'user', path: comp('notStarted', '/inscriere/echipa'), note: 'disclaimer gates, no form fields' },
  {
    pattern: '/concursuri/[id]/inscriere/fara-cont',
    auth: 'organizer',
    path: (i) => (i.ownOpen ? `/concursuri/${i.ownOpen}/inscriere/fara-cont` : null),
    ready: async (page) => {
      await expect(visible(page.getByTestId('guests-submit'))).toBeVisible({ timeout: 30_000 });
    },
    states: [refusedSubmit((p) => p.getByTestId('guests-submit'), (p) => p.locator('[aria-invalid="true"], [role="group"][aria-labelledby]').filter({ hasText: /trebuie|obligatoriu/ }).or(p.locator('[aria-invalid="true"]')))],
  },
  {
    pattern: '/concursuri/[id]/chat',
    auth: 'user',
    path: comp('started', '/chat'),
    setup: chatThread,
    ready: async (page) => {
      await expect(visible(page.getByText('Salut, pescari! Cum merge?'))).toBeVisible({ timeout: 60_000 });
      await expect(visible(page.getByText('Mulțumesc, mai încerc o dată la stand.'))).toBeVisible();
    },
    states: [
      {
        name: 'photo viewer',
        open: async (page) => {
          await visible(page.getByRole('button', { name: 'Imagine 1 din 1' })).click();
          await expect(page.getByTestId('chat-media-viewer')).toBeVisible({ timeout: 10_000 });
          return `[data-testid="chat-media-viewer"], ${OPEN_DIALOG}`;
        },
      },
    ],
    note: 'Firestore through helpers/fake-chat.ts (reads only)',
  },

  // ——— Organizer (the QA user holds the Organizer role)
  { pattern: '/organizator', auth: 'organizer', path: () => '/organizator' },
  {
    pattern: '/organizator/concursuri/nou/[pas]',
    auth: 'organizer',
    path: () => '/organizator/concursuri/nou/detalii',
    states: [
      {
        name: 'invalid name',
        open: async (page) => {
          const name = visible(page.getByLabel('Numele competiției *'));
          await name.fill('Cu');
          await name.press('Tab');
          await expect(name).toHaveAttribute('aria-invalid', 'true');
          return null;
        },
      },
      { name: 'leave guard', open: dialog('Ieși din asistent') },
      {
        // T4Header moves focus to the new step's h1 (owner rule 8: no ring on it).
        name: 'next step (Enter on Continuă)',
        open: async (page) => {
          await visible(page.getByTestId('wizard-next')).focus();
          await page.keyboard.press('Enter');
          await page.waitForURL((u) => /\/organizator\/concursuri\/nou\/(?!detalii)[^/]+$/.test(u.pathname), { timeout: 15_000 });
          await expect.poll(() => page.evaluate(() => document.activeElement?.tagName === 'H1' && !!document.activeElement.closest('main'))).toBe(true);
          return null;
        },
      },
    ],
  },
  { pattern: '/concursuri/[id]/editeaza/[pas]', auth: 'organizer', path: (i) => (i.ownUpcoming ? `/concursuri/${i.ownUpcoming}/editeaza/detalii` : null) },
  {
    pattern: '/concursuri/[id]/alocare',
    auth: 'organizer',
    path: (i) => (i.ownUpcoming ? `/concursuri/${i.ownUpcoming}/alocare` : null),
    states: [{ name: 'stand picker', open: dialog(/^Sector .+: .+(Alege|Schimbă) participantul$/) }],
  },
  { pattern: '/concursuri/[id]/cantar', auth: 'organizer', path: (i) => (i.scale ? `/concursuri/${i.scale.competition}/cantar` : null) },
  { pattern: '/concursuri/[id]/cantar/[standId]', auth: 'organizer', path: (i) => (i.scale ? `/concursuri/${i.scale.competition}/cantar/${i.scale.stand}` : null) },
  {
    pattern: '/concursuri/[id]/cantar/[standId]/[weighingId]',
    auth: 'organizer',
    path: (i) => (i.scale ? `/concursuri/${i.scale.competition}/cantar/${i.scale.stand}/${i.scale.weighing}` : null),
    // The weighing as its author sees it while it is open (the local ones are finished): the catch
    // actions, «Finalizează cântarul», the entry dialog.
    setup: async (page, i) => {
      await statute(page, 'author');
      await running(page, i.scale!.competition);
      await patchGet(page, `/api/cms/feed/weighings/${i.scale!.weighing}`, (b) => ({ ...b, weighingStatus: 'started' }));
    },
    ready: async (page) => {
      await expect(visible(page.getByRole('button', { name: 'Adaugă captură' }))).toBeVisible({ timeout: 30_000 });
    },
    states: [{ name: 'add catch', open: dialog(/^Adaugă captură$/) }],
  },
  {
    pattern: '/concursuri/[id]/cantar/[standId]/[weighingId]/modificari',
    auth: 'organizer',
    path: (i) => (i.scale ? `/concursuri/${i.scale.competition}/cantar/${i.scale.stand}/${i.scale.weighing}/modificari` : null),
  },
  { pattern: '/concursuri/[id]/penalizari', auth: 'organizer', path: (i) => (i.scale ? `/concursuri/${i.scale.competition}/penalizari` : null) },
  { pattern: '/concursuri/[id]/penalizari/stand', auth: 'organizer', path: (i) => (i.scale ? `/concursuri/${i.scale.competition}/penalizari/stand` : null) },
  {
    pattern: '/concursuri/[id]/penalizari/aplica',
    auth: 'organizer',
    path: (i) => (i.scale?.registration ? `/concursuri/${i.scale.competition}/penalizari/aplica?inscriere=${i.scale.registration}` : null),
    // A penalty exists only while the competition runs (canPickPenaltyStand): served «started», the
    // viewer its author (concurs-penalizari-aplica.spec.ts does the same) — else the page goes to the hub.
    setup: async (page, i) => {
      await statute(page, 'author');
      await running(page, i.scale!.competition);
    },
    ready: async (page) => {
      await expect(page.getByRole('heading', { level: 1, name: 'Aplică penalizare' })).toBeVisible({ timeout: 30_000 });
      await expect(visible(page.getByTestId('penalty-apply-submit'))).toBeVisible();
    },
    states: [
      refusedSubmit(
        (p) => p.getByTestId('penalty-apply-submit'),
        undefined,
        (p) => p.locator('label').filter({ has: p.getByRole('radio', { name: /^Penalizare greutate/ }) }).first().click(),
        'weight penalty, submit empty',
      ),
    ],
  },

  // ——— Operator (the QA user owns Chita)
  { pattern: '/operator', auth: 'operator', path: () => '/operator', expectPath: /^\/operator\/[^/]+$/, note: 'one owned lake → its dashboard' },
  { pattern: '/operator/[lakeId]', auth: 'operator', path: (i) => `/operator/${i.lake}` },
  {
    pattern: '/operator/[lakeId]/rezervari',
    auth: 'operator',
    path: (i) => `/operator/${i.lake}/rezervari`,
    // The sheet's actions need a request to answer: the booking read is served pending.
    setup: (page, i) => pendingBooking(page, i.operatorBooking!),
    states: [
      {
        name: 'booking detail sheet',
        open: async (page, i) => {
          await openOperatorSheet(page, i);
          return OPERATOR_SHEET;
        },
      },
      {
        name: 'refuse confirm',
        open: async (page, i) => {
          const sheet = await openOperatorSheet(page, i);
          await sheet.getByRole('button', { name: 'Refuză' }).click();
          await expect(page.getByRole('dialog', { name: 'Respinge rezervarea' }).or(page.getByRole('alertdialog', { name: 'Respinge rezervarea' }))).toBeVisible({ timeout: 10_000 });
          return OPEN_DIALOG;
        },
      },
    ],
  },
  { pattern: '/operator/[lakeId]/calendar', auth: 'operator', path: (i) => `/operator/${i.lake}/calendar` },
  {
    pattern: '/operator/[lakeId]/calendar/extra',
    auth: 'operator',
    path: (i) => (i.slot ? `/operator/${i.lake}/calendar/extra?${i.slot}` : null),
    ready: async (page) => {
      await expect(page.getByRole('checkbox').first()).toBeVisible({ timeout: 30_000 });
    },
  },
  { pattern: '/operator/[lakeId]/calendar/confirmare', auth: 'operator', path: (i) => (i.slot ? `/operator/${i.lake}/calendar/confirmare?${i.slot}` : null) },
  { pattern: '/operator/[lakeId]/blocaje', auth: 'operator', path: (i) => `/operator/${i.lake}/blocaje` },
  {
    pattern: '/operator/[lakeId]/blocaje/nou',
    auth: 'operator',
    path: (i) => `/operator/${i.lake}/blocaje/nou`,
    states: [refusedSubmit((p) => p.getByRole('button', { name: 'Salvează și închide' }), (p) => p.getByTestId('block-date-error'))],
  },
  { pattern: '/operator/evalueaza/[bookingId]', auth: 'operator', path: (i) => (i.operatorBooking ? `/operator/evalueaza/${i.operatorBooking}` : null) },
];

/** Rows whose fixture the local DB did not resolve: required ones fail the run, optional ones skip. */
export function unresolvedRows(ids: Ids) {
  const missing = A11Y_ROUTES.filter((r) => r.path(ids) == null);
  return { required: missing.filter((r) => !r.optional), optional: missing.filter((r) => r.optional) };
}

/* ——— id discovery ——— */

const CHITA = process.env.E2E_LAKE_CHITA ?? 's84u55lo4n9z0emngozttt6e';
/** Snagov (ape-publice.spec.ts): every fact present. The ids come from the bundled water dataset. */
const WATER = process.env.E2E_WATER ?? '2245';
/** Pinned hints (concurs-cantar-istoric.spec.ts): a completed competition, a stand with 6 weighings. */
const SCALE_HINT = { competition: 'i8kzbi5k51vmbyq75dmyez3d', stand: 'mxai2v2orwupnoxu9vxn5iph' };
const ANGLER_HINT = 'vsfh2zhq9fkie6njt0ciok5u';

const first = async <T>(p: Promise<T>) => p.catch(() => null);

type Transport = ReturnType<typeof createTestTransport>;

export async function discoverIds(jwt: string): Promise<Ids> {
  const guest = createTestTransport();
  const user = createTestTransport(jwt);

  const status = async (s: CompetitionStatus) =>
    (await first(getCompetitionsByStatus(guest, s, { page: 1, pageSize: 5 })))?.data[0]?.documentId ?? null;
  const [started, notStarted, completed] = await Promise.all([status('started'), status('notStarted'), status('completed')]);

  const news = (await first(getNews(guest, { page: 1, pageSize: 1 })))?.data[0]?.documentId ?? null;
  const sponsorRes = await first(fetch(`${process.env.E2E_CMS_URL ?? 'http://localhost:1337/api'}/feed/sponsors/dashboard`).then((r) => r.json()));
  const sponsor = (sponsorRes as { data?: { documentId: string }[] } | null)?.data?.[0]?.documentId ?? null;

  const partida = await richPartida(guest);

  const profile = await first(getProfile(user));
  const self = (profile as { documentId?: string } | null)?.documentId ?? null;
  const angler = await otherAngler(user, self, started ?? completed);

  const lakes = await first(getOwnedLakes(user));
  const owned = (lakes as { documentId: string }[] | null)?.map((l) => l.documentId) ?? [];
  const lake = owned.includes(CHITA) ? CHITA : (owned[0] ?? CHITA);

  const mine = await first(getMyBookingsPage(user, { bucket: 'all', page: 1, pageSize: 5 }));
  const booking = mine?.data[0]?.documentId ?? null;
  const ops = await first(getLakeBookings(user, lake, { bucket: 'all', page: 1, pageSize: 25 }));
  const operatorBooking = ops?.data.find((b) => b.bookingStatus === 'completed')?.documentId ?? ops?.data[0]?.documentId ?? null;

  // A stand with weighings: the pinned hint when the CMS still has it, else the first allocated
  // stand of a completed competition that has one.
  let scale: Ids['scale'] = null;
  const tryScale = async (competition: string, stand: string) => {
    const w = await first(getWeighings(guest, competition, stand));
    const weighing = (w as { documentId: string }[] | null)?.[0]?.documentId;
    if (weighing) scale = { competition, stand, weighing, registration: null };
  };
  await tryScale(SCALE_HINT.competition, SCALE_HINT.stand);
  if (!scale && completed) {
    const allocated = await first(getAllocatedParticipants(user, completed));
    const stands = ((allocated as { stand?: { documentId?: string } }[] | null) ?? []).map((a) => a.stand?.documentId).filter(Boolean);
    for (const stand of stands.slice(0, 5)) if (!scale) await tryScale(completed, stand!);
  }

  if (scale) {
    // The penalty form opens only for a registration on an allocated stand of a sector, in a
    // ranking type with penalties (resolveApplyTarget / canPickPenaltyStand; the status is served).
    const s = scale as NonNullable<Ids['scale']>;
    const c = await first(getCompetition(guest, s.competition));
    if (c && supportsPenalties(c.rankingType)) {
      const regs = await first(getCompetitionRegistrations(user, s.competition));
      const sectors = (c.sectors ?? []) as { stands: { id: string | number; documentId?: string }[] }[];
      s.registration =
        (regs as { documentId: string; stand?: { documentId?: string } | null }[] | null)?.find((r) => r.stand?.documentId && findSectorForStand(sectors, r.stand.documentId))
          ?.documentId ?? null;
    }
  }

  const slot = await freeSlot(user, lake);

  const organized = await first(getOrganizerCompetitions(user, { status: 'notStarted', page: 1, pageSize: 5 }));
  const ownList = (organized as { data?: { documentId: string }[] } | null)?.data ?? [];
  const ownUpcoming = ownList[0]?.documentId ?? null;
  let ownOpen: string | null = null;
  for (const o of ownList) {
    const c = await first(getCompetition(user, o.documentId));
    const approved = c?.registrations.filter((r) => r.registrationStatus === 'registered').length ?? 0;
    if (c && c.competitionStatus === 'notStarted' && (c.participantsLimit == null || c.participantsLimit - approved >= 1)) {
      ownOpen = o.documentId;
      break;
    }
  }
  const registrable = await registrableCompetition(user, self);

  return {
    competition: { started, notStarted, completed } as Ids['competition'],
    scale,
    slot,
    ownUpcoming,
    ownOpen,
    registrable,
    lake,
    water: WATER,
    news,
    sponsor,
    partida,
    angler,
    self,
    booking,
    operatorBooking,
  };
}

/**
 * A not-started competition whose «Înscrie-te» the QA user is offered (registrationAction, the gate
 * the form applies) and has no entry in yet — the create form, not a gate or a locked entry.
 */
async function registrableCompetition(user: Transport, self: string | null): Promise<string | null> {
  const now = new Date();
  for (let page = 1; page <= 3; page++) {
    const list = await first(getCompetitionsByStatus(user, 'notStarted', { page, pageSize: 25 }));
    for (const item of list?.data ?? []) {
      const c = await first(getCompetition(user, item.documentId));
      if (!c) continue;
      const mine = c.registrations.some((r) => (r.participants ?? []).some((p) => p.documentId === self));
      const action = registrationAction(c, self, now);
      if (!mine && !action.disabled && action.label === 'Înscrie-te') return item.documentId;
    }
    if (!list || page >= list.meta.pagination.pageCount) break;
  }
  return null;
}

/**
 * A community partidă worth auditing: ≥ 2 catches (the table and its max row) and photos (the
 * gallery). Preferred: one with an unweighed catch (the «–» + sr-only «necântărită» cell).
 */
async function richPartida(t: Transport): Promise<string | null> {
  const candidates: string[] = [];
  for (let page = 1; page <= 4 && candidates.length < 8; page++) {
    const h = await first(getCommunityHistory(t, { page, pageSize: 25 }));
    for (const s of h?.data ?? []) if (s.documentId && s.catchCount >= 2 && (s.photoCount ?? s.photos?.length ?? 0) > 0) candidates.push(s.documentId);
    if (!h || page >= h.meta.pagination.pageCount) break;
  }
  for (const id of candidates) {
    const c = await first(getSessionCatches(t, id, { pageSize: 50 }));
    if ((c?.data ?? []).some((x) => (x as { weightKg?: number | null }).weightKg == null)) return id;
  }
  return candidates[0] ?? null;
}

/**
 * Another angler than the QA user, with a profile the CMS serves: the pinned hint, then the
 * suggestions, the QA user's followers / following, a competition's participants. Null (the rows
 * fail) when only the QA user resolves.
 */
async function otherAngler(user: Transport, self: string | null, competition: string | null): Promise<string | null> {
  const ids: string[] = [ANGLER_HINT];
  const suggested = await first(getSuggestedAnglers(user, { page: 1, pageSize: 10 }));
  ids.push(...(suggested?.friendsOfFollows ?? []).map((a) => a.documentId), ...(suggested?.recentlyActive.data ?? []).map((a) => a.documentId));
  if (self) {
    for (const list of [getAnglerFollowers(user, self, { page: 1, pageSize: 10 }), getAnglerFollowing(user, self, { page: 1, pageSize: 10 })]) {
      ids.push(...((await first(list))?.data ?? []).map((a) => a.documentId));
    }
  }
  if (competition) {
    const regs = await first(getCompetitionRegistrations(user, competition));
    for (const r of (regs as { participants?: { documentId?: string }[] }[] | null) ?? []) ids.push(...(r.participants ?? []).map((p) => p.documentId ?? ''));
  }
  for (const id of [...new Set(ids)]) {
    if (!id || id === self) continue;
    // The profile read is signed-in only (auth: 'required'): a guest read always fails.
    if (await first(getAnglerProfile(user, id))) return id;
  }
  return null;
}

/* A free stand that offers extras for days +3 18:00 → +5 18:00 (or the next free pair of nights), as rezerva-extra.spec.ts picks it. */
const pad = (n: number) => String(n).padStart(2, '0');
function iso(d: Date) {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}
function dayAt(offset: number, hour = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  d.setHours(hour);
  return d;
}

/**
 * The extras step renders only for a stand that can add something to THIS tour (extrasRedirect:
 * offeredForSelection > 0, else back to the grid): a stand with an extra, two nights (per-night ones count).
 */
async function freeSlot(t: Transport, lake: string): Promise<string | null> {
  for (let day = 3; day < 40; day += 2) {
    const start = iso(dayAt(day, 18));
    const end = iso(dayAt(day + 2, 18));
    const av = await first(getLakeAvailability(t, lake, { from: iso(dayAt(day - 1)), to: iso(dayAt(day + 4)) }));
    if (!av) return null;
    const busy = (id: string) =>
      [...av.bookings, ...av.blocks].some(
        (b) => (b.standDocumentId === id || b.standDocumentId === null) && Date.parse(b.start) < Date.parse(end) && Date.parse(b.end) > Date.parse(start),
      );
    const stand = av.stands.find((x) => !busy(x.documentId) && offeredExtras(x, av.extras, 2).length > 0);
    if (stand) return new URLSearchParams([['stand', stand.documentId], ['start', start], ['end', end]]).toString();
  }
  return null;
}
