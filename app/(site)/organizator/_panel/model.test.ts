import { describe, expect, it } from 'vitest';
import { ApiError } from '@/core/transport';
import type { DraftCompetition, OrganizerDashboardStats, OrganizerStatDetailItem } from '@/core/organizer';
import {
  cancelledToast,
  cancelReason,
  canCancel,
  cardBadges,
  cardImage,
  cardParticipants,
  dateRangeLabel,
  draftDate,
  draftImage,
  draftStep,
  editEntry,
  emptyCopy,
  participantsLine,
  STAT_DETAIL,
  statDetailValue,
  statTiles,
  STATUS_BADGE,
  TABS,
  tabCounts,
  writeErrorMessage,
} from './model';

const STATS: OrganizerDashboardStats = {
  totalOrganized: 12,
  pendingRegistrations: 3,
  activeCompetitions: 2,
  emptySpots: 4,
  fillRate: 87,
  draftsCount: 2,
  byStatus: { completed: 10, notStarted: 2 },
};

const item = (over: Partial<OrganizerStatDetailItem> = {}): OrganizerStatDetailItem => ({
  documentId: 'c1',
  competition: {
    documentId: 'c1',
    name: 'Cupa',
    startDate: '2026-10-10T06:00:00.000Z',
    endDate: '2026-10-11T14:00:00.000Z',
    participantsLimit: 20,
    participantsRegistered: 12,
    competitionStatus: 'notStarted',
  },
  pendingRegistrationsCount: 2,
  emptySpotsCount: 8,
  fillRate: 60,
  ...over,
});

const comp = (over: Partial<DraftCompetition> = {}): DraftCompetition => ({
  id: 1,
  documentId: 'c1',
  name: 'Cupa',
  competitionStatus: 'notStarted',
  ...over,
});

describe('KPI tiles (organizer.panel.c3, c4)', () => {
  it('four tiles in fish order with values, the % unit apart and the tones', () => {
    const tiles = statTiles(STATS);
    expect(tiles.map((t) => [t.key, t.label, t.value, t.unit ?? null, t.tone])).toEqual([
      ['pending', 'Participanți în așteptare', 3, null, 'amber'],
      ['empty', 'Locuri libere', 4, null, 'indigo'],
      ['fill', 'Rată de ocupare', 87, '%', 'mint'],
      ['total', 'Total organizate', 12, null, 'signature'],
    ]);
    expect(tiles.map((t) => t.shortLabel)).toEqual(['În așteptare', 'Locuri libere', 'Ocupare', 'Organizate']);
  });
  it('only the pending tile pulses, and only above 0', () => {
    expect(statTiles(STATS).filter((t) => t.pulse).map((t) => t.key)).toEqual(['pending']);
    expect(statTiles({ ...STATS, pendingRegistrations: 0 }).some((t) => t.pulse)).toBe(false);
  });
});

describe('stat detail (c8–c10)', () => {
  it('titles and per-key empty messages', () => {
    expect(STAT_DETAIL.pending).toMatchObject({ title: 'Participanți în așteptare', emptyMessage: 'Niciun participant în așteptare.' });
    expect(STAT_DETAIL.empty).toMatchObject({ title: 'Locuri libere', emptyMessage: 'Nicio competiție cu locuri libere.' });
    expect(STAT_DETAIL.fill).toMatchObject({ title: 'Rată de ocupare', emptyMessage: 'Nicio competiție activă.' });
    expect(STAT_DETAIL.total).toMatchObject({ title: 'Total organizate', emptyMessage: 'Nu ai organizat nicio competiție încă.' });
  });
  it('value pills, with Romanian plurals', () => {
    expect(statDetailValue('pending', item())).toBe('2 în așteptare');
    expect(statDetailValue('empty', item())).toBe('8 locuri libere');
    expect(statDetailValue('empty', item({ emptySpotsCount: 1 }))).toBe('1 loc liber');
    expect(statDetailValue('empty', item({ emptySpotsCount: 20 }))).toBe('20 de locuri libere');
    expect(statDetailValue('fill', item())).toBe('60% ocupare');
    expect(statDetailValue('total', item())).toBe('12/20 participanți');
  });
  it('participants line and status badges', () => {
    expect(participantsLine(12, 20)).toBe('12/20 participanți');
    expect(participantsLine(1, null)).toBe('1 participant');
    expect(Object.fromEntries(Object.entries(STATUS_BADGE).map(([k, v]) => [k, `${v.label}:${v.tone}`]))).toEqual({
      draft: 'Ciornă:gray',
      notStarted: 'În viitor:indigo',
      started: 'Live:green',
      completed: 'Încheiat:gray',
      cancelled: 'Anulat:red',
    });
  });
  it('the date range is uppercased, null without both ends', () => {
    expect(dateRangeLabel('2026-10-10T06:00:00.000Z', '2026-10-11T14:00:00.000Z', new Date('2026-10-08T10:00:00Z'))).toBe('SÂM, 10 - DUM, 11 OCT');
    expect(dateRangeLabel(null, '2026-10-11T14:00:00.000Z')).toBeNull();
  });
});

