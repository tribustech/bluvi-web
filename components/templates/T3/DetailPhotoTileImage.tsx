'use client';

import Image, { type ImageProps } from 'next/image';
import { useState, type ReactNode } from 'react';
import { PhotoIcon } from '@heroicons/react/24/outline';

/*
 * One photo of the T3 hero (DetailPhotoHero): next/image, and when the photo fails to load (a
 * deleted S3 object, a 404) `fallback` fills the tile instead — never the browser's broken-image
 * glyph (the kit rule, as AvatarPhoto / Lightbox / the partidă's SafeImg). next/image replays an
 * error that happened before hydration (it re-sets `src` once mounted when `onError` is given).
 * Default fallback: the quiet tile's photo icon on the soft fill.
 */
export function DetailPhotoTileImage({ fallback, ...props }: ImageProps & { fallback?: ReactNode }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span data-t3="photo-failed" aria-hidden className="absolute inset-0 flex items-center justify-center bg-soft-fill text-muted [&>svg]:size-6">
        {fallback ?? <PhotoIcon />}
      </span>
    );
  }
  // eslint-disable-next-line jsx-a11y/alt-text -- `alt` is in props (the hero passes it).
  return <Image {...props} onError={() => setFailed(true)} />;
}
