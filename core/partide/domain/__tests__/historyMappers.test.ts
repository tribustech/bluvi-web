import { describe, it, expect } from 'vitest';
import { dtoToLocalEvent, dtoToLocalSession, listItemToSummaryLocalSession } from '../historyMappers';
import type { EventDTO, SessionDTO, SessionListItemDTO } from '../../schemas';

type AssertFalse<T extends false> = T;
type _ListOmitsRods = AssertFalse<'rods' extends keyof SessionListItemDTO ? true : false>;
type _ListOmitsMembers = AssertFalse<'members' extends keyof SessionListItemDTO ? true : false>;
type _ListOmitsJoinCode = AssertFalse<'joinCode' extends keyof SessionListItemDTO ? true : false>;
const listContract: [_ListOmitsRods, _ListOmitsMembers, _ListOmitsJoinCode] = [false, false, false];

const dto: SessionDTO = {
  documentId: 'sess-doc-1', clientId: 'c1', clientUpdatedAt: '2026-07-05T10:00:00.000Z',
  status: 'active', joinCode: 'JOIN42',
  venueType: 'lake', lakeId: 'lake-doc-9', lakeName: 'Roveng', lakeImageUrl: null,
  publicWaterCode: null, publicWaterName: null, manualVenueName: null,
  standId: null, standName: null, locality: null, anchorLat: 44.4, anchorLong: 26.0, anchorName: null,
  startedAt: '2026-07-05T04:00:00.000Z', endedAt: null, plannedDurationMs: 86400000,
  notes: null, visibleOnProfile: true, rods: [],
  targetSpecies: [{ documentId: 'fish-doc-1', name: 'Crap' }, { documentId: null, name: 'Altele' }],
  members: [
    { uid: 'user-host', name: 'Host', avatar: null, joinedAt: 'first' },
    { uid: 'user-guest', name: 'Guest', avatar: null, joinedAt: 'second' },
  ],
  hostUid: 'user-host',
};

describe('dtoToLocalSession', () => {
  it('preserves the authoritative hostUid instead of inferring it from roster order', () => {
    const s = dtoToLocalSession({
      ...dto,
      hostUid: 'user-host',
      members: [
        { uid: 'user-guest', name: 'Guest', avatar: null, joinedAt: 'earlier' },
        { uid: 'user-host', name: 'Host', avatar: null, joinedAt: 'later' },
      ],
    });
    expect(s.hostUid).toBe('user-host');
  });

  it('preserves active detail status, join code, and the complete server roster', () => {
    const s = dtoToLocalSession(dto);
    expect(s.status).toBe('active');
    expect(s.joinCode).toBe('JOIN42');
    expect(s.members).toEqual(dto.members);
  });

  it('preserves archived detail status, read-only code, and roster', () => {
    const archived = dtoToLocalSession({
      ...dto,
      status: 'finished',
      endedAt: '2026-07-05T18:00:00.000Z',
    });
    expect(archived.status).toBe('finished');
    expect(archived.joinCode).toBe('JOIN42');
    expect(archived.members).toEqual(dto.members);
  });

  it.each([undefined, null])('normalizes a %s hostUid to null', hostUid => {
    expect(dtoToLocalSession({ ...dto, hostUid }).hostUid).toBeNull();
  });

  it('converts ISO→epoch, wires serverId, resets runtimes, marks synced', () => {
    const s = dtoToLocalSession(dto);
    expect(s.clientId).toBe('c1');
    expect(s.serverId).toBe('sess-doc-1');
    expect(s.syncStatus).toBe('synced');
    expect(s.startedAt).toBe(Date.parse('2026-07-05T04:00:00.000Z'));
    expect(s.clientUpdatedAt).toBe(Date.parse('2026-07-05T10:00:00.000Z'));
    expect(s.anchorLng).toBe(26.0);
    expect(s.rodRuntimes).toEqual([]);
  });

  it('maps rod castLat/castLng and defaults them to null on legacy DTOs', () => {
    const rod = {
      index: 1, label: 'L1', color: '#F43F5E', bait: '', baitType: null, baitSize: null, baitFlavor: null,
      lane: 'center' as const, distance: 65, durationMs: 5400000, alarmSound: 'tone-1',
      castLat: 44.4312, castLng: 26.0125,
    };
    const s = dtoToLocalSession({ ...dto, rods: [rod] });
    expect(s.rods[0].castLat).toBe(44.4312);
    expect(s.rods[0].castLng).toBe(26.0125);

    const legacy = dtoToLocalSession({ ...dto, rods: [{ ...rod, castLat: undefined, castLng: undefined } as never] });
    expect(legacy.rods[0].castLat).toBeNull();
    expect(legacy.rods[0].castLng).toBeNull();
  });

  it('maps targetSpecies documentId → local id', () => {
    const s = dtoToLocalSession(dto);
    expect(s.targetSpecies).toEqual([
      { id: 'fish-doc-1', name: 'Crap' },
      { id: null, name: 'Altele' },
    ]);
  });

  it('defaults targetSpecies to [] when the DTO omits it', () => {
    const s = dtoToLocalSession({ ...dto, targetSpecies: undefined as unknown as SessionDTO['targetSpecies'] });
    expect(s.targetSpecies).toEqual([]);
  });

  it('marks a full-detail DTO as detailsHydrated (its rods/events are present)', () => {
    expect(dtoToLocalSession(dto).detailsHydrated).toBe(true);
  });

  it('defaults visibleOnProfile to true when the DTO omits/nulls it', () => {
    const s = dtoToLocalSession({ ...dto, visibleOnProfile: null as unknown as boolean });
    expect(s.visibleOnProfile).toBe(true);
  });

  it('carries an explicit visibleOnProfile: false through', () => {
    const s = dtoToLocalSession({ ...dto, visibleOnProfile: false });
    expect(s.visibleOnProfile).toBe(false);
  });
});

