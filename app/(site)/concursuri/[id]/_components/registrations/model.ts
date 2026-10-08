import { competitionProfileKeys, competitionsKeys, type CompetitionStatus, type CompetitionType, type DetailRegistration, type Registration } from '@/core/competitions';
import { competitionManagementKeys } from '@/core/organizer';
import { isApiError } from '@/core/transport';
import { routes, type ParticipantsFilter } from '@/lib/routes';

/*
 * The organizer's registrations list (parity competition-page.participanti-organizator; fish
 * components/competition/RegistrationsList.tsx, ExpandableRegistration.tsx, CollapsableActions.tsx):
 * the pure part — filters, order, names, which actions a row offers, the confirmations' copy.
 */

/** fish FilterKey. */
export type FilterKey = 'all' | 'registered' | 'pending' | 'rejected';

/** fish FILTERS order: Toți · În așteptare · Aprobați · Respinși. */
export const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Toți' },
  { key: 'pending', label: 'În așteptare' },
  { key: 'registered', label: 'Aprobați' },
  { key: 'rejected', label: 'Respinși' },
];

/** The URL's `filtru` (lib/routes ParticipantsFilter) ↔ fish's participantsFilter. «Toți» has no param. */
const PARAM: Record<Exclude<FilterKey, 'all'>, ParticipantsFilter> = {
  pending: 'in-asteptare',
  registered: 'aprobati',
  rejected: 'respinsi',
};

/** `?filtru=` → the filter; anything else (missing, unknown) → «Toți» (fish isFilterKey). */
export function filterFromParam(param: string | null | undefined): FilterKey {
  const hit = (Object.entries(PARAM) as [Exclude<FilterKey, 'all'>, ParticipantsFilter][]).find(([, v]) => v === param);
  return hit ? hit[0] : 'all';
}

export function paramOfFilter(key: FilterKey): ParticipantsFilter | undefined {
  return key === 'all' ? undefined : PARAM[key];
}

/** fish `counts`. */
export function filterCounts(registrations: Pick<Registration, 'registrationStatus'>[]): Record<FilterKey, number> {
  return {
    all: registrations.length,
    registered: registrations.filter(r => r.registrationStatus === 'registered').length,
    pending: registrations.filter(r => r.registrationStatus === 'pending').length,
    rejected: registrations.filter(r => r.registrationStatus === 'rejected').length,
  };
}

export function matchesFilter(r: Pick<Registration, 'registrationStatus'>, key: FilterKey): boolean {
  return key === 'all' || r.registrationStatus === key;
}

/**
 * fish `sortedRegistrations`: by stand; an unallocated registration counts as stand 0 (first),
 * an unallocated REJECTED one as stand 100 (last). fish parseInt()s the names (NaN for «A12»,
 * which keeps CMS order); the web compares them naturally («A2» before «A10»), the same order
 * for numeric names. Ties keep the CMS order.
 */
export function sortRegistrations<R extends Pick<Registration, 'registrationStatus' | 'stand'>>(registrations: R[]): R[] {
  const rank = (r: R) => (r.stand?.name ? 1 : r.registrationStatus === 'rejected' ? 2 : 0);
  return registrations
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const ra = rank(a.r);
      const rb = rank(b.r);
      if (ra !== rb) return ra - rb;
      if (ra === 1) return a.r.stand!.name.localeCompare(b.r.stand!.name, 'ro', { numeric: true }) || a.i - b.i;
      return a.i - b.i;
    })
    .map(x => x.r);
}

/** fish shows «Utilizator sters» for an account that is gone; the site says «Cont șters» everywhere. */
export const DELETED_ACCOUNT = 'Cont șters';

/**
 * fish ParticipantName: individual → the username, else the guest name, else «Cont șters»;
 * team with a name → «Echipa: {team}» with the members (or the guest name) under it; a team
 * without a name → the members (or the guest name), else «–».
 */
