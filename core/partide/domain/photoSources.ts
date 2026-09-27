// Ported from fish `features/partide/community/photoSources.ts` (pure).
/**
 * Picks the right catch-photo variant per surface, tolerating the pre-variant
 * response shape. The fallback is permanent, not a migration aid: finished
 * sessions are edge-cached for up to 30 days, so an old-shaped response can
 * arrive long after the CMS ships.
 */
type PhotoBearing = {
  photoUrl: string | null;
  photoGridUrl?: string | null;
  photoThumbUrl?: string | null;
};

/** 2-column masonry, ~537px @3x -> medium. */
export const gridSource = (c: PhotoBearing): string | null => c.photoGridUrl ?? c.photoUrl;

/** 38-52pt tiles -> thumbnail. */
export const thumbSource = (c: PhotoBearing): string | null => c.photoThumbUrl ?? c.photoUrl;

/** Full-screen lightbox and share -> xlarge (or original on legacy files). */
export const fullSource = (c: PhotoBearing): string | null => c.photoUrl;
