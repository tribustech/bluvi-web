import { describe, expect, it } from 'vitest';
import type { AllocatedParticipantsResponse, WeighingByStand } from '@/core/organizer';
import { canDeleteWeighing, defaultSelection, formatWeighingKg, parseTotal, standHeader, standTotals, weighingRows } from './model';

const competition = (rankingType = 'quantity') =>
  ({
    rankingType,
    sectors: [
      { documentId: 'sa', name: 'A', stands: [{ documentId: 's1', name: '1' }, { documentId: 's2', name: '2' }] },
      { documentId: 'sb', name: 'B', stands: [{ documentId: 's3', name: '10' }] },
    ],
  }) as never;

const alloc = (over: Partial<NonNullable<AllocatedParticipantsResponse[string]>> = {}): AllocatedParticipantsResponse => ({
  s3: {
    participants: [
      { id: 1, documentId: 'p1', name: 'Ion Pop' },
      { id: 2, documentId: 'p2', name: 'Ana Pop' },
    ],
    registrationId: 'r1',
    teamName: '',
    guestName: '',
    clubName: 'CS Ardealul',
    sectorName: 'B',
    sectorDrawPosition: 4,
    ...over,
  },
});

const w = (over: Partial<WeighingByStand> = {}): WeighingByStand => ({
  id: 1,
  documentId: 'w1',
  weighingType: 'normal',
  weighingStatus: 'finished',
  startDate: '2026-09-27T04:42:00.000Z',
  endDate: '2026-09-27T05:10:00.000Z',
  catches: [{ weight: 5.25 }, { weight: 7.2 }],
  ...over,
});

describe('standHeader (c2)', () => {
  it('names the stand from the competition’s sectors, the participants as bullets', () => {
    expect(standHeader(competition(), alloc(), 's3')).toEqual({
      standId: 's3',
      sectorName: 'B',
      standName: '10',
      label: 'Sector B, Stand 10',
      club: null,
      team: null,
      people: ['Ion Pop', 'Ana Pop'],
    });
  });

  it('national championship: the national label with the draw position, and the club', () => {
    const h = standHeader(competition('nationalChampionship'), alloc(), 's3')!;
    expect(h.label).toBe('Stand B4(10)');
    expect(h.club).toBe('CS Ardealul');
  });

  it('a team: «Echipa <nume>»; a guest is the one bullet', () => {
    const h = standHeader(competition(), alloc({ teamName: 'Crap Team', guestName: 'Musafir X' }), 's3')!;
    expect(h.team).toBe('Echipa Crap Team');
    expect(h.people).toEqual(['Musafir X']);
  });

  it('an unallocated stand has no people; a stand outside the competition is null', () => {
    expect(standHeader(competition(), alloc(), 's1')!.people).toEqual([]);
    expect(standHeader(competition(), alloc(), 'nope')).toBeNull();
  });
});

describe('weighingRows (c4)', () => {
  it('«Cântar N (Extra)», totals, Bucharest dd.MM, HH:mm, «În curs» without an end', () => {
    const rows = weighingRows([w(), w({ documentId: 'w2', weighingType: 'extra', weighingStatus: 'started', endDate: null, catches: [] })]);
    expect(rows[0]).toMatchObject({ title: 'Cântar 1', finished: true, catches: 2, start: '27.09, 07:42', end: '27.09, 08:10', open: false });
    expect(rows[0].totalKg).toBeCloseTo(12.45);
    expect(rows[1]).toMatchObject({ title: 'Cântar 2 (Extra)', extra: true, finished: false, catches: 0, end: 'În curs', open: true });
  });

  it('formats kg with three decimals and a comma; parses the total string', () => {
    expect(formatWeighingKg(12.45)).toBe('12,450');
    expect(formatWeighingKg(1234.5)).toBe('1.234,500');
    expect(parseTotal('37.350')).toBe(37.35);
    expect(parseTotal(undefined)).toBeNull();
    expect(parseTotal('x')).toBeNull();
  });
});

describe('canDeleteWeighing (c7)', () => {
  it('only an empty, unfinished weighing, only with actions allowed', () => {
    expect(canDeleteWeighing({ catches: 0, finished: false }, true)).toBe(true);
    expect(canDeleteWeighing({ catches: 0, finished: false }, false)).toBe(false);
    expect(canDeleteWeighing({ catches: 1, finished: false }, true)).toBe(false);
    expect(canDeleteWeighing({ catches: 0, finished: true }, true)).toBe(false);
  });
});

describe('defaultSelection / standTotals', () => {
  const rows = weighingRows([w(), w({ documentId: 'w2', weighingStatus: 'started', endDate: null }), w({ documentId: 'w3' })]);
  it('keeps a live selection, else the open weighing, else the latest', () => {
    expect(defaultSelection(rows, 'w3')).toBe('w3');
    expect(defaultSelection(rows, 'gone')).toBe('w2');
    expect(defaultSelection(weighingRows([w(), w({ documentId: 'w3' })]), null)).toBe('w3');
    expect(defaultSelection([], null)).toBeNull();
  });
  it('counts', () => {
    expect(standTotals(rows)).toEqual({ weighings: 3, extra: 0, catches: 6, open: 1 });
  });
});
