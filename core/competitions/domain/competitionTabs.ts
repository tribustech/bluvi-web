import type { CompetitionType, DetailRegistration, ExtraScale } from '../schemas';

/*
 * Pure logic of the competition page's route tabs (fish components/competition/CompetitionInfo.tsx,
 * CompetitionParticipants.tsx, ParticipantCard.tsx, components/ScaleItem.tsx): what each tab derives
 * from the competition core / the extra-scale list before it renders.
 */

/* ------------------------------------------------------------------ */
/* Informații — fish CompetitionInfo                                  */
/* ------------------------------------------------------------------ */

/** fish CompetitionInfo `numberOfParticipants` / `pendingParticipants`. */
export function registrationCounts(registrations: { registrationStatus: string }[]): { approved: number; pending: number } {
  let approved = 0;
  let pending = 0;
  for (const r of registrations) {
    if (r.registrationStatus === 'registered') approved++;
    else if (r.registrationStatus === 'pending') pending++;
  }
  return { approved, pending };
}

/** fish shows `participantsLimit || '21'`: a competition without a limit reads «x / 21». */
export const DEFAULT_PARTICIPANTS_LIMIT = 21;

/**
 * fish CompetitionInfo `passedPercentage`: 0 before the start, 100 from the end on, the elapsed
 * share (rounded) in between. A zero / negative / unreadable duration counts as ended once started.
 */
export function competitionProgress(startIso: string, endIso: string, now: Date): number {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (Number.isNaN(start)) return 0;
  const passed = now.getTime() - start;
  if (passed < 0) return 0;
  const total = end - start;
  if (Number.isNaN(total) || passed >= total) return 100;
  return Math.round((passed / total) * 100);
}

/* ------------------------------------------------------------------ */
/* Participanți — fish CompetitionParticipants + ParticipantCard      */
/* ------------------------------------------------------------------ */

type RegistrationLike = Pick<DetailRegistration, 'registrationStatus' | 'stand'>;

/**
 * fish `sortedRegistrations`: approved registrations only, unallocated first (fish reads a missing
 * stand as «0»), then by stand number. fish compares `parseInt(stand.name)`, which is NaN for stands
 * named with their sector («A1») and leaves those in CMS order; the web compares the names
 * naturally («A2» before «A10», «2» before «12»), which is the same order for numeric names.
 */
export function approvedRegistrationsByStand<R extends RegistrationLike>(registrations: R[]): R[] {
  return registrations
    .filter(r => r.registrationStatus === 'registered')
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const sa = a.r.stand?.name ?? '';
      const sb = b.r.stand?.name ?? '';
      if (!sa || !sb) return sa ? 1 : sb ? -1 : a.i - b.i;
      return sa.localeCompare(sb, 'ro', { numeric: true }) || a.i - b.i;
    })
    .map(x => x.r);
}

type CardRegistration = Pick<DetailRegistration, 'teamName' | 'guestName' | 'club'> & {
  participants: { documentId: string; username: string }[];
};

/**
 * fish ParticipantCard `getDisplayNames`: individual → the participant's username, else the guest
 * name, else «–»; team → the team name, else the club name, else «–».
 */
export function registrationDisplayName(registration: CardRegistration, competitionType: CompetitionType): string {
  if (competitionType !== 'team') return registration.participants[0]?.username ?? registration.guestName ?? '–';
  return registration.teamName?.trim() || registration.club?.name?.trim() || '–';
}

/** fish `getTeamSubtitle`: a team's members (or its guest name) under the team name; null for individuals. */
export function registrationTeamSubtitle(registration: CardRegistration, competitionType: CompetitionType): string | null {
  if (competitionType !== 'team') return null;
  const names = registration.participants.map(p => p.username).filter(Boolean);
  if (names.length > 0) return names.join(', ');
  return registration.guestName || null;
}

/**
 * fish `soloParticipant`: a registration that resolves to exactly one real user (an individual
 * entry, or a one-member team) is that person — its card header opens their profile.
 */
export function soloParticipant<P extends { documentId: string }>(registration: { participants: P[] }): P | null {
  return registration.participants.length === 1 && registration.participants[0]?.documentId ? registration.participants[0] : null;
}

/** The documentIds the stats batch is asked for (fish `participantDocumentIds`), approved registrations only. */
export function approvedParticipantIds(registrations: (Pick<DetailRegistration, 'registrationStatus'> & { participants: { documentId: string }[] })[]): string[] {
  return registrations
    .filter(r => r.registrationStatus === 'registered')
    .flatMap(r => r.participants.map(p => p.documentId).filter(Boolean));
}

/* ------------------------------------------------------------------ */
/* Extra Cântare — fish components/ScaleItem.tsx                      */
/* ------------------------------------------------------------------ */

/**
 * fish ScaleItem: a request is «done» once its status is anything but `new` (done or cancelled); it
 * looks disabled when done or when the competition has ended.
 */
export function extraScaleState(scale: Pick<ExtraScale, 'extraStatus'>, competitionStatus: string | undefined): { completed: boolean; disabled: boolean } {
  const completed = scale.extraStatus !== 'new';
  return { completed, disabled: completed || competitionStatus === 'completed' };
}

/**
 * The stand a request points at (fish: stand name + its first sector), or null when the request
 * lacks the data to open the stand's weighings («Nu exista suficiente date…»).
 */
export function extraScaleStand(scale: Pick<ExtraScale, 'stand'>): { standId: string; standName: string; sectorName: string } | null {
  const stand = scale.stand;
  const sectorName = stand?.sectors[0]?.name;
  if (!stand?.name || !stand.documentId || !sectorName) return null;
  return { standId: stand.documentId, standName: stand.name, sectorName };
}
