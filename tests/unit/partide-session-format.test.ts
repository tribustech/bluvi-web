import { describe, expect, it } from 'vitest';
import { catchCaption, clockRo, dayMonthRo, durationLabel, pastCardMeta, spacedDuration } from '@/components/partide/session/format';
import { splitDuration } from '@/components/partide/session/StatTiles';
import { evolutionPoints, smoothPath, yAxisScaleKg } from '@/components/partide/session/EvolutionChart';
import { venueWebHref } from '@/components/partide/session/VenueCard';

// partide.spectator: the page's wall-clock words (Europe/Bucharest whatever the runtime's zone).
describe('partidă format', () => {
  it('reads clocks and dates in Bucharest', () => {
    expect(clockRo('2026-10-07T11:30:00.000Z')).toBe('14:30');
    expect(clockRo('2026-01-07T22:05:00.000Z')).toBe('00:05');
    expect(dayMonthRo('2026-07-30T22:30:00.000Z')).toBe('31 IUL');
    expect(dayMonthRo('2026-11-02T10:00:00.000Z')).toBe('2 NOV');
  });

  it('captions a catch, legs left out when missing (fish catchCaption)', () => {
    expect(catchCaption({ species: 'Crap', weightKg: 3.4, occurredAt: '2026-10-07T11:30:00.000Z' })).toBe('Crap · 3,4 kg · 14:30');
    expect(catchCaption({ species: null, weightKg: null, occurredAt: '2026-10-07T11:30:00.000Z' })).toBe('14:30');
  });

  it('ended: durationMs or end − start; live: none', () => {
    const start = '2026-10-07T08:00:00.000Z';
    expect(durationLabel({ startedAt: start, endedAt: '2026-10-07T14:00:00.000Z', durationMs: null })).toBe('6h');
    expect(durationLabel({ startedAt: start, endedAt: '2026-10-07T14:00:00.000Z', durationMs: 45 * 60_000 })).toBe('45m');
    expect(durationLabel({ startedAt: start, endedAt: null, durationMs: null })).toBeNull();
    expect(pastCardMeta({ startedAt: start, endedAt: null, durationMs: null })).toBe('7 OCT · în desfășurare');
    expect(pastCardMeta({ startedAt: start, endedAt: '2026-10-07T14:00:00.000Z', durationMs: null })).toBe('7 OCT · 6\u00a0h');
    // Units spaced (rule 10), the tile's words.
    expect(spacedDuration('72h')).toBe('72\u00a0h');
    expect(spacedDuration('de 2h')).toBe('de 2\u00a0h');
    expect(spacedDuration('45m')).toBe('45\u00a0min');
    expect(spacedDuration('de 45m')).toBe('de 45\u00a0min');
  });

  it('splits a duration into number + unit word (rule 10)', () => {
    expect(splitDuration('6h')).toEqual({ value: '6', unit: 'h' });
    expect(splitDuration('de 2h')).toEqual({ value: '2', unit: 'h' });
    expect(splitDuration('45m')).toEqual({ value: '45', unit: 'min' });
  });

  it('links the venue on the web routes (fish venueHref)', () => {
    expect(venueWebHref({ lakeId: 'abc', venueType: 'lake', publicWaterCode: null })).toBe('/balti/abc');
    expect(venueWebHref({ lakeId: null, venueType: 'publicWater', publicWaterCode: 'AG-07' })).toBe('/ape-publice/AG-07');
    expect(venueWebHref({ lakeId: null, venueType: 'pin', publicWaterCode: null })).toBeNull();
  });
});

describe('evolution chart', () => {
  it('hides under two weighed catches; one point per weighed catch in time order', () => {
    expect(evolutionPoints([{ weightKg: 2, species: 'Crap', occurredAt: '2026-10-07T10:00:00Z' }])).toBeNull();
    const p = evolutionPoints([
      { weightKg: 3.4, species: 'Crap', occurredAt: '2026-10-07T11:30:00Z' },
      { weightKg: 1.24, species: null, occurredAt: '2026-10-07T10:30:00Z' },
      { weightKg: 0, species: 'Caras', occurredAt: '2026-10-07T10:40:00Z' },
    ])!;
    expect(p.map(x => x.detail)).toEqual(['Captură · 1,24 kg · 13:30', 'Crap · 3,4 kg · 14:30']);
  });

  it('kg scale: integer steps with headroom (fish yAxisScaleKg)', () => {
    expect(yAxisScaleKg(8.69)).toEqual({ maxValue: 9, noOfSections: 3, stepValue: 3 });
    expect(yAxisScaleKg(9)).toEqual({ maxValue: 12, noOfSections: 3, stepValue: 4 });
  });

  it('the curve passes through every point and never overshoots them', () => {
    const d = smoothPath([[0, 10], [10, 100], [20, 0], [30, 50]]);
    expect(d.startsWith('M0.0,10.0')).toBe(true);
    for (const pt of ['10.0,100.0', '20.0,0.0', '30.0,50.0']) expect(d).toContain(pt);
    const ys = [...d.matchAll(/-?\d+\.\d,(-?\d+\.\d)/g)].map(m => Number(m[1]));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(100);
  });
});
