import * as z from 'zod';
import type { CreateGuestRegistrationPayload, DetailRegistration, UpdateGuestRegistrationPayload } from '@/core/competitions';
import { formatCount } from '@/core/realtime/chat/format';
import { isApiError } from '@/core/transport';

/*
 * Adaugă participanți fără cont — the pure half of the form (parity participant.register-guests,
 * fish app/(app)/register/register-guests.tsx). Seeding (c8), typing (c6), validation (c6, c7) and
 * the write payloads (c9–c12); the page only renders what these return.
 */

/** fish NAME_PATTERN: letters (Romanian diacritics included), digits, spaces and hyphens. */
export const NAME_PATTERN = /^[a-zA-ZÀ-žĂăÂâÎîȘșȚț0-9\s-]+$/;
export const REQUIRED = 'Acest câmp este obligatoriu';
export const NAME_PATTERN_MESSAGE = 'Numele poate conține doar litere, cifre și cratime';
export const TEAM_NAME_MAX = 30;
export const TEAM_NAME_LENGTH = 'Numele echipei poate conține maximum 30 de caractere.';
export const TEAM_NAME_PATTERN = 'Numele echipei poate conține doar litere, cifre și cratime';
export const NO_PARTICIPANT = 'Trebuie să adaugi cel puțin un participant';
export const ADDED = 'Înregistrarea a fost adăugată cu succes!';
export const UPDATED = 'Înregistrarea a fost actualizată cu succes!';

export type GuestValues = {
  /** One entry per «Participant {n}» (a single competition uses the first only). */
  names: string[];
  teamName: string;
};

export type GuestMode = {
  isTeam: boolean;
  /** ?doarEchipa=1 (fish membersOnly=true): only the team name is edited and saved. */
  membersOnly: boolean;
};

/** c6 — what typing leaves in a name field: no leading spaces, no runs of spaces (fish onChangeText). */
export function sanitizeName(raw: string): string {
  return raw.replace(/^\s+/, '').replace(/\s{2,}/g, ' ');
}

/**
 * c8 — the form's first values. Add: one empty name. Edit: the registration's guestName split on
 * «, » (fish), its team name. A single competition keeps the whole guestName in its one field (fish
 * splits it too, then shows only the first part and saves them all — a name that cannot come from
 * this form, which refuses commas, so nothing is lost or hidden).
 */
export function seedValues(registration: Pick<DetailRegistration, 'guestName' | 'teamName'> | null, { isTeam }: { isTeam: boolean }): GuestValues {
  if (!registration) return { names: [''], teamName: '' };
  const guest = registration.guestName ?? '';
  const names = isTeam ? guest.split(', ').filter(n => n.trim()) : guest.trim() ? [guest] : [];
  return { names: names.length > 0 ? names : [''], teamName: registration.teamName ?? '' };
}

export function isDirty(values: GuestValues, baseline: GuestValues): boolean {
  return values.teamName !== baseline.teamName || values.names.length !== baseline.names.length || values.names.some((n, i) => n !== baseline.names[i]);
}

/** c5 — «Adaugă participant» while the fields are fewer than the team size (fish: teamParticipants ?? 1). */
export function canAddName(count: number, teamParticipants: number | null | undefined): boolean {
  return count < (teamParticipants ?? 1);
}

/** c5 — «Maxim {N} participanți/echipă», with Romanian plurals (owner: formatCount). */
export function teamMaxCaption(teamParticipants: number): string {
  return `Maxim ${formatCount(teamParticipants, 'participant', 'participanți')}/echipă`;
}

const nameSchema = z.string().min(1, REQUIRED).regex(NAME_PATTERN, NAME_PATTERN_MESSAGE);
const teamNameSchema = z
  .string()
  .max(TEAM_NAME_MAX, TEAM_NAME_LENGTH)
  // fish's `pattern` rule skips an empty value: the team name is optional.
  .refine(v => v === '' || NAME_PATTERN.test(v), TEAM_NAME_PATTERN);

/** c6 / c7 — the rules of the fields on screen (hidden ones are not validated, as in fish). */
export function guestSchema({ isTeam, membersOnly }: GuestMode) {
  return z.object({
    names: membersOnly ? z.array(z.string()) : isTeam ? z.array(nameSchema) : z.tuple([nameSchema]).rest(z.string()),
    teamName: isTeam ? teamNameSchema : z.string(),
  });
}

export type GuestErrors = { names: Record<number, string>; teamName?: string };

/** The first message per field (react-hook-form's default); no keys when the values pass. */
export function validate(values: GuestValues, mode: GuestMode): GuestErrors {
  const errors: GuestErrors = { names: {} };
  const res = guestSchema(mode).safeParse(values);
  if (res.success) return errors;
  for (const issue of res.error.issues) {
    const [field, index] = issue.path;
    if (field === 'teamName') errors.teamName ??= issue.message;
    else if (field === 'names' && typeof index === 'number') errors.names[index] ??= issue.message;
  }
  return errors;
}

export function hasErrors(errors: GuestErrors): boolean {
  return Boolean(errors.teamName) || Object.keys(errors.names).length > 0;
}

