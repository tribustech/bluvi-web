import { describe, expect, it } from 'vitest';
import type { LocalMarker, LocalRod, LocalSession } from './types';
import {
  fromIso,
  toIso,
  firestoreRodToLocal,
  firestoreRodRuntimeToLocal,
  firestoreSessionToLocal,
  localMarkerToFirestore,
  localRodToFirestore,
  localSessionMetaToFirestore,
  localSessionMetaPatchToFirestore,
  type FirestoreCatchDoc,
  type FirestoreMarkerDoc,
  type FirestoreRodDoc,
  type FirestoreSessionMeta,
} from './mappers';

const rod = (over: Partial<LocalRod> = {}): LocalRod => ({
  index: 1,
  label: 'L1',
  color: '#F43F5E',
  bait: 'Boilies',
  baitType: 'boilies',
  baitSize: 20,
  baitFlavor: null,
  lane: 'center',
  distance: 65,
  castLat: 44.4312,
  castLng: 26.0125,
  durationMs: 5_400_000,
  alarmSound: 'tone-1',
  ...over,
});

const session = (over: Partial<LocalSession> = {}): LocalSession => ({
  clientId: 'sess-1',
  serverId: null,
  syncStatus: 'pending',
  clientUpdatedAt: 1751790000000,
  venueType: 'lake',
  lakeId: 'lake-doc-9',
  lakeName: 'Roveng',
  lakeImageUrl: 'https://x/img.jpg',
  publicWaterCode: null,
  publicWaterName: null,
  manualVenueName: null,
  standId: 'stand-3',
  standName: 'A3',
  locality: 'Snagov',
  anchorLat: 44.4,
  anchorLng: 26.0,
  anchorName: 'Cortul',
  startedAt: 1751780000000,
  endedAt: null,
  warnedAt: null,
  autoCloseAt: null,
  plannedDurationMs: 86_400_000,
  notes: 'gg',
  visibleOnProfile: true,
  targetSpecies: [
    { id: 'fish-doc-1', name: 'Crap' },
    { id: null, name: 'Altele' },
  ],
  rods: [rod()],
  rodRuntimes: [{ phase: 'fishing', endEpoch: 123 }],
  detailsHydrated: true,
  projectionRev: 0,
  // Co-op read-only fields populated so the writer-exclusion tests prove the
  // meta writers drop them (the mapper surfaces them, the writers must not).
  joinCode: 'AB12CD',
  status: 'active',
  members: [{ uid: 'user-1', name: 'Ana', avatar: null, joinedAt: 'x' }],
  memberUids: ['user-1'],
  ...over,
});

const marker = (over: Partial<LocalMarker> = {}): LocalMarker => ({
  clientId: 'mk-1',
  serverId: null,
  syncStatus: 'pending',
  clientUpdatedAt: 1751790002000,
  type: 'hardSpot',
  lat: 44.41,
  lng: 26.02,
  label: 'zona tare',
  scope: 'session',
  venue: { venueType: 'lake', lakeId: 'lake-doc-9' },
  sessionClientId: 'sess-1',
  ...over,
});

describe('time helpers', () => {
  it('toIso / fromIso round-trip ms↔ISO and preserve null', () => {
    const ms = 1751790000000;
    expect(toIso(ms)).toBe(new Date(ms).toISOString());
    expect(fromIso(toIso(ms))).toBe(ms);
    expect(toIso(null)).toBeNull();
    expect(fromIso(null)).toBeNull();
    expect(fromIso('not-a-date')).toBeNull();
  });
});

