import * as z from 'zod';
import type { CompetitionRegistrationInput, DetailRegistration, UpdateCompetitionRegistrationInput } from '@/core/competitions';
import { formatCount } from '@/core/realtime/chat/format';

/*
 * The registration form's pure half — fish app/(app)/register/[competitionId].tsx (parity
 * participant.register). Everything the screen decides that is not rendering lives here, unit tested:
 * which registration is edited (c3), the seed values and when to re-seed them (c11), validation
 * (c5 / c6), the footer (c12 / c21), the zero-teammates confirm (c13), the payloads (c14 / c17).
 */

/** One chosen teammate (fish FormValues.participants[n]). */
export type Teammate = { documentId: string; username: string };

/** fish FormValues, minus what never changes on this page (competition, registrationStatus). */
export type RegistrationValues = {
  teamName: string;
  phone: string;
  participants: Teammate[];
};

type Registration = Pick<DetailRegistration, 'documentId' | 'registrationStatus' | 'teamName' | 'author' | 'participants'>;

export const PHONE_REQUIRED = 'Acest câmp este obligatoriu';
export const PHONE_LENGTH = 'Numărul de telefon trebuie să conțină minim 7 și maximum 15 caractere';
export const TEAM_NAME_MAX = 30;
export const TEAM_NAME_LENGTH = 'Numele echipei poate conține maximum 30 de caractere.';
export const LOCKED_MESSAGE = 'Nu poți face modificări. Contactează organizatorul.';
export const SUBMIT_FALLBACK_ERROR = 'A apărut o problemă în cadrul solicitării, te rugăm să încerci mai târziu.';
export const MISSING_REGISTRATION = 'Nu s-a găsit înscrierea!';

/**
 * c3 — the registration this page edits. Organizer mode: the one named in the URL. Otherwise the
 * viewer's own entry — status registered or pending, the viewer among its participants. None: a new
 * registration.
 */
export function findEditedRegistration<R extends Registration>(
  registrations: readonly R[] | undefined,
  {
    organizerMode,
    registrationId,
    viewerDocumentId,
  }: {
    organizerMode: boolean;
    registrationId?: string | null;
    viewerDocumentId?: string | null;
  },
): R | null {
  if (!registrations) return null;
  if (organizerMode && registrationId) return registrations.find(r => r.documentId === registrationId) ?? null;
  return (
    registrations
      .filter(r => r.registrationStatus === 'registered' || r.registrationStatus === 'pending')
      .find(r => r.participants.some(p => p.documentId === viewerDocumentId)) ?? null
  );
}

/**
 * The edited entry (c3) against the viewer's live status. `/feed/competitions/:id` (the
 * registrations) is edge cached and purged ~0.65 s after a write, my-status is not: right after a
 * create or a leave the two can disagree. `stale`: my-status says pending / registered but the
 * registrations do not have the entry yet (a new form here would POST a duplicate), or my-status
 * says no entry while the registrations still show one (a left entry offering «Părăsește» again).
 * Normal mode only (organizer mode edits someone else's entry).
 */
export function registrationsSettle(
  userRegistrationStatus: string | null | undefined,
  registration: Pick<Registration, 'registrationStatus'> | null,
): 'ok' | 'stale' {
  const live = userRegistrationStatus === 'pending' || userRegistrationStatus === 'registered';
  return live === Boolean(registration) ? 'ok' : 'stale';
}

/**
 * Who the form is about besides the teammates: the viewer, or — organizer mode — the
 * registration's author (fish's anchor for the participants list, c11 / c17).
 */
export function anchorOf(
  registration: Registration | null,
  { organizerMode, viewerDocumentId }: { organizerMode: boolean; viewerDocumentId?: string | null },
) {
  return (organizerMode ? registration?.author?.documentId : viewerDocumentId) ?? null;
}

