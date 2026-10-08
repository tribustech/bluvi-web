import { feederRoundActions, type CompetitionDetail, type DetailRegistration, type FeederRoundState } from '@/core/competitions';
import type { AllocatedParticipantsResponse, AllocateStandToRegistrationRequest } from '@/core/organizer';
import { paletteLetter, sectorColorMap } from '@/components/ranking/sector';
import type { SearchSelectOption } from '@/components/forms/SearchSelectDialog';
import { STARTED_REASON } from '../../_components/organizer/model';
import { sortedSectors } from '../../_components/standOrder';

/*
 * «Alocare participanți» / «Standuri manșa N» (parity organizer.participants c1–c9; fish
 * app/(app)/configure/participants/[competitionId].tsx + helpers/getFormOptionsLabels.tsx) — the
 * pure part: which stands exist, who sits where, the picker's options and the request body.
 *
 * The screen keeps one `Seats` value: stand documentId → the registration documentId seated there
 * ('' = empty, «-»). fish's react-hook-form values, keyed the same way. The organizer's changes are
 * a diff (`SeatEdits`) applied over the server's seating on every render, so a refetch while dirty
 * keeps the edits and shows everything else as the server has it.
 */

type CompetitionShape = Pick<CompetitionDetail, 'sectors' | 'registrations' | 'competitionType'>;

export const ALLOCATION_TITLE = 'Alocare participanți';
export const ALLOCATION_TITLE_ID = 'alocare-titlu';

/**
 * fish `?round=n` (web `?mansa=N`): leg seating only for a whole N > 1 — «re-seats every entrant for
 * leg n after the offline draw». Anything else is the normal allocation.
 */
