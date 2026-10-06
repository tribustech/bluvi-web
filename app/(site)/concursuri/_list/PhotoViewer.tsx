'use client';

import { useId, useState } from 'react';
import { ArrowRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { CalendarIcon, MapPinIcon, TrophyIcon, UserIcon, UsersIcon } from '@heroicons/react/20/solid';
import { PhotoDialog } from '@/components/surfaces/Lightbox';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { cardRankingLabel, formatKg, formatTotalKg, photoEntrantsLabel, type CompetitionCard } from '@/core/competitions';
import { blurDataUrl } from '@/lib/blurhash';
import type { PhotoRequest } from './CompetitionCardItem';

/*
 * The card's photo, full screen over the list — fish MediaViewer (as the chat uses it) with
 * CompetitionPhotoCaption (parity competitions-list.index.c26, cards.c18): the competition name as
 * the sender, its dateLabel as the time, the caption over the photo, and «Vezi concursul», which
 * closes the viewer and opens the competition. Closing (✕, Escape, a click on the dark ground)
 * returns to the list unchanged; focus goes back to the poster that opened it (the kit PhotoDialog,
 * the Lightbox's full-screen frame).
 *
 * The original upload can be several MB: as in fish MediaViewer, the card's thumbnail (already in
 * the browser's cache) and its blurhash are drawn first and the original fades in over them once it
 * decodes. If it fails, the thumbnail stays with «Imaginea nu a putut fi încărcată» under it.
 */

export function PhotoViewer({ photo, onClose, onOpenCompetition }: { photo: PhotoRequest | null; onClose: () => void; onOpenCompetition: (id: string) => void }) {
  const titleId = useId();
  const c = photo?.competition;
  return (
    <PhotoDialog open={photo !== null} onClose={onClose} labelledBy={titleId}>
      {photo && c ? (
        <>
          <div className="flex items-center gap-3 px-4 pt-3 pb-2 md:px-6">
            <div className="min-w-0 flex-1">
              <p id={titleId} className="truncate t-body-strong">
                {c.name}
              </p>
              <p className="t-caption text-lavender-3">{c.dateLabel}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Închide imaginea"
              className="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-photo-scrim hover:bg-navy"
            >
              <XMarkIcon aria-hidden className="size-6" />
            </button>
          </div>
          {/* The photo, whole (contain), at its own ratio; a click outside it closes. */}
          <div
            className="relative min-h-0 flex-1 px-2 md:px-6"
            onClick={(e) => {
              if (e.target === e.currentTarget) onClose();
            }}
          >
            <ViewerImage key={photo.url} photo={photo} alt={`Afișul concursului ${c.name}`} />
          </div>
          <div className="flex flex-col gap-4 bg-linear-to-t from-ink via-ink to-transparent px-4 pt-6 pb-[max(--spacing(4),env(safe-area-inset-bottom))] md:px-6 md:pb-6">
            <PhotoCaption c={c} />
            <Button
              variant="secondary"
              className="self-start"
              onClick={() => onOpenCompetition(c.documentId)}
              iconRight={<ArrowRightIcon />}
            >
              Vezi concursul
            </Button>
          </div>
        </>
      ) : null}
    </PhotoDialog>
  );
}

/** The original over its thumbnail and blur; it fades in on load, and a failure keeps the thumbnail. */
function ViewerImage({ photo, alt }: { photo: PhotoRequest; alt: string }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const blur = blurDataUrl(photo.blurhash ?? undefined);
  const thumb = photo.thumbnailUrl && photo.thumbnailUrl !== photo.url ? photo.thumbnailUrl : null;
  return (
    <div className="relative mx-auto flex size-full flex-col items-center justify-center gap-3">
      <div className="relative size-full min-h-0 flex-1">
        {state !== 'loaded' && (blur || thumb) ? (
          // eslint-disable-next-line @next/next/no-img-element -- the cached card thumbnail / a data URL, not an optimizable remote.
          <img
            aria-hidden={state === 'failed' ? undefined : true}
            alt={state === 'failed' ? alt : ''}
            src={thumb ?? blur!}
            width={photo.width}
            height={photo.height}
            className="absolute inset-0 size-full object-contain"
            // The blur paints while the thumbnail itself is still arriving.
            style={thumb && blur ? { backgroundImage: `url(${blur})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : undefined}
          />
        ) : null}
        {state === 'failed' ? null : (
          // eslint-disable-next-line @next/next/no-img-element -- the original, at its own size: no optimizer variant fits a full-screen zoom.
          <img
            src={photo.url}
            alt={alt}
            width={photo.width}
            height={photo.height}
            onLoad={() => setState('loaded')}
            onError={() => setState('failed')}
            className={cn(
              'relative size-full object-contain transition-opacity duration-(--duration-medium) ease-medium',
              state === 'loaded' ? 'opacity-100' : 'opacity-0',
            )}
          />
        )}
      </div>
      {state === 'failed' ? (
        <p role="status" className="shrink-0 t-body text-lavender-3">
          Imaginea nu a putut fi încărcată
        </p>
      ) : null}
    </div>
  );
}

/** fish CompetitionPhotoCaption: what the competition is, over its own photo (c18). */
function PhotoCaption({ c }: { c: CompetitionCard }) {
  const team = c.format.kind === 'team';
  const live = c.status === 'started';
  const r = c.results;
  return (
    <div className="flex max-w-180 flex-col gap-2.25">
      <h2 className="line-clamp-3 t-title1">{c.name}</h2>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 t-caption text-lavender-3">
        {c.lake ? (
          <span className="flex items-center gap-1">
            <MapPinIcon aria-hidden className="size-3.5" />
            {c.lake.name}
          </span>
        ) : null}
        <span className="flex items-center gap-1">
          <CalendarIcon aria-hidden className="size-3.5" />
          {live ? `LIVE · ${c.dateLabel}` : c.dateLabel}
        </span>
      </p>
      {/* The card's colours, on opaque fills (a photo can be any colour under them). */}
      <div className="flex flex-wrap gap-1.5">
        <Badge color="yellow" icon={<TrophyIcon aria-hidden />} className="bg-surface">
          {cardRankingLabel(c)}
        </Badge>
        <Badge color="green" icon={team ? <UsersIcon aria-hidden /> : <UserIcon aria-hidden />} className="bg-surface">
          {team ? (c.format.teamSize ? `Echipe de ${c.format.teamSize}` : 'Echipe') : 'Individual'}
        </Badge>
        <span className="inline-flex items-center rounded-badge bg-photo-scrim px-1.25 py-0.5 t-label">{photoEntrantsLabel(c)}</span>
      </div>
      {r?.hasCatches ? (
        <p className="flex flex-wrap gap-x-3.5 gap-y-1">
          <Stat value={String(r.catchCount)} label="capturi" />
          {r.totalKg !== null ? <Stat value={`${formatTotalKg(r.totalKg)} kg`} label="cântărite" /> : null}
          {r.biggestFishKg !== null ? <Stat value={`${formatKg(r.biggestFishKg)} kg`} label="CMMC" /> : null}
        </p>
      ) : null}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="t-body-strong">{value}</span>
      <span className="t-micro text-lavender-3">{label}</span>
    </span>
  );
}
