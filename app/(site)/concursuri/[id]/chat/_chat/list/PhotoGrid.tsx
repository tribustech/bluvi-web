'use client';

import type { ReactNode } from 'react';
import type { chat } from '@/core/realtime';
import { blurDataUrl } from '@/lib/blurhash';
import { cn } from '@/components/ui/cn';
import { photoLayout } from './model';
import { UploadRing } from './UploadRing';

/*
 * fish MessageBubble AttachmentGrid (participant.chat c20; core-free layout in ./model.ts
 * photoLayout): one photo fills a 260-wide frame at its ratio clamped between 3:4 and 16:10; 2–4 are
 * a square two-column grid; more show the first four with «+{n-3}» over the fourth. Each tile is a
 * button «Imagine {i} din {n}» (opens the room's viewer, c21); the blurhash stands under the photo
 * while it loads; a photo still uploading turns a ring over it. `meta`: a caption-less photo carries
 * the time (and my ticks) on its bottom edge, over a soft dark gradient.
 */
export function PhotoGrid({
  attachments,
  uploading,
  onOpen,
  meta,
  className,
}: {
  attachments: chat.ChatAttachment[];
  uploading: boolean;
  onOpen?: (index: number) => void;
  meta?: ReactNode;
  className?: string;
}) {
  const layout = photoLayout(attachments);
  if (!layout) return null;
  const count = attachments.length;
  return (
    <div className={cn('relative flex max-w-full flex-wrap gap-0.5', className)} style={{ width: layout.width }}>
      {layout.tiles.map(tile => {
        const a = attachments[tile.index];
        const blur = blurDataUrl(a.blurhash);
        return (
          <button
            key={`${a.id}-${tile.index}`}
            type="button"
            disabled={!onOpen}
            onClick={e => {
              e.stopPropagation();
              onOpen?.(tile.index);
            }}
            aria-label={`Imagine ${tile.index + 1} din ${count}`}
            aria-haspopup="dialog"
            className="relative block cursor-pointer overflow-hidden bg-soft-fill bg-cover bg-center outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent disabled:cursor-default"
            style={{ width: layout.kind === 'single' ? '100%' : tile.width, aspectRatio: `${tile.width} / ${tile.height}`, backgroundImage: blur ? `url(${blur})` : undefined }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- chat attachments (CMS / blob URLs), sized by the grid */}
            <img src={a.thumbnailUrl || a.url} alt="" loading="lazy" decoding="async" draggable={false} className="size-full object-cover" />
            {uploading ? <UploadRing /> : null}
            {tile.overflow > 0 ? (
              <span className="absolute inset-0 flex items-center justify-center bg-photo-scrim t-display text-on-photo-scrim">+{tile.overflow}</span>
            ) : null}
          </button>
        );
      })}
      {meta ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex h-11 items-end justify-end bg-linear-to-b from-transparent to-photo-scrim px-2.5 pb-1.5 text-on-photo-scrim">{meta}</span>
      ) : null}
    </div>
  );
}