describe('localSessionMetaToFirestore', () => {
  it('emits ISO timestamps, renames anchorLng→anchorLong, maps targetSpecies + rods mirror', () => {
    const meta = localSessionMetaToFirestore(session());
    expect(meta.startedAt).toBe(new Date(1751780000000).toISOString());
    expect(meta.endedAt).toBeNull();
    expect(meta.clientUpdatedAt).toBe(new Date(1751790000000).toISOString());
    expect(meta.anchorLong).toBe(26.0);
    expect(meta).not.toHaveProperty('anchorLng');
    expect(meta.targetSpecies).toEqual([
      { documentId: 'fish-doc-1', name: 'Crap' },
      { documentId: null, name: 'Altele' },
    ]);
    expect((meta.rods as Record<string, unknown>[])[0]).toMatchObject({ clientId: 'rod-1', index: 1, durationMs: 5_400_000 });
  });

  it('NEVER emits the server-owned protected fields', () => {
    const json = JSON.stringify(localSessionMetaToFirestore(session()));
    for (const f of ['memberUids', 'joinCode', 'status', 'hostUid', 'firestoreId', 'members']) {
      expect(json).not.toContain(f);
    }
  });
});

describe('localSessionMetaPatchToFirestore', () => {
  it('maps ONLY the keys present in the partial', () => {
    const patch = localSessionMetaPatchToFirestore({ notes: 'new note' });
    expect(patch).toEqual({ notes: 'new note' });
  });

  it('converts endedAt ms→ISO, targetSpecies, rods, and anchorLng→anchorLong', () => {
    const patch = localSessionMetaPatchToFirestore({
      endedAt: 1751790000000,
      anchorLng: 27.5,
      targetSpecies: [{ id: 'f1', name: 'Crap' }],
      rods: [rod({ index: 2 })],
    });
    expect(patch.endedAt).toBe(new Date(1751790000000).toISOString());
    expect(patch.anchorLong).toBe(27.5);
    expect(patch).not.toHaveProperty('anchorLng');
    expect(patch.targetSpecies).toEqual([{ documentId: 'f1', name: 'Crap' }]);
    expect((patch.rods as Record<string, unknown>[])[0]).toMatchObject({ clientId: 'rod-2', index: 2 });
  });

  it('never emits protected fields even if fed as extra keys', () => {
    const patch = localSessionMetaPatchToFirestore({ notes: 'x', clientId: 'sess-1' } as Partial<LocalSession>);
    expect(patch).not.toHaveProperty('joinCode');
    expect(patch).not.toHaveProperty('status');
    expect(patch).not.toHaveProperty('clientId');
  });
});

describe('localRodToFirestore', () => {
  it('keys the doc by rod-<index> and passes rod fields through', () => {
    const doc = localRodToFirestore(rod({ index: 3 }), 3);
    expect(doc.clientId).toBe('rod-3');
    expect(doc).toMatchObject({ index: 3, label: 'L1', durationMs: 5_400_000, alarmSound: 'tone-1' });
    expect(doc).not.toHaveProperty('clientUpdatedAt'); // stamped by the repo at write time
  });
});

describe('timer-free rod round-trip', () => {
  const timerFreeRod = {
    index: 2,
    label: 'L2',
    color: '#3B82F6',
    bait: 'Porumb',
    baitType: null,
    baitSize: null,
    baitFlavor: null,
    lane: 'left' as const,
    distance: 30,
    castLat: null,
    castLng: null,
    durationMs: null,
    alarmSound: null,
  };

  it('preserves durationMs/alarmSound null through Firestore (no 0/tone-1 coercion)', () => {
    const wire = localRodToFirestore(timerFreeRod, 2);
    expect(wire.durationMs).toBeNull();
    expect(wire.alarmSound).toBeNull();
    const back = firestoreRodToLocal(wire as never);
    expect(back.durationMs).toBeNull();
    expect(back.alarmSound).toBeNull();
  });
});

describe('localMarkerToFirestore', () => {
  it('flattens venue → venueType/publicWaterCode and matches MARKER_FIELDS', () => {
    const doc = localMarkerToFirestore(marker());
    expect(doc).toMatchObject({
      clientId: 'mk-1',
      type: 'hardSpot',
      lat: 44.41,
      lng: 26.02,
      label: 'zona tare',
      scope: 'session',
      venueType: 'lake',
      publicWaterCode: null,
    });
    expect(doc.clientUpdatedAt).toBe(new Date(1751790002000).toISOString());
  });

  it('emits publicWaterCode for a publicWater venue', () => {
    const doc = localMarkerToFirestore(marker({ venue: { venueType: 'publicWater', publicWaterCode: 'RO-123' } }));
    expect(doc.venueType).toBe('publicWater');
    expect(doc.publicWaterCode).toBe('RO-123');
  });
});

