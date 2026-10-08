/**
 * Public URL scheme — the one place page paths are built, so the sitemap, OpenGraph, links in
 * notifications and the future pages agree. Slugs are a UI decision still open (see the spec);
 * until then the documentId is the stable identifier. Romanian segments, as in the app copy.
 */
export type CompetitionTabStatus = 'notStarted' | 'started' | 'completed';

/** The organizer's registration filter on /concursuri/[id]/participanti (`filtru`). */
export type ParticipantsFilter = 'in-asteptare' | 'aprobati' | 'respinsi';

/**
 * The create / edit competition wizard's steps, in order (fish step-basics, step-config,
 * step-ranking, step-lake-sectors, step-stand-allocation, step-review).
 */
export const WIZARD_STEPS = ['detalii', 'configurare', 'clasament', 'lac-si-sectoare', 'standuri', 'revizuire'] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export type WizardOptions = {
  /** Where the wizard returns to (fish returnTo). Only a same-origin relative path is kept (safeReturnPath). */
  inapoi?: string;
  /** The rich text field open over step 1 (organizer.rich-text-editor). */
  editor?: 'descriere' | 'premii' | 'regulament';
  /** The ranking type whose explanation is open over step 3 (organizer.ranking-explanation). */
  explicatie?: string;
};

/** A booking flow selection in the URL (?stand&start&end[&extra…]): angler flow and operator walk-in. */
export type BookingSelection = { stand: string; start: string; end: string; extras?: string[] };

const bookingSelectionQuery = (sel: BookingSelection) =>
  new URLSearchParams([['stand', sel.stand], ['start', sel.start], ['end', sel.end], ...(sel.extras ?? []).map((e) => ['extra', e])]);

/** The operator inbox's ?status= deep-link vocabulary (operator.b.status-param; fish bucketFromLegacyStatus). */
export type OperatorBookingsStatus = 'pending' | 'cancelled' | 'rejected' | 'toreview' | 'all';

/** Header facts of «Evaluează pescarul» carried in its URL (fish rate-angler params). */
export type OperatorRateAnglerParams = {
  anglerName?: string;
  anglerId?: string;
  anglerAvatar?: string;
  standName?: string;
  startDate?: string;
  endDate?: string;
};

/**
 * `href` with the operator booking detail dialog open on `bookingId` (?rezervare=; operator.detaliu-rezervare):
 * keeps the page's own query and hash, replaces an earlier `rezervare`.
 */
export function withBookingDetail(href: string, bookingId: string): string {
  const hashAt = href.indexOf('#');
  const hash = hashAt >= 0 ? href.slice(hashAt) : '';
  const noHash = hashAt >= 0 ? href.slice(0, hashAt) : href;
  const qAt = noHash.indexOf('?');
  const path = qAt >= 0 ? noHash.slice(0, qAt) : noHash;
  const q = new URLSearchParams(qAt >= 0 ? noHash.slice(qAt + 1) : '');
  q.set('rezervare', bookingId);
  return `${path}?${q}${hash}`;
}

/**
 * `raw` when it is a same-origin relative path («/organizator», «/concursuri/abc?tab=x»), else null:
 * no scheme, no protocol-relative «//host», no backslash (browsers read «/\host» as «//host»), no
 * control characters. Use it on every return target read from a URL (`inapoi`) before navigating.
 */
