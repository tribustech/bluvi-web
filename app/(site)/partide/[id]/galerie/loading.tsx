import { GalleryFallback } from '@/app/(site)/balti/[id]/_sub/GalleryFallback';

/*
 * While the partidă and its first 30 photos are read (fish GalleryMasonrySkeleton under the header):
 * the gallery's own shape — the T1 header with «Galerie», the subtitle as a shimmer, the close
 * square, then the masonry skeleton (the lake gallery's fallback, read-only).
 */
export default function PartidaGalleryLoading() {
  return <GalleryFallback title="Galerie" />;
}
