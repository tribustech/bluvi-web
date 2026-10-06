/*
 * «Cronologia standurilor» — fish components/competition/StandProgressionChart.helpers.ts (ported
 * verbatim) plus the pure parts of StandProgressionChart.tsx: sector chips, the time range and the
 * slider's start, the y range, the ranking at a time, the readout subtitle and the auto-play step.
 * The chart itself (rows, scrubber, readout) is UI.
 */
import type { TimelineEvent, TimelineMetricKey, TimelineSnapshot } from '../schemas';
import { getCompetitorDisplayName } from './table/getCompetitorDisplayName';

export type TimelineStand = TimelineSnapshot['stands'][number];

/** fish `eventAtOrBefore`: the stand's last event at or before `timeMs` (events are in time order). */
export function eventAtOrBefore(events: readonly TimelineEvent[], timeMs: number): TimelineEvent | null {
  let result: TimelineEvent | null = null;
  for (const event of events) {
    if (new Date(event.t).getTime() <= timeMs) {
      result = event;
    } else {
      break;
    }
  }
  return result;
}

/** fish `STAND_COLOR_PALETTE` (the web draws the same 12 slots from its own colour tokens). */
export const STAND_COLOR_PALETTE = [
  '#5C6BC0',
  '#26A69A',
  '#EF5350',
  '#FFA726',
  '#AB47BC',
  '#42A5F5',
  '#66BB6A',
  '#FF7043',
  '#7E57C2',
  '#26C6DA',
  '#9CCC65',
  '#EC407A',
] as const;

/** The palette slot a stand keeps for the whole competition (fish `colorForStandId`'s index). */
export function standPaletteIndex(standId: number): number {
  return Math.abs(standId) % STAND_COLOR_PALETTE.length;
}

/** fish `colorForStandId`. */
export function colorForStandId(standId: number): string {
  return STAND_COLOR_PALETTE[standPaletteIndex(standId)];
}

const METRIC_LABELS: Record<TimelineMetricKey, string> = {
  quantity: 'Cantitate',
  catchCount: 'Număr capturi',
  biggestFish: 'Cea mai mare captură',
  quality: 'Calitate',
  quality1: 'Calitate 1',
  quality2: 'Calitate 2',
  bestOfCount: 'Capturi în top',
  topNCatchesAvarage: 'Media celor mai bune',
};

/** fish `metricLabel`. */
export function metricLabel(metric: TimelineMetricKey): string {
  return METRIC_LABELS[metric];
}

/** fish `formatMetricValue`: counts as integers, everything else «x.xxx kg», «—» when none. */
export function formatMetricValue(metric: TimelineMetricKey, value: number | null | undefined): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  if (metric === 'catchCount' || metric === 'bestOfCount') return `${Math.round(value)}`;
  return `${value.toFixed(3)} kg`;
}

const NON_MONOTONIC: TimelineMetricKey[] = ['quality', 'quality1', 'bestOfCount', 'topNCatchesAvarage'];

/** fish `isMetricNonMonotonic`. */
export function isMetricNonMonotonic(metric: TimelineMetricKey): boolean {
  return NON_MONOTONIC.includes(metric);
}

const DAYS_RO_SHORT = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'];

/** fish `computeIsMultiDay` (local calendar days). */
export function computeIsMultiDay(start: string, end: string): boolean {
  return new Date(start).toDateString() !== new Date(end).toDateString();
}

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/** fish `formatAxisLabel`: «HH:mm», or «Zi HH:mm» on a multi-day competition. */
export function formatAxisLabel(ms: number, isMultiDay: boolean): string {
  const d = new Date(ms);
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if (!isMultiDay) return time;
  return `${DAYS_RO_SHORT[d.getDay()]} ${time}`;
}

/* ------------------------------------------------------------------ */
/* StandProgressionChart.tsx — pure parts                              */
/* ------------------------------------------------------------------ */

export const ALL_SECTORS_ID = '__all__';

