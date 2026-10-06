'use client';

import { ShareIcon } from '@heroicons/react/24/outline';
import { useCallback, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Lightbox, type LightboxItem } from '@/components/surfaces/Lightbox';
import { plural } from '@/components/cards/format';
import { speciesChips } from '@/core/lakes';
import { fmtKg, type LakeCatchDTO } from '@/core/partide';
import { AnglerAvatar } from '../venue/bits';

/*
 * The Capturi section of a public water — fish PublicWaterSpeciesChips + PublicWaterCatchGrid
 * (MasonryGallery + ImageLightbox + CatchLightboxFooter).
 */

/** Server aggregate over every capture, most-caught first: six chips, then «+N». */
export function SpeciesChips({ species }: { species: { species: string; count: number }[] | undefined }) {
  const { shown, rest } = speciesChips(species);
  if (!shown.length) return null;
  return (
    <ul aria-label="Specii prinse" className="flex flex-wrap gap-1.5">
      {shown.map((s) => (
        <li key={s.species} className="flex items-center gap-1.25 rounded-full bg-soft-fill px-2.75 py-1.25 t-caption text-ink-2">
          {s.species}
          <span className="t-micro-strong text-ink">{s.count}</span>
        </li>
      ))}
      {rest > 0 ? (
        <li className="flex items-center rounded-full bg-soft-fill px-2.75 py-1.25 t-caption text-ink-2" aria-label={`încă ${plural(rest, 'specie', 'specii')}`}>
          +{rest}
        </li>
      ) : null}
    </ul>
  );
}

const caption = (c: LakeCatchDTO) => [c.species, c.weightKg != null ? `${fmtKg(c.weightKg)} kg` : null].filter(Boolean).join(' · ');
/** The detail grid's tile (fish PublicWaterCatchGrid: grid, else the original). */
const gridSrc = (c: LakeCatchDTO) => c.photoGridUrl ?? c.photoUrl ?? c.photoThumbUrl ?? null;
/** The gallery page's tile (fish VenueCatchesGalleryScreen, capturi.c4): grid → thumb → full, an empty URL skipped. */
export const galleryTileSrc = (c: LakeCatchDTO) => c.photoGridUrl || c.photoThumbUrl || c.photoUrl || null;
const fullSrc = (c: LakeCatchDTO) => c.photoUrl ?? c.photoGridUrl ?? c.photoThumbUrl ?? null;

/** Masonry tracks: columns auto-fill around this width (2 at least), 8px apart (gap-2). */
const TRACK_PX = 220;
const GAP_PX = 8;

/**
 * The masonry's column rule as CSS — the same maths as useMasonry: as many 220px tracks as fit
 * (8px apart), never fewer than two. The skeletons are laid on it, so the column count never
 * changes when the photos land.
 */
const MASONRY_COLUMNS = `repeat(auto-fill, minmax(min(${TRACK_PX}px, calc((100% - ${GAP_PX}px) / 2)), 1fr))`;

const SKELETON_RATIOS = [4, 3, 5, 3, 4, 5, 3, 4, 5, 4, 3, 5];

/** The masonry in grey (fish GalleryMasonrySkeleton): the real grid's columns, each tile at a photo-like ratio. */
export function MasonrySkeleton({ tiles = 12 }: { tiles?: number }) {
  return (
    <ul aria-hidden className="grid items-start gap-2" style={{ gridTemplateColumns: MASONRY_COLUMNS }} data-testid="masonry-skeleton">
      {Array.from({ length: tiles }, (_, i) => (
        <li key={i}>
          <span className="block w-full animate-shimmer rounded-card bg-soft-fill" style={{ aspectRatio: `3 / ${SKELETON_RATIOS[i % SKELETON_RATIOS.length]}` }} />
        </li>
      ))}
    </ul>
  );
}

const ratioOf = (c: LakeCatchDTO) => (c.photoWidth && c.photoHeight ? c.photoHeight / c.photoWidth : 4 / 3);

/**
 * The masonry, tiles placed absolutely: they stay in the DOM in the catches' order (newest first —
 * the reading and tab order), each in the shortest column so far, its top in exact pixels, so
 * every gap — across and down — is the same 8px. Placement only depends on the tiles before it, so
 * a page of 20 appended at the end never moves a tile already on screen. Columns auto-fill
 * (MASONRY_COLUMNS). Until the grid is measured (the server HTML, before hydration) it draws
 * nothing and the caller shows the skeleton on the same columns — the photos never paint in a
 * provisional layout that then jumps.
 */
