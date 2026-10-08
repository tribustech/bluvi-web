import { describe, expect, it } from 'vitest';
import type { AllocatedParticipantsResponse } from '@/core/organizer';
import { canWeigh, competitionRoleOf, deniedCopy, managementAccess } from './access';
import { countStands, filterStandGroups, standOccupantGroups } from './occupant';

const stand = (documentId: string, name: string) => ({ id: 1, documentId, name });
const sector = (name: string, stands: ReturnType<typeof stand>[]) => ({
  id: 1,
  documentId: `sec-${name}`,
  name,
  minFishNumber: null,
  stands,
});
const alloc = (o: Partial<NonNullable<AllocatedParticipantsResponse[string]>> = {}) => ({
  participants: [{ id: 1, documentId: 'u1', name: 'Ion Pop' }],
  registrationId: 'r1',
  teamName: '',
  guestName: '',
  clubName: '',
  sectorName: 'A',
  sectorDrawPosition: null,
  ...o,
});

const competition = (o: { rankingType?: string; competitionType?: 'single' | 'team' } = {}) =>
  ({
    rankingType: o.rankingType ?? 'quantity',
    competitionType: o.competitionType ?? 'single',
    // The competition's own order, not alphabetical (fish maps competition.sectors as-is).
    sectors: [sector('B', [stand('s3', '3'), stand('s4', '4')]), sector('A', [stand('s1', '1'), stand('s2', '2')])],
  }) as Parameters<typeof standOccupantGroups>[0];

describe('standOccupantGroups (fish scale/index.tsx)', () => {
  it('keeps the competition sector order and the sector stand order', () => {
    const groups = standOccupantGroups(competition(), {});
    expect(groups.map((g) => g.name)).toEqual(['B', 'A']);
    expect(groups[0].stands.map((s) => s.label)).toEqual(['Stand 3', 'Stand 4']);
  });

  it('individual: the participants joined; unallocated has no occupant', () => {
    const groups = standOccupantGroups(competition(), {
      s3: alloc({ participants: [{ id: 1, documentId: 'a', name: 'Ion' }, { id: 2, documentId: 'b', name: 'Ana' }] }),
      s4: null,
    });
    expect(groups[0].stands[0]).toMatchObject({ people: 'Ion, Ana', team: null, allocated: true, registrationId: 'r1' });
    expect(groups[0].stands[1]).toMatchObject({ people: null, team: null, allocated: false, registrationId: null });
    expect(groups[0]).toMatchObject({ allocated: 1, unallocated: 1 });
    expect(groups[1]).toMatchObject({ allocated: 0, unallocated: 2 });
  });

  it('individual guest: the guest name', () => {
    const [b] = standOccupantGroups(competition(), { s3: alloc({ participants: [], guestName: 'Gigel' }) });
    expect(b.stands[0]).toMatchObject({ people: 'Gigel', team: null });
  });

  it('team: «<echipă>:» then the members; «Echipă» without a name; a guest repeating the team is not printed twice', () => {
    const groups = standOccupantGroups(competition({ competitionType: 'team' }), {
      s3: alloc({ teamName: 'Nada Grea', participants: [{ id: 1, documentId: 'a', name: 'Ion' }, { id: 2, documentId: 'b', name: 'Ana' }] }),
      s4: alloc({ teamName: '' }),
      s1: alloc({ teamName: 'Știucile', participants: [], guestName: 'stiucile ' }),
      s2: alloc({ teamName: 'Crapii', participants: [], guestName: 'Mihai și Dan' }),
    });
    expect(groups[0].stands[0]).toMatchObject({ team: 'Nada Grea', people: 'Ion, Ana' });
    expect(groups[0].stands[1]).toMatchObject({ team: 'Echipă', people: 'Ion Pop' });
    expect(groups[1].stands[0]).toMatchObject({ team: 'Știucile', people: null });
    expect(groups[1].stands[1]).toMatchObject({ team: 'Crapii', people: 'Mihai și Dan' });
  });

  it('national championship: the national stand label with the draw position, and the club', () => {
    const [b] = standOccupantGroups(competition({ rankingType: 'nationalChampionship' }), {
      s3: alloc({ sectorDrawPosition: 2, clubName: 'Ardealul' }),
      s4: alloc({ clubName: '' }),
    });
    expect(b.stands[0]).toMatchObject({ label: 'Stand B2(3)', club: 'Ardealul' });
    expect(b.stands[1]).toMatchObject({ label: 'Stand B4', club: null });
  });

  it('no club and the plain label off the national championship', () => {
    const [b] = standOccupantGroups(competition({ rankingType: 'fipsed' }), { s3: alloc({ clubName: 'Ardealul', sectorDrawPosition: 2 }) });
    expect(b.stands[0]).toMatchObject({ label: 'Stand 3', club: null });
  });

  it('sector colours follow fish getColorsBySector (sorted names → palette by index)', () => {
    const groups = standOccupantGroups(competition(), {});
    expect(groups.map((g) => [g.name, g.paletteLetter])).toEqual([
      ['B', 'B'],
      ['A', 'A'],
    ]);
  });

  it('find-as-you-type: stand, seat, people, club and team, diacritics-insensitive', () => {
    const groups = standOccupantGroups(competition({ rankingType: 'nationalChampionship' }), {
      s3: alloc({ participants: [{ id: 1, documentId: 'a', name: 'Ștefan Ionescu' }], clubName: 'Ardealul' }),
    });
    expect(countStands(filterStandGroups(groups, 'stefan'))).toBe(1);
    expect(countStands(filterStandGroups(groups, 'ardeal'))).toBe(1);
    expect(countStands(filterStandGroups(groups, 'A2'))).toBe(1);
    expect(filterStandGroups(groups, 'A2')[0].name).toBe('A');
    expect(countStands(filterStandGroups(groups, '  '))).toBe(4);
    expect(filterStandGroups(groups, 'zzz')).toEqual([]);
  });
});

