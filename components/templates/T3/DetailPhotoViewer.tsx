'use client';

import { createContext, use, useState, type ReactNode } from 'react';
import { Squares2X2Icon } from '@heroicons/react/24/outline';
import { Lightbox } from '@/components/surfaces/Lightbox';
import { cn } from '@/components/ui/cn';
import { SHOW_ALL_CLASS } from './photoClasses';

/*
 * The photo grid's viewer (owner rule 1, ROADMAP §4b — the Airbnb detail page): from 768 every tile
 * of <DetailPhotoHero viewer> opens the kit Lightbox on its photo, and «Vezi toate fotografiile»
 * opens it on the first. The phone keeps the fish carousel (swipe), so the tile buttons and the
 * show-all button are md-only. The photos are the hero's own list (the same `src`s, already in the
 * browser's cache), so the lightbox's first frame is instant.
 */

type Photo = { src: string; alt?: string };
type Ctx = { open: (i: number) => void; count: number };
const ViewerContext = createContext<Ctx | null>(null);

export function DetailPhotoViewer({ photos, label, children }: { photos: Photo[]; label: string; children: ReactNode }) {
  const [index, setIndex] = useState<number | null>(null);
  const items = photos.map((p, i) => ({ key: `${p.src}-${i}`, src: p.src, preview: p.src, alt: p.alt || `${label} — ${i + 1}` }));
  return (
    <ViewerContext value={{ open: setIndex, count: photos.length }}>
      {children}
      <Lightbox items={items} index={index} onIndex={setIndex} total={items.length} label={label} />
    </ViewerContext>
  );
}

/** A grid tile's click target (from 768): the whole tile. */
export function DetailPhotoTileButton({ index, label }: { index: number; label: string }) {
  const ctx = use(ViewerContext);
  if (!ctx) return null;
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={label}
      onClick={() => ctx.open(index)}
      className={cn(
        // The tile's photo darkens on hover (DetailPhotoHero: group/tile).
        'absolute inset-0 cursor-pointer max-md:hidden focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-accent',
      )}
    />
  );
}

/** «Vezi toate fotografiile» (Airbnb «Show all photos»): a white pill on the grid's bottom-right, from 768. */
export function DetailPhotoShowAll({ className }: { className?: string }) {
  const ctx = use(ViewerContext);
  if (!ctx || ctx.count < 2) return null;
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={() => ctx.open(0)}
      className={cn(SHOW_ALL_CLASS, className)}
    >
      <Squares2X2Icon aria-hidden />
      Vezi toate fotografiile ({ctx.count})
    </button>
  );
}