function useMasonry(photos: LakeCatchDTO[]) {
  const [width, setWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLUListElement | null) => {
    observer.current?.disconnect();
    if (!el) return;
    setWidth(el.clientWidth);
    observer.current = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    observer.current.observe(el);
  }, []);
  const layout = useMemo(() => {
    if (!width) return null;
    const columns = Math.max(2, Math.floor((width + GAP_PX) / (TRACK_PX + GAP_PX)));
    const colPx = (width - GAP_PX * (columns - 1)) / columns;
    const tops = Array.from({ length: columns }, () => 0);
    const places = photos.map((c) => {
      const col = tops.indexOf(Math.min(...tops));
      const top = tops[col];
      tops[col] += ratioOf(c) * colPx + GAP_PX;
      return { left: col * (colPx + GAP_PX), top, width: colPx };
    });
    return { places, height: Math.max(0, Math.max(...tops) - GAP_PX) };
  }, [photos, width]);
  return [ref, layout] as const;
}

/** The `?foto=<clientId>` a shared catch carries: the page opens that photo once it is loaded. */
const FOTO_PARAM = 'foto';
const noSubscribe = () => () => {};
const readFotoParam = () => {
  try {
    return new URLSearchParams(window.location.search).get(FOTO_PARAM);
  } catch {
    return null;
  }
};

/**
 * The photo masonry: columns that fill top to bottom (2 on a phone, more as the column widens —
 * never wider tiles), each photo at its own ratio, the «<species> · <kg> kg» caption over its foot.
 *  - first page on its way: the masonry's own shape in shimmer (no «nicio captură» before the
 *    answer, no jump when it lands);
 *  - first page failed: nothing here (the community banner in Prezentare says it, with a retry);
 *  - answered with no photo: «Nicio captură cu poză pe această apă încă.» (c23).
 */
