/**
 * Pure CMS-DTO → local-model mappers for the HISTORY plane (finished sessions, React-Query
 * backed). fish `features/partide/domain/historyMappers.ts` (+ `firestore/mappers.ts#collapseFullRosterTags`,
 * which is pure and shared with the live plane).
 */
import type { EventDTO, SessionDTO, SessionListItemDTO } from '../schemas';
import type { LocalEvent, LocalSession } from './types';

/**
 * Pre-migration species enum → CMS Fish name. Legacy server DTOs stored one of these four
 * literals; anything else is already a name and passes through unchanged.
 */
export const LEGACY_SPECIES: Record<string, string> = {
  carp: 'Crap',
  grassCarp: 'Amur',
  catfish: 'Somn',
  other: 'Altele',
};

/**
 * Collapses a stored tag list to `null` ("Toți") when it is omitted/empty or names exactly the
 * whole current roster. fish `firestore/mappers.ts#collapseFullRosterTags`.
 */
export function collapseFullRosterTags(tagUids: string[] | null | undefined, roster: string[]): string[] | null {
  if (!tagUids || tagUids.length === 0) return null;
  if (roster.length > 0 && tagUids.length === roster.length) {
    const rosterSet = new Set(roster);
    if (tagUids.every(uid => rosterSet.has(uid))) return null;
  }
  return tagUids;
}

const epoch = (iso: string | null): number => (iso ? Date.parse(iso) : 0);

/** Full session detail (`/feed/sessions/:id`) → LocalSession (rods included, details hydrated). */
export function dtoToLocalSession(dto: SessionDTO): LocalSession {
  return {
    clientId: dto.clientId,
    serverId: dto.documentId,
    syncStatus: 'synced',
    clientUpdatedAt: epoch(dto.clientUpdatedAt),
    venueType: dto.venueType,
    lakeId: dto.lakeId,
    lakeName: dto.lakeName,
    lakeImageUrl: dto.lakeImageUrl,
    publicWaterCode: dto.publicWaterCode,
    publicWaterName: dto.publicWaterName,
    manualVenueName: dto.manualVenueName,
    standId: dto.standId,
    standName: dto.standName,
    locality: dto.locality ?? null,
    anchorLat: dto.anchorLat ?? 0,
    anchorLng: dto.anchorLong ?? 0,
    anchorName: dto.anchorName,
    startedAt: epoch(dto.startedAt),
    endedAt: dto.endedAt ? epoch(dto.endedAt) : null,
    // Sweeper watermarks are a live-session-only concept; archived sessions are past auto-close.
    warnedAt: null,
    autoCloseAt: null,
    plannedDurationMs: dto.plannedDurationMs ?? 0,
    notes: dto.notes,
    visibleOnProfile: dto.visibleOnProfile ?? true,
    targetSpecies: (dto.targetSpecies ?? []).map(t => ({ id: t.documentId, name: t.name })),
    rods: dto.rods.map(r => ({
      index: r.index,
      label: r.label ?? '',
      color: r.color ?? '',
      bait: r.bait ?? '',
      baitType: r.baitType,
      baitSize: r.baitSize,
      baitFlavor: r.baitFlavor,
      lane: r.lane ?? 'center',
      distance: r.distance ?? 0,
      castLat: r.castLat ?? null,
      castLng: r.castLng ?? null,
      durationMs: r.durationMs ?? null,
      alarmSound: (r.alarmSound ?? null) as LocalSession['rods'][number]['alarmSound'],
    })),
    rodRuntimes: [],
    detailsHydrated: true,
    hostUid: dto.hostUid ?? null,
    joinCode: dto.joinCode,
    status: dto.status,
    members: dto.members.map(member => ({
      uid: member.uid,
      name: member.name ?? null,
      avatar: member.avatar ?? null,
      joinedAt: member.joinedAt,
    })),
    projectionRev: 0,
  };
}

