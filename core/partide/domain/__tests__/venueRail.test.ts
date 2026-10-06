import { describe, expect, it } from 'vitest';
import { caughtLabel, dedupeByDocumentId, venueRailCatches } from '../venueRail';
import { labelIndices, seriesDetailLabels, yAxisScale } from '../activitySeries';

const NOW = new Date('2026-07-29T12:00:00').getTime();
const c = (id: string, session: string) => ({ clientId: id, sessionDocumentId: session });

describe('caughtLabel', () => {
  it('reads relative under a day, a date after', () => {
    expect(caughtLabel(NOW, new Date(NOW - 20_000).toISOString())).toBe('acum');
    expect(caughtLabel(NOW, new Date(NOW - 8 * 60_000).toISOString())).toBe('acum 8 min');
    expect(caughtLabel(NOW, new Date(NOW - 5 * 3_600_000).toISOString())).toBe('acum 5 h');
    expect(caughtLabel(NOW, new Date('2026-07-27T09:00:00').toISOString())).toBe('27 IUL');
    expect(caughtLabel(NOW, new Date(NOW + 60_000).toISOString())).toBe('29 IUL');
  });
});

describe('venueRailCatches', () => {
  const all = [c('a', 's1'), c('b', 's2'), c('c', 's3'), c('d', 's1'), c('e', 's4')];
  it('no live session: the latest three', () => {
    expect(venueRailCatches(all, [])).toEqual({ rows: all.slice(0, 3), heading: 'Ultimele capturi' });
  });
  it('one live session: the other sessions only', () => {
    expect(venueRailCatches(all, ['s1']).rows.map(r => r.clientId)).toEqual(['b', 'c', 'e']);
    expect(venueRailCatches([c('a', 's1')], ['s1']).rows).toEqual([]);
  });
  it('two or more live sessions: their catches, under their heading', () => {
    const r = venueRailCatches(all, ['s1', 's4']);
    expect(r.rows.map(x => x.clientId)).toEqual(['a', 'd', 'e']);
    expect(r.heading).toBe('Capturi în partidele active');
  });
  it('two live sessions without catches: the latest, plain heading', () => {
    expect(venueRailCatches(all, ['x', 'y'])).toEqual({ rows: all.slice(0, 3), heading: 'Ultimele capturi' });
  });
});

describe('dedupeByDocumentId', () => {
  it('keeps the first occurrence', () => {
    expect(dedupeByDocumentId([{ documentId: 'a', n: 1 }, { documentId: 'b', n: 2 }, { documentId: 'a', n: 3 }])).toEqual([
      { documentId: 'a', n: 1 },
      { documentId: 'b', n: 2 },
    ]);
  });
});

describe('activity series', () => {
  it('detail labels per period', () => {
    const now = new Date('2026-07-29T12:00:00');
    expect(seriesDetailLabels('week', 2, now)).toEqual(['mar 28 iul', 'mie 29 iul']);
    expect(seriesDetailLabels('month', 1, now)).toEqual(['29 iul']);
    expect(seriesDetailLabels('year', 2, now)).toEqual(['Ianuarie', 'Februarie']);
  });
  it('label indices', () => {
    expect(labelIndices(7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(labelIndices(30)).toEqual([0, 5, 10, 15, 20, 25, 29]);
    expect(labelIndices(27)).toEqual([0, 5, 10, 15, 20, 26]);
  });
  it('nice y scale', () => {
    expect(yAxisScale(4363)).toEqual({ maxValue: 4500, noOfSections: 3, stepValue: 1500 });
    expect(yAxisScale(2)).toEqual({ maxValue: 3, noOfSections: 3, stepValue: 1 });
  });
});
