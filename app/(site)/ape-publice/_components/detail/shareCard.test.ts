import { describe, expect, it } from 'vitest';
import { ALL_FIELDS, dmy, shareablePhotoSrc, shareCardLines, shareFieldKeys } from './shareCard';

const c = { weightKg: 12.5, species: 'Crap', occurredAt: '2026-09-20T08:30:00.000Z' };

describe('shareFieldKeys (fish ShareCatchSheet fieldKeys)', () => {
  it('offers a switch only for what the catch has; the date always', () => {
    expect(shareFieldKeys(c, 'Snagov')).toEqual(['kg', 'balta', 'specie', 'date']);
    expect(shareFieldKeys({ ...c, weightKg: null }, 'Snagov')).toEqual(['balta', 'specie', 'date']);
    expect(shareFieldKeys({ ...c, species: null }, '')).toEqual(['kg', 'date']);
    expect(shareFieldKeys({ weightKg: null, species: null, occurredAt: c.occurredAt }, '')).toEqual(['date']);
  });
});

describe('dmy (fish CatchCard)', () => {
  it('reads «20 sep 2026» on the Romanian day', () => {
    expect(dmy('2026-09-20T08:30:00.000Z')).toBe('20 sep 2026');
    // 22:30 UTC on 31 Dec is already 1 Jan in Bucharest.
    expect(dmy('2026-12-31T22:30:00.000Z')).toBe('1 ian 2027');
    expect(dmy('nope')).toBe('');
  });
});

describe('shareCardLines', () => {
  it('lists what is drawn, in reading order, following the switches', () => {
    expect(shareCardLines(c, 'Snagov', ALL_FIELDS)).toEqual(['Snagov', '12,5 kg', 'Crap', '20 sep 2026']);
    expect(shareCardLines(c, 'Snagov', { ...ALL_FIELDS, balta: false, date: false })).toEqual(['12,5 kg', 'Crap']);
  });
});

describe('shareablePhotoSrc', () => {
  const origin = 'http://localhost:3102';
  it('keeps data, blob and same-origin URLs; proxies the rest', () => {
    expect(shareablePhotoSrc('data:image/png;base64,AA', origin)).toBe('data:image/png;base64,AA');
    expect(shareablePhotoSrc('blob:http://localhost:3102/x', origin)).toBe('blob:http://localhost:3102/x');
    expect(shareablePhotoSrc('/uploads/a.jpg', origin)).toBe('/uploads/a.jpg');
    expect(shareablePhotoSrc('https://bluvi-staging.s3.eu-central-1.amazonaws.com/a b.jpg', origin)).toBe(
      '/ape-publice/api/foto?src=https%3A%2F%2Fbluvi-staging.s3.eu-central-1.amazonaws.com%2Fa%20b.jpg',
    );
  });
});