export function CatchGrid({
  catches,
  status,
  total,
  waterName,
  onEndReached,
  fetchingMore = false,
  moreFailed = false,
  onRetryMore,
  emptyText = 'Nicio captură cu poză pe această apă încă.',
  empty,
  tileSrc = gridSrc,
  faces = false,
}: {
  catches: LakeCatchDTO[];
  status: 'pending' | 'error' | 'success';
  /** The line when the venue answered with no photo (the gallery page says it its own way). */
  emptyText?: string;
  /** The whole empty state instead of the line (the gallery page's state card). */
  empty?: ReactNode;
  /** The server's total (the lightbox's «din M»). */
  total: number;
  waterName: string;
  onEndReached?: () => void;
  /** The next page is on its way / failed (the lightbox says so at its last loaded photo). */
  fetchingMore?: boolean;
  moreFailed?: boolean;
  onRetryMore?: () => void;
  /** The tile's photo (default: the detail grid's order). */
  tileSrc?: (c: LakeCatchDTO) => string | null;
  /** The lightbox shows the angler's face beside the name (fish members={[c.angler]} on the gallery page). */
  faces?: boolean;
}) {
  const photos = useMemo(() => catches.filter((c) => tileSrc(c)), [catches, tileSrc]);
  const [gridRef, masonry] = useMasonry(photos);
  // The open photo by id (it stays the same photo when the next page lands). Until the user opens
  // or closes one, a shared catch's `?foto=` opens it — once its page is here (the first, as a rule).
  const fotoParam = useSyncExternalStore(noSubscribe, readFotoParam, () => null);
  const [openId, setOpenId] = useState<string | null | undefined>(undefined);
  const shownId = openId === undefined ? fotoParam : openId;
  const found = shownId ? photos.findIndex((c) => c.clientId === shownId) : -1;
  const open = found >= 0 ? found : null;
  const setOpen = (i: number | null) => setOpenId(i == null ? null : (photos[i]?.clientId ?? null));
  // fish `openedInitial`: `?foto=` is looked up ONCE, in the first catches that arrive; a catch that
  // is not there is ignored (a later page never opens it out of the blue).
  const fotoMissing = openId === undefined && fotoParam != null && photos.length > 0 && found < 0;
  // Adjusted while rendering (React's «storing information from previous renders»), not in an effect.
  if (fotoMissing) setOpenId(null);

  if (!photos.length) {
    if (status === 'pending') {
      return (
        <div>
          <p role="status" className="sr-only">
            Se încarcă capturile…
          </p>
          <MasonrySkeleton tiles={6} />
        </div>
      );
    }
    if (status === 'error') return null;
    if (empty) return <>{empty}</>;
    return <p className="t-body-strong text-muted" data-testid="catches-empty">{emptyText}</p>;
  }
  return (
    <>
      {masonry ? null : <MasonrySkeleton tiles={Math.min(12, photos.length)} />}
      <ul ref={gridRef} className="relative" style={{ height: masonry?.height ?? 0 }} data-testid="catch-grid">
        {masonry
          ? photos.map((c, i) => {
              const cap = caption(c);
              const at = masonry.places[i];
              return (
                <li key={c.clientId} className="absolute" style={{ left: at.left, top: at.top, width: at.width }}>
                  <button
                    type="button"
                    onClick={() => setOpen(i)}
                    aria-label={`Deschide fotografia${cap ? `: ${cap}` : ''}`}
                    className="group relative block w-full cursor-pointer overflow-hidden rounded-card bg-soft-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    style={{ aspectRatio: c.photoWidth && c.photoHeight ? `${c.photoWidth} / ${c.photoHeight}` : '3 / 4' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- CMS photo variants (S3 / local uploads), already sized for the grid. */}
                    <img src={tileSrc(c) as string} alt="" loading="lazy" className="size-full object-cover transition-transform duration-(--duration-slow) group-hover:scale-[1.02]" />
                    {cap ? (
                      <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-photo-scrim to-transparent px-2.5 pt-6 pb-2 text-left t-label text-on-photo-scrim">
                        {cap}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })
          : null}
      </ul>
      <CatchLightbox
        catches={photos}
        total={Math.max(total, photos.length)}
        index={open}
        onIndex={setOpen}
        waterName={waterName}
        onEndReached={onEndReached}
        fetchingMore={fetchingMore}
        moreFailed={moreFailed}
        onRetryMore={onRetryMore}
        faces={faces}
      />
    </>
  );
}

const DATE = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bucharest' });

const ROUND = 'flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-photo-scrim hover:bg-navy';

/**
 * fish ImageLightbox + CatchLightboxFooter on the kit Lightbox: the photo whole, the big kg,
 * species · date, the angler; ← / → (and the arrow keys, a swipe on touch) page through every
 * loaded catch, reaching the end asks for the next page; «Distribuie» shares the catch with the
 * water's name and a link that reopens THIS photo (`?foto=<clientId>`; the system share sheet, or
 * the link copied). Escape / ✕ / a click on the dark ground closes; focus returns to the photo.
 * Deviation from fish c24 (not counted as passing): fish hands the catch to the Bluvi share card
 * (ShareCatchSheet, the water's name burned into the image); the web has no share-card renderer
 * yet, so the link is the stand-in.
 */
export function CatchLightbox({
  catches,
  total,
  index,
  onIndex,
  waterName,
  onEndReached,
  fetchingMore = false,
  moreFailed = false,
  onRetryMore,
  faces = false,
}: {
  catches: LakeCatchDTO[];
  total: number;
  index: number | null;
  onIndex: (i: number | null) => void;
  waterName: string;
  onEndReached?: () => void;
  fetchingMore?: boolean;
  moreFailed?: boolean;
  onRetryMore?: () => void;
  faces?: boolean;
}) {
  const [sharedAt, setSharedAt] = useState<number | null>(null);
  const items = useMemo<LightboxItem[]>(
    () => catches.map((c) => ({ key: c.clientId, src: fullSrc(c) as string, alt: caption(c) || 'Captură' })),
    [catches],
  );

  const share = async (i: number) => {
    const c = catches[i];
    if (!c) return;
    const text = [caption(c), waterName].filter(Boolean).join(' · ');
    const link = new URL(window.location.href);
    link.hash = '';
    link.search = '';
    link.searchParams.set(FOTO_PARAM, c.clientId);
    const url = link.toString();
    try {
      if (navigator.share) await navigator.share({ title: `Captură pe ${waterName}`, text, url });
      else {
        await navigator.clipboard.writeText(`${text} — ${url}`);
        setSharedAt(i);
      }
    } catch {
      // dismissed
    }
  };

  return (
    <Lightbox
      items={items}
      index={index}
      onIndex={onIndex}
      total={total}
      label="Capturi"
      title={(n, of) => `Captura ${n} din ${of}`}
      moreFailedText="Nu am putut încărca mai multe capturi."
      onEndReached={onEndReached}
      fetchingMore={fetchingMore}
      moreFailed={moreFailed}
      onRetryMore={onRetryMore}
      headerStart={(_, i) => (
        <>
          <button type="button" onClick={() => void share(i)} aria-label="Distribuie captura" className={ROUND}>
            <ShareIcon aria-hidden className="size-6" />
          </button>
          <span role="status" className="sr-only">
            {sharedAt !== null && sharedAt === i ? 'Linkul a fost copiat.' : ''}
          </span>
        </>
      )}
      footer={(_, i) => {
        const c = catches[i];
        if (!c) return null;
        return (
          <>
            {c.weightKg != null ? (
              <p className="flex items-baseline gap-1.25">
                <span className="t-display">{fmtKg(c.weightKg)}</span>
                <span className="t-heading text-lavender-3">kg</span>
              </p>
            ) : null}
            <p className="t-body text-lavender-3">{[c.species, DATE.format(new Date(c.occurredAt))].filter(Boolean).join(' · ')}</p>
            {faces ? (
              <p className="mt-1 flex min-w-0 items-center gap-2.25" data-testid="lightbox-angler">
                <AnglerAvatar uid={c.angler.uid} name={c.angler.name ?? ''} src={c.angler.avatarUrl} size={32} />
                {c.angler.name ? <span className="truncate t-body-strong">{c.angler.name}</span> : null}
              </p>
            ) : c.angler.name ? (
              <p className="mt-1 truncate t-body-strong">{c.angler.name}</p>
            ) : null}
          </>
        );
      }}
    />
  );
}