describe('tabs (c12, c13, c16)', () => {
  it('order and labels', () => {
    expect(TABS.map((t) => `${t.key}:${t.label}`)).toEqual(['draft:Ciorne', 'notStarted:Viitoare', 'started:Live', 'completed:Încheiate', 'cancelled:Anulate']);
  });
  it('counts: drafts for Ciorne, byStatus for the rest (missing → 0)', () => {
    expect(tabCounts(STATS)).toEqual({ draft: 2, notStarted: 2, started: 0, completed: 10, cancelled: 0 });
    expect(tabCounts(undefined)).toEqual({});
  });
  it('empty copies', () => {
    expect(emptyCopy('draft')).toBe('Nu ai ciorne. Creează o competiție nouă!');
    expect(emptyCopy('cancelled')).toBe('Nu ai competiții în această categorie.');
  });
});

describe('cards (c17, c21, c22, b.card-edit-entry)', () => {
  const banner = { url: 'o.jpg', formats: { small: { url: 's.jpg' }, thumbnail: { url: 't.jpg' } } } as DraftCompetition['banner'];
  it('draft banner chain small → thumbnail → original → placeholder', () => {
    expect(draftImage({ banner })).toBe('s.jpg');
    expect(draftImage({ banner: { url: 'o.jpg', formats: { thumbnail: { url: 't.jpg' } } } as DraftCompetition['banner'] })).toBe('t.jpg');
    expect(draftImage({ banner: { url: 'o.jpg' } as DraftCompetition['banner'] })).toBe('o.jpg');
    expect(draftImage({ banner: null })).toBeNull();
  });
  it('draft step and date', () => {
    expect(draftStep({ draftMeta: { completedSteps: [1, 2], sectors: [], standAllocations: {}, sponsorIds: [], fishSpeciesIds: [] } })).toBe('Pas 2/5');
    expect(draftStep({ draftMeta: null })).toBe('Pas 0/5');
    expect(draftDate('2026-10-05T21:30:00.000Z')).toBe('6 oct. 2026');
    expect(draftDate(null)).toBeNull();
  });
  it('compact card image falls back to the lake photo', () => {
    expect(cardImage({ banner: null, lake: { documentId: 'l', name: 'Lac', images: [{ url: 'lake.jpg' } as NonNullable<DraftCompetition['banner']>] } })).toBe('lake.jpg');
    expect(cardImage({ banner: null, lake: null })).toBeNull();
  });
  it('participants line, pending only while notStarted', () => {
    const regs = [
      { id: 1, documentId: 'a', registrationStatus: 'registered' },
      { id: 2, documentId: 'b', registrationStatus: 'pending' },
    ];
    expect(cardParticipants(comp({ registrations: regs, participantsLimit: 20, competitionType: 'team' }))).toEqual({ line: '1/20 echipe', pending: '1 în așteptare' });
    expect(cardParticipants(comp({ registrations: regs, participantsLimit: null, competitionType: 'single', competitionStatus: 'started' }))).toEqual({
      line: '1/21 pescari',
      pending: null,
    });
  });
  it('badges', () => {
    expect(cardBadges(comp({ competitionType: 'team', rankingType: 'quantity' }))).toEqual([
      { label: 'Echipe', tone: 'green' },
      { label: 'Cantitate', tone: 'yellow' },
    ]);
  });
  it('edit entry and cancel', () => {
    expect(editEntry('notStarted')).toBe('wizard');
    expect(editEntry('started')).toBe('notice');
    expect(editEntry('completed')).toBeNull();
    expect(canCancel('notStarted')).toBe(true);
    expect(canCancel('started')).toBe(false);
  });
});

describe('writes (c20, c25)', () => {
  it('reason trimmed, omitted when blank', () => {
    expect(cancelReason('  Vreme  ')).toBe('Vreme');
    expect(cancelReason('   ')).toBeUndefined();
  });
  it('toasts', () => {
    expect(cancelledToast(0)).toBe('Competiția a fost anulată.');
    expect(cancelledToast(2)).toBe('Competiția a fost anulată. Unii participanți ar putea să nu primească notificarea.');
  });
  it('server message only for a handled (bluCode) error', () => {
    expect(writeErrorMessage(new ApiError({ message: 'Concursul a început.', status: 400, code: 'HTTP', bluCode: 'X' }), 'fb')).toBe('Concursul a început.');
    expect(writeErrorMessage(new ApiError({ message: 'generic', status: 500, code: 'HTTP' }), 'fb')).toBe('fb');
    expect(writeErrorMessage(new Error('x'), 'fb')).toBe('fb');
  });
});
