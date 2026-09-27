import { describe, expect, it } from 'vitest';
import { heroOrder, heroStack } from './heroOrder';
import type { HeroPick } from './pickHero';
import type { CompetitionCard } from '../schemas';

const card = (documentId: string) => ({ documentId }) as CompetitionCard;

describe('heroOrder', () => {
  it('pins my own live competition first', () => {
    const order = heroOrder([card('a'), card('b'), card('c')], new Set(['c']), 1);
    expect(order[0].documentId).toBe('c');
  });

  it('keeps every competition, including one with no catches', () => {
    const order = heroOrder([card('a'), card('b'), card('c'), card('d')], new Set(), 7);
    expect(order.map(c => c.documentId).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('is stable for the same seed and differs across seeds', () => {
    const input = [card('a'), card('b'), card('c'), card('d'), card('e')];
    expect(heroOrder(input, new Set(), 3)).toEqual(heroOrder(input, new Set(), 3));
    const seeds = new Set([1, 2, 3, 4, 5].map(s => heroOrder(input, new Set(), s)[0].documentId));
    expect(seeds.size).toBeGreaterThan(1);
  });

  it('gives every competition a turn at the front across seeds', () => {
    const input = [card('a'), card('b'), card('c')];
    const firsts = new Set(Array.from({ length: 60 }, (_, s) => heroOrder(input, new Set(), s)[0].documentId));
    expect(firsts).toEqual(new Set(['a', 'b', 'c']));
  });

  it('pins mine first even when several are mine', () => {
    const order = heroOrder([card('a'), card('b'), card('c')], new Set(['b', 'c']), 2);
    expect(['b', 'c']).toContain(order[0].documentId);
    expect(['b', 'c']).toContain(order[1].documentId);
  });

  it('returns an empty array for an empty list', () => {
    expect(heroOrder([], new Set(), 1)).toEqual([]);
  });
});

describe('heroStack', () => {
  const pick = (over: Partial<HeroPick>): HeroPick =>
    ({
      kind: 'live',
      competition: card('a'),
      mine: false,
      live: [],
      myImminent: null,
      ...over,
    }) as HeroPick;

  const ids = (stack: ReturnType<typeof heroStack>) => stack.map(s => s.competition.documentId);

  it('leads with my own imminent start and keeps every live competition behind it', () => {
    const live = [card('a'), card('b'), card('c')];
    const stack = heroStack(pick({ kind: 'next', competition: card('mine'), mine: true, live, myImminent: card('mine') }), 4);

    expect(ids(stack)[0]).toBe('mine');
    expect(stack[0]).toMatchObject({ kind: 'next', mine: true });
    expect(ids(stack).slice(1).sort()).toEqual(['a', 'b', 'c']);
    expect(stack.slice(1).every(s => s.kind === 'live')).toBe(true);
  });

  it('puts my own live competition first and my imminent start second', () => {
    const live = [card('a'), card('mine-live'), card('b')];
    const stack = heroStack(
      pick({ kind: 'live', competition: card('mine-live'), mine: true, live, myImminent: card('mine-soon') }),
      9
    );

    expect(ids(stack).slice(0, 2)).toEqual(['mine-live', 'mine-soon']);
    expect(stack[0]).toMatchObject({ kind: 'live', mine: true });
    expect(stack[1]).toMatchObject({ kind: 'next', mine: true });
    expect(ids(stack).slice(2).sort()).toEqual(['a', 'b']);
  });

  it('is just the live competitions when nothing of mine starts soon', () => {
    const live = [card('a'), card('b')];
    const stack = heroStack(pick({ live }), 2);
    expect(ids(stack).sort()).toEqual(['a', 'b']);
  });

  it('collapses to the single card the ladder picked when nothing is live', () => {
    const stack = heroStack(pick({ kind: 'next', competition: card('featured'), featured: true }), 1);
    expect(stack).toEqual([{ kind: 'next', competition: card('featured'), mine: false, featured: true }]);
  });

  it('keeps the same order for the same seed', () => {
    const p = pick({ kind: 'next', competition: card('mine'), mine: true, live: [card('a'), card('b'), card('c')], myImminent: card('mine') });
    expect(ids(heroStack(p, 12))).toEqual(ids(heroStack(p, 12)));
  });

  it('never lists the same competition twice when my imminent start is already live', () => {
    // The two card lists have independent ages, so the moment a competition I
    // am registered in goes live it can sit in both. The pager keys by
    // documentId; two pages for one competition is always a contradiction.
    const stack = heroStack(
      pick({ kind: 'live', competition: card('x'), mine: true, live: [card('x'), card('a')], myImminent: card('x') }),
      5
    );
    const ids = stack.map(s => s.competition.documentId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(stack.find(s => s.competition.documentId === 'x')!.kind).toBe('live');
  });
});