export function safeReturnPath(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) return null;
  if (raw.includes('\\') || /[\u0000-\u001f\u007f]/.test(raw)) return null;
  try {
    const base = 'https://bluvi.invalid';
    const url = new URL(raw, base);
    if (url.origin !== base) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function wizardQuery(opts: WizardOptions & { ciorna?: string }): string {
  const q = new URLSearchParams();
  if (opts.ciorna) q.set('ciorna', opts.ciorna);
  const back = safeReturnPath(opts.inapoi);
  if (back) q.set('inapoi', back);
  if (opts.editor) q.set('editor', opts.editor);
  if (opts.explicatie) q.set('explicatie', opts.explicatie);
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** The Concursuri tabs' own path segments (/concursuri/viitoare · /live · /rezultate). */
export const COMPETITION_TAB_SLUG = { notStarted: 'viitoare', started: 'live', completed: 'rezultate' } as const satisfies Record<
  CompetitionTabStatus,
  string
>;

export const routes = {
  home: () => '/',
  lakes: () => '/balti',
  /** The lakes results map (lakes.results-map); search and filters ride in the query (balti/_list/url.ts). */
  lakesMap: (query = '') => (query ? `/balti/harta?${query}` : '/balti/harta'),
  /** Public waters map (area public-waters); the Bălți / Ape publice toggle links here. */
  publicWaters: () => '/ape-publice',
  lake: (documentId: string) => `/balti/${encodeURIComponent(documentId)}`,
  // The lake page's subpages (parity docs/parity/areas/lakes.yml, fish app/(app)/lakes/[lakeId]/*).
  lakeGallery: (documentId: string) => `/balti/${encodeURIComponent(documentId)}/galerie`,
  lakePartide: (documentId: string) => `/balti/${encodeURIComponent(documentId)}/partide`,
  /** The lake's statistics (lakes.stats); `perioada`: week | month (default, left out) | year. */
  lakeStats: (documentId: string, perioada?: 'week' | 'month' | 'year') =>
    `/balti/${encodeURIComponent(documentId)}/statistici${perioada && perioada !== 'month' ? `?perioada=${perioada}` : ''}`,
  /** `tab`: live (default, left out) | viitoare | trecute (lakes.competitions.c6). */
  lakeCompetitions: (documentId: string, tab?: 'live' | 'viitoare' | 'trecute') =>
    `/balti/${encodeURIComponent(documentId)}/concursuri${tab && tab !== 'live' ? `?tab=${tab}` : ''}`,
  /** Every catch photo at the lake (lakes.catches); `foto` opens the lightbox on that catch (clientId). */
  lakeCatches: (documentId: string, foto?: string) =>
    `/balti/${encodeURIComponent(documentId)}/capturi${foto ? `?foto=${encodeURIComponent(foto)}` : ''}`,
  /** Anglers' ranking at the lake (lakes.anglers-ranking); `perioada`: week | month (default, left out) | year. */
  lakeRanking: (documentId: string, perioada?: 'week' | 'month' | 'year') =>
    `/balti/${encodeURIComponent(documentId)}/clasament${perioada && perioada !== 'month' ? `?perioada=${perioada}` : ''}`,
  /** Stand ranking (lakes.stands-ranking); defaults (month, kg) are left out of the URL. */
  lakeStands: (documentId: string, { perioada, sortare }: { perioada?: 'week' | 'month' | 'year'; sortare?: 'kg' | 'catches' | 'record' } = {}) => {
    const q = new URLSearchParams();
    if (perioada && perioada !== 'month') q.set('perioada', perioada);
    if (sortare && sortare !== 'kg') q.set('sortare', sortare);
    const s = q.toString();
    return `/balti/${encodeURIComponent(documentId)}/standuri${s ? `?${s}` : ''}`;
  },
  lakeMap: (documentId: string) => `/balti/${encodeURIComponent(documentId)}/harta`,
  lakeReviews: (documentId: string) => `/balti/${encodeURIComponent(documentId)}/recenzii`,
  /** Add / edit the viewer's review (lakes.review-form, M3); `rezervare`: the completed booking it verifies. */
  lakeReview: (documentId: string, { editare, rezervare }: { editare?: boolean; rezervare?: string } = {}) => {
    const q = new URLSearchParams();
    if (editare) q.set('editare', '1');
    if (rezervare) q.set('rezervare', rezervare);
    const s = q.toString();
    return `/balti/${encodeURIComponent(documentId)}/recenzie${s ? `?${s}` : ''}`;
  },
  lakeBooking: (documentId: string) => `/balti/${encodeURIComponent(documentId)}/rezerva`,
  /**
   * The booking flow's steps 2 and 3 (booking.rezerva-extra / -confirmare). The selection rides in
   * the query (?stand&start&end[&extra…]) so a reload or Back re-seeds it — the codec is
   * app/(site)/balti/[id]/rezerva/_flow/params.ts (readFlowParams); keep the two in step.
   */
  lakeBookingExtras: (documentId: string, sel: BookingSelection) =>
    `/balti/${encodeURIComponent(documentId)}/rezerva/extra?${bookingSelectionQuery(sel)}`,
  lakeBookingReview: (documentId: string, sel: BookingSelection) =>
    `/balti/${encodeURIComponent(documentId)}/rezerva/confirmare?${bookingSelectionQuery(sel)}`,
  /** Sign in, returning to `next` (a path with its query; /intra validates it). Home and /intra itself: plain /intra. */
  signIn: (next?: string) => (!next || next === '/' || next === '/intra' ? '/intra' : `/intra?next=${encodeURIComponent(next)}`),
  /**
   * The Concursuri list: /concursuri (Live when something is live, else Viitoare — decided by the
   * server), or one tab's own page (fish (tabs)/competitions `status`, competitions-list.index.c27).
   */
  competitions: (status?: CompetitionTabStatus) => (status ? `/concursuri/${COMPETITION_TAB_SLUG[status]}` : '/concursuri'),
  /**
   * /concursuri in results mode (competitions-list.results): a lake / organizer pick (by documentId,
   * its name as `label`) or a free-text search (`q`).
   */
  competitionsSearch: (search: { type: 'lake' | 'organizer' | 'text'; value: string; label: string }) => {
    const q = new URLSearchParams();
    if (search.type === 'text') q.set('q', search.value);
    else {
      q.set(search.type === 'lake' ? 'lakeId' : 'organizerId', search.value);
      q.set('label', search.label);
    }
    return `/concursuri?${q.toString()}`;
  },
  competition: (documentId: string) => `/concursuri/${encodeURIComponent(documentId)}`,
  competitionRanking: (documentId: string) => `/concursuri/${encodeURIComponent(documentId)}/clasament`,
  competitionInfo: (documentId: string) => `/concursuri/${encodeURIComponent(documentId)}/informatii`,
  /**
   * `filtru` (the organizer's registration filter, M6 organizer.participants): in-asteptare — the
   * pending registrations (fish participantsFilter=pending, the NEW_REGISTRATION_ORGANIZER
   * notification) · aprobati · respinsi. Ignored by the public list.
   */
  competitionParticipants: (documentId: string, filtru?: ParticipantsFilter) =>
    `/concursuri/${encodeURIComponent(documentId)}/participanti${filtru ? `?filtru=${filtru}` : ''}`,
  /**
   * The registration form (participant.register; fish /register/[competitionId]). Organizer mode
   * (fish asOrganizer=1 + registrationId): `organizator` + `inscriere` (a registration documentId) —
   * honoured only when the viewer authors the competition.
   */
  competitionRegister: (documentId: string, opts: { organizator?: boolean; inscriere?: string } = {}) => {
    const q = new URLSearchParams();
    if (opts.organizator) q.set('organizator', '1');
    if (opts.inscriere) q.set('inscriere', opts.inscriere);
    const qs = q.toString();
    return `/concursuri/${encodeURIComponent(documentId)}/inscriere${qs ? `?${qs}` : ''}`;
  },
  /** «Câteva lucruri de menționat» before a NEW team registration (participant.team-disclaimer). */
  competitionTeamDisclaimer: (documentId: string) => `/concursuri/${encodeURIComponent(documentId)}/inscriere/echipa`,
  /** Guests without an account (participant.register-guests): edit one (`inscriere`), team name only (`doarEchipa`). */
  competitionRegisterGuests: (documentId: string, opts: { inscriere?: string; doarEchipa?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (opts.inscriere) q.set('inscriere', opts.inscriere);
    if (opts.doarEchipa) q.set('doarEchipa', '1');
    const qs = q.toString();
    return `/concursuri/${encodeURIComponent(documentId)}/inscriere/fara-cont${qs ? `?${qs}` : ''}`;
  },
  /**
   * The competition chat (participant.chat; fish /competitions/[id]/chat?tab=). `tab`: the room —
   * `participanti` (fish `participants`) or `general`; left out, the page picks it (the room last
   * used here, else Participanți for a member once the statute is known, else General).
   */
  competitionChat: (documentId: string, tab?: 'general' | 'participanti') =>
    `/concursuri/${encodeURIComponent(documentId)}/chat${tab ? `?tab=${tab}` : ''}`,
  competitionExtraScales: (documentId: string) => `/concursuri/${encodeURIComponent(documentId)}/extra-cantare`,
  competitionRules: (documentId: string) => `/concursuri/${encodeURIComponent(documentId)}/regulament`,
  /**
   * The Clasament's Cântare view (competition-page.cantare); `stand` (a stand documentId) opens that
   * stand's weighings — the web's way into a stand's history until the scale area (M6) ships.
   */
  competitionWeighings: (documentId: string, stand?: string) =>
    `/concursuri/${encodeURIComponent(documentId)}/cantare${stand ? `?stand=${encodeURIComponent(stand)}` : ''}`,
  /**
   * The weighing detail over the Cântare view (competition-page.cantar-detaliu): `stand` (a stand
   * documentId) is opened behind it, the dialog starts on `weighing` (fish openWeighingSheet).
   */
  competitionWeighing: (documentId: string, weighing: string, stand: string) =>
    `/concursuri/${encodeURIComponent(documentId)}/cantare?cantar=${encodeURIComponent(weighing)}&stand=${encodeURIComponent(stand)}`,
  /**
   * The ranking as an image (competition-page.imagine-clasament; fish ranking-image / ranking-image-cn).
   * `query` names the table (clasament/imagine/model.ts imageQueryString: «?sortare=loc&sector=B»).
   */
  competitionRankingImage: (documentId: string, query = '') => `/concursuri/${encodeURIComponent(documentId)}/clasament/imagine${query}`,
  /** The PNG itself (the same `query`): what the image page shows, «Descarcă» saves and «Distribuie» shares. */
  competitionRankingImageFile: (documentId: string, query = '') =>
    `/concursuri/${encodeURIComponent(documentId)}/clasament/imagine/png${query}`,
  /** The Clasament's Statistici view (competition-page.statistici). */
  competitionStatistics: (documentId: string) => `/concursuri/${encodeURIComponent(documentId)}/statistici`,
  /** The Clasament's «Toți peștii» view (competition-page.toti-pestii). */
  competitionCatches: (documentId: string) => `/concursuri/${encodeURIComponent(documentId)}/capturi`,
  /** «Cronologia standurilor», full page (competition-page.cronologie; fish stand-timeline/[id]). */
  competitionStandTimeline: (documentId: string) => `/concursuri/${encodeURIComponent(documentId)}/statistici/cronologie`,
  /** The ranking with an angler's stats open (competition-page.statistici-pescar): `registration` documentId. */
  competitionAngler: (documentId: string, registration: string) =>
    `/concursuri/${encodeURIComponent(documentId)}?pescar=${encodeURIComponent(registration)}`,
  news: () => '/stiri',
  newsItem: (documentId: string) => `/stiri/${encodeURIComponent(documentId)}`,
  sponsor: (documentId: string) => `/sponsori/${encodeURIComponent(documentId)}`,
  /**
   * The angler profile (account.angler-profile); `tab`: capturi (default, left out) | sesiuni |
   * concursuri. Legacy /anglers/<id> links (fish NEW_FOLLOWER) redirect here (next.config.ts, 308).
   */
  angler: (documentId: string, tab?: 'capturi' | 'sesiuni' | 'concursuri') =>
    `/pescari/${encodeURIComponent(documentId)}${tab && tab !== 'capturi' ? `?tab=${tab}` : ''}`,
  /** An angler's followers / following (account.connections; fish anglers/[id]/connections?tab=followers|following). */
  anglerConnections: (documentId: string, tab?: 'urmaritori' | 'urmareste') =>
    `/pescari/${encodeURIComponent(documentId)}/conexiuni${tab ? `?tab=${tab}` : ''}`,
  partida: (documentId: string) => `/partide/${encodeURIComponent(documentId)}`,
  /**
   * A partidă by its CLIENT id (the Firestore session id fish's PARTIDA_FINISHED /
   * PARTIDA_AUTO_CLOSE_WARN carry): resolves to /partide/[documentId] through the live pointer or
   * the own list, else Ale mele (partide.b.notif-finished-autoclose).
   */
  partidaSession: (clientId: string) => `/partide/sesiune/${encodeURIComponent(clientId)}`,
  partide: () => '/partide',
  // ── M4 Partide (docs/parity/areas/partide.yml). Pages that are not on the web yet are reached
  // only through lib/partide-pages.ts, whose helpers answer null until the page ships. Starting,
  // joining and running a partidă (start, join, capture, rods, member actions) are app-only on web
  // (owner 2026-10-08, ROADMAP §4b rule 21): lib/app-links.ts opens the app instead. ──
  /** The hub's «Explorează» tab (partide.exploreaza; fish (tabs)/partide sub-tab `partide`). */
  partideExplore: () => '/partide/exploreaza',
  /** The hub's «Ale mele» tab (partide.ale-mele; fish sub-tab `alemele`). */
  partideMine: () => '/partide/ale-mele',
  /**
   * The viewer's history (fish partide/istoric; parity partide.istoric): `sortare=greutate` (fish
   * «Greutate»), one `balti` per venue name picked (fish's venue filter matches names), `cu-capturi=1`.
   * Defaults left out.
   */
  partideHistory: (filters: { byWeight?: boolean; venues?: readonly string[]; withCaptures?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (filters.byWeight) q.set('sortare', 'greutate');
    for (const v of filters.venues ?? []) q.append('balti', v);
    if (filters.withCaptures) q.set('cu-capturi', '1');
    const s = q.toString();
    return `/partide/istoric${s ? `?${s}` : ''}`;
  },
  /** «Statistici comunitate» (fish partide/statistici); `perioada`: week | month (default, left out) | year. */
  partideStats: (perioada?: 'week' | 'month' | 'year') =>
    `/partide/statistici${perioada && perioada !== 'month' ? `?perioada=${perioada}` : ''}`,
  /** «Clasamente» (fish partide/clasament); `perioada` as partideStats, `tab` the ranking (first one left out). */
  partideRanking: (perioada?: 'week' | 'month' | 'year', tab?: string) => {
    const q = new URLSearchParams();
    if (perioada && perioada !== 'month') q.set('perioada', perioada);
    if (tab) q.set('tab', tab);
    const s = q.toString();
    return `/partide/clasament${s ? `?${s}` : ''}`;
  },
  /** The viewer's own catch gallery (fish partide/capturile-mele). */
  myCatches: () => '/partide/capturile-mele',
  /** Every catch of one partidă (fish community session catches). */
  partidaCatches: (documentId: string) => `/partide/${encodeURIComponent(documentId)}/capturi`,
  /** The photo gallery of one partidă. */
  partidaGallery: (documentId: string) => `/partide/${encodeURIComponent(documentId)}/galerie`,
  suggestedAnglers: () => '/pescari/sugerati',
  /**
   * Angler search (partide.pescari; fish /partide/pescari): «Urmăriți de prietenii tăi» + «Activi
   * recent», or the results for `q` (the settled search term, kept in the URL).
   */
  anglersSearch: (q?: string) => (q?.trim() ? `/pescari?q=${encodeURIComponent(q.trim())}` : '/pescari'),
  profile: () => '/profil',
  /** Edit the own profile (account.edit-profile; fish /edit-profile). */
  editProfile: () => '/setari/profil',
  /** Complete the profile after the first sign-in (account.complete-profile; fish /complete-profile). */
  completeProfile: () => '/profil/completeaza',
  settings: () => '/setari',
  notifications: () => '/notificari',
  /** Notification settings (account.notification-settings; fish /settings/notifications). */
  notificationSettings: () => '/setari/notificari',
  /** Followed competitions' notification preferences (account.notification-preferences). */
  notificationPreferences: () => '/setari/notificari/concursuri',
  /** The viewer's bookings (booking.yml, fish /bookings). */
  myBookings: () => '/rezervari',
  /** One of the viewer's bookings (booking.rezervare, fish /bookings/[id]); notifications land here. */
  booking: (documentId: string) => `/rezervari/${encodeURIComponent(documentId)}`,
  /** The current poll (fish /polls/current). */
  polls: () => '/sondaje',
  /** Past polls (participant.polls-past; fish /polls/past). */
  pollsPast: () => '/sondaje/anterioare',
  organizer: () => '/organizator',
  // ── M6 Organizer (docs/parity/areas/organizer.yml). Every page below is signed in only (proxy.ts)
  // and gated server-side (lib/server/require-organizer.ts); the CMS stays the authority. ──
  /**
   * The create-competition wizard (organizer.wizard; fish create-competition/step-*). `ciorna`: a
   * saved draft's documentId (fish draftId); `inapoi`: where «Închide» / publish-cancel returns
   * (fish returnTo — a same-origin relative path, else left out); `editor`: the rich text field open
   * over step 1 (organizer.rich-text-editor); `explicatie`: the ranking type whose explanation is
   * open over step 3 (organizer.ranking-explanation).
   */
  organizerCompetitionNew: (pas: WizardStep, opts: WizardOptions & { ciorna?: string } = {}) =>
    `/organizator/concursuri/nou/${pas}${wizardQuery(opts)}`,
  /** The same wizard over a published, not-started competition (fish params.competitionId + returnTo). */
  competitionEdit: (documentId: string, pas: WizardStep, opts: WizardOptions = {}) =>
    `/concursuri/${encodeURIComponent(documentId)}/editeaza/${pas}${wizardQuery(opts)}`,
  /** «Alocă standuri pe sectoare» (organizer.sectors; fish sector-stands/[competitionId]). */
  competitionSectors: (documentId: string) => `/concursuri/${encodeURIComponent(documentId)}/sectoare`,
  /**
   * «Alocă participanții pe standuri» (organizer.participants; fish allocate-participants). `mansa`:
   * the feeder leg being seated (N > 1; leg 1 and every other type leave it out).
   */
  competitionAllocation: (documentId: string, mansa?: number) =>
    `/concursuri/${encodeURIComponent(documentId)}/alocare${mansa && mansa > 1 ? `?mansa=${mansa}` : ''}`,
  /** The scale's stand picker «Alege standul» (organizer.scale; fish scale/[competitionId]). */
  competitionScale: (documentId: string) => `/concursuri/${encodeURIComponent(documentId)}/cantar`,
  /** One stand's weighings (organizer.scale-history; fish scale/[competitionId]/history). */
  competitionScaleStand: (documentId: string, standId: string) =>
    `/concursuri/${encodeURIComponent(documentId)}/cantar/${encodeURIComponent(standId)}`,
  /** One weighing: add catches, sign, close (organizer.scale-weighing; fish scale/[competitionId]/[weighingId]). */
  competitionScaleWeighing: (documentId: string, standId: string, weighingId: string) =>
    `/concursuri/${encodeURIComponent(documentId)}/cantar/${encodeURIComponent(standId)}/${encodeURIComponent(weighingId)}`,
  /** A weighing's change log (organizer.scale-revisions; fish weighing-revisions/[weighingId]). */
  competitionScaleRevisions: (documentId: string, standId: string, weighingId: string) =>
    `/concursuri/${encodeURIComponent(documentId)}/cantar/${encodeURIComponent(standId)}/${encodeURIComponent(weighingId)}/modificari`,
  /** The penalties hub (organizer.penalties; fish penalties/[competitionId]); PENALTY notifications land here. */
  competitionPenalties: (documentId: string) => `/concursuri/${encodeURIComponent(documentId)}/penalizari`,
  /** Pick the stand to penalise (organizer.penalties-select-stand). */
  competitionPenaltiesStand: (documentId: string) => `/concursuri/${encodeURIComponent(documentId)}/penalizari/stand`,
  /** Apply a penalty to one registration (organizer.penalties-apply; fish penalties/[competitionId]/apply). */
  competitionPenaltiesApply: (documentId: string, inscriere: string) =>
    `/concursuri/${encodeURIComponent(documentId)}/penalizari/aplica?inscriere=${encodeURIComponent(inscriere)}`,
  /**
   * M7 lake operator (docs/parity/areas/operator.yml). The panel of one lake (operator.panou), or the
   * lake picker «Administrare lacuri» without one (operator.alege-balta).
   */
  operator: (lakeId?: string) => (lakeId ? `/operator/${encodeURIComponent(lakeId)}` : '/operator'),
  /** The walk-in / availability grid, step 1 (operator.calendar; fish operator/[lakeId]/walk-in). */
  operatorCalendar: (lakeId: string) => `/operator/${encodeURIComponent(lakeId)}/calendar`,
  /**
   * The bookings inbox (operator.rezervari; fish operator/[lakeId]/bookings). `status` is the shared
   * deep-link vocabulary of the panel, Acasă and the notifications (operator.b.status-param); `focus`
   * brings one booking into view (operator.b.focus-param — pair it with status «all»).
   */
  operatorBookings: (lakeId: string, status?: OperatorBookingsStatus, focus?: string) => {
    const q = new URLSearchParams();
    if (status) q.set('status', status);
    if (focus) q.set('focus', focus);
    const s = q.toString();
    return `/operator/${encodeURIComponent(lakeId)}/rezervari${s ? `?${s}` : ''}`;
  },
  /** The stand blocks calendar (operator.blocaje; fish operator/[lakeId]/blocks). */
  operatorBlocks: (lakeId: string) => `/operator/${encodeURIComponent(lakeId)}/blocaje`,
  /** Create a stand block (operator.blocaj-nou; fish operator/[lakeId]/blocks/new). */
  operatorBlockNew: (lakeId: string) => `/operator/${encodeURIComponent(lakeId)}/blocaje/nou`,
  /**
   * The walk-in flow's steps 2 and 3 (extras / review). Same ?stand&start&end[&extra…] codec as
   * lakeBookingExtras / lakeBookingReview (app/(site)/balti/[id]/rezerva/_flow/params.ts readFlowParams).
   */
  operatorCalendarExtras: (lakeId: string, sel: BookingSelection) =>
    `/operator/${encodeURIComponent(lakeId)}/calendar/extra?${bookingSelectionQuery(sel)}`,
  operatorCalendarReview: (lakeId: string, sel: BookingSelection) =>
    `/operator/${encodeURIComponent(lakeId)}/calendar/confirmare?${bookingSelectionQuery(sel)}`,
  /**
   * Rate the angler of a finished booking (operator.evalueaza; fish operator/rate-angler/[bookingId]).
   * The header facts ride in the query, as fish's params do (no extra read to paint the header).
   */
  operatorRateAngler: (bookingId: string, p: OperatorRateAnglerParams = {}) => {
    const q = new URLSearchParams();
    if (p.anglerName) q.set('anglerName', p.anglerName);
    if (p.anglerId) q.set('anglerId', p.anglerId);
    if (p.anglerAvatar) q.set('anglerAvatar', p.anglerAvatar);
    if (p.standName) q.set('standName', p.standName);
    if (p.startDate) q.set('startDate', p.startDate);
    if (p.endDate) q.set('endDate', p.endDate);
    const s = q.toString();
    return `/operator/evalueaza/${encodeURIComponent(bookingId)}${s ? `?${s}` : ''}`;
  },
  // Public waters (ANAR): `id` is the bundled numeric row id or the stable linkCode («R:RO11_01.018_R1»),
  // which carries «:» and «.» — always encoded (parity public-waters.b.route-param).
  publicWater: (idOrCode: string | number) => `/ape-publice/${encodeURIComponent(String(idOrCode))}`,
  publicWaterMap: (idOrCode: string | number) => `/ape-publice/${encodeURIComponent(String(idOrCode))}/harta`,
  publicWaterPartide: (idOrCode: string | number) => `/ape-publice/${encodeURIComponent(String(idOrCode))}/partide`,
  /** `perioada`: week | month (default, left out) | year (public-waters.b.period-param). */
  publicWaterStats: (idOrCode: string | number, perioada?: 'week' | 'month' | 'year') =>
    `/ape-publice/${encodeURIComponent(String(idOrCode))}/statistici${perioada && perioada !== 'month' ? `?perioada=${perioada}` : ''}`,
  publicWaterRanking: (idOrCode: string | number, perioada?: 'week' | 'month' | 'year') =>
    `/ape-publice/${encodeURIComponent(String(idOrCode))}/clasament${perioada && perioada !== 'month' ? `?perioada=${perioada}` : ''}`,
  /** `foto` opens the lightbox on that catch (clientId), as from the partide rail (public-waters.partide.c8). */
  publicWaterCatches: (idOrCode: string | number, foto?: string) =>
    `/ape-publice/${encodeURIComponent(String(idOrCode))}/capturi${foto ? `?foto=${encodeURIComponent(foto)}` : ''}`,
} as const;

/**
 * Pages the web does not have yet, shared by every area (one switch per page, never one per
 * area): until the batch that ships a page flips its entry, its targets render as plain rows /
 * text — never a dead link to the catch-all 404.
 *  - angler → /pescari/[id], the angler profile (M2, docs/parity/areas/account.yml) — ON since M2-B1;
 *  - connections → /pescari/[id]/conexiuni, an angler's followers / following (M2, account.connections) — ON since M2-B2;
 *  - partida → /partide/[id], with the own-vs-spectator resolution (M4) — ON since M4-B3 (every
 *    partidă link across the site: lake / public-water live rows, history cards and record heroes,
 *    the angler profile's session cards, the partidă notifications);
 *  - settings → /setari, the settings hub (M2, account.settings) — ON since M2-B5 (the own profile's
 *    cog and the account menus' «Setări» rows);
 *  - myBookings → /rezervari, the viewer's bookings (M3, booking.rezervarile-mele) — ON since M3-B1
 *    (Setări's «Rezervările mele» row);
 *  - bookingDetail → /rezervari/[id], one booking (M3, booking.rezervare) — ON since M3-B2 (the
 *    Rezervările mele rows and the booking notifications link to it).
 */
export const ON_WEB = {
  angler: true,
  connections: true,
  partida: true,
  settings: true,
  myBookings: true,
  bookingDetail: true,
} as const;

/** The angler's profile, or null while the web has none (render the person without a link). */
export const anglerHref = (documentId: string): string | null => (ON_WEB.angler ? routes.angler(documentId) : null);

/** An angler's followers / following (the profile's «N urmăritori · N urmărește»), or null while the web has none. */
export const anglerConnectionsHref = (documentId: string, tab?: 'urmaritori' | 'urmareste'): string | null =>
  ON_WEB.connections ? routes.anglerConnections(documentId, tab) : null;

/** A booking's page (/rezervari/[id]), or null while the web has none (the row stays a plain row). */
export const bookingHref = (documentId: string): string | null => (ON_WEB.bookingDetail ? routes.booking(documentId) : null);

/** A partidă's page, or null while the web has none. */
export const partidaHref = (documentId: string): string | null => (ON_WEB.partida ? routes.partida(documentId) : null);

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

export const absoluteUrl = (path: string) => `${siteUrl()}${path}`;
