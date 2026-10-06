import { describe, expect, it } from 'vitest';
import {
  cardRankingLabel,
  dateWithHours,
  enrolledLabel,
  entrantsCount,
  entrantsLine,
  formatCount,
  formatKg,
  formatTotalKg,
  photoEntrantsLabel,
  unitSingular,
} from './cardCopy';

/* fish features/competitions/components/cards/cardRankingLabel.ts, helpers/formatKg.ts, helpers/heroCopy.ts */

describe('cardRankingLabel', () => {
  it('a live feeder on legs says which leg it is in', () => {
    expect(cardRankingLabel({ status: 'started', rankingLabel: 'Feeder', rounds: { current: 1, count: 2, status: 'running' } })).toBe(
      'Feeder · Manșa 1/2'
    );
  });
  it('a single-leg feeder has no leg to name', () => {
    expect(cardRankingLabel({ status: 'started', rankingLabel: 'Feeder', rounds: { current: 1, count: 1, status: 'running' } })).toBe('Feeder');
  });
  it('anything else is the CMS label unchanged', () => {
    expect(cardRankingLabel({ status: 'completed', rankingLabel: 'Feeder', rounds: { current: 2, count: 2, status: 'closed' } })).toBe('Feeder');
    expect(cardRankingLabel({ status: 'started', rankingLabel: 'Cantitate', rounds: null })).toBe('Cantitate');
    expect(cardRankingLabel({ status: 'notStarted', rankingLabel: 'Cantitate' })).toBe('Cantitate');
  });
});

describe('formatKg / formatTotalKg (ro-RO without ICU)', () => {
  it('formatKg keeps up to three decimals with a comma and dot grouping', () => {
    expect(formatKg(4.27)).toBe('4,27');
    expect(formatKg(4800.270000000001)).toBe('4.800,27');
    expect(formatKg(12)).toBe('12');
    expect(formatKg(0.1234)).toBe('0,123');
  });
  it('formatTotalKg keeps one decimal', () => {
    expect(formatTotalKg(1024.291)).toBe('1.024,3');
    expect(formatTotalKg(150)).toBe('150');
    expect(formatTotalKg(1234567.04)).toBe('1.234.567');
  });
  it('negative values keep the sign, a rounded zero does not', () => {
    expect(formatKg(-1.5)).toBe('-1,5');
    expect(formatKg(-0.0001)).toBe('0');
  });
});

describe('counting copy', () => {
  it('formatCount is fish helpers/formatCount (de from 20)', () => {
    expect(formatCount(1, 'pescar', 'pescari')).toBe('1 pescar');
    expect(formatCount(3, 'pescar', 'pescari')).toBe('3 pescari');
    expect(formatCount(24, 'pescar', 'pescari')).toBe('24 de pescari');
    expect(formatCount(101, 'pescar', 'pescari')).toBe('101 pescari');
  });
  it('unit agreement', () => {
    expect(unitSingular('pescari')).toBe('pescar');
    expect(unitSingular('echipe')).toBe('echipă');
    expect(enrolledLabel('pescari')).toBe('PESCARI ÎNSCRIȘI');
    expect(enrolledLabel('echipe')).toBe('ECHIPE ÎNSCRISE');
    expect(entrantsLine(1, 'echipe')).toBe('1 echipă în concurs');
    expect(entrantsLine(24, 'pescari')).toBe('24 de pescari în concurs');
    expect(entrantsCount(3, 'echipe')).toBe('3 echipe');
  });
  it('photoEntrantsLabel: seats before the start, turnout after', () => {
    const base = { joinedCount: 6, format: { kind: 'single' as const, teamSize: null, unit: 'pescari' as const } };
    expect(photoEntrantsLabel({ ...base, status: 'notStarted', capacity: 10 })).toBe('6/10 pescari');
    expect(photoEntrantsLabel({ ...base, status: 'notStarted', capacity: null })).toBe('6 pescari');
    expect(photoEntrantsLabel({ ...base, status: 'started', capacity: 10 })).toBe('6 pescari');
  });
  it('dateWithHours', () => {
    expect(dateWithHours({ dateLabel: '20 oct', hoursLabel: '08:00–16:00' })).toBe('20 oct · 08:00–16:00');
    expect(dateWithHours({ dateLabel: '20–21 oct', hoursLabel: null })).toBe('20–21 oct');
  });
});
