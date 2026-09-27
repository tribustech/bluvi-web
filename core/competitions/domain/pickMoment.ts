import type { CompetitionCard } from '../schemas';
import type { PulseDestination } from '../schemas';

/**
 * The person card: one fact about one person, and there is ALWAYS one.
 *
 * It used to show the winner of a competition that finished within 14 days and
 * nothing at all otherwise — so the bento silently dropped from three tiles to
 * two the moment the last winner aged out, with nothing having changed for the
 * user. The window is gone: the ladder below always resolves while the screen
 * has a single competition to show, which the bento already requires.
 *
 * The ladder, best first:
 *   1. CÂȘTIGĂTOR — a competition's first place. A win does not stop being
 *      true; an old one just says when it happened.
 *   2. PE PODIUM — second and third. Weaker than a win, but a real result, and
 *      on a quiet week it is what keeps the tile from showing one face forever.
 *   3. ORGANIZATOR — whoever is running the nearest competition. Weaker news
 *      still, but a real person tied to something the angler can open.
 *
 * The whole ladder is a ROTATION, not a single pick: it advances every five
 * minutes so the tile is a different person each time you come back, rather
 * than the same face until the data changes.
 *
 * Phase 1 runs no ranking, so "Lider acum" is not available here; it arrives
 * with the snapshot table in Phase 2 and belongs at the top of this ladder.
 *
 * Ties are not resolved into a single name: the card says how many shared the
 * place, because that is what happened.
 */

export type Moment = {
  /** Identifies the person shown, so the screen can avoid repeating them. */
  key: string;
  kicker: string;
  displayName: string;
  line: string;
  meta: string;
  avatarUrls: string[];
  competitionId: string;
  /**
   * Where a tap goes, when the server said so. Absent on every moment this file
   * builds: the local ladder is made of competition cards, so `competitionId`
   * is the only destination it can name and the screen keeps opening the
   * competition for it. `/feed/pulse-person` can also name an angler, and it
   * ships the answer rather than leaving the app to infer it from the kicker.
   */
  destination?: PulseDestination;
  /** Place in the server's top for the ranking criteria, drawn as a `#N` badge. */
  rank?: number;
};

export type MomentLists = {
  live: CompetitionCard[];
  upcoming: CompetitionCard[];
  completed: CompetitionCard[];
};

/**
 * Past this, a win is still shown but is dated, so the card cannot read as
 * something that happened this week.
 */
const FRESH_DAYS = 14;

function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return (now.getTime() - then.getTime()) / 86_400_000;
}

function champions(completed: CompetitionCard[], now: Date): Moment[] {
  const out: Moment[] = [];

  for (const competition of completed) {
    const winners = competition.results?.podium.filter(row => row.position === 1) ?? [];
    if (!winners.length) continue;

    const age = daysSince(competition.endDate, now);
    const tied = winners.length > 1;
    const isTeam = competition.format.kind === 'team';
    // Only a stale win carries its date; a fresh one reads as news without it.
    const stale = age === null || age > FRESH_DAYS;

    out.push({
      key: `CAMPION:${competition.documentId}`,
      kicker: tied ? 'PODIUM' : isTeam ? 'ECHIPA CÂȘTIGĂTOARE' : 'CÂȘTIGĂTOR',
      displayName: tied
        ? `${winners.length} ${isTeam ? 'echipe' : 'pescari'} la egalitate`
        : winners[0].displayName,
      line: tied ? 'Locul 1 la egalitate' : isTeam ? 'Echipă · locul 1' : 'Individual · locul 1',
      meta: stale ? `${competition.name} · ${competition.dateLabel}` : competition.name,
      // One avatar per tied entry, never two faces from the same team.
      avatarUrls: tied
        ? winners.map(w => w.avatarUrls[0]).filter(Boolean)
        : winners[0].avatarUrls.slice(0, 2),
      competitionId: competition.documentId,
    });
  }

  return out;
}

/** Second and third place, one candidate each — the rest of the podium. */
function runnersUp(completed: CompetitionCard[], now: Date): Moment[] {
  const out: Moment[] = [];

  for (const competition of completed) {
    for (const position of [2, 3]) {
      const rows = competition.results?.podium.filter(row => row.position === position) ?? [];
      // A shared second place names nobody, and "2 pescari la egalitate pe
      // locul 2" is not a headline. Skip it rather than write it.
      if (rows.length !== 1 || rows[0].tied) continue;

      const age = daysSince(competition.endDate, now);
      const stale = age === null || age > FRESH_DAYS;

      out.push({
        key: `PODIUM${position}:${competition.documentId}`,
        kicker: 'PE PODIUM',
        displayName: rows[0].displayName,
        line: `${competition.format.kind === 'team' ? 'Echipă' : 'Individual'} · locul ${position}`,
        meta: stale ? `${competition.name} · ${competition.dateLabel}` : competition.name,
        avatarUrls: rows[0].avatarUrls.slice(0, 2),
        competitionId: competition.documentId,
      });
    }
  }

  return out;
}

/** Whoever is running the nearest competition — live first, then the next start. */
function organizers(lists: MomentLists): Moment[] {
  const order = [...lists.live, ...lists.upcoming, ...lists.completed];

  return order.flatMap(competition => {
    const organizer = competition.organizer;
    if (!organizer) return [];

    return [
      {
        key: `ORGANIZATOR:${organizer.documentId}`,
        kicker: 'ORGANIZATOR',
        displayName: organizer.username,
        line: competition.status === 'started' ? 'Are un concurs în desfășurare' : 'Organizează',
        meta: competition.name,
        avatarUrls: organizer.avatarUrl ? [organizer.avatarUrl] : [],
        competitionId: competition.documentId,
      },
    ];
  });
}

/** How long one person holds the tile. */
export const ROTATION_MS = 5 * 60 * 1000;

/**
 * The current slot. Derived from the clock rather than counted in state, so
 * every mount of the screen agrees on who is up and a re-render never advances
 * it early.
 */
export function momentRotation(now: Date): number {
  return Math.floor(now.getTime() / ROTATION_MS);
}

export function pickMoment(
  lists: MomentLists,
  now: Date,
  recentlyShownKeys: string[] = [],
  rotation = 0
): Moment | null {
  // The lists arrive newest-first for completed and soonest-first for upcoming,
  // so each kind is already in the order worth showing.
  const ladder = [
    ...champions(lists.completed, now),
    ...runnersUp(lists.completed, now),
    ...organizers(lists),
  ];
  if (!ladder.length) return null;

  // Whoever the screen just showed elsewhere drops out — unless that empties
  // the ladder, in which case repeating beats showing nothing.
  const pool = ladder.filter(c => !recentlyShownKeys.includes(c.key));
  const from = pool.length ? pool : ladder;

  // `rotation` can be any integer, including a negative one from a clock before
  // the epoch, so the modulo is normalised rather than trusted.
  return from[((rotation % from.length) + from.length) % from.length];
}
