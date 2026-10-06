import { describe, expect, it } from 'vitest';
import type { NationalChampionshipStandRanking } from '../schemas';
import {
  formatNationalStand,
  isNationalChampionshipRankings,
  isNcWinner,
  ncGeneralModel,
  ncSectorRows,
  ncSectorTotals,
  sortNcClubs,
} from './nationalChampionship';

type Team = NationalChampionshipStandRanking['teams'][number];

const team = (o: Partial<Team>): Team => ({
  sectorId: 'sA',
  sectorName: 'A',
  standId: 1,
  standName: '1',
  teamName: '',
  guestName: null,
  participants: [],
  registrationId: 'r',
  biggestFish: 2,
  catchCount: 3,
  sectorPosition: 1,
  generalPosition: 1,
  quantity: 6,
  averageWeight: 2,
  sectorPoints: 1,
  sectorDrawPosition: null,
  ...o,
});

const club = (o: Partial<NationalChampionshipStandRanking>): NationalChampionshipStandRanking => ({
  clubId: 'c',
  clubName: 'Club',
  clubPoints: 3,
  clubPosition: 1,
  clubAverageWeight: 2,
  clubTotalQuantity: 12,
  clubTotalCatchCount: 6,
  clubBiggestCatch: 4,
  teams: [],
  ...o,
});

const ardeal = club({
  clubId: '1',
  clubName: 'Ardealul',
  clubPosition: 2,
  clubPoints: 5,
  teams: [
    team({ registrationId: 'a1', sectorId: 'sA', sectorName: 'A', standName: '3', participants: [{ username: 'Ion' }, { username: 'Ana' }], generalPosition: 4, sectorPosition: 2, sectorPoints: 2 }),
    team({ registrationId: 'a2', sectorId: 'sB', sectorName: 'B', standName: '9', guestName: 'Cici', generalPosition: 1, sectorPosition: 1, sectorPoints: 1 }),
  ],
});
const arad = club({
  clubId: '2',
  clubName: 'Arad',
  clubPosition: 1,
  teams: [
    team({ registrationId: 'b1', sectorId: 'sA', sectorName: 'A', standName: '1', guestName: 'Bubu', generalPosition: 2, sectorPosition: 1, sectorPoints: 1, quantity: 10 }),
    team({ registrationId: 'b2', sectorId: 'sA', sectorName: 'A', standName: '2', guestName: 'Capot', catchCount: 0, quantity: 0, biggestFish: 0, generalPosition: 3, sectorPosition: 2.5, sectorPoints: 2.5 }),
  ],
});

describe('formatNationalStand', () => {
  it('sector letter + draw position + stand in brackets, else letter + stand', () => {
    expect(formatNationalStand('A', 3, '12')).toBe('A3(12)');
    expect(formatNationalStand('A', null, '12')).toBe('A12');
    expect(formatNationalStand('Sector B', null, 7)).toBe('B7');
  });
});

describe('isNationalChampionshipRankings', () => {
  it('club rows only', () => {
    expect(isNationalChampionshipRankings([ardeal])).toBe(true);
    expect(isNationalChampionshipRankings([])).toBe(false);
  });
});

describe('isNcWinner', () => {
  it('places 1..numberOfSectors', () => {
    expect(isNcWinner(2, 2)).toBe(true);
    expect(isNcWinner(2, 3)).toBe(false);
    expect(isNcWinner(0, 1)).toBe(false);
  });
});

describe('sortNcClubs', () => {
  it('Club keeps the backend order; position orders clubs by clubPosition', () => {
    expect(sortNcClubs([ardeal, arad], 'club').map(c => c.clubName)).toEqual(['Ardealul', 'Arad']);
    expect(sortNcClubs([ardeal, arad], 'position').map(c => c.clubName)).toEqual(['Arad', 'Ardealul']);
  });
});

describe('ncGeneralModel', () => {
  it('club totals with three decimals, winners by clubPosition, teams labelled', () => {
    const [a, b] = ncGeneralModel([ardeal, arad], 1);
    expect(a).toMatchObject({ clubName: 'Ardealul', colorIndex: 0, winner: false, totalKg: '12.000', points: '5', position: '2' });
    expect(b).toMatchObject({ colorIndex: 1, winner: true });
    expect(a.teams[0]).toMatchObject({ participants: 'Ion, Ana', stand: 'A3', quantity: '6.000', individualWinner: false });
    expect(a.teams[1]).toMatchObject({ participants: 'Cici', individualWinner: true });
  });
  it('zero values print «-»', () => {
    const [m] = ncGeneralModel([club({ clubTotalQuantity: 0, clubTotalCatchCount: 0, teams: [team({ quantity: 0 })] })], 1);
    expect(m.totalKg).toBe('-');
    expect(m.catchCount).toBe('-');
    expect(m.teams[0].quantity).toBe('-');
  });
});

describe('ncSectorRows', () => {
  it('only that sector; position puts capot last, then generalPosition', () => {
    const rows = ncSectorRows([ardeal, arad], 'sA', 'position');
    expect(rows.map(r => r.participants)).toEqual(['Bubu', 'Ion, Ana', 'Capot']);
    expect(rows[2]).toMatchObject({ quantity: '-', averageWeight: '-', biggestFish: '-', sectorPoints: '2.5', capot: true, club: 'Arad' });
    expect(rows[0]).toMatchObject({ quantity: '10.000', averageWeight: '3.333', sectorPosition: '1' });
  });
  it('stand without draw positions: sector position with capot last', () => {
    expect(ncSectorRows([ardeal, arad], 'sA', 'stand').map(r => r.stand)).toEqual(['A1', 'A3', 'A2']);
  });
  it('stand with draw positions: by draw position', () => {
    const drawn = club({
      teams: [team({ registrationId: 'x', sectorDrawPosition: 2, standName: '5' }), team({ registrationId: 'y', sectorDrawPosition: 1, standName: '8' })],
    });
    expect(ncSectorRows([drawn], 'sA', 'stand').map(r => r.stand)).toEqual(['A1(8)', 'A2(5)']);
  });
  it('a sector with no teams is empty', () => {
    expect(ncSectorRows([ardeal], 'sZ', 'position')).toEqual([]);
  });
});

describe('ncSectorTotals', () => {
  it('the sector’s own totals', () => {
    expect(ncSectorTotals([ardeal, arad], 'sA')).toEqual({ totalQuantity: 16, totalCatchesCount: 6, biggestFish: 2 });
  });
});