export function registrationName(r: Pick<Registration, 'participants' | 'guestName' | 'teamName'>, type: CompetitionType): { name: string; members: string | null } {
  const people = (r.participants ?? []).map(p => p.username?.trim() || DELETED_ACCOUNT);
  if (type !== 'team') return { name: people[0] ?? (r.guestName?.trim() || DELETED_ACCOUNT), members: null };
  const list = people.length ? people.join(', ') : r.guestName?.trim() || '';
  const team = r.teamName?.trim();
  if (team) return { name: `Echipa: ${team}`, members: list || null };
  return { name: list || '–', members: null };
}

/** fish handleEdit `isGuest`: a typed-in name and no account behind it. */
export function isGuestRegistration(r: Pick<Registration, 'guestName' | 'participants'>): boolean {
  return !!r.guestName && (r.participants?.length ?? 0) === 0;
}

/**
 * fish handleEdit: a guest registration opens the guests' form on that registration
 * (participant.register-guests, `inscriere`); any other the registration form in organizer mode.
 */
export function editHref(competitionId: string, r: Pick<Registration, 'documentId' | 'guestName' | 'participants'>): string {
  return isGuestRegistration(r)
    ? routes.competitionRegisterGuests(competitionId, { inscriere: r.documentId })
    : routes.competitionRegister(competitionId, { organizator: true, inscriere: r.documentId });
}

/** fish handlePhoneCall: the registration author's phone as a tel: link, null when there is none. */
export function phoneHref(r: Pick<Registration, 'author'>): string | null {
  const phone = r.author?.phone?.trim();
  return phone ? `tel:${phone.replace(/\s+/g, '')}` : null;
}

/** The author's phone as written (the desktop call popover shows it), null when there is none. */
export function phoneText(r: Pick<Registration, 'author'>): string | null {
  return r.author?.phone?.trim() || null;
}

export type StatusAction = 'pending' | 'reject' | 'approve';

/** A status change that failed for a reason the organizer cannot fix by retrying gets that reason. */
export const STATUS_ERROR_RETRY = 'Nu s-a putut actualiza înscrierea. Încearcă din nou.';

/**
 * fish showErrorToast(err.message) after a status change, with the CMS's known refusals in Romanian
 * with diacritics (fir-intins-cms registration.ts rejectRegistration / acceptRegistration /
 * moveRegistrationToWaitingList). Another 4xx: the CMS's own message. 5xx, network, anything that is
 * not an ApiError: «try again».
 */
export function statusErrorMessage(err: unknown): string {
  if (!isApiError(err) || err.code !== 'HTTP' || err.status >= 500) return STATUS_ERROR_RETRY;
  switch (err.bluCode) {
    case 'REGISTRATION:COMPETITION_STATUS_NOT_STARTED':
      return 'Concursul a început; înscrierile nu mai pot fi schimbate.';
    case 'REGISTRATION:PARTICIPANTS_LIMIT_EXCEEDED':
      // The same code for a crew larger than the competition's team size.
      return /echip/i.test(err.message) ? 'Echipa are mai mulți membri decât permite concursul.' : 'Numărul maxim de participanți a fost atins.';
    case 'REGISTRATION:CANNOT_REJECT_WHEN_CANCELLED_BY_USER':
      return 'Nu poți respinge o cerere anulată de participant.';
    case 'REGISTRATION:CANNOT_ACCEPT_REGISTERED_USER':
      return 'Participantul este deja înscris la concurs.';
    case 'REGISTRATION:COMPETITION_NOT_FOUND':
      return 'Concursul nu mai există.';
    default:
      return err.message || STATUS_ERROR_RETRY;
  }
}

/** Every account behind the list (whatever the status): the person popover's stats batch. */
export function accountParticipantIds(registrations: Pick<Registration, 'participants'>[]): string[] {
  return [...new Set(registrations.flatMap(r => (r.participants ?? []).map(p => p.documentId).filter(Boolean)))];
}

