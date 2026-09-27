import { describe, expect, it } from 'vitest';
import { pickHero } from './pickHero';

const NOW = new Date('2026-09-23T09:00:00.000Z');
const iso = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString();

const card = (over: Record<string, unknown>) =>
  ({
    documentId: 'x',
    joinedCount: 0,
    placesLeft: 5,
    startDate: null,
    endDate: null,
    results: null,
    ...over,
  }) as never;

const empty = { live: [], upcoming: [], completed: [] };

describe('pickHero', () => {
  it('gives the hero to my own live competition above everything', () => {
    const hero = pickHero(
      { ...empty, live: [card({ documentId: 'other' }), card({ documentId: 'mine' })] },
      [{ documentId: 'mine', status: 'started', startDate: null }],
      NOW
    );
    expect(hero!.competition.documentId).toBe('mine');
    expect(hero!.mine).toBe(true);
  });

  it('gives it to my own start within two days, over a stranger’s live one', () => {
    const hero = pickHero(
      {
        ...empty,
        live: [card({ documentId: 'someone-else' })],
        upcoming: [card({ documentId: 'mine', startDate: '2026-09-24T06:00:00.000Z' })],
      },
      [{ documentId: 'mine', status: 'notStarted', startDate: '2026-09-24T06:00:00.000Z' }],
      NOW
    );
    // Rule 1 did not match (my competition is not live), so rule 2 wins.
    expect(hero!.competition.documentId).toBe('mine');
  });

  it('keeps the live competitions behind my own imminent start instead of hiding them', () => {
    const hero = pickHero(
      {
        ...empty,
        live: [card({ documentId: 'a' }), card({ documentId: 'b' }), card({ documentId: 'c' })],
        upcoming: [card({ documentId: 'mine', startDate: iso(1) })],
      },
      [{ documentId: 'mine', status: 'notStarted', startDate: iso(1) }],
      NOW
    );
    expect(hero!.competition.documentId).toBe('mine');
    // The whole point: the stack is not emptied to make room for one card.
    expect(hero!.live.map(c => c.documentId)).toEqual(['a', 'b', 'c']);
    expect(hero!.myImminent?.documentId).toBe('mine');
  });

  it('lets my own LIVE competition lead, and carries my imminent start for the stack', () => {
    const hero = pickHero(
      {
        ...empty,
        live: [card({ documentId: 'other' }), card({ documentId: 'mine-live' })],
        upcoming: [card({ documentId: 'mine-soon', startDate: iso(1) })],
      },
      [
        { documentId: 'mine-live', status: 'started', startDate: null },
        { documentId: 'mine-soon', status: 'notStarted', startDate: iso(1) },
      ],
      NOW
    );
    expect(hero).toMatchObject({ kind: 'live', mine: true });
    expect(hero!.competition.documentId).toBe('mine-live');
    expect(hero!.myImminent?.documentId).toBe('mine-soon');
  });

  it('carries no imminent start when nothing of mine starts inside two days', () => {
    const hero = pickHero(
      {
        ...empty,
        live: [card({ documentId: 'a' })],
        upcoming: [card({ documentId: 'mine', startDate: iso(6) })],
      },
      [{ documentId: 'mine', status: 'notStarted', startDate: iso(6) }],
      NOW
    );
    expect(hero!.myImminent).toBeNull();
  });

  it('never pins the hero to a registration eight months out', () => {
    const hero = pickHero(
      {
        ...empty,
        upcoming: [
          card({ documentId: 'mine', startDate: '2027-05-01T06:00:00.000Z' }),
          card({ documentId: 'popular', startDate: '2026-09-28T06:00:00.000Z', joinedCount: 12 }),
        ],
      },
      [{ documentId: 'mine', status: 'notStarted', startDate: '2027-05-01T06:00:00.000Z' }],
      NOW
    );
    expect(hero!.competition.documentId).toBe('popular');
  });

  it('prefers a competition with room over a fuller one', () => {
    const hero = pickHero(
      {
        ...empty,
        upcoming: [
          card({ documentId: 'full', startDate: '2026-09-26T06:00:00.000Z', joinedCount: 21, placesLeft: 0 }),
          card({ documentId: 'open', startDate: '2026-09-27T06:00:00.000Z', joinedCount: 8, placesLeft: 4 }),
        ],
      },
      [],
      NOW
    );
    expect(hero!.competition.documentId).toBe('open');
  });

  it('returns every live competition for the stack', () => {
    const pick = pickHero(
      { ...empty, live: [card({ documentId: 'a' }), card({ documentId: 'b' })] },
      [],
      NOW
    );
    expect(pick!.kind).toBe('live');
    expect(pick!.live.map(c => c.documentId).sort()).toEqual(['a', 'b']);
  });

  it('puts the live competition with no catches in the stack too', () => {
    const pick = pickHero(
      {
        ...empty,
        live: [
          card({ documentId: 'busy', joinedCount: 27, results: { capturedAt: iso(0), catchCount: 249 } }),
          card({ documentId: 'quiet', joinedCount: 3, results: null }),
        ],
      },
      [],
      NOW
    );
    expect(pick!.live.map(c => c.documentId).sort()).toEqual(['busy', 'quiet']);
  });

  it('leaves the stack empty when nothing is live', () => {
    const pick = pickHero({ ...empty, upcoming: [card({ documentId: 'soon', startDate: iso(3) })] }, [], NOW);
    expect(pick!.kind).toBe('next');
    expect(pick!.live).toEqual([]);
    expect(pick!.myImminent).toBeNull();
  });

  it('does not hold the hero for a registration ten days out', () => {
    const mine = [{ documentId: 'mine', status: 'notStarted', startDate: iso(10) }];
    const pick = pickHero(
      {
        ...empty,
        upcoming: [
          card({ documentId: 'mine', startDate: iso(10) }),
          card({ documentId: 'other', startDate: iso(9), joinedCount: 8, placesLeft: 4 }),
        ],
      },
      mine,
      NOW
    );
    expect(pick!.competition.documentId).toBe('other');
  });

  it('still gives the hero to my own start inside two days', () => {
    const mine = [{ documentId: 'mine', status: 'notStarted', startDate: iso(1) }];
    const pick = pickHero({ ...empty, upcoming: [card({ documentId: 'mine', startDate: iso(1) })] }, mine, NOW);
    expect(pick).toMatchObject({ kind: 'next', mine: true });
  });

  it('falls back to the soonest start, then to the last finished', () => {
    const soonest = pickHero(
      {
        ...empty,
        upcoming: [
          card({ documentId: 'far', startDate: '2027-02-01T06:00:00.000Z' }),
          card({ documentId: 'near', startDate: '2026-12-01T06:00:00.000Z' }),
        ],
      },
      [],
      NOW
    );
    expect(soonest!.competition.documentId).toBe('near');

    const recent = pickHero(
      {
        ...empty,
        completed: [
          card({ documentId: 'old', endDate: '2026-08-01T18:00:00.000Z' }),
          card({ documentId: 'last', endDate: '2026-09-21T18:00:00.000Z' }),
        ],
      },
      [],
      NOW
    );
    expect(recent).toMatchObject({ kind: 'recent' });
    expect(recent!.competition.documentId).toBe('last');
  });

  it('returns nothing when there is nothing at all', () => {
    expect(pickHero(empty, [], NOW)).toBeNull();
  });

  it('survives competitions with no dates', () => {
    const hero = pickHero({ ...empty, upcoming: [card({ documentId: 'undated' })] }, [], NOW);
    expect(hero!.competition.documentId).toBe('undated');
  });
});
