import { fmtKg, fullSource, gridSource, membersLabel, type CommunityMemberDTO, type CommunitySessionDetailCatchDTO } from '@/core/partide';
import { formatCount } from '@/core/realtime/chat/format';

/*
 * The pure side of «Galeria partidei» (fish features/partide/screens/SessionGalleryScreen.tsx):
 * which catches are tiles, their captions, the header's subtitle. Unit-tested (view.test.ts).
 */

/** fish GALLERY_PAGE_SIZE: 30 photos a page. */
export const GALLERY_PAGE_SIZE = 30;

/** The gallery's query options (core sessionCatchesInfiniteQuery), the same on the server and in the browser. */
export const GALLERY_QUERY = { photosOnly: true, pageSize: GALLERY_PAGE_SIZE } as const;

export type GalleryPhoto = {
  key: string;
  /** The grid rendition (medium), else the original. */
  grid: string;
  /** The original, for the lightbox. */
  full: string;
  /** width / height when the CMS knows the photo's pixels; null → the masonry's 4:3. */
  ratio: number | null;
  weightKg: number | null;
  species: string | null;
  occurredAt: string;
};

/**
 * Every loaded page's photo catches in page order (fish `pages.flatMap(p => p.data)`), each once:
 * cursor pages can repeat a row across a page boundary. A row without a photo (never sent with
 * `photos=1`) is not a tile.
 */
export function galleryPhotos(pages: readonly { data: readonly CommunitySessionDetailCatchDTO[] }[] | undefined): GalleryPhoto[] {
  const seen = new Set<string>();
  const out: GalleryPhoto[] = [];
  for (const c of (pages ?? []).flatMap(p => p.data)) {
    const full = fullSource(c);
    if (!full || seen.has(c.clientId)) continue;
    seen.add(c.clientId);
    out.push({
      key: c.clientId,
      grid: gridSource(c) ?? full,
      full,
      ratio: c.width && c.height ? c.width / c.height : null,
      weightKg: c.weightKg,
      species: c.species,
      occurredAt: c.occurredAt,
    });
  }
  return out;
}

/** fish photoCaption: «{specie} · {kg} kg», only what is known; null when neither is. */
export function photoCaption(c: Pick<GalleryPhoto, 'species' | 'weightKg'>): string | null {
  return [c.species, c.weightKg != null ? `${fmtKg(c.weightKg)} kg` : null].filter(Boolean).join(' · ') || null;
}

/** The tile's accessible name: «Deschide fotografia: Crap · 3,4 kg», else «Deschide fotografia». */
export function tileLabel(c: Pick<GalleryPhoto, 'species' | 'weightKg'>): string {
  const caption = photoCaption(c);
  return caption ? `Deschide fotografia: ${caption}` : 'Deschide fotografia';
}

/**
 * fish subtitle (c1): «{membersLabel} · {photoCount} fotografii» — the members only when the
 * partidă has some, the count only once it is known (rule 4: never a guessed «0»). Plurals by
 * formatCount («1 fotografie», «20 de fotografii»).
 */
export function gallerySubtitle(members: readonly CommunityMemberDTO[] | null, photoCount: number | null): string | null {
  const who = members && members.length ? membersLabel([...members]) : null;
  const count = photoCount != null ? formatCount(photoCount, 'fotografie', 'fotografii') : null;
  return [who, count].filter(Boolean).join(' · ') || null;
}
