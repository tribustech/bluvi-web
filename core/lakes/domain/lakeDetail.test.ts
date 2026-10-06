import { describe, expect, it } from 'vitest';
import {
  buildLakeSectionChips,
  buildLakeStats,
  buildMapUrls,
  computeActiveSection,
  lakeBookingAction,
  lakeBookingNouBadge,
  lakeBookingState,
  lakeCompetitionsVisible,
  lakeHasContact,
  lakeShareMessage,
  lakeShareText,
  LAKE_SHARE_DEFAULT_MESSAGE,
  parseLakeCoordinates,
} from './lakeDetail';
import { RECENT_VIEWED_LAKE_IDS_KEY } from './recentViewed';
import { pushRecentViewedLakeId } from './search';

// fish features/lakes/helpers/__tests__/lakeDetailLogic.test.ts + the inline rules of
// app/(app)/lakes/[lakeId].tsx, LakeCharacteristics, LakeContactSection, NavigationSheet, ShareLakeSheet.

const none = { hasFacilities: false, hasFish: false, hasPartide: false, hasPrices: false, hasCompetitions: false, hasContact: false };

describe('buildLakeSectionChips', () => {
  it('always includes prezentare + recenzii; others by flags, in canonical order', () => {
    expect(buildLakeSectionChips(none)).toEqual(['prezentare', 'recenzii']);
    expect(
      buildLakeSectionChips({ hasFacilities: true, hasFish: true, hasPartide: true, hasPrices: true, hasCompetitions: true, hasContact: true }),
    ).toEqual(['prezentare', 'facilitati', 'pesti', 'partide', 'preturi', 'concursuri', 'recenzii', 'contact']);
  });
});

describe('lakeCompetitionsVisible', () => {
  it('stays visible until both counts are known, hides only at 0 + 0', () => {
    expect(lakeCompetitionsVisible(null)).toBe(true);
    expect(lakeCompetitionsVisible({ live: 0, upcoming: 2 })).toBe(true);
    expect(lakeCompetitionsVisible({ live: 0, upcoming: 0 })).toBe(false);
  });
});

describe('lakeHasContact', () => {
  const empty = { address: null, website: null, contact: [], coordinates: null };
  it('is true for an address, a website, a phone or coordinates', () => {
    expect(lakeHasContact(empty)).toBe(false);
    expect(lakeHasContact({ ...empty, address: 'Str. Mare' })).toBe(true);
    expect(lakeHasContact({ ...empty, website: 'https://x.ro' })).toBe(true);
    expect(lakeHasContact({ ...empty, contact: [{ id: 1, header: null, name: null, phone: '07' }] })).toBe(true);
    expect(lakeHasContact({ ...empty, coordinates: { lat: '44', long: '25' } })).toBe(true);
  });
});

describe('booking affordance', () => {
  it('maps the lake flags to the three booking states', () => {
    expect(lakeBookingState({ bookingEnabled: true, acceptsReservations: true })).toBe('enabled');
    expect(lakeBookingState({ bookingEnabled: false, acceptsReservations: true })).toBe('legacy_phone');
    expect(lakeBookingState({ bookingEnabled: false, acceptsReservations: undefined })).toBe('none');
  });

  it('routes the CTA: book / sign-in / contact / interest', () => {
    expect(lakeBookingAction('enabled', true)).toBe('book');
    expect(lakeBookingAction('enabled', false)).toBe('sign-in');
    expect(lakeBookingAction('legacy_phone', true)).toBe('contact');
    expect(lakeBookingAction('legacy_phone', false)).toBe('contact');
    expect(lakeBookingAction('none', true)).toBe('interest');
    expect(lakeBookingAction('none', false)).toBe('interest');
  });

  it('the NOU badge expired on 2026-10-01 and never shows without booking', () => {
    expect(lakeBookingNouBadge('enabled', Date.parse('2026-09-30T12:00:00Z'))).toBe(true);
    expect(lakeBookingNouBadge('enabled', Date.parse('2026-10-01T00:00:00Z'))).toBe(false);
    expect(lakeBookingNouBadge('none', Date.parse('2026-09-01T00:00:00Z'))).toBe(false);
  });
});

