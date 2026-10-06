import { describe, expect, it } from 'vitest';
import type { TimelineSnapshot } from '../schemas';
import {
  ALL_SECTORS_ID,
  barRatio,
  colorForStandId,
  computeIsMultiDay,
  eventAtOrBefore,
  eventTimestamps,
  formatAxisLabel,
  formatMetricValue,
  metricLabel,
  metricRange,
  nextPlayMs,
  rankStands,
  standIdentifier,
  standPaletteIndex,
  standRowLabel,
  standSubtitle,
  standValuesAt,
  timelineRange,
  timelineSectors,
  timelineStandInfo,
  timelineVisibleStands,
  type TimelineStand,
} from './standTimeline';

const ev = (t: string, quantity: number, catchCount = 1) => ({ weighingId: 1, t, quantity, catchCount, biggestFish: quantity });
const stand = (standId: number, sectorId: string, sectorName: string, standName: string, events: ReturnType<typeof ev>[]): TimelineStand => ({
  standId,
  standName,
  sectorId,
  sectorName,
  teamName: null,
  guestName: null,
  events,
});

const T0 = '2026-09-10T06:00:00.000Z';
const stands = [
  stand(3, 'sb', 'B', '2', [ev('2026-09-10T08:00:00.000Z', 5), ev('2026-09-10T10:00:00.000Z', 9)]),
  stand(1, 'sa', 'A', '1', [ev('2026-09-10T07:00:00.000Z', 4)]),
  stand(2, 'sa', 'A', '10', []),
];
const snapshot: Pick<TimelineSnapshot, 'competitionStart' | 'competitionEnd' | 'stands'> = {
  competitionStart: T0,
  competitionEnd: '2026-09-10T09:00:00.000Z',
  stands,
};

describe('StandProgressionChart.helpers (verbatim)', () => {
  it('eventAtOrBefore', () => {
    expect(eventAtOrBefore(stands[0].events, Date.parse('2026-09-10T07:59:00Z'))).toBeNull();
    expect(eventAtOrBefore(stands[0].events, Date.parse('2026-09-10T09:00:00Z'))?.quantity).toBe(5);
    expect(eventAtOrBefore(stands[0].events, Date.parse('2026-09-10T10:00:00Z'))?.quantity).toBe(9);
  });

  it('a 12-colour palette by standId', () => {
    expect(standPaletteIndex(13)).toBe(1);
    expect(standPaletteIndex(-2)).toBe(2);
    expect(colorForStandId(0)).toBe('#5C6BC0');
  });

  it('labels and values', () => {
    expect(metricLabel('topNCatchesAvarage')).toBe('Media celor mai bune');
    expect(formatMetricValue('catchCount', 3.4)).toBe('3');
    expect(formatMetricValue('quantity', 3.4)).toBe('3.400 kg');
    expect(formatMetricValue('quantity', undefined)).toBe('—');
  });

  it('axis labels add the day on multi-day competitions', () => {
    const ms = new Date(2026, 8, 12, 7, 5).getTime(); // a Saturday, local
    expect(formatAxisLabel(ms, false)).toBe('07:05');
    expect(formatAxisLabel(ms, true)).toBe('Sâm 07:05');
    expect(computeIsMultiDay(new Date(2026, 8, 12, 6).toISOString(), new Date(2026, 8, 12, 22).toISOString())).toBe(false);
    expect(computeIsMultiDay(new Date(2026, 8, 12, 6).toISOString(), new Date(2026, 8, 13, 6).toISOString())).toBe(true);
  });
});

