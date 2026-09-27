import type { CompetitionCard } from '../schemas';
import type { HeroCardPick, HeroPick } from './pickHero';

/**
 * The order the live competitions are shown in inside the hero stack.
 *
 * Two rules, and deliberately no third:
 *
 *  1. My own live competition comes first. That is the answer to "what is
 *     happening to me", and it is the only claim anyone gets on position one.
 *  2. Everything else is shuffled, so every competition gets a fair turn at
 *     the front across screen loads.
 *
 * There is no activity sort. Sorting by the freshest weighing put a 1-catch
 * competition ahead of one with 249 catches and 27 entrants, because "freshest"
 * measures the last thing that happened, not how much has happened. And every
 * live competition is in the list — the one with zero catches included; the
 * stack is the tab's live inventory, not an editorial pick.
 *
 * `seed` is an argument rather than a `Math.random()` call inside, because this
 * runs in a FlashList header that re-renders on every filter and search change.
 * A reshuffle per render would move the cards under the reader's finger. The
 * caller draws one seed per screen load and hands it in.
 */

/** mulberry32 — four lines, uniform enough for a shuffle, and deterministic. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates, in place, on a copy. */
function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function heroOrder(
  live: CompetitionCard[],
  myDocumentIds: Set<string>,
  seed: number
): CompetitionCard[] {
  if (live.length < 2) return [...live];

  const random = prng(seed);
  const mine = live.filter(c => myDocumentIds.has(c.documentId));
  const others = live.filter(c => !myDocumentIds.has(c.documentId));

  // Both halves are shuffled: with two of my own live competitions, neither is
  // permanently the one I see first either.
  return [...shuffle(mine, random), ...shuffle(others, random)];
}

/**
 * The pages of the hero stack, in the order they are shown.
 *
 * `heroOrder` above answers "in what order do the live competitions go"; this
 * answers "what is in the stack at all", which since the imminent-start change
 * is no longer the same question. The stack is:
 *
 *   1. my own live competition, if I have one (`heroOrder` pins it);
 *   2. my own start inside two days, if I have one;
 *   3. every other live competition, shuffled.
 *
 * ── Why my live competition leads and my imminent start does not ────────────
 *
 * Both are mine and both are urgent, so the tie is broken on what the card can
 * tell me that I do not already know. A live competition of mine has a ranking
 * moving, a biggest fish and hours left to fish; a start tomorrow has a date I
 * chose and an entrant count. The live one also expires within hours, while the
 * upcoming one takes position one by itself the moment it starts. Leading with
 * the start would cost me the only card on the screen that is changing.
 *
 * ── Why it is composed here and not in `pickHero` ───────────────────────────
 *
 * `pickHero` is the ladder: it answers which competition the hero is ABOUT, and
 * it must stay seed-free so the answer is the same on every render. The order
 * of the pages is a display concern with a per-screen-load random draw in it,
 * and that belongs next to the shuffle it uses.
 *
 * With nothing live and no imminent start of mine — a discovery pick, a
 * featured card, a past competition — the stack is the single card the ladder
 * chose, and `HeroStack` renders it without a pager.
 */
export function heroStack(pick: HeroPick, seed: number): HeroCardPick[] {
  /* Rung 1 already found my own live competition, if I have one; that is the
     only id `heroOrder` needs to pin. */
  const myLiveIds = new Set(pick.kind === 'live' && pick.mine ? [pick.competition.documentId] : []);

  const live = heroOrder(pick.live, myLiveIds, seed).map<HeroCardPick>(competition => ({
    kind: 'live',
    competition,
    mine: myLiveIds.has(competition.documentId),
  }));

  if (!pick.myImminent) {
    if (live.length) return live;
    const { kind, competition, mine, featured } = pick;
    return [{ kind, competition, mine, featured }];
  }

  const imminent: HeroCardPick = { kind: 'next', competition: pick.myImminent, mine: true };
  /* No competition appears twice in the stack — the pager keys by documentId,
     and two pages for one competition is a contradiction in the inputs, never
     a product requirement. Live wins: it is the truer state. `useCompetitionsPulse`
     already keeps the two lists consistent; this keeps the invariant with the
     function that composes the stack. */
  if (live.some(l => l.competition.documentId === imminent.competition.documentId)) return live;
  // Second when my own live competition holds the front, first otherwise.
  const at = live.length && live[0].mine ? 1 : 0;
  return [...live.slice(0, at), imminent, ...live.slice(at)];
}
