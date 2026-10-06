/*
 * What the competition's action bar (and its «Acțiuni» sheet) offers a viewer who is neither the
 * organizer nor a referee — the pure halves of fish components/competition/CompetitionRanking.tsx
 * (disabledInscrieTe, handleInscrieTe, canPerformExtraCantarAction, hasRequestedExtraCantar) and
 * components/NormalUserSheetItems.tsx (registrationDisabledMessage). Both fish files compute the
 * same «disabled» rule; it lives here once.
 */
import type { CompetitionStatus, CompetitionType, DetailRegistration, ExtraScale } from '../schemas';

type RegistrationStatus = 'new' | 'pending' | 'registered' | 'rejected' | (string & {}) | null | undefined;

export type RegistrationActionInput = {
  competitionStatus: CompetitionStatus | string;
  competitionType: CompetitionType | string;
  registrationDeadline: string | null;
  participantsLimit: number | null;
  registrations: ReadonlyArray<Pick<DetailRegistration, 'registrationStatus' | 'author' | 'participants'>>;
  userRegistrationStatus?: RegistrationStatus;
};

export type RegistrationAction = {
  /** «Modifică înscrierea» once the viewer has a pending / registered entry, «Înscrie-te» otherwise. */
  label: 'Înscrie-te' | 'Modifică înscrierea';
  disabled: boolean;
  /** fish NormalUserSheetItems `registrationDisabledMessage` — shown under a disabled action. */
  reason: string | null;
  /** fish handleInscrieTe: the registration form, or the team disclaimer for a new team entry. */
  target: 'register' | 'teamDisclaimer';
};

/**
 * fish `isRegisteredButNotTheAuthor`: on a team competition the viewer is a participant of a
 * PENDING entry someone else filed.
 */
export function isPendingTeamEntryOfSomeoneElse(c: RegistrationActionInput, viewerDocumentId: string | null | undefined): boolean {
  if (c.competitionType === 'single') return false;
  const mine = c.registrations
    .filter(r => r.registrationStatus === 'pending')
    .find(r => r.participants?.some(p => p.documentId === viewerDocumentId));
  if (!mine) return false;
  return mine.author?.documentId !== viewerDocumentId;
}

/** fish `hasReachedParticipantsLimit`: the limit equals the approved entries (fish compares with ===). */
export function hasReachedParticipantsLimit(c: Pick<RegistrationActionInput, 'participantsLimit' | 'registrations'>): boolean {
  return c.participantsLimit === c.registrations.filter(r => r.registrationStatus === 'registered').length;
}

/** fish `isRegistrationDisabled`: started, or past the registration deadline. */
export function isRegistrationClosed(c: Pick<RegistrationActionInput, 'competitionStatus' | 'registrationDeadline'>, now: Date): boolean {
  if (c.competitionStatus === 'started') return true;
  return c.registrationDeadline ? now.getTime() > new Date(c.registrationDeadline).getTime() : false;
}

/** The viewer's «Înscrie-te» / «Modifică înscrierea»: label, whether it is offered, why not, and where it goes. */
export function registrationAction(c: RegistrationActionInput, viewerDocumentId: string | null | undefined, now: Date): RegistrationAction {
  const status = c.userRegistrationStatus ?? null;
  const notAuthor = isPendingTeamEntryOfSomeoneElse(c, viewerDocumentId);
  const limit = hasReachedParticipantsLimit(c);
  const disabled =
    status === 'rejected' ||
    (notAuthor && status === 'pending') ||
    (status === 'registered'
      ? // approved: editable only on team competitions while notStarted
        c.competitionType !== 'team' || c.competitionStatus !== 'notStarted'
      : isRegistrationClosed(c, now) || limit);

  // fish NormalUserSheetItems: the message for whichever rule applies (last match wins, as there).
  let reason: string;
  switch (status) {
    case 'rejected':
      reason = 'Cererea ta de a te înscrie în această competiție a fost respinsă.';
      break;
    case 'registered':
      reason = c.competitionType === 'team' ? 'Nu poți face modificări. Contactează organizatorul.' : 'Nu se mai pot face modificări';
      break;
    default:
      reason = 'Termenul pentru înscriere a expirat';
  }
  if (limit && status !== 'registered') reason = 'Numărul maxim de participanți a fost atins';
  if (notAuthor && status === 'pending') reason = 'Nu poți face modificări pentru că nu ești autorul înscrierii.';

  const editing = status === 'pending' || status === 'registered';
  return {
    label: editing ? 'Modifică înscrierea' : 'Înscrie-te',
    disabled,
    reason: disabled ? reason : null,
    target: editing || c.competitionType === 'single' ? 'register' : 'teamDisclaimer',
  };
}

/** fish `canPerformExtraCantarAction`: a registered participant of a started competition. */
export function canRequestExtraScale(c: { competitionStatus: string; userRegistrationStatus?: RegistrationStatus }): boolean {
  return c.userRegistrationStatus === 'registered' && c.competitionStatus === 'started';
}

/** fish `hasRequestedExtraCantar`: the viewer has a request with status «new» in the competition's list. */
export function hasRequestedExtraScale(
  list: ReadonlyArray<Pick<ExtraScale, 'author' | 'extraStatus'>> | undefined,
  viewerDocumentId: string | null | undefined,
): boolean {
  if (!list || !viewerDocumentId) return false;
  return list.some(e => e.author?.documentId === viewerDocumentId && e.extraStatus === 'new');
}
