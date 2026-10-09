import type { Page } from '@playwright/test';
import { getLakeAvailability, getOwnedLakes, getMyBookingsPage, getLakeBookings } from '@/core/booking';
import { getCompetitionRegistrations, getCompetitionsByStatus, type CompetitionStatus } from '@/core/competitions';
import { getNews } from '@/core/news';
import { getOrganizerCompetitions, getWeighings, getAllocatedParticipants } from '@/core/organizer';
import { getCommunityHistory } from '@/core/partide';
import { getAnglerProfile, getProfile } from '@/core/social';
import { createTestTransport } from '../../transport';

/*
 * The route table of the M8 accessibility audit (tests/e2e/a11y-audit.spec.ts, parity
 * global.b.a11y-audit): every page.tsx under app/(site), one row per route pattern, with
 *  - `auth`: who opens it — guest (signed out), user (the QA account), organizer / operator (the
 *    same QA account: it holds the Organizer role and owns the local Chita lake);
 *  - `path(ids)`: the concrete URL, ids resolved below through core/ against the local CMS (the
 *    same reads the app makes), like helpers/fixtures.ts — a pinned id is only a hint;
 *  - `states`: extra UI states scanned after the page (dialogs: filters, share, contact…).
 *
 * A route whose id the local DB does not have resolves to null and its test skips with the reason.
 * `ROUTE_FILES` is the page.tsx list the spec compares against the folder tree, so a new page
 * without a row fails the audit.
 */

export type Auth = 'guest' | 'user' | 'organizer' | 'operator';

export type Ids = {
  competition: Record<CompetitionStatus, string | null>;
  /** A competition whose stand has weighings (scale history / revisions). */
  scale: { competition: string; stand: string; weighing: string; registration: string | null } | null;
  /** A free Chita stand for two nights (stand/start/end query of the booking and walk-in steps). */
  slot: string | null;
  /** A not-started competition the QA user organizes (edit wizard). */
  ownUpcoming: string | null;
  lake: string;
  water: string;
  news: string | null;
  sponsor: string | null;
  partida: string | null;
  angler: string;
  self: string | null;
  booking: string | null;
  operatorBooking: string | null;
};

export type UiState = {
  name: string;
  /** Opens the state; resolves to the scope the scan is limited to (a dialog), or null = whole page. */
  open: (page: Page) => Promise<string | null>;
  /** Only at these widths (the control lives in one breakpoint's layout). Default: every width. */
  widths?: number[];
};

