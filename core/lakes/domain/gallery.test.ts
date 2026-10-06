import { describe, expect, it } from 'vitest';
import {
  buildGalleryCatchItems,
  buildGalleryPhotoItems,
  DEFAULT_PHOTO_ASPECT,
  GALLERY_FILTERS,
  galleryCountLabel,
  galleryItemsFor,
  interleaveGalleryItems,
  type GalleryCatchSource,
} from './gallery';

// fish features/lakes/helpers/__tests__/lakeDetailLogic.test.ts (gallery part).

const img = (url: string, over: Partial<{ mediumUrl: string | null; smallUrl: string | null; blurhash: string | null }> = {}) => ({
  url,
  mediumUrl: null,
  smallUrl: null,
  blurhash: null,
  ...over,
});

const catchOf = (id: string, over: Partial<GalleryCatchSource> = {}): GalleryCatchSource => ({
  clientId: id,
  photoUrl: `https://x/${id}.jpg`,
  photoGridUrl: null,
  photoWidth: null,
  photoHeight: null,
  species: 'Crap',
  weightKg: 4.2,
  occurredAt: '2026-08-04T10:28:04.350Z',
  angler: { uid: 'u1', name: 'Andrei Pop' },
  ...over,
});

describe('buildGalleryPhotoItems', () => {
  it('prefers medium, then small, then the original for the tile; keeps the original for the lightbox', () => {
    const [a, b, c] = buildGalleryPhotoItems([
      img('o1', { mediumUrl: 'm1', smallUrl: 's1', blurhash: 'LKO2' }),
      img('o2', { smallUrl: 's2' }),
      img('o3'),
    ]);
    expect(a).toEqual({ kind: 'photo', key: 'photo-o1', uri: 'm1', fullUri: 'o1', aspectRatio: DEFAULT_PHOTO_ASPECT, blurhash: 'LKO2' });
    expect(b.uri).toBe('s2');
    expect(c.uri).toBe('o3');
    expect(c.blurhash).toBeUndefined();
  });
  it('drops an image without any url', () => {
    expect(buildGalleryPhotoItems([img('')])).toEqual([]);
  });
});

describe('buildGalleryCatchItems', () => {
  it('skips catches without a photo and takes the photo ratio (4:3 fallback)', () => {
    const items = buildGalleryCatchItems([
      catchOf('a', { photoWidth: 800, photoHeight: 1000, photoGridUrl: 'https://x/grid-a.jpg' }),
      catchOf('b', { photoUrl: null }),
      catchOf('c'),
    ]);
    expect(items.map(i => i.key)).toEqual(['catch-a', 'catch-c']);
    expect(items[0].aspectRatio).toBe(0.8);
    expect(items[0].gridUri).toBe('https://x/grid-a.jpg');
    expect(items[0].uri).toBe('https://x/a.jpg');
    expect(items[1].aspectRatio).toBe(DEFAULT_PHOTO_ASPECT);
    expect(items[1].gridUri).toBe('https://x/c.jpg');
    expect(items[1]).toMatchObject({ clientId: 'c', anglerName: 'Andrei Pop', anglerUid: 'u1', weightKg: 4.2, species: 'Crap' });
  });
});

describe('interleaveGalleryItems', () => {
  const photos = buildGalleryPhotoItems([img('p1'), img('p2'), img('p3')]);
  const catches = buildGalleryCatchItems([catchOf('c1')]);
  it('alternates photo / catch, then appends the rest of the longer list', () => {
    expect(interleaveGalleryItems(photos, catches).map(i => i.key)).toEqual(['photo-p1', 'catch-c1', 'photo-p2', 'photo-p3']);
    const many = buildGalleryCatchItems([catchOf('c1'), catchOf('c2'), catchOf('c3')]);
    expect(interleaveGalleryItems(photos.slice(0, 1), many).map(i => i.key)).toEqual(['photo-p1', 'catch-c1', 'catch-c2', 'catch-c3']);
  });
  it('galleryItemsFor: Foto baltă / Capturi comunitate / Toate', () => {
    expect(galleryItemsFor('foto', photos, catches)).toBe(photos);
    expect(galleryItemsFor('capturi', photos, catches)).toBe(catches);
    expect(galleryItemsFor('toate', photos, catches)).toHaveLength(4);
  });
});

describe('labels', () => {
  it('filters in fish order, Toate first', () => {
    expect(GALLERY_FILTERS.map(f => f.label)).toEqual(['Toate', 'Foto baltă', 'Capturi comunitate']);
  });
  it('counts photos in Romanian', () => {
    expect(galleryCountLabel(1)).toBe('1 fotografie');
    expect(galleryCountLabel(0)).toBe('0 fotografii');
    expect(galleryCountLabel(12)).toBe('12 fotografii');
  });
});
