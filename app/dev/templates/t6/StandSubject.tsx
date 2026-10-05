import { FlowSubjectCard } from '@/components/templates/T6';
import type { StandView } from './data';

/**
 * The anglers under the team line, only when they are registered participants: a guest name on a
 * team competition repeats the team (often with a typo) — StandPicker's tile rule, on the source.
 */
const peopleBesideTeam = (stand: StandView): string[] => (stand.team && stand.guest ? [] : stand.people);

/**
 * Step 2's subject card (the stand, its club, team and anglers). One component for the loaded step
 * and its loading fallback, so the card is the same box in both.
 */
export function StandSubject({ stand }: { stand: StandView }) {
  return (
    <FlowSubjectCard
      title={stand.fullLabel}
      kicker={stand.club}
      subtitle={stand.team ? `Echipa ${stand.team}` : undefined}
      people={peopleBesideTeam(stand)}
    />
  );
}