const listItemDto: SessionListItemDTO = {
  documentId: 'sess-doc-1', clientId: 'c1', clientUpdatedAt: '2026-07-05T10:00:00.000Z',
  status: 'finished',
  venueType: 'lake', lakeId: 'lake-doc-9', lakeName: 'Roveng', lakeImageUrl: null,
  publicWaterCode: null, publicWaterName: null, manualVenueName: null,
  standId: null, standName: null, locality: 'Cluj', anchorLat: 44.4, anchorLong: 26.0, anchorName: null,
  startedAt: '2026-07-05T04:00:00.000Z', endedAt: '2026-07-05T18:00:00.000Z', plannedDurationMs: 86400000,
  notes: 'trip', visibleOnProfile: true,
  targetSpecies: [{ documentId: 'fish-doc-1', name: 'Crap' }, { documentId: null, name: 'Altele' }],
  captures: 4, recordKg: 6.8, totalKg: 18.4,
};

describe('listItemToSummaryLocalSession', () => {
  it('keeps the lean list contract free of rods, members, and joinCode', () => {
    expect(listContract).toEqual([false, false, false]);
  });

  it('preserves an explicit hostUid and normalizes a missing one to null', () => {
    expect(listItemToSummaryLocalSession({ ...listItemDto, hostUid: 'user-host' }).hostUid).toBe('user-host');
    expect(listItemToSummaryLocalSession({ ...listItemDto, hostUid: undefined }).hostUid).toBeNull();
  });

  it('builds a summary-only row: detailsHydrated:false, empty rods, serverId=documentId', () => {
    const s = listItemToSummaryLocalSession(listItemDto);
    expect(s.detailsHydrated).toBe(false);
    expect(s.rods).toEqual([]);
    expect(s.rodRuntimes).toEqual([]);
    expect(s.serverId).toBe('sess-doc-1');
    expect(s.syncStatus).toBe('synced');
    expect(s.clientId).toBe('c1');
    expect(s.status).toBe('finished');
  });

  it('carries the list-DTO aggregates onto the summary fields', () => {
    const s = listItemToSummaryLocalSession(listItemDto);
    expect(s.summaryCaptures).toBe(4);
    expect(s.summaryRecordKg).toBe(6.8);
  });

  it('keeps summaryRecordKg null when the list DTO has no record weight', () => {
    const s = listItemToSummaryLocalSession({ ...listItemDto, recordKg: null });
    expect(s.summaryRecordKg).toBeNull();
    expect(s.summaryCaptures).toBe(4);
  });

  it('mirrors dtoToLocalSession on identity / venue / date fields (only rods & hydration differ)', () => {
    const full = dtoToLocalSession(dto);
    const summary = listItemToSummaryLocalSession(listItemDto);
    for (const key of [
      'clientId', 'serverId', 'syncStatus', 'clientUpdatedAt', 'venueType', 'lakeId', 'lakeName',
      'publicWaterCode', 'publicWaterName', 'manualVenueName', 'standId', 'standName',
      'anchorLat', 'anchorLng', 'anchorName', 'startedAt', 'plannedDurationMs',
    ] as const) {
      expect(summary[key]).toEqual(full[key]);
    }
    expect(summary.targetSpecies).toEqual(full.targetSpecies);
  });
});

