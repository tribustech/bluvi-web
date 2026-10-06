import type { FeedLakeImage } from '../schemas';

/*
 * The lake gallery's items — fish `features/lakes/helpers/lakeDetailLogic.ts`
 * (buildGalleryPhotoItems, buildGalleryCatchItems, interleaveGalleryItems).
 *
 * The catches come from core/partide (`LakeCatchDTO`), which core/lakes may not import (the domain
 * graph runs partide → lakes): the builder takes the structural slice of a catch it reads, which a
 * `LakeCatchDTO` satisfies as is.
 */

export const DEFAULT_PHOTO_ASPECT = 4 / 3;

export interface GalleryPhotoItem {
  kind: 'photo';
  key: string;
  /** The tile's rendition (medium → small → original). */
  uri: string;
  /** The original, for the lightbox (lakes.gallery.c8). */
  fullUri: string;
  aspectRatio: number;
  blurhash?: string;
}

export interface GalleryCatchItem {
  kind: 'catch';
  key: string;
  /** The catch's id (web: the lightbox and `?foto=` look a catch up by it). */
  clientId: string;
  /** fish shows the original on the tile; the web tile takes the grid rendition when there is one. */
  uri: string;
  gridUri: string;
  aspectRatio: number;
  anglerName: string | null;
  anglerUid: string;
  weightKg: number | null;
  species: string | null;
  occurredAt: string;
}

export type GalleryItem = GalleryPhotoItem | GalleryCatchItem;

/** The fields of a community catch (core/partide `LakeCatchDTO`) the gallery reads. */
export interface GalleryCatchSource {
  clientId: string;
  photoUrl: string | null;
  photoGridUrl?: string | null;
  photoWidth: number | null;
  photoHeight: number | null;
  species: string | null;
  weightKg: number | null;
  occurredAt: string;
  angler: { uid: string; name: string | null };
}

export function buildGalleryPhotoItems(images: Omit<FeedLakeImage, 'thumbnailUrl'>[]): GalleryPhotoItem[] {
  return images
    .filter(img => img.mediumUrl || img.smallUrl || img.url)
    .map(img => ({
      kind: 'photo' as const,
      key: `photo-${img.url}`,
      uri: (img.mediumUrl || img.smallUrl || img.url) as string,
      fullUri: img.url,
      aspectRatio: DEFAULT_PHOTO_ASPECT,
      blurhash: img.blurhash || undefined,
    }));
}

/** Catches without a photo are skipped (lakes.gallery.c4). */
export function buildGalleryCatchItems(catches: GalleryCatchSource[]): GalleryCatchItem[] {
  return catches
    .filter(c => c.photoUrl)
    .map(c => ({
      kind: 'catch' as const,
      key: `catch-${c.clientId}`,
      clientId: c.clientId,
      uri: c.photoUrl as string,
      gridUri: c.photoGridUrl || (c.photoUrl as string),
      aspectRatio: c.photoWidth && c.photoHeight ? c.photoWidth / c.photoHeight : DEFAULT_PHOTO_ASPECT,
      anglerName: c.angler.name,
      anglerUid: c.angler.uid,
      weightKg: c.weightKg,
      species: c.species,
      occurredAt: c.occurredAt,
    }));
}

/** Mock behavior: alternate photo/catch, then append whichever list runs longer. */
export function interleaveGalleryItems(photos: GalleryPhotoItem[], catches: GalleryCatchItem[]): GalleryItem[] {
  const out: GalleryItem[] = [];
  const max = Math.max(photos.length, catches.length);
  for (let i = 0; i < max; i++) {
    if (photos[i]) out.push(photos[i]);
    if (catches[i]) out.push(catches[i]);
  }
  return out;
}

export type GalleryFilter = 'toate' | 'foto' | 'capturi';

/** fish gallery.tsx FILTERS (lakes.gallery.c2), «Toate» first and the default. */
export const GALLERY_FILTERS: { id: GalleryFilter; label: string }[] = [
  { id: 'toate', label: 'Toate' },
  { id: 'foto', label: 'Foto baltă' },
  { id: 'capturi', label: 'Capturi comunitate' },
];

/** fish gallery.tsx `items` memo: what one filter shows. */
export function galleryItemsFor(filter: GalleryFilter, photos: GalleryPhotoItem[], catches: GalleryCatchItem[]): GalleryItem[] {
  if (filter === 'foto') return photos;
  if (filter === 'capturi') return catches;
  return interleaveGalleryItems(photos, catches);
}

/** fish gallery.tsx: «{lake} · N fotografii» — N = the lake's photos + the server's catch total. */
export function galleryCountLabel(total: number): string {
  return `${total} ${total === 1 ? 'fotografie' : 'fotografii'}`;
}
