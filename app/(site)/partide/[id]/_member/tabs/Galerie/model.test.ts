import { describe, expect, it } from 'vitest';
import type { LocalEvent, LocalSession } from '@/core/partide';
import { coverRect, galleryCaption, galleryCatches, gifFileName, gifItems, gridPhoto } from './model';

const ev = (p: Partial<LocalEvent>): LocalEvent =>
  ({
    clientId: 'e',
    outcome: 'capture',
    occurredAt: Date.parse('2026-07-12T10:00:00Z'),
    weightKg: null,
    species: null,
    photoUrl: null,
    photoLocalUri: null,
    photoThumbUrl: null,
    ...p,
  }) as LocalEvent;

const session = { lakeName: 'Balta Mock', publicWaterName: null, manualVenueName: null, anchorName: null, standName: 'Stand 7' } as unknown as LocalSession;

describe('Galerie model (fish GalerieScene)', () => {
  it('galleryCatches: captures with a photo only, newest first', () => {
    const list = galleryCatches([
      ev({ clientId: 'a', occurredAt: 1, photoUrl: 'https://x/a.jpg' }),
      ev({ clientId: 'b', occurredAt: 3, photoUrl: null }),
      ev({ clientId: 'c', occurredAt: 2, outcome: 'lost', photoUrl: 'https://x/c.jpg' }),
      ev({ clientId: 'd', occurredAt: 4, photoLocalUri: 'blob:local' }),
    ]);
    expect(list.map(e => e.clientId)).toEqual(['d', 'a']);
  });

  it('galleryCaption: «{specie} · {kg} kg», only what is known', () => {
    expect(galleryCaption({ species: 'Crap', weightKg: 3.25 })).toBe('Crap · 3,25 kg');
    expect(galleryCaption({ species: null, weightKg: 2 })).toBe('2,0 kg');
    expect(galleryCaption({ species: 'Somn', weightKg: null })).toBe('Somn');
    expect(galleryCaption({ species: null, weightKg: null })).toBeNull();
  });

  it('gridPhoto: the thumb when there is one, else the photo', () => {
    expect(gridPhoto(ev({ photoUrl: 'full', photoThumbUrl: 'thumb' }))).toBe('thumb');
    expect(gridPhoto(ev({ photoUrl: 'full' }))).toBe('full');
  });

  it('gifItems: venue · stand, kg, species, date (fish exportGif)', () => {
    expect(gifItems(session, [ev({ photoUrl: 'p', weightKg: 3, species: 'Crap' }), ev({ photoUrl: 'q' })])).toEqual([
      { photoUri: 'p', venue: 'Balta Mock · Stand 7', kgText: '3,0', species: 'Crap', dateLabel: '12 iul 2026' },
      { photoUri: 'q', venue: 'Balta Mock · Stand 7', kgText: '', species: '', dateLabel: '12 iul 2026' },
    ]);
    expect(gifItems({ ...session, standName: null }, [ev({ photoUrl: 'p' })])[0].venue).toBe('Balta Mock');
  });

  it('coverRect: a centred crop at the frame ratio', () => {
    expect(coverRect(1000, 1000, 720, 900)).toEqual({ x: 100, y: 0, width: 800, height: 1000 });
    expect(coverRect(800, 2000, 720, 900)).toEqual({ x: 0, y: 500, width: 800, height: 1000 });
  });

  it('gifFileName', () => {
    expect(gifFileName(42)).toBe('bluvi-galerie-42.gif');
  });
});
