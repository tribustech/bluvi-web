import type { UserStatuteForCompetition } from '@/core/social';

/*
 * Who may open a management page (parity organizer.b.role-gate). Pure, shared by ManagementFrame and
 * the screens. The CMS stays the authority: these decide what the page offers, never what it may
 * write.
 *
 * - `signedIn`: any signed-in viewer (the proxy and requireViewer already settled that) — the scale,
 *   the penalties hub (fish lets an angler read them);
 * - `author`: the competition's author (fish userRole === 'author': wizard edit, sectors,
 *   participant allocation, guests);
 * - `authorOrReferee`: author or referee (fish isAuthorOrReferee: weighing, penalties, leg actions).
 *   `isReferee` is the CMS's additive flag (a referee who is also on a team reads as participant);
 * - `role`: the users-permissions role «Organizer» (fish isOrganizerProfile: /organizator).
 */
export type ManagementRequirement = 'author' | 'authorOrReferee' | 'role' | 'signedIn';

/** The viewer's part in one competition; `none` = a known statute with no role. */
export type CompetitionRole = 'author' | 'referee' | 'participant' | 'none';

export function competitionRoleOf(statute: UserStatuteForCompetition): CompetitionRole {
  if (statute.userRole === 'author') return 'author';
  if (statute.userRole === 'referee' || statute.isReferee) return 'referee';
  if (statute.userRole === 'participant' || statute.isParticipant) return 'participant';
  return 'none';
}

export const isAuthorOrReferee = (role: CompetitionRole | undefined) => role === 'author' || role === 'referee';

/**
 * The gate's verdict: `pending` while the statute (or session role) is unknown — never a «no access»
 * copy for an unknown state (owner rule 4) — then `allowed` / `denied`.
 */
export function managementAccess(
  requires: ManagementRequirement,
  { role, isOrganizer }: { role: CompetitionRole | undefined; isOrganizer: boolean },
): 'pending' | 'allowed' | 'denied' {
  if (requires === 'signedIn') return 'allowed';
  if (requires === 'role') return isOrganizer ? 'allowed' : 'denied';
  if (role === undefined) return 'pending';
  if (requires === 'author') return role === 'author' ? 'allowed' : 'denied';
  return isAuthorOrReferee(role) ? 'allowed' : 'denied';
}

/** What the denied gate says, per requirement (a known state only). */
export function deniedCopy(requires: ManagementRequirement): { title: string; description: string } {
  switch (requires) {
    case 'role':
      return {
        title: 'Pagină pentru organizatori',
        description: 'Contul tău nu are rolul de organizator. Poți cere rolul din aplicația Bluvi.',
      };
    case 'authorOrReferee':
      return {
        title: 'Doar pentru organizator și arbitri',
        description: 'Pagina poate fi deschisă doar de organizatorul concursului sau de arbitrii lui.',
      };
    default:
      return {
        title: 'Doar pentru organizatorul concursului',
        description: 'Pagina poate fi deschisă doar de cel care a creat concursul.',
      };
  }
}

/**
 * fish scale/history.tsx:58-68 — weighing actions (start, add, delete) are allowed only on a started
 * competition, for its author or a referee. The scale screens stay readable for everyone else.
 */
export function canWeigh(role: CompetitionRole | undefined, competitionStatus: string | null | undefined): boolean {
  return competitionStatus === 'started' && isAuthorOrReferee(role);
}

/**
 * canWeigh, with the leg (feeder on legs, «manșe»): a closed leg's weighings cannot be reopened
 * (feederRoundActions: «Cântarele ei nu mai pot fi redeschise») and no new one starts until the next
 * leg does — so while `roundStatus` is 'closed' nobody can weigh, whatever the role. The CMS re-checks.
 */
export function canWeighCompetition(
  role: CompetitionRole | undefined,
  c: { competitionStatus?: string | null; rankingType?: string | null; roundStatus?: string | null },
): boolean {
  if (c.rankingType === 'feederRounds' && c.roundStatus === 'closed') return false;
  return canWeigh(role, c.competitionStatus);
}