export type RowActions = {
  /** «Editează»: not rejected, not once the competition is cancelled / completed (the CMS blocks edits). */
  edit: boolean;
  /** «Apelează»: always offered (fish); without a phone it says «Număr de telefon invalid». */
  call: true;
  /** Before the start only, in fish's order: «Mută în așteptare», «Elimină» | «Respinge», «Aprobă». */
  status: StatusAction[];
};

/** fish CollapsableActions' conditions. */
export function rowActions(competitionStatus: CompetitionStatus | string, registrationStatus: string): RowActions {
  const before = competitionStatus === 'notStarted';
  const status: StatusAction[] = [];
  if (before && registrationStatus !== 'pending') status.push('pending');
  if (before && registrationStatus !== 'rejected') status.push('reject');
  if (before && registrationStatus !== 'registered') status.push('approve');
  return {
    edit: !['cancelled', 'completed'].includes(competitionStatus) && registrationStatus !== 'rejected',
    call: true,
    status,
  };
}

export type Confirm = { label: string; title: string; question: string; confirm: string; success: string; tone: 'primary' | 'danger' };

/** fish's Alert copy per action (the button's own label too: «Elimină» an approved, «Respinge» a pending one). */
export function confirmOf(action: StatusAction, registrationStatus: string): Confirm {
  if (action === 'pending') {
    return {
      label: 'Mută în așteptare',
      title: 'Mută în lista de așteptare',
      question: 'Ești sigur că vrei să muți participantul înapoi în lista de așteptare?',
      confirm: 'Mută',
      success: 'Înregistrare mutată în așteptare.',
      tone: 'primary',
    };
  }
  if (action === 'approve') {
    return {
      label: 'Aprobă',
      title: 'Acceptă înregistrarea',
      question: 'Ești sigur că vrei să aprobi cererea de participare la concurs?',
      confirm: 'Acceptă',
      success: 'Înregistrare acceptată cu succes.',
      tone: 'primary',
    };
  }
  const remove = registrationStatus === 'registered';
  return {
    label: remove ? 'Elimină' : 'Respinge',
    title: remove ? 'Elimină' : 'Respinge',
    question: remove ? 'Ești sigur că vrei să elimini participantul?' : 'Ești sigur că vrei să respingi cererea de participare la concurs?',
    confirm: remove ? 'Elimină' : 'Respinge',
    success: 'Înregistrare respinsă cu succes.',
    tone: 'danger',
  };
}

/** The status as words (the icon's text alternative, the desktop pill). Unknown statuses: none (fish shows no icon). */
export function statusText(registrationStatus: string): { label: string; tone: 'pending' | 'success' | 'danger' } | null {
  switch (registrationStatus) {
    case 'pending':
      return { label: 'În așteptare', tone: 'pending' };
    case 'registered':
      return { label: 'Aprobat', tone: 'success' };
    case 'rejected':
      return { label: 'Respins', tone: 'danger' };
    default:
      return null;
  }
}

/** The list's row as the person popover reads it (PersonPopover takes the competition's DetailRegistration). */
export function toDetailRegistration(r: Registration): DetailRegistration {
  return {
    id: r.id,
    documentId: r.documentId,
    registrationStatus: r.registrationStatus,
    teamName: r.teamName,
    guestName: r.guestName ?? null,
    stand: r.stand ?? null,
    club: r.club ?? null,
    author: r.author ? { id: r.author.id, documentId: r.author.documentId, username: r.author.username ?? DELETED_ACCOUNT } : null,
    participants: (r.participants ?? []).map(p => ({ id: p.id, documentId: p.documentId, username: p.username?.trim() || DELETED_ACCOUNT, avatar: p.avatar?.url ? { url: p.avatar.url } : null })),
  };
}

/**
 * fish RegistrationsList onRefresh: the list, then refreshActionSheetQueries — the competition, the
 * viewer's statute, the allocated participants.
 */
export function refreshKeys(competitionId: string) {
  return [
    competitionsKeys.registrationsListById(competitionId),
    competitionsKeys.byId(competitionId),
    competitionProfileKeys.statuteForCompetition(competitionId),
    competitionManagementKeys.allocatedParticipants(competitionId),
  ] as const;
}
