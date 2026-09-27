import { describe, expect, it } from 'vitest';
import { applyCaptureUpdate, buildLogCaptureEvent, sameTagSelection, sessionFromInput } from '../captureEdits';
import type { LocalEvent } from '../types';

const base = (over: Partial<LocalEvent> = {}): LocalEvent => ({
  ...buildLogCaptureEvent('s1', { weightKg: 5, weightEstimated: true, species: 'Crap' }, 'e1', 1000),
  ...over,
});

describe('captureEdits', () => {
  it('compares tag selections as sets, with null as its own state', () => {
    expect(sameTagSelection(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameTagSelection(null, null)).toBe(true);
    expect(sameTagSelection(null, [])).toBe(false);
    expect(sameTagSelection(['a'], ['a', 'b'])).toBe(false);
  });

  it('builds a quick capture: explicit bait overrides the rod snapshot, photo marks pending', () => {
    const e = buildLogCaptureEvent(
      's1',
      {
        weightKg: null,
        weightEstimated: false,
        species: 'Somn',
        bait: 'Viermi',
        photoLocalUri: 'blob:x',
        rod: { index: 2, label: 'L', color: '#f00', bait: 'Boilies', baitType: null, baitSize: 20, baitFlavor: null, lane: 'left', distance: 60 },
      },
      'e9',
      5000
    );
    expect(e).toMatchObject({ clientId: 'e9', rodIndex: 2, bait: 'Viermi', baitSize: 20, lane: 'left', distance: 60, photoUploadStatus: 'pending', occurredAt: 5000, outcome: 'capture' });
  });

  it('forces weightEstimated false when the edited weight is null', () => {
    const { next } = applyCaptureUpdate(base(), { weightKg: null }, [], 2000);
    expect(next.weightKg).toBeNull();
    expect(next.weightEstimated).toBe(false);
    expect(next.clientUpdatedAt).toBe(2000);
  });

  it('PATCHes tags only on a genuine change, and resets "Toți" with the roster list, never []', () => {
    expect(applyCaptureUpdate(base({ photoTagUids: ['a'] }), { photoTagUids: ['a'] }, ['a', 'b'], 1).photoTagUidsPatch).toBeUndefined();
    expect(applyCaptureUpdate(base(), { notes: 'x' }, ['a'], 1).photoTagUidsPatch).toBeUndefined();
    expect(applyCaptureUpdate(base({ photoTagUids: ['a'] }), { photoTagUids: null }, ['a', 'b'], 1).photoTagUidsPatch).toEqual(['a', 'b']);
    expect(applyCaptureUpdate(base(), { photoTagUids: ['b'] }, ['a', 'b'], 1).photoTagUidsPatch).toEqual(['b']);
  });

  it('detaches a photo and re-attributes a rod', () => {
    const { next } = applyCaptureUpdate(base({ photoUrl: 'u', photoFileId: 3 }), { photo: { localUri: null }, rod: null, distance: 40 }, [], 1);
    expect(next).toMatchObject({ photoUrl: null, photoFileId: null, photoUploadStatus: 'none', rodIndex: null, distance: 40 });
  });

  it('builds the session a start POSTs', () => {
    const s = sessionFromInput('c1', { venue: { venueType: 'lake', lakeId: 'L' }, venueName: 'Chita', anchor: { lat: 1, lng: 2 }, plannedDurationMs: 60_000, rods: [] }, 7);
    expect(s).toMatchObject({ clientId: 'c1', lakeId: 'L', lakeName: 'Chita', publicWaterName: null, startedAt: 7, visibleOnProfile: true, detailsHydrated: true });
  });
});
