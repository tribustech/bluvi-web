import { describe, it, expect } from 'vitest';
import { axisLabelIndices, buildEvolutionLineSeries } from '../evolution';

const at = (min: number) => new Date(Date.UTC(2026, 6, 22, 10, min)).toISOString();

describe('axisLabelIndices', () => {
  it('shows all indices at n <= 4', () => {
    expect(axisLabelIndices(2)).toEqual([0, 1]);
    expect(axisLabelIndices(4)).toEqual([0, 1, 2, 3]);
  });

  it('picks first + last + ~equidistant middles, max 4 labels', () => {
    expect(axisLabelIndices(5)).toEqual([0, 1, 3, 4]);
    expect(axisLabelIndices(12)).toEqual([0, 4, 7, 11]);
    expect(axisLabelIndices(60)).toEqual([0, 20, 39, 59]);
  });
});

describe('buildEvolutionLineSeries', () => {
  it('returns null under 2 weighed catches', () => {
    expect(buildEvolutionLineSeries([])).toBeNull();
    expect(buildEvolutionLineSeries([{ weightKg: 2, species: 'Crap', occurredAt: at(10) }])).toBeNull();
    expect(
      buildEvolutionLineSeries([
        { weightKg: null, species: null, occurredAt: at(10) },
        { weightKg: 2, species: 'Crap', occurredAt: at(20) },
      ])
    ).toBeNull();
  });

  it('one point per weighed catch, sorted chronologically, y = individual kg', () => {
    const r = buildEvolutionLineSeries([
      { weightKg: 1.2, species: 'Crap', occurredAt: at(70) },
      { weightKg: 3.4, species: null, occurredAt: at(10) },
      { weightKg: 2.1, species: 'Șalău', occurredAt: at(40) },
    ])!;
    expect(r.series.map(s => s.count)).toEqual([3.4, 2.1, 1.2]);
  });

  it('axis labels are HH:MM on picked indices, empty elsewhere', () => {
    const r = buildEvolutionLineSeries(
      [10, 20, 30, 40, 50].map(m => ({ weightKg: 1, species: null, occurredAt: at(m) }))
    )!;
    const labeled = r.series.map((s, i) => (s.label !== '' ? i : -1)).filter(i => i >= 0);
    expect(labeled).toEqual([0, 1, 3, 4]);
    expect(r.series[0].label).toMatch(/^\d{2}:\d{2}$/);
  });

  it('detail labels: "Specie · kg kg · HH:MM", null species → "Captură"', () => {
    const r = buildEvolutionLineSeries([
      { weightKg: 2.4, species: 'Crap', occurredAt: at(10) },
      { weightKg: 1, species: null, occurredAt: at(40) },
    ])!;
    expect(r.detailLabels[0]).toMatch(/^Crap · 2,4 kg · \d{2}:\d{2}$/);
    expect(r.detailLabels[1]).toMatch(/^Captură · 1,0 kg · \d{2}:\d{2}$/);
    expect(r.detailLabels).toHaveLength(2);
  });
});