describe('firestoreSessionToLocal', () => {
  // Rods are a SINGLE source: the `meta.rods` array (no rods subcollection).
  const rodDoc: FirestoreRodDoc = {
    clientId: 'rod-1',
    index: 1,
    label: 'L1',
    color: '#F43F5E',
    bait: 'Boilies',
    baitType: 'boilies',
    baitSize: 20,
    baitFlavor: null,
    lane: 'center',
    distance: 65,
    castLat: 44.4312,
    castLng: 26.0125,
    durationMs: 5_400_000,
    alarmSound: 'tone-1',
  };
  const metaDoc: FirestoreSessionMeta = {
    clientUpdatedAt: new Date(1751790000000).toISOString(),
    venueType: 'lake',
    lakeId: 'lake-doc-9',
    lakeName: 'Roveng',
    lakeImageUrl: 'https://x/img.jpg',
    publicWaterCode: null,
    publicWaterName: null,
    manualVenueName: null,
    standId: 'stand-3',
    standName: 'A3',
    locality: 'Snagov',
    anchorLat: 44.4,
    anchorLong: 26.0,
    anchorName: 'Cortul',
    startedAt: new Date(1751780000000).toISOString(),
    endedAt: null,
    plannedDurationMs: 86_400_000,
    notes: 'gg',
    visibleOnProfile: true,
    targetSpecies: [
      { documentId: 'fish-doc-1', name: 'Crap' },
      { documentId: null, name: 'Altele' },
    ],
    rods: [rodDoc],
    // server-owned fields present on the wire — surfaced READ-ONLY for the co-op
    // UI (hostUid/joinCode/status/members/memberUids); firestoreId is ignored:
    hostUid: 'user-1',
    joinCode: 'AB12CD',
    firestoreId: 'sess-1',
    status: 'active',
    members: [{ uid: 'user-1', name: 'Ana', avatar: null, joinedAt: 'x' }],
    memberUids: ['user-1'],
  };
  const catchDoc: FirestoreCatchDoc = {
    clientId: 'evt-1',
    clientUpdatedAt: new Date(1751790001000).toISOString(),
    outcome: 'capture',
    rodIndex: 1,
    rodLabel: 'L1',
    rodColor: '#F43F5E',
    bait: 'Boilies',
    baitType: 'boilies',
    baitSize: 20,
    baitFlavor: null,
    lane: 'center',
    distance: 65,
    lat: 44.43,
    lng: 26.01,
    weightKg: 6.4,
    species: 'Crap',
    speciesId: 'fish-doc-1',
    notes: null,
    occurredAt: new Date(1751790000500).toISOString(),
    photoUrl: 'https://x/p.jpg',
    photoThumbUrl: 'https://x/t.jpg',
    photoFileId: 42,
  };
  const markerDoc: FirestoreMarkerDoc = {
    clientId: 'mk-1',
    clientUpdatedAt: new Date(1751790002000).toISOString(),
    type: 'hardSpot',
    lat: 44.41,
    lng: 26.02,
    label: 'zona tare',
    scope: 'session',
    venueType: 'lake',
    publicWaterCode: null,
  };

  it('assembles a synced LocalSession with online constants and idle rodRuntimes', () => {
    const { session: s } = firestoreSessionToLocal('sess-1', metaDoc, [catchDoc], [markerDoc]);
    expect(s.clientId).toBe('sess-1');
    expect(s.serverId).toBeNull();
    expect(s.syncStatus).toBe('synced');
    expect(s.detailsHydrated).toBe(true);
    expect(s.startedAt).toBe(1751780000000);
    expect(s.anchorLng).toBe(26.0); // anchorLong→anchorLng
    expect(s.lakeName).toBe('Roveng');
    expect(s.targetSpecies).toEqual([
      { id: 'fish-doc-1', name: 'Crap' },
      { id: null, name: 'Altele' },
    ]);
    expect(s.rods).toHaveLength(1);
    expect(s.rodRuntimes).toEqual([{ phase: 'idle', endEpoch: null }]);
  });

  it('surfaces the authoritative hostUid even when the roster starts with a guest', () => {
    const { session: s } = firestoreSessionToLocal('sess-1', {
      ...metaDoc,
      hostUid: 'user-host',
      members: [
        { uid: 'user-guest', name: 'Guest', avatar: null, joinedAt: 'earlier' },
        { uid: 'user-host', name: 'Host', avatar: null, joinedAt: 'later' },
      ],
      memberUids: ['user-guest', 'user-host'],
    }, [], []);
    expect(s.hostUid).toBe('user-host');
  });

  it('surfaces the server-owned co-op fields READ-ONLY (joinCode/status/members/memberUids)', () => {
    const { session: s } = firestoreSessionToLocal('sess-1', metaDoc, [], []);
    expect(s.joinCode).toBe('AB12CD');
    expect(s.status).toBe('active');
    expect(s.memberUids).toEqual(['user-1']);
    expect(s.members).toEqual([{ uid: 'user-1', name: 'Ana', avatar: null, joinedAt: 'x' }]);
  });

  it('defaults the hostUid and co-op fields when the wire omits them', () => {
    const { session: s } = firestoreSessionToLocal(
      'sess-1',
      { ...metaDoc, hostUid: undefined, joinCode: undefined, status: undefined, members: undefined, memberUids: undefined },
      [],
      []
    );
    expect(s.hostUid).toBeNull();
    expect(s.joinCode).toBeNull();
    expect(s.status).toBeNull();
    expect(s.members).toEqual([]);
    expect(s.memberUids).toEqual([]);
  });

  it('keeps an explicit null hostUid as null', () => {
    const { session: s } = firestoreSessionToLocal('sess-1', { ...metaDoc, hostUid: null }, [], []);
    expect(s.hostUid).toBeNull();
  });

  it('maps warnedAt/autoCloseAt ISO strings from the sweeper to epoch ms (READ-ONLY)', () => {
    const { session: s } = firestoreSessionToLocal(
      'sess-1',
      {
        ...metaDoc,
        warnedAt: new Date(1751790500000).toISOString(),
        autoCloseAt: new Date(1751791000000).toISOString(),
      },
      [],
      []
    );
    expect(s.warnedAt).toBe(1751790500000);
    expect(s.autoCloseAt).toBe(1751791000000);
  });

  it('defaults warnedAt/autoCloseAt to null when the sweeper has not touched the doc', () => {
    const { session: s } = firestoreSessionToLocal('sess-1', metaDoc, [], []);
    expect(s.warnedAt).toBeNull();
    expect(s.autoCloseAt).toBeNull();
  });

  it('assembles events (ISO→ms) with online sync fields and photo fields', () => {
    const { events } = firestoreSessionToLocal('sess-1', metaDoc, [catchDoc], [markerDoc]);
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.occurredAt).toBe(1751790000500);
    expect(e.clientUpdatedAt).toBe(1751790001000);
    expect(e.syncStatus).toBe('synced');
    expect(e.sessionClientId).toBe('sess-1');
    expect(e.photoUrl).toBe('https://x/p.jpg');
    expect(e.photoThumbUrl).toBe('https://x/t.jpg');
    expect(e.photoFileId).toBe(42);
    expect(e.photoUploadStatus).toBe('done');
  });

  it('round-trips photoTagUids off the projection doc', () => {
    const { events } = firestoreSessionToLocal('sess-1', metaDoc, [{ ...catchDoc, photoTagUids: ['u-mario'] }], []);
    expect(events[0].photoTagUids).toEqual(['u-mario']);
  });

  it('defaults photoTagUids to null when the projection omits it — undefined means "everyone", same as null', () => {
    const { events } = firestoreSessionToLocal('sess-1', metaDoc, [catchDoc], []);
    expect(events[0].photoTagUids).toBeNull();
  });

  it('reads an explicit null photoTagUids as null (not undefined) — also "everyone"', () => {
    const { events } = firestoreSessionToLocal('sess-1', metaDoc, [{ ...catchDoc, photoTagUids: null }], []);
    expect(events[0].photoTagUids).toBeNull();
  });

  it('collapses an empty array to null — legacy rows with no photoTags relation ever set (M1)', () => {
    const { events } = firestoreSessionToLocal('sess-1', metaDoc, [{ ...catchDoc, photoTagUids: [] }], []);
    expect(events[0].photoTagUids).toBeNull();
  });

  it('collapses a full-roster tag array to null — "Toți", not every member individually (M2)', () => {
    const meta = { ...metaDoc, memberUids: ['user-1', 'user-2'] };
    const { events } = firestoreSessionToLocal(
      'sess-1',
      meta,
      [{ ...catchDoc, photoTagUids: ['user-2', 'user-1'] }], // order-independent
      []
    );
    expect(events[0].photoTagUids).toBeNull();
  });

  it('keeps a genuine partial tag selection intact — a strict subset of the roster is a real tag', () => {
    const meta = { ...metaDoc, memberUids: ['user-1', 'user-2'] };
    const { events } = firestoreSessionToLocal('sess-1', meta, [{ ...catchDoc, photoTagUids: ['user-1'] }], []);
    expect(events[0].photoTagUids).toEqual(['user-1']);
  });

  it('assembles markers, rebuilding the venue ref from session context', () => {
    const { markers } = firestoreSessionToLocal('sess-1', metaDoc, [catchDoc], [markerDoc]);
    expect(markers).toHaveLength(1);
    expect(markers[0].venue).toEqual({ venueType: 'lake', lakeId: 'lake-doc-9' });
    expect(markers[0].sessionClientId).toBe('sess-1');
  });

  it('reads rods from meta.rods (single source, no subcollection)', () => {
    const { session: s } = firestoreSessionToLocal('sess-1', metaDoc, [], []);
    expect(s.rods).toHaveLength(1);
    expect(s.rods[0]).toMatchObject({ index: 1, label: 'L1', durationMs: 5_400_000 });
  });

  it('handles empty subcollections and empty meta.rods', () => {
    const { session: s, events, markers } = firestoreSessionToLocal('sess-1', { ...metaDoc, rods: [] }, [], []);
    expect(events).toEqual([]);
    expect(markers).toEqual([]);
    expect(s.rods).toEqual([]);
    expect(s.rodRuntimes).toEqual([]);
  });

  it('sorts meta.rods by index', () => {
    const { session: s } = firestoreSessionToLocal(
      'sess-1',
      { ...metaDoc, rods: [{ ...rodDoc, clientId: 'rod-2', index: 2 }, rodDoc] },
      [],
      []
    );
    expect(s.rods.map(r => r.index)).toEqual([1, 2]);
  });

  it('rebuilds a publicWater marker venue from the marker publicWaterCode', () => {
    const { markers } = firestoreSessionToLocal(
      'sess-1',
      { ...metaDoc, venueType: 'publicWater', lakeId: null, publicWaterCode: 'RO-9' },
      [],
      [{ ...markerDoc, venueType: 'publicWater', publicWaterCode: 'RO-9' }]
    );
    expect(markers[0].venue).toEqual({ venueType: 'publicWater', publicWaterCode: 'RO-9' });
  });

  // The catch read side is now fed by the CMS PROJECTION (buildProjection →
  // toEventDTO), not by anything this file writes — the client never writes a
  // catch to Firestore any more. So this reads a literal projection doc rather
  // than round-tripping through a local writer.
  it('reads a projection catch doc into a LocalEvent', () => {
    const wire: FirestoreCatchDoc = {
      clientId: 'evt-1',
      clientUpdatedAt: new Date(1751790001000).toISOString(),
      outcome: 'capture',
      rodIndex: 1,
      rodLabel: 'L1',
      rodColor: '#F43F5E',
      bait: 'Boilies',
      baitType: 'boilies',
      baitSize: 20,
      baitFlavor: null,
      lane: 'center',
      distance: 65,
      lat: 44.43,
      lng: 26.01,
      weightKg: 6.4,
      species: 'Crap',
      speciesId: 'fish-doc-1',
      notes: null,
      occurredAt: new Date(1751790000500).toISOString(),
      photoUrl: 'https://x/p.jpg',
      photoThumbUrl: 'https://x/t.jpg',
      photoFileId: 7,
    };
    const { events } = firestoreSessionToLocal('sess-1', metaDoc, [wire], []);
    const back = events[0];
    expect(back.clientId).toBe('evt-1');
    expect(back.occurredAt).toBe(1751790000500);
    expect(back.clientUpdatedAt).toBe(1751790001000);
    expect(back.weightKg).toBe(6.4);
    expect(back.speciesId).toBe('fish-doc-1');
    expect(back.photoFileId).toBe(7);
    expect(back.photoUploadStatus).toBe('done');
  });

  it('defaults weightEstimated to false when the field is absent (legacy catch doc)', () => {
    const wire = {
      clientId: 'evt-2',
      outcome: 'capture',
      weightKg: 6.4,
      occurredAt: new Date(1751790000500).toISOString(),
    } as unknown as FirestoreCatchDoc;
    const { events } = firestoreSessionToLocal('sess-1', metaDoc, [wire], []);
    expect(events[0].weightEstimated).toBe(false);
  });

  it('carries an explicit weightEstimated', () => {
    const wire = {
      clientId: 'evt-3',
      outcome: 'capture',
      weightKg: 4.2,
      weightEstimated: true,
      occurredAt: new Date(1751790000500).toISOString(),
    } as unknown as FirestoreCatchDoc;
    const { events } = firestoreSessionToLocal('sess-1', metaDoc, [wire], []);
    expect(events[0].weightEstimated).toBe(true);
  });

  it('maps a weightless catch to null kg and a false flag', () => {
    const wire = {
      clientId: 'evt-4',
      outcome: 'capture',
      weightKg: null,
      occurredAt: new Date(1751790000500).toISOString(),
    } as unknown as FirestoreCatchDoc;
    const { events } = firestoreSessionToLocal('sess-1', metaDoc, [wire], []);
    expect(events[0].weightKg).toBeNull();
    expect(events[0].weightEstimated).toBe(false);
  });

  it('round-trips a marker through localMarkerToFirestore → firestoreSessionToLocal', () => {
    const original = marker();
    const wire = localMarkerToFirestore(original) as unknown as FirestoreMarkerDoc;
    const { markers } = firestoreSessionToLocal('sess-1', metaDoc, [], [wire]);
    expect(markers[0].clientId).toBe(original.clientId);
    expect(markers[0].clientUpdatedAt).toBe(original.clientUpdatedAt);
    expect(markers[0].venue).toEqual(original.venue);
  });
});