/** c11 — the form's values from the server: the registration's participants minus the anchor, its team name, the profile's phone. */
export function seedValues(
  registration: Registration | null,
  {
    organizerMode,
    viewerDocumentId,
    profilePhone,
  }: {
    organizerMode: boolean;
    viewerDocumentId?: string | null;
    profilePhone?: string | null;
  },
): RegistrationValues {
  const anchor = anchorOf(registration, { organizerMode, viewerDocumentId });
  return {
    participants: (registration?.participants ?? [])
      .filter(p => p.documentId !== anchor)
      .map(p => ({ documentId: p.documentId, username: p.username })),
    teamName: registration?.teamName ?? '',
    phone: profilePhone ?? '',
  };
}

/**
 * c11 — the server data the seed depends on. When it changes (the refetch after «Salvează», a CDN
 * copy older than the write) the form re-seeds, unless the user has already edited it.
 */
export function seedKey(
  registration: Registration | null,
  profile: { documentId?: string | null; phone?: string | null } | null | undefined,
): string {
  return JSON.stringify([
    registration?.documentId,
    registration?.teamName,
    registration?.registrationStatus,
    registration?.participants.map(p => p.documentId),
    profile?.documentId,
    profile?.phone,
  ]);
}

/** react-hook-form's isDirty for these fields: anything differs from the baseline. */
export function isDirty(values: RegistrationValues, baseline: RegistrationValues): boolean {
  return (
    values.teamName !== baseline.teamName ||
    values.phone !== baseline.phone ||
    values.participants.length !== baseline.participants.length ||
    values.participants.some((p, i) => p.documentId !== baseline.participants[i]?.documentId)
  );
}

/**
 * c5 / c6 — fish's rules as a zod schema. The phone is validated only on a new registration (it
 * is not on the form otherwise): required, then 7–15 characters (fish's /^.{7,15}$/). The team name
 * is optional, at most 30.
 */
export function registrationSchema({ isNew }: { isNew: boolean }) {
  return z.object({
    phone: isNew
      ? z
          .string()
          .min(1, PHONE_REQUIRED)
          .regex(/^.{7,15}$/, PHONE_LENGTH)
      : z.string(),
    teamName: z.string().max(TEAM_NAME_MAX, TEAM_NAME_LENGTH),
  });
}

export type FieldErrors = Partial<Record<'phone' | 'teamName', string>>;

/** The first message per field (react-hook-form's default), or {} when the values pass. */
export function validate(values: RegistrationValues, { isNew, isTeam }: { isNew: boolean; isTeam: boolean }): FieldErrors {
  const res = registrationSchema({ isNew }).safeParse({
    phone: values.phone,
    teamName: isTeam ? values.teamName : '',
  });
  if (res.success) return {};
  const errors: FieldErrors = {};
  for (const issue of res.error.issues) {
    const key = issue.path[0] as keyof FieldErrors;
    errors[key] ??= issue.message;
  }
  return errors;
}

export type Footer =
  /** No registration: «Finalizează». */
  | { kind: 'create' }
  /** An entry in normal mode after the start: only the text, no action. */
  | { kind: 'locked'; message: string }
  /** «Salvează modificările» (disabled until dirty), plus «Părăsește concursul» when allowed. */
  | { kind: 'update'; canLeave: boolean };

/**
 * c12 / c21 — the footer. Organizer mode is never locked by the status and never offers «Părăsește
 * concursul»; the viewer can leave only a pending entry. `lockedReason`: the competition page's entry
 * is disabled for the viewer's own entry (core registrationAction) — read-only, with that reason.
 */
export function footerState({
  registration,
  organizerMode,
  competitionStatus,
  lockedReason,
}: {
  registration: Pick<Registration, 'registrationStatus'> | null;
  organizerMode: boolean;
  competitionStatus: string | undefined;
  lockedReason?: string | null;
}): Footer {
  if (!registration) return { kind: 'create' };
  if (!organizerMode && lockedReason) return { kind: 'locked', message: lockedReason };
  if (!organizerMode && competitionStatus !== 'notStarted') return { kind: 'locked', message: LOCKED_MESSAGE };
  return {
    kind: 'update',
    canLeave: !organizerMode && registration.registrationStatus === 'pending',
  };
}