describe('management access (organizer.b.role-gate)', () => {
  it('reads the role from the statute, the referee flag included', () => {
    expect(competitionRoleOf({ userRole: 'author' })).toBe('author');
    expect(competitionRoleOf({ userRole: 'participant', isReferee: true })).toBe('referee');
    expect(competitionRoleOf({ userRole: 'participant' })).toBe('participant');
    expect(competitionRoleOf({ userRole: null })).toBe('none');
  });

  it('is pending while the statute is unknown, never denied (rule 4)', () => {
    expect(managementAccess('author', { role: undefined, isOrganizer: true })).toBe('pending');
    expect(managementAccess('authorOrReferee', { role: undefined, isOrganizer: false })).toBe('pending');
  });

  it('decides per requirement', () => {
    expect(managementAccess('signedIn', { role: undefined, isOrganizer: false })).toBe('allowed');
    expect(managementAccess('role', { role: undefined, isOrganizer: false })).toBe('denied');
    expect(managementAccess('role', { role: undefined, isOrganizer: true })).toBe('allowed');
    expect(managementAccess('author', { role: 'referee', isOrganizer: true })).toBe('denied');
    expect(managementAccess('authorOrReferee', { role: 'referee', isOrganizer: false })).toBe('allowed');
    expect(managementAccess('authorOrReferee', { role: 'participant', isOrganizer: false })).toBe('denied');
    expect(deniedCopy('author').title).toBe('Doar pentru organizatorul concursului');
  });

  it('weighing actions: author or referee on a started competition only', () => {
    expect(canWeigh('author', 'started')).toBe(true);
    expect(canWeigh('referee', 'started')).toBe(true);
    expect(canWeigh('participant', 'started')).toBe(false);
    expect(canWeigh('author', 'notStarted')).toBe(false);
    expect(canWeigh(undefined, 'started')).toBe(false);
  });
});