/** The sector chips: «Toate», then «Sector X» sorted by label. */
export function timelineSectors(stands: readonly TimelineStand[]): { sectorId: string; label: string }[] {
  const map = new Map<string, string>();
  for (const s of stands) if (s.sectorId) map.set(s.sectorId, s.sectorName ?? '');
  const list = [...map.entries()]
    .map(([sectorId, sectorName]) => ({ sectorId, label: sectorName ? `Sector ${sectorName}` : 'Sector' }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return [{ sectorId: ALL_SECTORS_ID, label: 'Toate' }, ...list];
}

/** The stands a sector chip shows, by sector then stand name. */
export function timelineVisibleStands(stands: readonly TimelineStand[], sectorId: string): TimelineStand[] {
  const filtered = sectorId === ALL_SECTORS_ID ? stands : stands.filter(s => s.sectorId === sectorId);
  return [...filtered].sort((a, b) => {
    const sectorCmp = (a.sectorName ?? '').localeCompare(b.sectorName ?? '');
    if (sectorCmp !== 0) return sectorCmp;
    return (a.standName ?? `${a.standId}`).localeCompare(b.standName ?? `${b.standId}`);
  });
}

/**
 * The slider's range and where it starts: the configured start → the configured end, extended to
 * the last event when a late weighing ends after it; it starts at the end for a completed
 * competition, otherwise at the latest event (the start when there is none).
 */
export function timelineRange(data: Pick<TimelineSnapshot, 'competitionStart' | 'competitionEnd' | 'stands'>, competitionStatus?: string | null) {
  const startMs = new Date(data.competitionStart).getTime();
  const configuredEndMs = new Date(data.competitionEnd).getTime();
  let latestEventMs = startMs;
  for (const s of data.stands) {
    for (const e of s.events) {
      const t = new Date(e.t).getTime();
      if (t > latestEventMs) latestEventMs = t;
    }
  }
  const endMs = Math.max(configuredEndMs, latestEventMs);
  const initialMs = competitionStatus === 'completed' ? endMs : latestEventMs > startMs ? latestEventMs : startMs;
  return { startMs, endMs, latestEventMs, initialMs, isMultiDay: computeIsMultiDay(data.competitionStart, data.competitionEnd) };
}

/** A y range fixed for the whole competition (bar lengths stay comparable while scrubbing). */
export function metricRange(stands: readonly TimelineStand[], metric: TimelineMetricKey): { yMin: number; yMax: number } {
  let lo = Infinity;
  let hi = -Infinity;
  for (const stand of stands) {
    for (const e of stand.events) {
      const v = e[metric];
      if (typeof v !== 'number') continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { yMin: 0, yMax: 1 };
  if (lo === hi) {
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.1;
    return { yMin: Math.max(0, lo - pad), yMax: hi + pad };
  }
  return { yMin: Math.max(0, lo), yMax: hi };
}

/** A bar's length, 0–1, on the fixed range. */
export function barRatio(value: number | null, { yMin, yMax }: { yMin: number; yMax: number }): number {
  if (value === null || yMax === yMin) return 0;
  return Math.max(0, Math.min(1, (value - yMin) / (yMax - yMin)));
}

export type StandAtTime = { stand: TimelineStand; event: TimelineEvent | null; value: number | null };

/** Every visible stand's value at the slider time. */
export function standValuesAt(stands: readonly TimelineStand[], metric: TimelineMetricKey, timeMs: number): StandAtTime[] {
  return stands.map(stand => {
    const event = eventAtOrBefore(stand.events, timeMs);
    const raw = event ? event[metric] : undefined;
    return { stand, event, value: typeof raw === 'number' ? raw : null };
  });
}

/** standId → rank (0 = best): highest value first (larger is better for every metric), ties by stand name. */
export function rankStands(values: readonly StandAtTime[]): Map<number, number> {
  const sortable = values.map(v => ({ ...v, sortKey: v.value === null ? -Infinity : v.value }));
  sortable.sort((a, b) => {
    if (b.sortKey !== a.sortKey) return b.sortKey - a.sortKey;
    return (a.stand.standName ?? `${a.stand.standId}`).localeCompare(b.stand.standName ?? `${b.stand.standId}`);
  });
  return new Map(sortable.map((entry, index) => [entry.stand.standId, index]));
}

/** The row label: «A/12» under «Toate», «12» inside a sector. */
export function standRowLabel(stand: TimelineStand, allSectors: boolean): string {
  const name = stand.standName ?? `#${stand.standId}`;
  return allSectors && stand.sectorName ? `${stand.sectorName}/${name}` : name;
}

export const isNcRankingType = (rankingType: string) => rankingType === 'nationalChampionship' || rankingType === 'fipsed';

export type TimelineStandInfo = { participants: string[]; teamName: string | null; guestName: string | null; clubName: string | null };

/** fish `standInfoMap`: who is on each stand (registered registrations, by the stand's numeric id). */
export function timelineStandInfo(
  registrations: readonly {
    registrationStatus?: string | null;
    stand?: { id?: number } | null;
    participants?: { username?: string | null }[] | null;
    teamName?: string | null;
    guestName?: string | null;
    club?: { name?: string | null } | null;
  }[]
): Map<number, TimelineStandInfo> {
  const map = new Map<number, TimelineStandInfo>();
  for (const reg of registrations) {
    if (reg.registrationStatus !== 'registered') continue;
    const id = reg.stand?.id;
    if (typeof id !== 'number') continue;
    map.set(id, {
      participants: (reg.participants ?? []).map(p => p.username?.trim()).filter((u): u is string => !!u),
      teamName: reg.teamName ?? null,
      guestName: reg.guestName ?? null,
      clubName: reg.club?.name ?? null,
    });
  }
  return map;
}

/**
 * fish `buildStandSubtitle`: NC / FIPSed → the participants (the team name is generic «Echipa 1»),
 * else team → participants → guest.
 */
export function standSubtitle(
  info: TimelineStandInfo | undefined,
  fallbackTeam: string | null,
  fallbackGuest: string | null,
  rankingType: string
): string | null {
  const participants = info?.participants ?? [];
  const teamName = info?.teamName?.trim() || fallbackTeam?.trim() || null;
  const guestName = info?.guestName?.trim() || fallbackGuest?.trim() || null;
  if (isNcRankingType(rankingType)) {
    if (participants.length > 0) return participants.join(', ');
    return teamName || guestName;
  }
  return getCompetitorDisplayName({ teamName, participantNames: participants, guestName, fallback: '' }) || null;
}

/** «Sector A, Standul 12» (fish readout identifier). */
export function standIdentifier(stand: TimelineStand): string {
  const name = stand.standName ?? `#${stand.standId}`;
  return stand.sectorName ? `Sector ${stand.sectorName}, Standul ${name}` : `Standul ${name}`;
}

/* ---- auto-play (fish StandProgressionChart play loop) ---- */

export const PLAY_DURATION_MS = 14_000;
export const PLAY_TICK_MS = 33;
const DEAD_ZONE_MS = 5 * 60 * 1000;
const DEAD_ZONE_TRANSIT_MS = 1_000;
const DEAD_ZONE_LAND_BUFFER_MS = 2_500;
const APPROACH_WINDOW_MS = 60 * 1000;

/** Sorted unique event times of the visible stands (play skips the dead time between them). */
export function eventTimestamps(stands: readonly TimelineStand[]): number[] {
  const set = new Set<number>();
  for (const s of stands) for (const e of s.events) set.add(new Date(e.t).getTime());
  return [...set].sort((a, b) => a - b);
}

/**
 * One play tick: the whole range in ~14 s at a constant pace, slowing continuously near weighing
 * events, and jumping gaps longer than 5 minutes (landing 2.5 s of competition time before the next
 * event). Returns the next slider time and whether play reached the end.
 */
export function nextPlayMs(
  prev: number,
  { startMs, endMs, events }: { startMs: number; endMs: number; events: readonly number[] }
): { ms: number; done: boolean } {
  const range = endMs - startMs;
  if (range <= 0) return { ms: endMs, done: true };
  const baseStep = (range * PLAY_TICK_MS) / PLAY_DURATION_MS;
  const transitTicks = Math.max(1, DEAD_ZONE_TRANSIT_MS / PLAY_TICK_MS);
  const slowTargetWallMs = Math.min(3_000, Math.max(500, events.length * 300));
  const slowStepByWall = (APPROACH_WINDOW_MS * PLAY_TICK_MS) / slowTargetWallMs;
  const minStep = Math.min(baseStep, slowStepByWall);

  const nextIdx = events.findIndex(t => t > prev);
  const nextEvent = nextIdx === -1 ? undefined : events[nextIdx];
  const prevEvent = nextIdx === -1 ? events[events.length - 1] : nextIdx === 0 ? undefined : events[nextIdx - 1];
  const distNext = nextEvent !== undefined ? nextEvent - prev : Infinity;
  const distPrev = prevEvent !== undefined ? prev - prevEvent : Infinity;

  let step: number;
  const inDeadZone = nextEvent !== undefined && distNext > DEAD_ZONE_MS && distNext > baseStep * 4 && distPrev > APPROACH_WINDOW_MS;
  if (inDeadZone) {
    const target = nextEvent - DEAD_ZONE_LAND_BUFFER_MS;
    step = target > prev ? Math.max(baseStep, (target - prev) / transitTicks) : baseStep;
  } else {
    const distNearest = Math.min(distNext, distPrev);
    const proximity = Math.max(0, Math.min(1, 1 - distNearest / APPROACH_WINDOW_MS));
    step = baseStep - proximity * (baseStep - minStep);
  }
  const next = prev + step;
  if (next >= endMs) return { ms: endMs, done: true };
  return { ms: Math.round(next), done: false };
}
