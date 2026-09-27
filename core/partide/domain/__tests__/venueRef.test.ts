import { describe, it, expect } from 'vitest';
import { sessionSubtitle, sessionVenueRef, VENUE_KIND_LABEL } from '../venueRef';
import type { LocalSession } from '../types';

const session = (over: Partial<LocalSession>): LocalSession => ({
  clientId: 'c1',
  serverId: null,
  syncStatus: 'pending',
  clientUpdatedAt: 1,
  venueType: 'pin',
  lakeId: null,
  lakeName: null,
  publicWaterCode: null,
  publicWaterName: null,
  manualVenueName: 'Dunăre',
  standId: null,
  standName: null,
  locality: null,
  anchorLat: 44.4,
  anchorLng: 26.0,
  anchorName: null,
  startedAt: 1000,
  endedAt: null,
  warnedAt: null,
  autoCloseAt: null,
  plannedDurationMs: 3600000,
  notes: null,
  visibleOnProfile: true,
  targetSpecies: [],
  rods: [],
  rodRuntimes: [],
  detailsHydrated: true,
  projectionRev: 0,
  ...over,
});

describe('sessionVenueRef', () => {
  it('lakeId present → lake venue', () => {
    expect(sessionVenueRef(session({ lakeId: 'lake-1' }))).toEqual({ venueType: 'lake', lakeId: 'lake-1' });
  });

  it('no lakeId, publicWaterCode present → publicWater venue', () => {
    expect(sessionVenueRef(session({ lakeId: null, publicWaterCode: 'pw-1' }))).toEqual({
      venueType: 'publicWater',
      publicWaterCode: 'pw-1',
    });
  });

  it('neither lakeId nor publicWaterCode → pin venue at the anchor coords', () => {
    expect(
      sessionVenueRef(session({ lakeId: null, publicWaterCode: null, anchorLat: 44.41, anchorLng: 26.02 }))
    ).toEqual({ venueType: 'pin', anchor: { lat: 44.41, lng: 26.02 } });
  });
});

describe('sessionSubtitle', () => {
  it('returns standName even when locality is also set', () => {
    expect(sessionSubtitle(session({ standName: 'Stand 3', locality: 'Ilfov' }))).toBe('Stand 3');
  });

  it('labels a bare stand name so the header does not read as a naked number', () => {
    expect(sessionSubtitle(session({ standName: '6', locality: 'Giurgiu' }))).toBe('Stand 6');
    expect(sessionSubtitle(session({ standName: 'A9', locality: 'Giurgiu' }))).toBe('Stand A9');
  });

  it('returns locality when standName is null', () => {
    expect(sessionSubtitle(session({ standName: null, locality: 'Ilfov' }))).toBe('Ilfov');
  });

  it('falls back to the venue-kind label when both are null', () => {
    expect(sessionSubtitle(session({ standName: null, locality: null, venueType: 'pin' }))).toBe(
      VENUE_KIND_LABEL.pin
    );
  });
});
