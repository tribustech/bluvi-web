import type { CompetitionCard } from '../schemas';

/**
 * Which competition gets the hero.
 *
 * Pure and ordered, so it can be tested and so the rule can be read in one
 * place. The prototype recomputes this on every render, which lets an unrelated
 * tap flip the hero under the user; the screen picks once per mount instead.
 */

export type HeroKind = 'live' | 'next' | 'recent';

/**
 * One card, as `HeroCard` renders it. A `HeroPick` IS one of these — it just
 * carries, in addition, the material the stack behind it is built from. The
 * stack's other pages are cards without a ladder of their own, which is why the
 * card component takes this narrower type: `heroStack` mints a page per
 * competition, and none of them needs to know what the whole stack contains.
 */
export type HeroCardPick = {
  kind: HeroKind;
  competition: CompetitionCard;
  /** The viewer is registered in this one. */
  mine: boolean;
  /**
   * This pick came from `/feed/featured-competition` rather than from the
   * ladder below. `pickHero` never sets it — `useCompetitionsPulse` does, when
   * the ladder would otherwise have produced a discovery pick and the server
   * offered a promoted competition instead.
   *
   * It is a flag rather than a fourth `HeroKind` on purpose: a featured
   * competition IS a `next` card in every respect the card renders — entrants
   * over capacity, the date line, "Vezi concursul" — and only its chip differs,
   * so that a promoted card cannot be mistaken for something live or for one of
   * the viewer's own. Adding a kind would have forked all four branches of
   * `HeroCard` to change one string.
   */
  featured?: boolean;
};

export type HeroPick = HeroCardPick & {
  /**
   * Every live competition, for the stack — the hero shows all of them, not a
   * qualified subset, so a competition with zero catches still gets a page.
   * Empty when nothing is live. `competition` is the stack's lead card; the
   * display order itself is `heroStack`'s, drawn once per screen load.
   */
  live: CompetitionCard[];
  /**
   * My own start inside two days, when I have one — and it is carried here
   * WHETHER OR NOT it won the hero.
   *
   * It used to win outright and return `live: []`, which meant that on a day
   * with four live competitions the entire stack vanished behind one upcoming
   * card. An imminent start of mine is a reason to lead the stack, not a reason
   * to empty it: `heroStack` puts it at the front and the live competitions
   * carry on behind it.
   *
   * When I also have a live competition of my own, that one leads and this sits
   * immediately behind it — see `heroStack` for why.
   */
  myImminent: CompetitionCard | null;
};

export type MyRegistration = { documentId: string; status: string; startDate: string | null };

const DAY = 86_400_000;
const URGENT_DAYS = 2;
const WINDOW_DAYS = 14;

function daysUntil(startDate: string | null, now: Date): number | null {
  if (!startDate) return null;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return null;
  return Math.round((start.getTime() - now.getTime()) / DAY);
}

export function pickHero(
  input: { live: CompetitionCard[]; upcoming: CompetitionCard[]; completed: CompetitionCard[] },
  myRegistrations: MyRegistration[],
  now: Date
): HeroPick | null {
  const mine = new Set(myRegistrations.map(r => r.documentId));

  /* My own start within two calendar days. Found before either personal rung
     is answered, because it belongs in the stack in BOTH of them: as the lead
     when nothing of mine is live, and one place behind my live competition
     when something is. */
  const myImminent =
    input.upcoming
      .filter(c => mine.has(c.documentId))
      .find(c => {
        const d = daysUntil(c.startDate, now);
        return d !== null && d >= 0 && d <= URGENT_DAYS;
      }) ?? null;

  // 1 — my own live competition beats everything, including my own imminent
  //     start. A competition I am fishing RIGHT NOW has a ranking moving and
  //     hours left on it; one starting tomorrow will take the lead by itself
  //     the moment it goes live, and until then it rides second in the stack.
  const myLive = input.live.find(c => mine.has(c.documentId));
  if (myLive) return { kind: 'live', competition: myLive, mine: true, live: input.live, myImminent };

  // 2 — my own start within two calendar days. Personal urgency, not a
  //     standing claim on the slot — and no longer a claim on the WHOLE slot:
  //     the live competitions stay in the stack behind it.
  if (myImminent) return { kind: 'next', competition: myImminent, mine: true, live: input.live, myImminent };

  // 3 — anything live at all. ALL of it: the stack shows every live
  //     competition, so there is nothing left to choose between here.
  //
  //     What used to stand here was a sort by the freshest weighing, and it was
  //     deleted rather than tuned: on the production snapshot it put a 1-catch
  //     competition ahead of one with 249 catches and 27 entrants, because the
  //     last thing that happened is not a measure of how much has happened.
  //     Order now belongs to `heroOrder`, which shuffles per screen load.
  if (input.live.length) {
    const lead = input.live[0];
    return { kind: 'live', competition: lead, mine: mine.has(lead.documentId), live: input.live, myImminent: null };
  }

  // There is deliberately no rung for "my own start within a fortnight". A
  // competition I registered for 13 days ago must not hold the hero for two
  // weeks — I already know I am in it, and past that point the hero's job is
  // discovery. Personal urgency keeps the slot only while it is genuinely
  // urgent, which is rung 1 and rung 2.

  // 4 — the most subscribed start within a fortnight THAT STILL HAS ROOM.
  //     Sending a discovery hero to a full competition is a closed door.
  const soon = input.upcoming.filter(c => {
    const d = daysUntil(c.startDate, now);
    return d !== null && d >= 0 && d <= WINDOW_DAYS;
  });
  const open = soon.filter(c => (c.placesLeft ?? 1) > 0);
  const ranked = (open.length ? open : soon).sort(
    (a, b) => b.joinedCount - a.joinedCount || (a.startDate ?? '').localeCompare(b.startDate ?? '')
  );
  if (ranked.length) return { kind: 'next', competition: ranked[0], mine: false, live: [], myImminent: null };

  // 5 — the soonest start, whenever it is. Undated ones sort last.
  const dated = input.upcoming.filter(c => c.startDate);
  if (dated.length) {
    const soonest = [...dated].sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))[0];
    return { kind: 'next', competition: soonest, mine: mine.has(soonest.documentId), live: [], myImminent: null };
  }
  if (input.upcoming.length) return { kind: 'next', competition: input.upcoming[0], mine: false, live: [], myImminent: null };

  // 6 — nothing ahead: the last one that finished.
  if (input.completed.length) {
    const recent = [...input.completed].sort((a, b) => (b.endDate ?? '').localeCompare(a.endDate ?? ''))[0];
    return { kind: 'recent', competition: recent, mine: false, live: [], myImminent: null };
  }

  return null;
}