describe('rod runtime round-trip (spec 2026-07-22)', () => {
  const NOW = 1_753_000_000_000;

  it('serializes fishing with an ISO endsAt', () => {
    const doc = localRodToFirestore(rod(), 1, { phase: 'fishing', endEpoch: NOW + 60_000 });
    expect(doc.runtimePhase).toBe('fishing');
    expect(doc.runtimeEndsAt).toBe(new Date(NOW + 60_000).toISOString());
  });

  it('serializes idle/ready with null endsAt, and firing as fishing (never stored)', () => {
    expect(localRodToFirestore(rod(), 1, { phase: 'idle', endEpoch: null }).runtimePhase).toBe('idle');
    expect(localRodToFirestore(rod(), 1, { phase: 'ready', endEpoch: null }).runtimePhase).toBe('ready');
    const firing = localRodToFirestore(rod(), 1, { phase: 'firing', endEpoch: null });
    expect(firing.runtimePhase).toBe('fishing');
    expect(firing.runtimeEndsAt).toBeNull();
  });

  it('serializes firing WITH its past epoch, so a reopened app still counts up', () => {
    const doc = localRodToFirestore(rod(), 1, { phase: 'firing', endEpoch: NOW - 60_000 });
    expect(doc.runtimePhase).toBe('fishing');
    expect(doc.runtimeEndsAt).toBe(new Date(NOW - 60_000).toISOString());
    expect(firestoreRodRuntimeToLocal({ clientId: 'rod-1', index: 1, ...doc }, NOW)).toEqual({
      phase: 'firing',
      endEpoch: NOW - 60_000,
    });
  });

  it('omitted runtime serializes as idle', () => {
    expect(localRodToFirestore(rod(), 1).runtimePhase).toBe('idle');
  });

  it('reads a future fishing back as fishing with epoch endEpoch', () => {
    const rt = firestoreRodRuntimeToLocal(
      { clientId: 'rod-1', index: 1, runtimePhase: 'fishing', runtimeEndsAt: new Date(NOW + 60_000).toISOString() },
      NOW
    );
    expect(rt).toEqual({ phase: 'fishing', endEpoch: NOW + 60_000 });
  });

  it('derives firing from past-due fishing AND from fishing with null endsAt', () => {
    const past = firestoreRodRuntimeToLocal(
      { clientId: 'rod-1', index: 1, runtimePhase: 'fishing', runtimeEndsAt: new Date(NOW - 1000).toISOString() },
      NOW
    );
    // The past-due epoch is KEPT — the card counts up from it («Expirat −00:00:01»).
    expect(past).toEqual({ phase: 'firing', endEpoch: NOW - 1000 });
    const nullish = firestoreRodRuntimeToLocal({ clientId: 'rod-1', index: 1, runtimePhase: 'fishing' }, NOW);
    expect(nullish).toEqual({ phase: 'firing', endEpoch: null });
  });

  it('absent fields read as idle (old docs)', () => {
    expect(firestoreRodRuntimeToLocal({ clientId: 'rod-1', index: 1 }, NOW)).toEqual({ phase: 'idle', endEpoch: null });
  });
});

