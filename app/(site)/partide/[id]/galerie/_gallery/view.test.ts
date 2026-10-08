import { describe, expect, it } from 'vitest';
import type { CommunitySessionDetailCatchDTO } from '@/core/partide';
import { gallerySubtitle, galleryPhotos, photoCaption, tileLabel } from './view';

const c = (id: string, patch: Partial<CommunitySessionDetailCatchDTO> = {}): CommunitySessionDetailCatchDTO => ({
  clientId: id,
  species: 'Crap',
  weightKg: 3.4,
  photoUrl: `https://x/${id}.jpg`,
  photoGridUrl: `https://x/medium_${id}.jpg`,
  photoThumbUrl: null,
  occurredAt: '2026-10-07T11:30:00.000Z',
  width: 1200,
  height: 900,
  ...patch,
});

describe('galleryPhotos', () => {
  it('keeps page order, dedupes across pages, skips rows without a photo', () => {
    const out = galleryPhotos([{ data: [c('a'), c('b')] }, { data: [c('b'), c('n', { photoUrl: null, photoGridUrl: null }), c('d')] }]);
    expect(out.map(p => p.key)).toEqual(['a', 'b', 'd']);
  });
  it('grid → the medium rendition, full → the original, ratio from the pixels (null when unknown)', () => {
    const [p, q] = galleryPhotos([{ data: [c('a'), c('b', { photoGridUrl: null, width: null, height: undefined })] }]);
    expect(p).toMatchObject({ grid: 'https://x/medium_a.jpg', full: 'https://x/a.jpg', ratio: 4 / 3 });
    expect(q).toMatchObject({ grid: 'https://x/b.jpg', ratio: null });
  });
  it('no pages → nothing', () => {
    expect(galleryPhotos(undefined)).toEqual([]);
  });
});

describe('captions', () => {
  it('fish photoCaption: only what is known', () => {
    expect(photoCaption({ species: 'Crap', weightKg: 3.4 })).toBe('Crap · 3,4 kg');
    expect(photoCaption({ species: null, weightKg: 12.345 })).toBe('12,345 kg');
    expect(photoCaption({ species: 'Somn', weightKg: null })).toBe('Somn');
    expect(photoCaption({ species: null, weightKg: null })).toBeNull();
    expect(tileLabel({ species: null, weightKg: null })).toBe('Deschide fotografia');
    expect(tileLabel({ species: 'Crap', weightKg: 2 })).toBe('Deschide fotografia: Crap · 2,0 kg');
  });
});

describe('gallerySubtitle', () => {
  const ion = { uid: 'a', name: 'Ion', avatarUrl: null };
  const dan = { uid: 'b', name: 'Dan', avatarUrl: null };
  it('members · count, with Romanian plurals', () => {
    expect(gallerySubtitle([ion], 1)).toBe('Ion · 1 fotografie');
    expect(gallerySubtitle([ion, dan], 12)).toBe('Ion și Dan · 12 fotografii');
    expect(gallerySubtitle([ion], 20)).toBe('Ion · 20 de fotografii');
    expect(gallerySubtitle([ion], 0)).toBe('Ion · 0 fotografii');
  });
  it('rule 4: an unknown part is left out', () => {
    expect(gallerySubtitle(null, 3)).toBe('3 fotografii');
    expect(gallerySubtitle([ion], null)).toBe('Ion');
    expect(gallerySubtitle(null, null)).toBeNull();
    expect(gallerySubtitle([{ uid: 'x', name: null, avatarUrl: null }], 2)).toBe('1 pescar · 2 fotografii');
  });
});
