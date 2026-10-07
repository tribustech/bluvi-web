'use client';

import { ShareIcon } from '@heroicons/react/24/outline';
import { useMemo, useState } from 'react';
import { anglerCatchShareTarget } from '@/components/partide/CatchLightbox';
import { ShareCatchSheet } from '@/components/partide/share/ShareCatchSheet';
import { Lightbox, type LightboxItem } from '@/components/surfaces/Lightbox';
import { cn } from '@/components/ui/cn';
import { fmtCatchDate, fmtProfileKg, type AnglerCatch } from '@/core/social';
import { blurDataUrl } from '@/lib/blurhash';
import { CatchLightboxFooter } from './CatchLightboxFooter';
import { CATCH_GRID } from './frame';

/*
 * Capturi — fish AnglerProfileScreen's photo grid (parity account.angler-profile c17–c20).
 *  - Phone: three square columns 2px apart, edge to edge (fish GRID_COLUMNS 3, GRID_GAP 2). From
 *    768 the grid auto-fills more columns (never wider tiles: ROADMAP §4 width rule), 6px apart,
 *    the tiles rounded inside the page gutters.
 *  - Each tile draws `photoGridUrl` (the medium rendition; fallback `photoUrl`) over its blurhash.
 *  - Activating a tile opens the kit Lightbox on it (original photo, ← → / swipe, Escape), with
 *    fish's CatchDetailFooter; paging to the last loaded catch asks for the next page (c20).
 *  - c21: «Distribuie captura» on the open photo (fish ImageLightbox `shareable` + onShare,
 *    AnglerProfileScreen.tsx:348-370 — on every profile, own or not) closes the lightbox and opens
 *    partide's ShareCatchSheet (the composed card: photo, kg, venue, species, the competition of a
 *    competition catch — fish anglerCatchToShareEvent), never the bare photo.
 */

const ROUND =
  'flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-photo-scrim hover:bg-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-photo-scrim';


const gridSrc = (c: AnglerCatch) => c.photoGridUrl || c.photoUrl;

/** «Captură: 12,4 kg · Crap, 5 SEP 2025» — the tile's and the photo's name. */
export function catchName(c: AnglerCatch): string {
  const what = [c.weightKg != null ? `${fmtProfileKg(c.weightKg)} kg` : null, c.species].filter(Boolean).join(' · ');
  return `Captură${what ? `: ${what}` : ''}, ${fmtCatchDate(c.date)}`;
}

export function CatchGrid({
  catches,
  total,
  onLoadMore,
  fetchingMore,
  moreFailed,
}: {
  catches: AnglerCatch[];
  /** Every catch there is (meta.pagination.total): the lightbox's «N din M». */
  total: number;
  onLoadMore: () => void;
  fetchingMore: boolean;
  moreFailed: boolean;
}) {
  // The open catch by key, so it stays the same photo when the next page lands.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const index = openKey ? catches.findIndex(c => c.key === openKey) : -1;
  const items = useMemo<LightboxItem[]>(
    () => catches.map(c => ({ key: c.key, src: c.photoUrl, preview: gridSrc(c), alt: catchName(c) })),
    [catches],
  );
  const byKey = useMemo(() => new Map(catches.map(c => [c.key, c])), [catches]);
  const [sharing, setSharing] = useState<AnglerCatch | null>(null);
  const shareTarget = useMemo(() => (sharing ? anglerCatchShareTarget(sharing) : null), [sharing]);
  // fish shareHandoff: the lightbox closes first, then the share sheet opens over the page.
  const share = (key: string) => {
    const c = byKey.get(key);
    if (!c) return;
    setOpenKey(null);
    setSharing(c);
  };

  return (
    <>
      <ul className={CATCH_GRID} data-testid="catch-grid">
        {catches.map(c => (
          <li key={c.key} className="flex">
            <CatchTile c={c} onOpen={() => setOpenKey(c.key)} />
          </li>
        ))}
      </ul>
      <Lightbox
        items={items}
        index={index >= 0 ? index : null}
        onIndex={i => setOpenKey(i == null ? null : (catches[i]?.key ?? null))}
        total={Math.max(total, catches.length)}
        label="Capturi"
        headerStart={item => (
          <button type="button" onClick={() => share(item.key)} aria-label="Distribuie captura" className={ROUND}>
            <ShareIcon aria-hidden className="size-6" />
          </button>
        )}
        footer={item => {
          const c = byKey.get(item.key);
          return c ? <CatchLightboxFooter item={c} /> : null;
        }}
        onEndReached={onLoadMore}
        fetchingMore={fetchingMore}
        moreFailed={moreFailed}
        onRetryMore={onLoadMore}
        moreFailedText="Nu am putut încărca mai multe capturi."
      />
      <ShareCatchSheet
        target={shareTarget}
        lakeName={sharing?.venueName ?? ''}
        competitionName={sharing?.source === 'competition' ? sharing.competitionName : null}
        onClose={() => setSharing(null)}
      />
    </>
  );
}

function CatchTile({ c, onOpen }: { c: AnglerCatch; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  const blur = useMemo(() => blurDataUrl(c.blurhash), [c.blurhash]);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={catchName(c)}
      data-testid="catch-tile"
      className={cn(
        'group relative block aspect-square w-full cursor-pointer overflow-hidden bg-soft-fill bg-cover bg-center md:rounded-control',
        'focus-visible:z-above focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent md:focus-visible:outline-offset-2',
      )}
      style={blur ? { backgroundImage: `url("${blur}")` } : undefined}
    >
      {failed ? null : (
        // eslint-disable-next-line @next/next/no-img-element -- CMS grid rendition, already sized for the tile.
        <img
          src={gridSrc(c)}
          alt=""
          loading="lazy"
          decoding="async"
          ref={img => {
            // A photo that failed before hydration (its onError fired before React listened).
            if (img && img.complete && img.naturalWidth === 0 && img.src) setFailed(true);
          }}
          onError={() => setFailed(true)}
          className="size-full object-cover transition-transform duration-(--duration-slow) group-hover:scale-[1.03] motion-reduce:transition-none"
        />
      )}
    </button>
  );
}