describe('meta mappers zip rods with runtimes', () => {
  const NOW = 1_753_000_000_000;

  it('full-meta writer zips session rodRuntimes onto the rod docs', () => {
    const meta = localSessionMetaToFirestore(session({ rodRuntimes: [{ phase: 'fishing', endEpoch: NOW + 60_000 }] }));
    expect((meta.rods as Record<string, unknown>[])[0].runtimePhase).toBe('fishing');
    expect((meta.rods as Record<string, unknown>[])[0].runtimeEndsAt).toBe(new Date(NOW + 60_000).toISOString());
  });

  it('patch mapper writes runtime fields per rod and no rodRuntimes key', () => {
    const out = localSessionMetaPatchToFirestore({
      rods: [rod({ index: 0 }), rod({ index: 1 })],
      rodRuntimes: [
        { phase: 'fishing', endEpoch: NOW + 60_000 },
        { phase: 'idle', endEpoch: null },
      ],
    });
    const docs = out.rods as Record<string, unknown>[];
    expect(docs[0].runtimePhase).toBe('fishing');
    expect(docs[1].runtimePhase).toBe('idle');
    expect(out).not.toHaveProperty('rodRuntimes');
  });

  it('firestoreSessionToLocal restores rodRuntimes from the rod docs', () => {
    const meta: FirestoreSessionMeta = {
      startedAt: new Date(NOW - 3_600_000).toISOString(),
      rods: [
        { clientId: 'rod-0', index: 0, runtimePhase: 'fishing', runtimeEndsAt: new Date(NOW + 60_000).toISOString() },
        { clientId: 'rod-1', index: 1 },
      ],
    };
    const { session: s } = firestoreSessionToLocal('s1', meta, [], [], NOW);
    expect(s.rodRuntimes).toEqual([
      { phase: 'fishing', endEpoch: NOW + 60_000 },
      { phase: 'idle', endEpoch: null },
    ]);
  });
});
