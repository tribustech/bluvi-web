import { describe, expect, it } from 'vitest';
import { DEFAULT_PLACE, isDefaultPlace, isVenueKey, placeFromParams, placeToParams } from './place';

const params = (q: string) => new URLSearchParams(q);

describe('Explorează place in the URL', () => {
  it('reads the defaults from an empty query', () => {
    expect(placeFromParams(params(''))).toEqual(DEFAULT_PLACE);
    expect(isDefaultPlace(placeFromParams(params('')))).toBe(true);
  });

  it('reads live, the chip and the venue', () => {
    expect(placeFromParams(params('live=1&filtru=notificari&loc=lake:abc'))).toEqual({ liveOnly: true, chip: 'urmarite', venueKey: 'lake:abc' });
    expect(placeFromParams(params('filtru=prieteni&loc=water:R:RO11_01.018_R1'))).toEqual({
      liveOnly: false,
      chip: 'prieteni',
      venueKey: 'water:R:RO11_01.018_R1',
    });
  });

  it('ignores values it does not know', () => {
    expect(placeFromParams(params('live=yes&filtru=altceva&loc=lake:'))).toEqual(DEFAULT_PLACE);
    expect(placeFromParams(params('loc=pin:1'))).toEqual(DEFAULT_PLACE);
    expect(isVenueKey('water:  ')).toBe(false);
  });

  it('writes only what differs from the default, and round-trips', () => {
    expect(placeToParams(DEFAULT_PLACE)).toEqual({ live: null, filtru: null, loc: null });
    const place = { liveOnly: true, chip: 'prieteni' as const, venueKey: 'lake:x' };
    const q = new URLSearchParams(Object.entries(placeToParams(place)).filter((e): e is [string, string] => e[1] !== null));
    expect(placeFromParams(q)).toEqual(place);
  });
});
