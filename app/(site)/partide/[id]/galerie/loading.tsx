import { GalleryLoading } from './_gallery/GalleryLoading';

/*
 * While the partidă and its first 30 photos are read (fish GalleryMasonrySkeleton under the header):
 * the gallery's own shape — the T1 header with «Galerie», the subtitle as a shimmer, the round ✕ on
 * the right (as the screen), then the masonry skeleton.
 */
export default function PartidaGalleryLoading() {
  return <GalleryLoading />;
}