/** c8 — «Adaugă coechipieri» stays available while the team (teammates + the anchor) is below teamParticipants. */
export function canAddTeammate(teammates: number, teamParticipants: number | null | undefined): boolean {
  // fish: `participants.length + 1 >= teamParticipants!` — with no limit the comparison is false.
  if (teamParticipants == null) return true;
  return teammates + 1 < teamParticipants;
}

/** c13 — a team competition with nobody added asks first. */
export function needsEmptyTeamConfirm(competitionType: string | undefined, teammates: number): boolean {
  return competitionType === 'team' && teammates === 0;
}

/**
 * c7 — «Această competiție permite înscrierea unui număr maxim de {N} participanți/echipă. Vă rugăm
 * să adăugați un număr maxim de {N-1} coechipieri.», with Romanian plurals (formatCount).
 */
export function teamLimitCaption(teamParticipants: number): string {
  const members = formatCount(teamParticipants, 'participant', 'participanți');
  const mates = formatCount(Math.max(0, teamParticipants - 1), 'coechipier', 'coechipieri');
  return `Această competiție permite înscrierea unui număr maxim de ${members}/echipă. Vă rugăm să adăugați un număr maxim de ${mates}.`;
}

/** teammates, then the anchor — fish's order; just the anchor without teammates; [] without an anchor. */
function participantIds(values: RegistrationValues, anchor: string | null): string[] {
  if (!anchor) return [];
  return [...values.participants.map(p => p.documentId), anchor];
}

/** c14 — POST /registrations: the viewer last, the phone null when the profile already has one. */
export function createPayload(
  values: RegistrationValues,
  {
    competitionId,
    viewerDocumentId,
    profilePhone,
  }: {
    competitionId: string;
    viewerDocumentId: string | null;
    profilePhone?: string | null;
  },
): CompetitionRegistrationInput {
  return {
    competition: competitionId,
    teamName: values.teamName,
    // fish: targetRegistration?.registrationStatus || '' — always '' for a new entry (the CMS sets it).
    registrationStatus: '',
    participants: participantIds(values, viewerDocumentId),
    phone: profilePhone ? null : values.phone,
  };
}

/** c17 — PUT /registrations/{id}: teammates + the anchor (the viewer, or the author in organizer mode). */
export function updatePayload(
  values: RegistrationValues,
  {
    competitionId,
    registrationId,
    anchor,
  }: {
    competitionId: string;
    registrationId: string | null | undefined;
    anchor: string | null;
  },
): UpdateCompetitionRegistrationInput {
  if (!registrationId) throw new Error(MISSING_REGISTRATION);
  return {
    competition: competitionId,
    registrationId,
    teamName: values.teamName,
    participants: participantIds(values, anchor),
  };
}

/** c16 — the status dialog's error text: the server's message, else fish's fallback. */
export function submitErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : '';
  return message || SUBMIT_FALLBACK_ERROR;
}

/** c9 — the picker row's tag: «#{username}{id}» (fish `${user.username}${user.id}`). */
export function userTag(user: { username: string; id: number }): string {
  return `#${user.username}${user.id}`;
}

/** c9 — the thumb avatar (fish getImageFormat(avatar, 'thumb')): thumbnail → small → original. */
export function thumbUrl(
  avatar:
    | {
        url: string;
        formats?: {
          thumbnail?: { url: string };
          small?: { url: string };
        } | null;
      }
    | null
    | undefined,
) {
  if (!avatar) return null;
  return avatar.formats?.thumbnail?.url ?? avatar.formats?.small?.url ?? avatar.url ?? null;
}

/** «Individual» / «Echipe · max 3/echipă» — the summary card's format line (only what the competition has). */
export function formatLine(competitionType: string | undefined, teamParticipants: number | null | undefined): string | null {
  if (competitionType === 'single') return 'Individual';
  if (competitionType === 'team') return teamParticipants ? `Echipe · max ${teamParticipants}/echipă` : 'Echipe';
  return null;
}