/**
 * Lean list item (`/feed/sessions/mine`) → summary-only LocalSession: no rods/events,
 * `detailsHydrated:false`, and the list DTO's aggregates carried on
 * `summaryCaptures/summaryRecordKg/summaryTotalKg` so the history card can show counts before
 * its full detail is pulled on open.
 */
export function listItemToSummaryLocalSession(dto: SessionListItemDTO): LocalSession {
  return {
    clientId: dto.clientId,
    serverId: dto.documentId,
    syncStatus: 'synced',
    clientUpdatedAt: epoch(dto.clientUpdatedAt),
    venueType: dto.venueType,
    lakeId: dto.lakeId,
    lakeName: dto.lakeName,
    lakeImageUrl: dto.lakeImageUrl,
    publicWaterCode: dto.publicWaterCode,
    publicWaterName: dto.publicWaterName,
    manualVenueName: dto.manualVenueName,
    standId: dto.standId,
    standName: dto.standName,
    locality: dto.locality ?? null,
    anchorLat: dto.anchorLat ?? 0,
    anchorLng: dto.anchorLong ?? 0,
    anchorName: dto.anchorName,
    startedAt: epoch(dto.startedAt),
    endedAt: dto.endedAt ? epoch(dto.endedAt) : null,
    warnedAt: null,
    autoCloseAt: null,
    plannedDurationMs: dto.plannedDurationMs ?? 0,
    notes: dto.notes,
    visibleOnProfile: dto.visibleOnProfile ?? true,
    targetSpecies: (dto.targetSpecies ?? []).map(t => ({ id: t.documentId, name: t.name })),
    rods: [],
    rodRuntimes: [],
    detailsHydrated: false,
    summaryCaptures: dto.captures,
    summaryRecordKg: dto.recordKg,
    summaryTotalKg: dto.totalKg,
    hostUid: dto.hostUid ?? null,
    status: dto.status,
    projectionRev: 0,
  };
}

/**
 * Server event DTO → LocalEvent (already synced).
 *
 * `roster` is the session's current member uids (`SessionDTO.members`, from the same
 * `/feed/sessions/:id` response) — pass it whenever available so `photoTagUids` collapses exactly
 * like the live projection path does. Omitting it still collapses the omitted/null/`[]` shapes to
 * "Toți", but an explicit full-roster array would then pass through as a specific selection.
 */
export function dtoToLocalEvent(dto: EventDTO, sessionClientId: string, roster: string[] = []): LocalEvent {
  return {
    clientId: dto.clientId,
    serverId: dto.documentId,
    serverNumericId: dto.id,
    syncStatus: 'synced',
    clientUpdatedAt: epoch(dto.clientUpdatedAt),
    sessionClientId,
    outcome: dto.outcome,
    rodIndex: dto.rodIndex,
    rodLabel: dto.rodLabel,
    rodColor: dto.rodColor,
    bait: dto.bait ?? '',
    baitType: dto.baitType,
    baitSize: dto.baitSize,
    baitFlavor: dto.baitFlavor,
    lane: dto.lane,
    distance: dto.distance ?? 0,
    lat: dto.lat,
    lng: dto.lng,
    weightKg: dto.weightKg,
    // Defensive: older cached payloads (pre-field) may omit it entirely — coerce absence to false.
    weightEstimated: dto.weightEstimated === true,
    species: dto.species == null ? null : (LEGACY_SPECIES[dto.species] ?? dto.species),
    speciesId: dto.speciesId ?? null,
    photoLocalUri: null,
    photoUploadStatus: dto.photoUrl ? 'done' : 'none',
    photoUrl: dto.photoUrl,
    photoThumbUrl: dto.photoThumbUrl ?? null,
    photoTagUids: collapseFullRosterTags(dto.photoTagUids, roster),
    notes: dto.notes,
    occurredAt: epoch(dto.occurredAt),
  };
}
