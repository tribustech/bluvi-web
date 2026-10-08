import { catchDay } from '@/components/partide/CatchLightbox';
import { eventPhotoUri, fmtKg, type LocalEvent, type LocalSession } from '@/core/partide';
import { venueName } from '../../model';

/*
 * The Galerie tab's pure side (fish features/partide/scenes/GalerieScene.tsx): which events are
 * photos, their captions, and the GIF frames' lines (fish helpers/gifExport.ts GifGalleryItem).
 */

/** fish GalerieScene photoCatches: captures with a photo, newest first. */
export function galleryCatches(events: readonly LocalEvent[]): LocalEvent[] {
  return events.filter(e => e.outcome === 'capture' && eventPhotoUri(e) != null).sort((a, b) => b.occurredAt - a.occurredAt);
}

/** fish GalerieScene caption: «{specie} · {kg} kg», only what is known; null when neither is. */
export function galleryCaption(e: Pick<LocalEvent, 'species' | 'weightKg'>): string | null {
  return [e.species, e.weightKg != null ? `${fmtKg(e.weightKg)} kg` : null].filter(Boolean).join(' · ') || null;
}

/** The grid rendition (the thumb when the CMS made one), else the photo itself. */
export function gridPhoto(e: LocalEvent): string {
  return e.photoThumbUrl || (eventPhotoUri(e) as string);
}

/** fish GifGalleryItem: one frame's photo and lines. */
export type GifItem = {
  photoUri: string;
  /** «Balta Mock · Stand 7» — the venue, then the stand when there is one. */
  venue: string;
  /** The weight as displayed («3,25»); '' hides the kg block. */
  kgText: string;
  /** '' hides the chip. */
  species: string;
  /** «12 iul 2026». */
  dateLabel: string;
};

/** fish exportGif's items: venue · stand, kg, species, date — for every photo catch. */
export function gifItems(session: Pick<LocalSession, 'lakeName' | 'publicWaterName' | 'manualVenueName' | 'anchorName' | 'standName'>, catches: readonly LocalEvent[]): GifItem[] {
  const venue = [venueName(session as LocalSession), session.standName].filter(Boolean).join(' · ');
  return catches.flatMap(e => {
    const photoUri = eventPhotoUri(e);
    if (!photoUri) return [];
    return [
      {
        photoUri,
        venue,
        kgText: e.weightKg != null ? fmtKg(e.weightKg) : '',
        species: e.species ?? '',
        dateLabel: catchDay(new Date(e.occurredAt).toISOString()),
      },
    ];
  });
}

/** The source rect that cover-fits a `sw`×`sh` image into a `dw`×`dh` frame (centred crop). */
export function coverRect(sw: number, sh: number, dw: number, dh: number): { x: number; y: number; width: number; height: number } {
  const scale = Math.max(dw / sw, dh / sh);
  const width = dw / scale;
  const height = dh / scale;
  return { x: (sw - width) / 2, y: (sh - height) / 2, width, height };
}

/** The file name of an export («bluvi-galerie-1696600000000.gif»). */
export const gifFileName = (now: number) => `bluvi-galerie-${now}.gif`;
