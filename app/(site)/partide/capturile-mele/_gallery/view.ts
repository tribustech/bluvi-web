import { fmtKg } from '@/core/partide';
import { formatCount } from '@/core/realtime/chat/format';
import type { AnglerCatch } from '@/core/social';

/*
 * Pure helpers of «Capturile mele» (fish features/partide/screens/MyCatchesGalleryScreen.tsx).
 */

/**
 * fish dedupeByKey over every loaded page: cursor pages can repeat a row across a page boundary,
 * so a photo never appears twice (c2). First occurrence wins, order kept.
 */
export function dedupeCatches(pages: readonly { data: readonly AnglerCatch[] }[] | undefined): AnglerCatch[] {
  const seen = new Set<string>();
  const out: AnglerCatch[] = [];
  for (const c of (pages ?? []).flatMap(p => p.data)) {
    if (seen.has(c.key)) continue;
    seen.add(c.key);
    out.push(c);
  }
  return out;
}

/**
 * fish's subtitle (c1): «{total} captură/capturi», only once there is a catch — never «0 capturi»
 * over the empty state. Romanian plurals with «de» from 20 (formatCount).
 */
export function catchesSubtitle(total: number, loaded: number): string | null {
  if (loaded === 0) return null;
  return formatCount(Math.max(total, loaded), 'captură', 'capturi');
}

/** The tile's ratio (width / height) from the photo's pixels; unknown → null (the masonry's 4:3). */
export function catchRatio(c: Pick<AnglerCatch, 'photoWidth' | 'photoHeight'>): number | null {
  return c.photoWidth && c.photoHeight ? c.photoWidth / c.photoHeight : null;
}

/** The tile's accessible name: «Deschide captura: 12,5 kg, Crap, Balta Chita». */
export function catchTileLabel(c: Pick<AnglerCatch, 'weightKg' | 'species' | 'venueName' | 'competitionName' | 'source'>): string {
  const what = [
    c.weightKg != null ? `${fmtKg(c.weightKg)} kg` : null,
    c.species,
    c.venueName,
    c.source === 'competition' ? c.competitionName : null,
  ].filter(Boolean);
  return what.length ? `Deschide captura: ${what.join(', ')}` : 'Deschide captura';
}