export function legRoundOf(mansa: string | string[] | null | undefined): number | null {
  const raw = Array.isArray(mansa) ? mansa[0] : mansa;
  if (raw == null || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 1 ? n : null;
}

/** c2: fish ScrollScreen title. */
export const allocationTitle = (round: number | null) => (round ? `Standuri manșa ${round}` : ALLOCATION_TITLE);

/** c3: fish's intro over the leg seating form. */
export const legIntro = (round: number) =>
  `Introdu rezultatul tragerii la sorți pentru manșa ${round}: alege participantul de pe fiecare stand. Sub fiecare nume vezi unde a pescuit în manșa anterioară.`;

/** stand documentId → registration documentId ('' = empty). */
export type Seats = Readonly<Record<string, string>>;
/** The organizer's changes: stand documentId → registration documentId ('' = emptied). */
export type SeatEdits = Readonly<Record<string, string>>;

/**
 * The sectors by name and each one's stands by name, natural «ro» order (standOrder.compareNames) —
 * the order the competition page's sector list and Participanți use. A deliberate change from fish,
 * which maps the CMS's order as-is (locally «C, A, B, D» and stands «14, 15, 11…»). The one place
 * the screen, the aside and the seat lookups take the order from.
 */
export function orderedSectors<S extends Pick<CompetitionDetail, 'sectors'>>(c: S): S['sectors'] {
  return sortedSectors(c.sectors);
}

/** Every stand of every sector, in orderedSectors' order. */
export function sectorStands(c: Pick<CompetitionDetail, 'sectors'>): { standId: string; standName: string; sectorName: string }[] {
  return orderedSectors(c).flatMap((s) => s.stands.map((st) => ({ standId: st.documentId, standName: st.name, sectorName: s.name })));
}

/* ------------------------------------------------------------------ */
/* When the editor may open (the CMS refuses every other case)         */
/* ------------------------------------------------------------------ */

export type AllocationBlock = { title: string; description: string };

/**
 * null = the editor may open. Otherwise the neutral gate it is replaced with, so the organizer never
 * enters a whole draw the CMS then refuses (owner rule 4):
 *  - normal allocation: only before the start (CMS competition.ts allocateStandToRegistration
 *    «Alocarea este permisă doar pentru competiții care nu au început.»; the web's entry is off with
 *    STARTED_REASON, fish OrganizerSheetItems);
 *  - leg seating (?mansa=N): only when the leg actions offer «Reașază pentru manșa N» — a feeder
 *    competition, started, its leg N-1 closed (CMS feeder-rounds.ts validateRoundAllocation).
 */
export function allocationBlock(
  c: Pick<CompetitionDetail, 'competitionStatus'> & FeederRoundState,
  legRound: number | null,
): AllocationBlock | null {
  if (legRound) {
    const allowed = (feederRoundActions(c) ?? []).some((a) => a.kind === 'allocateNext' && a.round === legRound);
    return allowed
      ? null
      : {
          title: `Standurile pentru manșa ${legRound} nu se pot stabili acum`,
          description: `Standurile unei manșe se introduc după ce manșa anterioară a fost închisă și înainte să pornească manșa ${legRound}.`,
        };
  }
  return c.competitionStatus === 'notStarted' ? null : { title: 'Alocarea nu mai poate fi modificată', description: STARTED_REASON };
}

/** The save's hint when nothing differs from the server (the save is off: it would notify everyone again). */
export const NO_CHANGES = 'Nicio modificare de salvat.';

/**
 * c5: outside leg seating the stands are prefilled from /allocated-participants (fish setValue per
 * stand: `registrationId || ''`); in leg seating they start empty (a new draw, never a copy of the
 * previous leg). Only the sectors' stands get a seat: the web never sends a seat it does not show.
 */
export function initialSeats(
  c: Pick<CompetitionDetail, 'sectors'>,
  allocated: AllocatedParticipantsResponse | null | undefined,
  legRound: number | null,
): Seats {
  return Object.fromEntries(
    sectorStands(c).map(({ standId }) => [standId, legRound ? '' : (allocated?.[standId]?.registrationId ?? '')]),
  );
}

/** The edits over the server's seating; an edit whose stand is gone is dropped. */
export function applySeatEdits(initial: Seats, edits: SeatEdits): Seats {
  const out: Record<string, string> = { ...initial };
  for (const [standId, registrationId] of Object.entries(edits)) if (standId in out) out[standId] = registrationId;
  return out;
}

/** One edit, kept only while it differs from the server's value (so undoing it leaves the page clean). */
export function withSeatEdit(initial: Seats, edits: SeatEdits, standId: string, registrationId: string): SeatEdits {
  const next: Record<string, string> = { ...edits };
  if ((initial[standId] ?? '') === registrationId) delete next[standId];
  else next[standId] = registrationId;
  return next;
}

export const isDirty = (initial: Seats, seats: Seats) => Object.keys(seats).some((k) => (initial[k] ?? '') !== seats[k]);

/** registration documentId → its stand (sector + stand names), for the seated ones. */
export function seatOf(c: Pick<CompetitionDetail, 'sectors'>, seats: Seats): Map<string, { sectorName: string; standName: string; standId: string }> {
  const out = new Map<string, { sectorName: string; standName: string; standId: string }>();
  for (const s of sectorStands(c)) {
    const reg = seats[s.standId];
    if (reg) out.set(reg, { sectorName: s.sectorName, standName: s.standName, standId: s.standId });
  }
  return out;
}

export const isRegistered = (r: Pick<DetailRegistration, 'registrationStatus'>) => r.registrationStatus === 'registered';

/** c9: seated stands / registered entrants (fish seatedCount, registeredCount). */
export function seatCounts(c: Pick<CompetitionDetail, 'registrations'>, seats: Seats): { seated: number; registered: number } {
  return {
    seated: Object.values(seats).filter(Boolean).length,
    registered: c.registrations.filter(isRegistered).length,
  };
}

/* ------------------------------------------------------------------ */
/* The occupant of a stand (fish getDisplayedName over registrationsMap) */
/* ------------------------------------------------------------------ */

export type Occupant = {
  /** The registration's club (fish's first line). */
  club: string | null;
  /** Team competitions: the team's name, printed bold with «:» (fish `${teamName}: `). */
  team: string | null;
  /** The participants («, ») or the guest's name; null when it only repeats the team. */
  people: string | null;
  /** For the avatar: a person's photo, else initials of the name. */
  avatar: { name: string; src: string | null; square: boolean };
  /** Who it is in one line (the row's accessible name). */
  name: string;
};

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/**
 * fish registrationsMap: single → [username || guestName]; team → every member's username, or the
 * guest's name; the club and (team) the team name. A guest entry on a team competition usually
 * repeats the team as its name: the same name is not printed twice (as the scale's occupant.ts).
 * A registration missing from the competition (an allocation the detail does not list) falls back to
 * the allocation's own names.
 */
export function occupantOf(
  c: CompetitionShape,
  registrationId: string,
  allocated?: AllocatedParticipantsResponse | null,
): Occupant | null {
  if (!registrationId) return null;
  const isTeam = c.competitionType === 'team';
  const reg = c.registrations.find((r) => r.documentId === registrationId);
  let club: string | null;
  let team: string | null;
  let names: string[];
  let photo: string | null = null;
  if (reg) {
    club = reg.club?.name || null;
    team = isTeam ? reg.teamName || null : null;
    names = isTeam
      ? reg.participants.length > 0
        ? reg.participants.map((p) => p.username)
        : [reg.guestName ?? '']
      : [reg.participants[0]?.username || reg.guestName || ''];
    photo = !isTeam ? (reg.participants[0]?.avatar?.url ?? null) : null;
  } else {
    const a = allocated ? Object.values(allocated).find((x) => x?.registrationId === registrationId) : null;
    if (!a) return null;
    club = a.clubName || null;
    team = isTeam ? a.teamName || null : null;
    names = a.participants.length > 0 ? a.participants.map((p) => p.name) : [a.guestName];
  }
  const joined = names.filter(Boolean).join(', ');
  const people = joined && !(team && fold(joined) === fold(team)) ? joined : null;
  const name = [team, people].filter(Boolean).join(': ') || club || 'Înscriere';
  return {
    club,
    team,
    people,
    avatar: { name: team ?? (joined || name), src: photo, square: isTeam },
    name: club && name !== club ? `${club}, ${name}` : name,
  };
}

/* ------------------------------------------------------------------ */
/* The picker (fish usersOptions + SelectWithSearchSheet filterBy)     */
/* ------------------------------------------------------------------ */

/**
 * fish getOptionLabel: single «Club - user» or «user» (user = the username, else the guest's name);
 * team «Club - Echipă», «Club», the team's name, else «Echipa -».
 */
export function optionLabel(r: DetailRegistration, competitionType: CompetitionDetail['competitionType']): string {
  const club = r.club?.name;
  if (competitionType === 'single') {
    const user = r.participants[0]?.username || r.guestName || '';
    return club ? `${club} - ${user}` : user;
  }
  if (club) return r.teamName ? `${club} - ${r.teamName}` : club;
  return r.teamName || 'Echipa -';
}

/** fish getOptionLabelHelper: team → the members (or the guest's name); single → nothing. */
export function optionMembers(r: DetailRegistration, competitionType: CompetitionDetail['competitionType']): string | undefined {
  if (competitionType !== 'team') return undefined;
  return r.participants.length > 0 ? r.participants.map((p) => p.username).join(', ') : r.guestName || '';
}

/**
 * fish SelectWithSearchSheet filterBy 'id' (single only): the username + the user's numeric id
 * («ion12»), or «Fără cont #<registration id>» for a guest.
 */
export function optionKeywords(r: DetailRegistration, competitionType: CompetitionDetail['competitionType']): string | undefined {
  if (competitionType !== 'single') return undefined;
  const p = r.participants[0];
  return p ? `${p.username}${p.id}` : `Fără cont #${r.id}`;
}

export type RegistrationOption = SearchSelectOption & { registrationId: string };

/**
 * c7: the registered entrants (fish filters registrationStatus === 'registered'), label + helper
 * (the members and, in leg seating, «M{n-1}: sector/stand», joined « · » as fish). Seated ones
 * (on any stand, this one included) are disabled — with their stand as the reason — and listed
 * last; the one on `standId` is marked selected.
 */
export function registrationOptions(
  c: CompetitionShape,
  seats: Seats,
  standId: string | null,
  previousSeats: Readonly<Record<string, string>> = {},
): RegistrationOption[] {
  const seated = seatOf(c, seats);
  const isTeam = c.competitionType === 'team';
  const options = c.registrations.filter(isRegistered).map((r): RegistrationOption => {
    const where = seated.get(r.documentId);
    const helper = [optionMembers(r, c.competitionType), previousSeats[r.documentId]].filter(Boolean).join(' · ') || undefined;
    const label = optionLabel(r, c.competitionType);
    return {
      id: r.documentId,
      registrationId: r.documentId,
      label,
      helper,
      keywords: optionKeywords(r, c.competitionType),
      avatar: {
        name: (isTeam ? r.teamName : r.participants[0]?.username || r.guestName) || label,
        src: isTeam ? null : (r.participants[0]?.avatar?.url ?? null),
        square: isTeam,
      },
      disabled: Boolean(where),
      disabledReason: where ? `Stand ${where.sectorName}${where.standName}` : undefined,
      selected: Boolean(standId && where?.standId === standId) || undefined,
    };
  });
  // fish: [...options].sort((a, b) => Number(a.disabled) - Number(b.disabled)) — stable.
  return [...options.filter((o) => !o.disabled), ...options.filter((o) => o.disabled)];
}

/** The registered entrants without a stand (the aside's list), in the competition's order. */
export function unseated(c: CompetitionShape, seats: Seats): { registrationId: string; label: string }[] {
  const seated = seatOf(c, seats);
  return c.registrations
    .filter((r) => isRegistered(r) && !seated.has(r.documentId))
    .map((r) => ({ registrationId: r.documentId, label: optionLabel(r, c.competitionType) }));
}

/* ------------------------------------------------------------------ */
/* Save                                                                */
/* ------------------------------------------------------------------ */

/** c8: fish onSubmit — { standId: registrationId } turned into { registrationId: standId }, filled stands only. */
export function allocationsBody(seats: Seats): AllocateStandToRegistrationRequest {
  return {
    allocations: Object.fromEntries(
      Object.entries(seats)
        .filter(([, registrationId]) => registrationId)
        .map(([standId, registrationId]) => [registrationId, standId]),
    ),
  };
}

export const SAVED_MESSAGE = 'Alocarea participanților a fost realizată cu succes';
export const legSavedMessage = (round: number) => `Standurile pentru manșa ${round} au fost salvate`;
const FALLBACK_ERROR = 'Nu am putut salva alocarea. Încearcă din nou.';

/** c8: an error toasts the server's message (fish showErrorToast(error.message)). */
export function saveErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : '';
  return message || FALLBACK_ERROR;
}

/** sector documentId → its colour (fish getColorsBySector by index) and palette letter. */
export function sectorPalette(c: Pick<CompetitionDetail, 'sectors'>): Map<string, { color: string; letter: string | null }> {
  const colors = sectorColorMap(c.sectors.map((s) => s.name));
  return new Map(
    c.sectors.map((s) => {
      const color = colors[s.name] ?? 'var(--color-muted)';
      return [s.documentId, { color, letter: paletteLetter(color) }];
    }),
  );
}