export type A11yRoute = {
  /** The app/(site) route pattern, as its folder path (route groups dropped). */
  pattern: string;
  auth: Auth;
  path: (ids: Ids) => string | null;
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

const dialog = (name: RegExp | string): UiState['open'] => async (page) => {
  const button = page.getByRole('button', { name }).locator('visible=true').first();
  await button.click({ timeout: 10_000 });
  await waitForOpenDialog(page);
  return OPEN_DIALOG;
};

/** Opens the consent preferences dialog from the page's «Setări de confidențialitate» entry. */
const consentDialog: UiState = {
  name: 'consent preferences dialog',
  open: async (page) => {
    await page.getByRole('link', { name: /Setări de confidențialitate/ }).locator('visible=true').first().click({ timeout: 10_000 });
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
    await page.getByRole('button', { name: /urmăritor/ }).locator('visible=true').first().click({ timeout: 10_000 });
    const panel = page.getByRole('complementary', { name: 'Urmăritori' });
    await page.locator(OPEN_DIALOG).locator('visible=true').first().or(panel).first().waitFor({ state: 'visible', timeout: 10_000 });
    return `${OPEN_DIALOG}, aside[aria-labelledby]`;
  },
};

const comp = (s: CompetitionStatus, tail = '') => (ids: Ids) => (ids.competition[s] ? `/concursuri/${ids.competition[s]}${tail}` : null);

export const A11Y_ROUTES: A11yRoute[] = [
  // ——— Public
  {
    pattern: '/',
    auth: 'guest',
    path: () => '/',
    states: [consentDialog, { name: 'contact', open: dialog(/^Contactează-ne/) }, { name: 'search palette', open: dialog(/^Caută( bălți, concursuri, pescari)?$/) }],
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
  { pattern: '/partide/[id]/capturi', auth: 'guest', path: (i) => (i.partida ? `/partide/${i.partida}/capturi` : null) },
  { pattern: '/partide/[id]/galerie', auth: 'guest', path: (i) => (i.partida ? `/partide/${i.partida}/galerie` : null) },
  { pattern: '/pescari', auth: 'user', path: () => '/pescari' },
  { pattern: '/pescari/[id]', auth: 'guest', path: (i) => `/pescari/${i.angler}` },
  { pattern: '/pescari/[id]', auth: 'user', path: (i) => `/pescari/${i.angler}` },
  { pattern: '/pescari/[id]/conexiuni', auth: 'user', path: (i) => `/pescari/${i.angler}/conexiuni` },
  { pattern: '/sondaje', auth: 'guest', path: () => '/sondaje' },
  { pattern: '/sondaje/anterioare', auth: 'guest', path: () => '/sondaje/anterioare' },

  // ——— Signed in (the QA user)
  { pattern: '/notificari', auth: 'user', path: () => '/notificari' },
  { pattern: '/profil', auth: 'user', path: () => '/profil' },
  { pattern: '/profil/completeaza', auth: 'user', path: () => '/profil/completeaza' },
  { pattern: '/setari', auth: 'user', path: () => '/setari', states: [consentDialog] },
  { pattern: '/setari/profil', auth: 'user', path: () => '/setari/profil' },
  { pattern: '/setari/notificari', auth: 'user', path: () => '/setari/notificari' },
  { pattern: '/setari/notificari/concursuri', auth: 'user', path: () => '/setari/notificari/concursuri' },
  { pattern: '/pescari/sugerati', auth: 'user', path: () => '/pescari/sugerati' },
  { pattern: '/rezervari', auth: 'user', path: () => '/rezervari' },
  { pattern: '/rezervari/[id]', auth: 'user', path: (i) => (i.booking ? `/rezervari/${i.booking}` : null) },
  { pattern: '/balti/[id]/rezerva', auth: 'user', path: (i) => `/balti/${i.lake}/rezerva` },
  { pattern: '/balti/[id]/rezerva/extra', auth: 'user', path: (i) => (i.slot ? `/balti/${i.lake}/rezerva/extra?${i.slot}` : null) },
  { pattern: '/balti/[id]/rezerva/confirmare', auth: 'user', path: (i) => (i.slot ? `/balti/${i.lake}/rezerva/confirmare?${i.slot}` : null) },
  { pattern: '/balti/[id]/recenzie', auth: 'user', path: (i) => `/balti/${i.lake}/recenzie` },
  { pattern: '/partide/ale-mele', auth: 'user', path: () => '/partide/ale-mele' },
  { pattern: '/partide/capturile-mele', auth: 'user', path: () => '/partide/capturile-mele' },
  { pattern: '/partide/istoric', auth: 'user', path: () => '/partide/istoric' },
  { pattern: '/partide/statistici', auth: 'user', path: () => '/partide/statistici' },
  { pattern: '/partide/sesiune/[clientId]', auth: 'user', path: () => '/partide/sesiune/e2e-a11y-unknown', note: 'resolves and replaces itself (unknown id → Ale mele)' },
  { pattern: '/concursuri/[id]/inscriere', auth: 'user', path: comp('notStarted', '/inscriere') },
  { pattern: '/concursuri/[id]/inscriere/echipa', auth: 'user', path: comp('notStarted', '/inscriere/echipa') },
  { pattern: '/concursuri/[id]/inscriere/fara-cont', auth: 'organizer', path: (i) => (i.ownUpcoming ? `/concursuri/${i.ownUpcoming}/inscriere/fara-cont` : null) },
  { pattern: '/concursuri/[id]/chat', auth: 'user', path: comp('started', '/chat'), note: 'Firestore aborted (shared project, no writes)' },

  // ——— Organizer (the QA user holds the Organizer role)
  { pattern: '/organizator', auth: 'organizer', path: () => '/organizator' },
  { pattern: '/organizator/concursuri/nou/[pas]', auth: 'organizer', path: () => '/organizator/concursuri/nou/detalii' },
  { pattern: '/concursuri/[id]/editeaza/[pas]', auth: 'organizer', path: (i) => (i.ownUpcoming ? `/concursuri/${i.ownUpcoming}/editeaza/detalii` : null) },
  { pattern: '/concursuri/[id]/alocare', auth: 'organizer', path: (i) => (i.ownUpcoming ? `/concursuri/${i.ownUpcoming}/alocare` : null) },
  { pattern: '/concursuri/[id]/cantar', auth: 'organizer', path: (i) => (i.scale ? `/concursuri/${i.scale.competition}/cantar` : null) },
  { pattern: '/concursuri/[id]/cantar/[standId]', auth: 'organizer', path: (i) => (i.scale ? `/concursuri/${i.scale.competition}/cantar/${i.scale.stand}` : null) },
  {
    pattern: '/concursuri/[id]/cantar/[standId]/[weighingId]',
    auth: 'organizer',
    path: (i) => (i.scale ? `/concursuri/${i.scale.competition}/cantar/${i.scale.stand}/${i.scale.weighing}` : null),
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
  },

  // ——— Operator (the QA user owns Chita)
  { pattern: '/operator', auth: 'operator', path: () => '/operator' },
  { pattern: '/operator/[lakeId]', auth: 'operator', path: (i) => `/operator/${i.lake}` },
  { pattern: '/operator/[lakeId]/rezervari', auth: 'operator', path: (i) => `/operator/${i.lake}/rezervari` },
  { pattern: '/operator/[lakeId]/calendar', auth: 'operator', path: (i) => `/operator/${i.lake}/calendar` },
  { pattern: '/operator/[lakeId]/calendar/extra', auth: 'operator', path: (i) => (i.slot ? `/operator/${i.lake}/calendar/extra?${i.slot}` : null) },
  { pattern: '/operator/[lakeId]/calendar/confirmare', auth: 'operator', path: (i) => (i.slot ? `/operator/${i.lake}/calendar/confirmare?${i.slot}` : null) },
  { pattern: '/operator/[lakeId]/blocaje', auth: 'operator', path: (i) => `/operator/${i.lake}/blocaje` },
  { pattern: '/operator/[lakeId]/blocaje/nou', auth: 'operator', path: (i) => `/operator/${i.lake}/blocaje/nou` },
  { pattern: '/operator/evalueaza/[bookingId]', auth: 'operator', path: (i) => (i.operatorBooking ? `/operator/evalueaza/${i.operatorBooking}` : null) },
];

/* ——— id discovery ——— */

const CHITA = process.env.E2E_LAKE_CHITA ?? 's84u55lo4n9z0emngozttt6e';
/** Snagov (ape-publice.spec.ts): every fact present. The ids come from the bundled water dataset. */
const WATER = process.env.E2E_WATER ?? '2245';
/** Pinned hints (concurs-cantar-istoric.spec.ts): a completed competition, a stand with 6 weighings. */
const SCALE_HINT = { competition: 'i8kzbi5k51vmbyq75dmyez3d', stand: 'mxai2v2orwupnoxu9vxn5iph' };
const ANGLER_HINT = 'vsfh2zhq9fkie6njt0ciok5u';

const first = async <T>(p: Promise<T>) => p.catch(() => null);


export async function discoverIds(jwt: string): Promise<Ids> {
  const guest = createTestTransport();
  const user = createTestTransport(jwt);

  const status = async (s: CompetitionStatus) =>
    (await first(getCompetitionsByStatus(guest, s, { page: 1, pageSize: 5 })))?.data[0]?.documentId ?? null;
  const [started, notStarted, completed] = await Promise.all([status('started'), status('notStarted'), status('completed')]);

  const news = (await first(getNews(guest, { page: 1, pageSize: 1 })))?.data[0]?.documentId ?? null;
  const sponsorRes = await first(fetch(`${process.env.E2E_CMS_URL ?? 'http://localhost:1337/api'}/feed/sponsors/dashboard`).then((r) => r.json()));
  const sponsor = (sponsorRes as { data?: { documentId: string }[] } | null)?.data?.[0]?.documentId ?? null;

  const history = await first(getCommunityHistory(guest, { page: 1, pageSize: 5 }));
  const partida = (history as { data?: { documentId?: string }[] } | null)?.data?.find((s) => s.documentId)?.documentId ?? null;

  const profile = await first(getProfile(user));
  const self = (profile as { documentId?: string } | null)?.documentId ?? null;
  const angler = (await first(getAnglerProfile(guest, ANGLER_HINT))) ? ANGLER_HINT : (self ?? ANGLER_HINT);

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
    const s = scale as NonNullable<Ids['scale']>;
    const regs = await first(getCompetitionRegistrations(user, s.competition));
    s.registration = (regs as { documentId: string; stand?: unknown }[] | null)?.find((r) => r.stand)?.documentId ?? null;
  }

  const slot = await freeSlot(user, lake);

  const organized = await first(getOrganizerCompetitions(user, { status: 'notStarted', page: 1, pageSize: 5 }));
  const ownUpcoming = (organized as { data?: { documentId: string }[] } | null)?.data?.[0]?.documentId ?? null;

  return {
    competition: { started, notStarted, completed } as Ids['competition'],
    scale,
    slot,
    ownUpcoming,
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

/* A free stand for days +3 18:00 → +5 18:00 (or the next free pair of nights), as rezerva-extra.spec.ts picks it. */
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

async function freeSlot(t: ReturnType<typeof createTestTransport>, lake: string): Promise<string | null> {
  for (let day = 3; day < 40; day += 2) {
    const start = iso(dayAt(day, 18));
    const end = iso(dayAt(day + 2, 18));
    const av = await first(getLakeAvailability(t, lake, { from: iso(dayAt(day - 1)), to: iso(dayAt(day + 4)) }));
    if (!av) return null;
    const busy = (id: string) =>
      [...av.bookings, ...av.blocks].some(
        (b) => (b.standDocumentId === id || b.standDocumentId === null) && Date.parse(b.start) < Date.parse(end) && Date.parse(b.end) > Date.parse(start),
      );
    const stand = av.stands.find((x) => !busy(x.documentId));
    if (stand) return new URLSearchParams([['stand', stand.documentId], ['start', start], ['end', end]]).toString();
  }
  return null;
}
