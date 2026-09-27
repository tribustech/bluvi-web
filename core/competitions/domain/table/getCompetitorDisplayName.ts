/* Ported verbatim from fish `helpers/getCompetitorDisplayName.ts`. */
/**
 * Competitor display name for the ranking screen.
 * Rule: team name (if set) → participants' usernames joined → guest name → fallback.
 * The participants step covers teams whose members have app accounts; guestName
 * is the fallback when a team's members have no account.
 *
 * National Championship is intentionally NOT handled here: its teamName is
 * auto-generated ("Echipa 1"), so those views show participants first.
 */
export function getCompetitorDisplayName(input: {
  teamName?: string | null;
  participantNames?: ReadonlyArray<string | null | undefined> | null;
  guestName?: string | null;
  fallback?: string;
}): string {
  const team = input.teamName?.trim();
  if (team) return team;

  const participants = (input.participantNames ?? [])
    .map(name => (typeof name === 'string' ? name.trim() : ''))
    .filter(Boolean)
    .join(', ');
  if (participants) return participants;

  const guest = input.guestName?.trim();
  if (guest) return guest;

  return input.fallback ?? '-';
}
