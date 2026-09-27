import { describe, expect, it } from 'vitest';
import { pulsePersonToMoment } from './pulsePersonToMoment';
import type { PulsePerson } from '../schemas';

const person = (over: Partial<PulsePerson> = {}): PulsePerson => ({
  criterion: 'winner',
  kicker: 'CÂȘTIGĂTOR',
  displayName: 'SIC Carp sori',
  line: 'Echipă · locul 1',
  meta: 'Cupa Nordului ed IV',
  avatarUrls: ['a.jpg', 'b.png', 'c.jpeg'],
  destination: { type: 'competition', documentId: 't9wvhtck' },
  ...over,
});

describe('pulsePersonToMoment', () => {
  // The server ships finished Romanian copy. The adapter that "improves" it is
  // the one that makes the CMS copy tests stop describing what users read.
  it('copies the server copy through verbatim', () => {
    const moment = pulsePersonToMoment(person());
    expect(moment.kicker).toBe('CÂȘTIGĂTOR');
    expect(moment.displayName).toBe('SIC Carp sori');
    expect(moment.line).toBe('Echipă · locul 1');
    expect(moment.meta).toBe('Cupa Nordului ed IV');
  });

  it('passes every avatar the server sent, including a winning team of three', () => {
    expect(pulsePersonToMoment(person()).avatarUrls).toEqual(['a.jpg', 'b.png', 'c.jpeg']);
  });

  it('carries the destination rather than inferring one from the kicker', () => {
    expect(pulsePersonToMoment(person()).destination).toEqual({
      type: 'competition',
      documentId: 't9wvhtck',
    });
  });

  it('fills competitionId for a competition destination', () => {
    expect(pulsePersonToMoment(person()).competitionId).toBe('t9wvhtck');
  });

  it('leaves competitionId empty for an angler — there is no competition', () => {
    const moment = pulsePersonToMoment(
      person({ criterion: 'mostPodiums', destination: { type: 'angler', documentId: 'u9' } })
    );
    expect(moment.competitionId).toBe('');
    expect(moment.destination).toEqual({ type: 'angler', documentId: 'u9' });
  });

  // The screen de-duplicates on `key`, and the same angler can legitimately
  // turn up under two criteria — those are two different cards.
  it('keys on criterion AND destination', () => {
    const a = pulsePersonToMoment(person({ criterion: 'mostPodiums', destination: { type: 'angler', documentId: 'u9' } }));
    const b = pulsePersonToMoment(person({ criterion: 'mostActive', destination: { type: 'angler', documentId: 'u9' } }));
    expect(a.key).toBe('mostPodiums:u9');
    expect(b.key).toBe('mostActive:u9');
    expect(a.key).not.toBe(b.key);
  });
});

describe('pulsePersonToMoment — rank', () => {
  it('carries the place in the top when the server sends one', () => {
    const m = pulsePersonToMoment({
      criterion: 'mostPodiums', kicker: 'TOP PE PODIUM', displayName: 'Paul Ionescu', line: '7 podiumuri',
      meta: 'Din 11 concursuri', avatarUrls: [], destination: { type: 'angler', documentId: 'u1' }, rank: 3,
    });
    expect(m.rank).toBe(3);
  });

  it('has no rank for a role or record criterion', () => {
    const m = pulsePersonToMoment({
      criterion: 'winner', kicker: 'CÂȘTIGĂTOR', displayName: 'X', line: 'Individual · locul 1',
      meta: 'Cupa', avatarUrls: [], destination: { type: 'competition', documentId: 'c1' },
    });
    expect(m.rank).toBeUndefined();
  });
});