describe('buildLakeStats', () => {
  const blank = { surface: null, depth: null, numberOfSeats: null, regime: null, fishingType: null, fishingSpotTypes: null };
  it('keeps only the stats the lake has, in fish order', () => {
    expect(buildLakeStats(blank)).toEqual([]);
    expect(
      buildLakeStats({ surface: 10.5, depth: { min: 1.5, max: null }, numberOfSeats: 21, regime: 'C&R', fishingType: 'Sportiv', fishingSpotTypes: 'Pontoane' }),
    ).toEqual([
      { key: 'surface', value: '10,5 ha', label: 'Suprafață' },
      { key: 'depth', value: '1,5 – ? m', label: 'Adâncime' },
      { key: 'seats', value: '21 locuri', label: 'Standuri pescuit' },
      { key: 'regime', value: 'C&R', label: 'Regim de pescuit' },
      { key: 'fishingType', value: 'Sportiv', label: 'Tip de pescuit' },
      { key: 'fishingSpotTypes', value: 'Pontoane', label: 'Loc de pescuit' },
    ]);
  });

  it('drops a depth with neither bound', () => {
    expect(buildLakeStats({ ...blank, depth: { min: null, max: null } })).toEqual([]);
  });
});

describe('coordinates and directions', () => {
  it('parses only when both parts are numbers', () => {
    expect(parseLakeCoordinates({ lat: '44.08', long: '25.66' })).toEqual({ lat: 44.08, lng: 25.66 });
    expect(parseLakeCoordinates({ lat: 'x', long: '25.66' })).toBeNull();
    expect(parseLakeCoordinates(null)).toBeNull();
  });

  it('builds the Google Maps, Waze and Apple Maps links', () => {
    expect(buildMapUrls({ lat: '44.1', long: '25.6' })).toEqual({
      google: 'https://www.google.com/maps/dir/?api=1&destination=44.1,25.6&travelmode=driving&dir_action=navigate',
      waze: 'https://waze.com/ul?ll=44.1,25.6&navigate=yes&z=10',
      apple: 'https://maps.apple.com/?daddr=44.1,25.6',
    });
    expect(buildMapUrls(null)).toBeNull();
  });
});

describe('share text', () => {
  it('is the message, a blank line, the fish emoji + name, then the link', () => {
    expect(LAKE_SHARE_DEFAULT_MESSAGE).toBe('Mergem la pescuit aici?');
    expect(lakeShareMessage('Hai?', 'Chita Lake')).toBe('Hai?\n\n🎣 Chita Lake');
    expect(lakeShareText('Hai?', 'Chita Lake', 'https://bluvi.ro/balti/x')).toBe('Hai?\n\n🎣 Chita Lake\nhttps://bluvi.ro/balti/x');
  });
});

describe('computeActiveSection', () => {
  const offsets = [
    { id: 'b', y: 600 },
    { id: 'a', y: 0 },
    { id: 'c', y: 1200 },
  ];
  it('is the last section whose top passed the pinned nav', () => {
    expect(computeActiveSection(0, offsets, 100)).toBe('a');
    expect(computeActiveSection(500, offsets, 100)).toBe('b');
    expect(computeActiveSection(5000, offsets, 100)).toBe('c');
    expect(computeActiveSection(0, [], 100)).toBeNull();
  });
});

describe('recently viewed', () => {
  it('uses fish’s storage key and moves the lake to the end', () => {
    expect(RECENT_VIEWED_LAKE_IDS_KEY).toBe('recentViewedLakeIds');
    expect(pushRecentViewedLakeId(['a', 'b', 'c'], 'a')).toEqual(['b', 'c', 'a']);
  });
});
