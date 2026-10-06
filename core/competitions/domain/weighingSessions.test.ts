import { describe, expect, it } from 'vitest';
import type { WeighingStatisticsItem } from '../schemas';
import { buildWeighingSessions, weighingSessionsTotals } from './weighingSessions';

/** A local wall-clock time on 2026-05-09 (a Saturday): the grouping reads the reader's clock. */
const at = (h: number, m = 0, day = 9) => new Date(2026, 4, day, h, m).toISOString();

let n = 0;
const w = (start: string, end: string | null, kg: number, extra = false, stand = 's'): WeighingStatisticsItem => ({
  weighingDocumentId: `w${++n}`,
  startDate: start,
  endDate: end,
  weighingType: extra ? 'extra' : 'normal',
  sequenceIndex: n,
  totalWeightKg: kg,
  catchCount: 2,
  sectorName: 'A',
  standName: stand,
});

describe('buildWeighingSessions (fish WeighingSessionTimeline buildSessions)', () => {
  it('is empty without weighings', () => {
    expect(buildWeighingSessions([])).toEqual([]);
  });

  it('splits normal weighings on a gap over 4 hours and names them by the time of day', () => {
    const sessions = buildWeighingSessions([
      w(at(8), at(8, 30), 10, false, '1'),
      w(at(9), at(9, 10), 5, false, '2'),
      // 4h00 after 09:10 is not a new session…
      w(at(13, 10), at(13, 20), 1, false, '1'),
      // …17:30 is (over 4 h after 13:20).
      w(at(17, 30), at(18), 4, false, '3'),
    ]);
    expect(sessions.map(s => s.label)).toEqual(['Cântar 1 – Dimineață', 'Cântar 2 – Seară']);
    expect(sessions.map(s => s.icon)).toEqual(['☀️', '🌙']);
    expect(sessions[0]).toMatchObject({ totalKg: 16, catchCount: 6, standCount: 2, weighingCount: 3, timeRange: 'Sâmbătă, 08:00 – 13:20' });
    expect(sessions[1].timeRange).toBe('Sâmbătă, 17:30 – 18:00');
  });

  it('groups extras before, between and after the normal sessions', () => {
    const sessions = buildWeighingSessions([
      w(at(6), at(6, 10), 1, true),
      w(at(8), at(9), 10),
      w(at(10), at(10, 5), 2, true),
      w(at(11), at(11, 5), 3, true),
      w(at(16), at(17), 5),
      w(at(20), null, 7, true),
    ]);
    expect(sessions.map(s => s.label)).toEqual(['Extra-cântar', 'Cântar 1 – Dimineață', 'Extra-cântar', 'Cântar 2 – Seară', 'Extra-cântar']);
    expect(sessions[2]).toMatchObject({ type: 'extra', icon: '⚡', totalKg: 5, weighingCount: 2 });
    // An open weighing ends at its start.
    expect(sessions[4].timeRange).toBe('Sâmbătă, 20:00 – 20:00');
  });

  it('extras alone are one session', () => {
    const sessions = buildWeighingSessions([w(at(8), at(9), 1, true), w(at(15), at(16), 2, true)]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ label: 'Extra-cântar', totalKg: 3 });
  });

  it('totals every session', () => {
    expect(weighingSessionsTotals(buildWeighingSessions([w(at(8), at(9), 1.25), w(at(18), at(19), 2, true)]))).toEqual({ kg: 3.25, catches: 4 });
  });
});