describe('the chart model', () => {
  it('sector chips: Toate then «Sector X» sorted', () => {
    expect(timelineSectors(stands)).toEqual([
      { sectorId: ALL_SECTORS_ID, label: 'Toate' },
      { sectorId: 'sa', label: 'Sector A' },
      { sectorId: 'sb', label: 'Sector B' },
    ]);
    expect(timelineVisibleStands(stands, 'sa').map(s => s.standName)).toEqual(['1', '10']);
    expect(timelineVisibleStands(stands, ALL_SECTORS_ID).map(s => s.standId)).toEqual([1, 2, 3]);
  });

  it('the range extends to a late event; the slider starts at the end when completed, else at the latest event', () => {
    const r = timelineRange(snapshot, 'started');
    expect(r.startMs).toBe(Date.parse(T0));
    expect(r.endMs).toBe(Date.parse('2026-09-10T10:00:00Z'));
    expect(r.initialMs).toBe(Date.parse('2026-09-10T10:00:00Z'));
    const noEvents = timelineRange({ ...snapshot, stands: [] }, 'started');
    expect(noEvents.initialMs).toBe(Date.parse(T0));
    expect(timelineRange({ ...snapshot, stands: [] }, 'completed').initialMs).toBe(Date.parse('2026-09-10T09:00:00Z'));
  });

  it('ranks by the value at the slider (best first, ties and empty stands by name) on a fixed y range', () => {
    const at9 = standValuesAt(stands, 'quantity', Date.parse('2026-09-10T09:00:00Z'));
    expect(at9.map(v => v.value)).toEqual([5, 4, null]);
    const ranks = rankStands(at9);
    expect([ranks.get(3), ranks.get(1), ranks.get(2)]).toEqual([0, 1, 2]);
    const range = metricRange(stands, 'quantity');
    expect(range).toEqual({ yMin: 4, yMax: 9 });
    expect(barRatio(9, range)).toBe(1);
    expect(barRatio(null, range)).toBe(0);
    expect(metricRange([stands[1]], 'quantity')).toEqual({ yMin: 3.6, yMax: 4.4 });
    expect(metricRange([], 'quantity')).toEqual({ yMin: 0, yMax: 1 });
  });

  it('row labels, identifier and the readout subtitle', () => {
    expect(standRowLabel(stands[0], true)).toBe('B/2');
    expect(standRowLabel(stands[0], false)).toBe('2');
    expect(standIdentifier(stands[0])).toBe('Sector B, Standul 2');
    const info = timelineStandInfo([
      { registrationStatus: 'registered', stand: { id: 3 }, participants: [{ username: 'ana' }, { username: ' bob ' }], teamName: 'Echipa 1', guestName: null, club: { name: 'CS Crap' } },
      { registrationStatus: 'pending', stand: { id: 1 }, participants: [], teamName: 'X', guestName: null },
    ]);
    expect(info.has(1)).toBe(false);
    expect(standSubtitle(info.get(3), null, null, 'quantity')).toBe('Echipa 1');
    expect(standSubtitle(info.get(3), null, null, 'nationalChampionship')).toBe('ana, bob');
    expect(standSubtitle(undefined, null, 'Ion', 'quantity')).toBe('Ion');
    expect(standSubtitle(undefined, null, null, 'quantity')).toBeNull();
  });

  it('play: constant pace far from events, a jump over a long gap, done at the end', () => {
    const startMs = 0;
    const endMs = 14_000_000;
    const events = eventTimestamps([stand(1, 's', 'A', '1', [ev(new Date(10_000_000).toISOString(), 1)])]);
    // Far from the only event, past the dead-zone threshold: jumps to 2.5 s before it, within ~1 s of ticks.
    const jumped = nextPlayMs(0, { startMs, endMs, events });
    expect(jumped.ms).toBeGreaterThan(33_000);
    expect(jumped.done).toBe(false);
    const nearEnd = nextPlayMs(endMs - 1, { startMs, endMs, events });
    expect(nearEnd).toEqual({ ms: endMs, done: true });
    // At the event itself the pace is the slowest one.
    const atEvent = nextPlayMs(10_000_000, { startMs, endMs, events });
    expect(atEvent.ms - 10_000_000).toBeLessThan(33_000);
  });
});
