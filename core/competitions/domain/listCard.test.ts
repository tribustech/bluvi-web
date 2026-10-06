import { describe, expect, it } from 'vitest';
import type { CompetitionListItem } from '../schemas';
import { getDisplayedDate, legacyListCard } from './listCard';

const NOW = new Date('2026-10-05T10:00:00Z');

describe('getDisplayedDate (fish helpers/getDisplayedDate.ts, date-fns ro, Europe/Bucharest)', () => {
  // Expectations produced by fish's own helper (date-fns + ro locale, TZ=Europe/Bucharest, same now).
  it.each([
    ['2026-10-10T05:00:00.000Z', '2026-10-10T15:00:00.000Z', 'sâm, 10 oct'],
    // 00:30 Bucharest on the 10th, still the 9th in UTC: the day is the Romanian one.
    ['2026-10-09T21:30:00.000Z', '2026-10-10T08:00:00.000Z', 'sâm, 10 oct'],
    ['2026-10-10T05:00:00.000Z', '2026-10-11T15:00:00.000Z', 'sâm, 10 - dum, 11 oct'],
    ['2026-10-30T05:00:00.000Z', '2026-11-01T15:00:00.000Z', 'vin, 30 oct - dum, 1 noi'],
    ['2027-03-06T07:00:00.000Z', '2027-03-06T15:00:00.000Z', 'sâm, 6 mar 2027'],
    ['2026-12-31T07:00:00.000Z', '2027-01-02T15:00:00.000Z', 'joi, 31 dec 2026 - sâm, 2 ian 2027'],
    ['2027-02-27T07:00:00.000Z', '2027-03-01T15:00:00.000Z', 'sâm, 27 feb - lun, 1 mar 2027'],
  ])('%s → %s', (start, end, expected) => {
    expect(getDisplayedDate(start, end, NOW)).toBe(expected);
  });
});

const person = (id: number, username: string, avatar: string | null = null) => ({
  id,
  documentId: `p${id}`,
  username,
  avatar: avatar ? { url: avatar } : null,
});

function item(over: Partial<CompetitionListItem> = {}): CompetitionListItem {
  return {
    id: 1,
    documentId: 'c1',
    name: 'Cupa Toamnei',
    startDate: '2026-10-10T05:00:00.000Z',
    endDate: '2026-10-11T15:00:00.000Z',
    competitionStatus: 'notStarted',
    competitionType: 'single',
    rankingType: 'quantity',
    bestOfFishCount: null,
    bestOfTierSizes: null,
    registerFee: null,
    participantsLimit: 30,
    teamParticipants: null,
    registrationDeadline: null,
    banner: null,
    lake: null,
    viewers: 4,
    registrations: [],
    ...over,
  };
}

describe('legacyListCard (fish components/CompetitionCard.tsx)', () => {
  it('upper-cases the date, counts registered entrants against the limit, labels format and ranking', () => {
    const card = legacyListCard(
      item({
        registrations: [
          { registrationStatus: 'registered', participants: [person(1, 'ana', '/a.jpg')] },
          { registrationStatus: 'registered', participants: [person(2, 'bogdan')] },
          { registrationStatus: 'rejected', participants: [person(3, 'cezar')] },
        ],
      }),
      NOW,
    );
    expect(card.dateLabel).toBe('SÂM, 10 - DUM, 11 OCT');
    expect(card.entrantsLabel).toBe('2/30 pescari');
    expect(card.pendingLabel).toBeNull();
    expect(card.faces).toEqual([
      { name: 'ana', avatarUrl: '/a.jpg' },
      { name: 'bogdan', avatarUrl: null },
    ]);
    expect(card.facesOverflow).toBe(0);
    expect(card.formatLabel).toBe('Individual');
    expect(card.rankingLabel).toBe('Cantitate');
  });

  it('falls back to 21 places and «echipe» for a team event without a limit', () => {
    const card = legacyListCard(item({ competitionType: 'team', participantsLimit: null, rankingType: 'bestOf', bestOfFishCount: 5 }), NOW);
    expect(card.entrantsLabel).toBe('0/21 echipe');
    expect(card.formatLabel).toBe('Echipe');
    expect(card.rankingLabel).toBe('Best of 5');
  });

  it('says the pending registrations of an upcoming competition (with the diacritic) and shows their faces after the registered ones', () => {
    const regs = [
      { registrationStatus: 'pending', participants: [person(9, 'zoe')] },
      { registrationStatus: 'registered', participants: [person(1, 'ana')] },
      { registrationStatus: 'pending', participants: [person(8, 'yan')] },
      { registrationStatus: 'registered', participants: [person(2, 'bogdan')] },
      { registrationStatus: 'registered', participants: [person(3, 'cezar')] },
    ];
    const card = legacyListCard(item({ registrations: regs }), NOW);
    expect(card.pendingLabel).toBe('2 în așteptare');
    expect(card.entrantsLabel).toBe('3/30 pescari');
    expect(card.faces.map(f => f.name)).toEqual(['ana', 'bogdan', 'cezar']);
    expect(card.facesOverflow).toBe(2);
    // Live and finished competitions never say pending (fish showPendingRegistrations).
    expect(legacyListCard(item({ registrations: regs, competitionStatus: 'started' }), NOW).pendingLabel).toBeNull();
  });

  it('takes the banner, else the lake’s first image, in its small format', () => {
    const lakeImg = { url: '/lake.jpg', smallUrl: '/lake-small.jpg', blurhash: 'LKO2' };
    const lake = { id: 3, documentId: 'l1', name: 'Chita', coordinates: null, images: [lakeImg] };
    expect(legacyListCard(item({ lake }), NOW).poster).toEqual({ src: '/lake-small.jpg', blurhash: 'LKO2' });
    expect(legacyListCard(item({ lake, banner: { url: '/b.jpg', smallUrl: null } }), NOW).poster).toEqual({ src: '/b.jpg', blurhash: null });
    expect(legacyListCard(item(), NOW).poster).toBeNull();
  });
});