/**
 * c10 — the names to save: trimmed, empty ones dropped, joined with «, ». A single competition saves
 * its one field. null when there is nothing left (fish's «Trebuie să adaugi cel puțin un
 * participant» toast) — never in membersOnly mode, where the names are not sent at all.
 */
export function joinedGuestName(values: GuestValues, { isTeam }: { isTeam: boolean }): string {
  return (isTeam ? values.names : values.names.slice(0, 1))
    .map(n => n.trim())
    .filter(Boolean)
    .join(', ');
}

export type BuiltPayload =
  | { kind: 'create'; payload: CreateGuestRegistrationPayload }
  | { kind: 'update'; payload: UpdateGuestRegistrationPayload }
  | { kind: 'empty' };

/**
 * c9–c12 — the write. Add: POST {competitionId, guestName, teamName}; edit: PUT {guestName?,
 * teamName} (membersOnly omits guestName). The team name is trimmed (fish trims only its leading
 * spaces while typing) and, as in fish, always sent — «» on a single competition.
 */
export function buildPayload(
  values: GuestValues,
  { competitionId, registrationId, isTeam, membersOnly }: GuestMode & { competitionId: string; registrationId: string | null },
): BuiltPayload {
  const guestName = joinedGuestName(values, { isTeam });
  if (!membersOnly && !guestName) return { kind: 'empty' };
  const teamName = isTeam ? values.teamName.trim() : '';
  if (registrationId) {
    return {
      kind: 'update',
      payload: { registrationId, ...(membersOnly ? {} : { guestName }), teamName },
    };
  }
  return { kind: 'create', payload: { competitionId, guestName, teamName } };
}

const FALLBACK_ERROR = 'A apărut o eroare. Te rugăm să încerci din nou.';

/**
 * The CMS answers some refusals in English, and its 500s (which keep their message: they carry a
 * bluCode) in Romanian without diacritics: the Romanian line for each (fish showed error.message).
 */
const BLU_MESSAGES: Record<string, string> = {
  'REGISTRATION:COMPETITION_PARTICIPANTS_LIMIT_REACHED': 'Concursul a atins numărul maxim de participanți.',
  'REGISTRATION:COMPETITION_SHOULD_NOT_BE_STARTED': 'Participanții fără cont pot fi adăugați doar înainte de începerea concursului.',
  'REGISTRATION:COMPETITION_NOT_FOUND': 'Concursul nu a fost găsit.',
  'REGISTRATION:NOT_FOUND': 'Înscrierea nu a fost găsită. Poate a fost ștearsă între timp.',
  'REGISTRATION:INVALID_REQUEST_BODY': 'Datele trimise nu sunt valide. Verifică numele și încearcă din nou.',
  'REGISTRATION:REGISTER_GUESTS_ERROR': 'A apărut o eroare la adăugarea participanților. Dacă problema persistă, contactează echipa de suport.',
  'REGISTRATION:UPDATE_GUEST_ERROR': 'A apărut o eroare la actualizarea înscrierii. Dacă problema persistă, contactează echipa de suport.',
};

/** c11 / c12 — the error toast: the server's message, in Romanian. */
export function writeErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.bluCode && BLU_MESSAGES[error.bluCode]) return BLU_MESSAGES[error.bluCode];
    if (error.status === 403) return 'Doar organizatorul concursului poate modifica participanții.';
  }
  const message = error instanceof Error ? error.message.trim() : '';
  return message || FALLBACK_ERROR;
}

/**
 * Edit mode: the registration this page edits, if the competition still has it. A registration
 * with accounts on it is not a guest entry — it is edited on the registration page (organizer mode),
 * `doarEchipa` or not: no fish caller sends membersOnly, so the web does not widen it to account
 * entries (rule 4 — and their «Echipa» caption would have no guest names to show).
 */
export function findGuestRegistration<R extends Pick<DetailRegistration, 'documentId' | 'guestName' | 'participants'>>(
  registrations: R[],
  registrationId: string,
): { kind: 'found'; registration: R } | { kind: 'missing' } | { kind: 'account'; registration: R } {
  const registration = registrations.find(r => r.documentId === registrationId);
  if (!registration) return { kind: 'missing' };
  const isGuest = Boolean(registration.guestName) && registration.participants.length === 0;
  if (!isGuest) return { kind: 'account', registration };
  return { kind: 'found', registration };
}

/**
 * `doarEchipa` only means something on a team entry: a single competition has no team name, so the
 * mode would leave an empty form that saves {teamName:''}. There it is the normal edit instead.
 */
export function effectiveMembersOnly(membersOnly: boolean, { isTeam }: { isTeam: boolean }): boolean {
  return membersOnly && isTeam;
}

/** «12 din 30» approved entries — the organizer's capacity line (only when there is a limit). */
export function capacityLine(registrations: Pick<DetailRegistration, 'registrationStatus'>[], limit: number | null): string | null {
  if (!limit) return null;
  const approved = registrations.filter(r => r.registrationStatus === 'registered').length;
  return `${approved} din ${limit}`;
}
