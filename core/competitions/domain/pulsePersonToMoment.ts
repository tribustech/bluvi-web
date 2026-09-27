import type { PulsePerson } from '../schemas';
import type { Moment } from './pickMoment';

/**
 * `/feed/pulse-person` → the shape `MomentCard` already renders.
 *
 * Deliberately thin, and it has to stay that way: the server ships FINISHED
 * Romanian copy, so every field below is a straight copy. The moment this file
 * starts rewriting `kicker` or recomputing `meta`, the tile has two sources of
 * truth for its own wording and the CMS tests stop proving anything about what
 * the user reads.
 *
 * The two fields that are not copies:
 *
 *   - `key` identifies the PERSON, which is what the screen de-duplicates on.
 *     Criterion plus destination id, because the same angler can legitimately
 *     turn up under two criteria and those are two different cards.
 *   - `competitionId` only exists on the local `Moment` because the local
 *     ladder is built out of competition cards. An angler destination has no
 *     competition, so it is empty — `destination` is what routing and analytics
 *     read, and it is always present on a server moment.
 */
export function pulsePersonToMoment(person: PulsePerson): Moment {
  return {
    key: `${person.criterion}:${person.destination.documentId}`,
    kicker: person.kicker,
    displayName: person.displayName,
    line: person.line,
    meta: person.meta,
    avatarUrls: person.avatarUrls,
    competitionId: person.destination.type === 'competition' ? person.destination.documentId : '',
    destination: person.destination,
    ...(person.rank ? { rank: person.rank } : {}),
  };
}