const eventDto: EventDTO = {
  id: 42, documentId: 'ev-doc-1', clientId: 'e1', clientUpdatedAt: '2026-07-05T11:00:00.000Z',
  outcome: 'capture', rodIndex: 2, rodLabel: 'L2', rodColor: '#F43F5E',
  bait: 'Boilies', baitType: 'boilies', baitSize: 20, baitFlavor: null,
  lane: 'center', distance: 65, lat: 44.43, lng: 26.01,
  weightKg: 6.4, weightEstimated: false, species: 'carp', speciesId: 'fish-doc-1',
  photoUrl: 'https://cdn/x.jpg', photoThumbUrl: 'https://cdn/x-thumb.jpg', notes: null,
  occurredAt: '2026-07-05T10:30:00.000Z',
  photoTagUids: [],
};

describe('dtoToLocalEvent', () => {
  it('converts ISO→epoch, wires serverId + serverNumericId, marks synced', () => {
    const e = dtoToLocalEvent(eventDto, 'c1');
    expect(e.clientId).toBe('e1');
    expect(e.serverId).toBe('ev-doc-1');
    expect(e.serverNumericId).toBe(42);
    expect(e.syncStatus).toBe('synced');
    expect(e.sessionClientId).toBe('c1');
    expect(e.occurredAt).toBe(Date.parse('2026-07-05T10:30:00.000Z'));
    expect(e.clientUpdatedAt).toBe(Date.parse('2026-07-05T11:00:00.000Z'));
    expect(e.photoUploadStatus).toBe('done'); // remote photo exists
    expect(e.photoLocalUri).toBeNull();
  });

  it('maps a legacy species enum literal to its Romanian name and carries speciesId through', () => {
    const e = dtoToLocalEvent(eventDto, 'c1');
    expect(e.species).toBe('Crap');
    expect(e.speciesId).toBe('fish-doc-1');
  });

  it('passes a non-legacy species value (a CMS Fish name) through unchanged', () => {
    const e = dtoToLocalEvent({ ...eventDto, species: 'Salău' }, 'c1');
    expect(e.species).toBe('Salău');
  });

  it('defaults species null → null and speciesId omitted → null', () => {
    const e = dtoToLocalEvent({ ...eventDto, species: null, speciesId: undefined as unknown as string }, 'c1');
    expect(e.species).toBeNull();
    expect(e.speciesId).toBeNull();
  });

  it('marks photoUploadStatus none when the DTO has no photo', () => {
    const e = dtoToLocalEvent({ ...eventDto, photoUrl: null, photoThumbUrl: null }, 'c1');
    expect(e.photoUploadStatus).toBe('none');
    expect(e.photoUrl).toBeNull();
  });

  // Mirrors the live (Firestore projection) path's collapse rules exactly —
  // see firestore/mappers.test.ts's "round-trips photoTagUids" block — so a
  // REST-hydrated (archived) capture prefills the tag picker identically to
  // the same capture read live. See final-review.md's EventDTO item.
  it('round-trips a genuine partial tag selection', () => {
    const e = dtoToLocalEvent({ ...eventDto, photoTagUids: ['u-mario'] }, 'c1', ['u-mario', 'u-luigi']);
    expect(e.photoTagUids).toEqual(['u-mario']);
  });

  it('collapses an empty array to null — "everyone" (no roster needed)', () => {
    const e = dtoToLocalEvent({ ...eventDto, photoTagUids: [] }, 'c1', ['u-mario', 'u-luigi']);
    expect(e.photoTagUids).toBeNull();
  });

  it('collapses a full-roster tag array to null — "Toți", not every member individually', () => {
    const e = dtoToLocalEvent({ ...eventDto, photoTagUids: ['u-luigi', 'u-mario'] }, 'c1', ['u-mario', 'u-luigi']);
    expect(e.photoTagUids).toBeNull();
  });

  it('defaults the roster to [] when the caller omits it, so any non-empty tags pass through', () => {
    const e = dtoToLocalEvent({ ...eventDto, photoTagUids: ['u-mario'] }, 'c1');
    expect(e.photoTagUids).toEqual(['u-mario']);
  });
});
