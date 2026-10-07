import { describe, expect, it } from 'vitest';
import { displayEnd } from '@/app/(site)/concursuri/[id]/_components/dates';
import {
  catchItems,
  competitionJsonLd,
  competitionSummary,
  weighingItems,
  type LooseCompetitionDetail,
} from '@/app/(site)/concursuri/[id]/_components/load';

/*
 * The competition page's metadata and SportsEvent (global.b.seo-metadata, global.b.seo-json-ld):
 * the same clamped dates as the page shows, a summary that promises only what the stage has, the
 * address Google requires for an Event when it is known, and view rows that never say «capot».
 */

const competition = (over: Partial<LooseCompetitionDetail> = {}) =>
  ({
    documentId: 'c1',
    name: 'Cupa Toamnei',
    startDate: '2026-09-27T06:00:00.000Z',
    endDate: '2026-09-28T14:00:00.000Z',
    competitionStatus: 'completed',
    regulation: null,
    banner: { url: 'https://cdn/x.jpg', formats: { large: { url: 'https://cdn/x-large.jpg' } } },
    lake: { id: 1, documentId: 'lk1', name: 'Balta Test', contact: [], stands: [] },
    author: { id: 1, documentId: 'u1', username: 'Club Crap', phone: null },
    ...over,
  }) as unknown as LooseCompetitionDetail;

describe('displayEnd — one clamp for the header, the metadata and the JSON-LD', () => {
  it('an end before the start is the start; otherwise the end', () => {
    expect(displayEnd({ startDate: '2026-09-27T06:00:00Z', endDate: '2026-09-25T06:00:00Z' })).toBe('2026-09-27T06:00:00Z');
    expect(displayEnd({ startDate: '2026-09-27T06:00:00Z', endDate: '2026-09-28T06:00:00Z' })).toBe('2026-09-28T06:00:00Z');
  });

  it('m1 / j1: endDate < startDate never prints a backwards range nor an invalid SportsEvent', () => {
    const c = competition({ startDate: '2026-09-27T06:00:00.000Z', endDate: '2026-09-25T06:00:00.000Z' });
    expect(competitionSummary(c)).toContain('27 septembrie 2026');
    expect(competitionSummary(c)).not.toMatch(/27–25/);
    const ld = competitionJsonLd(c);
    expect(Date.parse(ld.endDate as string)).toBeGreaterThanOrEqual(Date.parse(ld.startDate as string));
    expect(ld.description).toBe(competitionSummary(c));
  });
});

describe('competitionSummary — what the stage offers (rule 4)', () => {
  it('before the start: the registration (and the regulation only when there is one)', () => {
    expect(competitionSummary(competition({ competitionStatus: 'notStarted' }))).toMatch(/ Înscrieri pe Bluvi\.$/);
    const withRules = competition({ competitionStatus: 'notStarted', regulation: [{ type: 'paragraph', children: [{ type: 'text', text: 'Art. 1' }] }] as never });
    expect(competitionSummary(withRules)).toMatch(/ Înscrieri și regulament pe Bluvi\.$/);
  });
  it('once started: the ranking and the weighings — never «statistici» (signed-in, noindex)', () => {
    for (const status of ['started', 'completed'] as const) {
      const d = competitionSummary(competition({ competitionStatus: status }));
      expect(d).toMatch(/ Clasament și cântare pe Bluvi\.$/);
      expect(d.toLowerCase()).not.toContain('statistici');
    }
  });
});

type Ld = { location: { address?: unknown }; image?: unknown; organizer?: unknown };

describe('competitionJsonLd', () => {
  it('j1: location.address (PostalAddress, RO) when the lake\'s place is known, the poster as image, an Organization organiser', () => {
    const ld = competitionJsonLd(competition(), { locality: 'Ciolpani', region: 'Ilfov' }) as unknown as Ld;
    expect(ld.location.address).toEqual({ '@type': 'PostalAddress', addressLocality: 'Ciolpani', addressRegion: 'Ilfov', addressCountry: 'RO' });
    expect(ld.image).toEqual(['https://cdn/x-large.jpg']);
    expect(ld.organizer).toEqual({ '@type': 'Organization', name: 'Club Crap' });
  });
  it('rule 4: no address when the place is unknown', () => {
    const ld = competitionJsonLd(competition(), null) as unknown as Ld;
    expect(ld.location.address).toBeUndefined();
    expect((competitionJsonLd(competition(), { locality: null, region: null }) as unknown as Ld).location.address).toBeUndefined();
  });
});

describe('the views\' ItemList rows', () => {
  it('Cântare: in weighing order, kilograms and fish — «fără captură», never «capot»', () => {
    const w = (i: number, startDate: string, catchCount: number, totalWeightKg: number) => ({
      weighingDocumentId: `w${i}`,
      startDate,
      endDate: null,
      weighingType: 'normal',
      sequenceIndex: i,
      totalWeightKg,
      catchCount,
      standName: String(i),
    });
    const items = weighingItems([w(2, '2026-09-27T12:00:00Z', 0, 0), w(1, '2026-09-27T10:00:00Z', 3, 7.25)]);
    expect(items).toEqual([
      { name: 'Standul 1', description: '7,25 kg, 3 pești' },
      { name: 'Standul 2', description: '0 kg, fără captură' },
    ]);
    expect(JSON.stringify(items)).not.toMatch(/capot/i);
  });
  it('Toți peștii: species, kilograms, stand and angler', () => {
    const items = catchItems([
      { id: 1, weight: 4.2, standId: null, standName: 'A1', sectorId: null, sectorName: null, teamName: null, guestName: null, participantUsername: 'ion', fishName: 'Crap' },
      { id: 2, weight: 1, standId: null, standName: '', sectorId: null, sectorName: null, teamName: null, guestName: null, participantUsername: null, fishName: null },
    ]);
    expect(items).toEqual([
      { name: 'Crap', description: '4,2 kg, standul A1, ion' },
      { name: 'Pește', description: '1 kg' },
    ]);
  });
});
