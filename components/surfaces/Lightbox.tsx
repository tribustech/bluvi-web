'use client';

import { ChevronLeftIcon, ChevronRightIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEventHandler, type ReactNode } from 'react';
// The overlay module, not the T2 barrel: the barrel drags T2Map (supercluster, maplibre CSS) along.
import { T2Spinner } from '@/components/templates/T2/T2MapOverlay';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { fmtKg } from '@/core/partide';
import { useModalDialog } from './useModalDialog';

/*
 * fish ImageLightbox + CatchLightboxFooter (lakes.gallery.c8, lakes.catches.c5): the photo whole
 * on black, swiping through every loaded item from the one activated. Web: ← / → buttons and the
 * arrow keys page, «N din M» names the place, Escape / ✕ / a click on the dark ground closes and
 * focus returns to the tile (native <dialog>). A catch carries fish's footer — the big kg, species
 * · date, the angler. Reaching the last loaded item asks for the next page (fish `onEndReached`);
 * while it loads «→» is busy, a failed page says so with a retry. The arrows stay in place at the
 * ends (aria-disabled), so keyboard focus never drops to the page behind. On touch the photos sit
 * on a scroll-snap track (fish's paging FlatList — the primary gesture on a phone): the photo
 * follows the finger and the neighbour slides in, the browser's own momentum and snap, one page per
 * swipe (owner 2026-10-11: a swipe that only switched on release felt broken). Only the current
 * photo and its neighbours are drawn; the other slides are empty boxes. A photo that fails to
 * load shows a muted photo glyph, never the browser's broken image. While the original downloads,
 * the tile's grid rendition (already in the browser's cache) stands in, blurred, with a spinner and
 * «Se încarcă fotografia…» announced — never a black stage that looks broken; the neighbours'
 * originals are preloaded so paging is instant.
 *
 * Kit surface: a lake's Galerie and Capturi, a public water's catches. A host can name the place its
 * own way (`title`), put an action left of the title (`headerStart`, e.g. «Distribuie»), word the
 * failed next page (`moreFailedText`) and draw its own footer (`footer`); `PhotoDialog` is the bare
 * full-screen dark dialog for a single photo with its own chrome (the competition poster viewer).
 */

export type LightboxCatch = {
  weightKg: number | null;
  species: string | null;
  occurredAt: string;
  anglerName: string | null;
  /** fish CatchLightboxFooter `members` (the catches page only): the angler's ringed avatar by the name. */
  angler?: { uid: string; name: string | null; avatarUrl: string | null };
};
export type LightboxItem = {
  key: string;
  /** The original (it can be several MB). */
  src: string;
  /** The grid rendition the tile already loaded: drawn blurred under the original while it downloads. */
  preview?: string;
  alt: string;
  catch?: LightboxCatch;
};

const ARROW =
  'absolute top-1/2 flex size-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-photo-scrim hover:bg-navy aria-disabled:cursor-default aria-disabled:text-faint aria-disabled:hover:bg-photo-scrim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-photo-scrim';
const ROUND =
  'flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-photo-scrim hover:bg-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-photo-scrim';

const DATE = new Intl.DateTimeFormat('ro-RO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Bucharest',
});

export function catchDate(occurredAt: string): string {
  const d = new Date(occurredAt);
  return Number.isNaN(d.getTime()) ? '' : DATE.format(d);
}

export function Lightbox({
  items,
  index,
  onIndex,
  total,
  label,
  title,
  headerStart,
  moreFailedText,
  footer,
  onEndReached,
  fetchingMore = false,
  moreFailed = false,
  onRetryMore,
}: {
  items: LightboxItem[];
  index: number | null;
  onIndex: (i: number | null) => void;
  /** Every item there is (loaded or not): «N din M», and whether «→» waits for a page at the end. */
  total: number;
  /** What the dialog shows («Galerie», «Capturi»): the default title «{label} · N din M». */
  label: string;
  /** The title for item `n` (1-based) of `total` — replaces «{label} · N din M». */
  title?: (n: number, total: number) => string;
  /** An action left of the title (a 48px round button); the slot is an empty 48px box without it. */
  headerStart?: (item: LightboxItem, index: number) => ReactNode;
  /** The line when the next page failed («Nu am putut încărca mai multe fotografii.»). */
  moreFailedText?: string;
  /** The footer under the photo for the current item; by default the catch footer (`item.catch`). */
  footer?: (item: LightboxItem, index: number) => ReactNode;
  onEndReached?: () => void;
  fetchingMore?: boolean;
  moreFailed?: boolean;
  onRetryMore?: () => void;
}) {
  const open = index !== null && items[index] != null;
  const titleId = useId();
  const item = open ? items[index] : null;
  const last = index != null && index >= items.length - 1;
  const more = last && index != null && index + 1 < total;
  const waiting = more && fetchingMore;
  const stuck = more && moreFailed && !fetchingMore;
  const endRef = useRef(onEndReached);
  useEffect(() => {
    endRef.current = onEndReached;
  });
  useEffect(() => {
    if (open && last) endRef.current?.();
  }, [open, last, index]);

  // The neighbours' originals start downloading while this one is looked at (fish's paging list).
  useEffect(() => {
    if (index == null) return;
    for (const n of [items[index - 1], items[index + 1]]) {
      if (n?.src) new Image().src = n.src;
    }
  }, [index, items]);

  // The track follows `index`: instantly when the dialog opens, smoothly for an arrow or key. A
  // swipe moves the track first and reports the page it settled on, so the effect finds it in place.
  const track = useRef<HTMLDivElement>(null);
  const smooth = useRef(false);
  // The latest index, and the page an arrow / key scroll is heading to: while it travels, the
  // pages it passes are not «settled» (only a swipe's resting page is reported).
  const current = useRef(index);
  const heading = useRef<number | null>(null);
  useLayoutEffect(() => {
    current.current = index;
    const el = track.current;
    if (!el || index == null) return;
    const left = index * el.clientWidth;
    if (Math.abs(el.scrollLeft - left) > 1) {
      heading.current = smooth.current ? index : null;
      el.scrollTo({ left, behavior: smooth.current ? 'smooth' : 'instant' });
    }
    smooth.current = false;
  }, [index, open]);

  const go = (d: number) => {
    if (index == null) return;
    const next = index + d;
    if (next < 0 || next >= items.length) return;
    smooth.current = true;
    onIndex(next);
  };

  // The page the track rests on (scrollend; a short quiet period where it is not supported).
  const settle = useRef<number | undefined>(undefined);
  const onSettled = () => {
    const el = track.current;
    const now = current.current;
    if (!el || now == null || !el.clientWidth) return;
    const page = Math.round(el.scrollLeft / el.clientWidth);
    if (heading.current != null) {
      if (page === heading.current) heading.current = null;
      return;
    }
    if (page !== now && page >= 0 && page < items.length) onIndex(page);
  };
  useEffect(() => () => window.clearTimeout(settle.current), []);
  const c = item?.catch;
  const secondary = c ? [c.species, catchDate(c.occurredAt)].filter(Boolean).join(' · ') : '';

  return (
    <PhotoDialog
      open={open}
      onClose={() => onIndex(null)}
      labelledBy={titleId}
      data-testid="lightbox"
      onKeyDown={e => {
        if (e.key === 'ArrowRight') go(1);
        if (e.key === 'ArrowLeft') go(-1);
      }}
    >
      {item ? (
        <>
          <div className="flex items-center gap-2 px-4 pt-3 pb-2 md:px-6">
            {(headerStart && headerStart(item, index ?? 0)) || <span aria-hidden className="size-12 shrink-0" />}
            <p id={titleId} className="min-w-0 flex-1 truncate text-center t-body-strong">
              {title ? title((index ?? 0) + 1, total) : `${label} · ${(index ?? 0) + 1} din ${Math.max(total, items.length)}`}
            </p>
            <button type="button" onClick={() => onIndex(null)} aria-label="Închide" className={ROUND}>
              <XMarkIcon aria-hidden className="size-6" />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1" data-testid="lightbox-stage">
            <div
              ref={track}
              data-testid="lightbox-track"
              className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-hidden pointer-coarse:overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              // Touch scrolls it (the swipe); with a mouse or keyboard the arrows page it, so it is
              // never a keyboard-unreachable scroller there.
              onScroll={() => {
                window.clearTimeout(settle.current);
                settle.current = window.setTimeout(onSettled, 120);
              }}
              onClick={e => {
                // A click on the dark ground (the slide around the photo) closes.
                if ((e.target as HTMLElement).dataset.slide != null) onIndex(null);
              }}
            >
              {items.map((it, i) => (
                <div
                  key={it.key}
                  data-slide=""
                  data-testid={i === index ? 'lightbox-current' : undefined}
                  aria-hidden={i !== index || undefined}
                  className="flex w-full shrink-0 snap-center snap-always items-center px-2 md:px-6"
                >
                  {index != null && Math.abs(i - index) <= 1 ? <LightboxPhoto src={it.src} preview={it.preview} alt={it.alt} /> : null}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-disabled={index === 0 || undefined}
              aria-label="Fotografia anterioară"
              className={cn(ARROW, 'left-2 md:left-6')}
            >
              <ChevronLeftIcon aria-hidden className="size-6" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-disabled={last || undefined}
              aria-busy={waiting || undefined}
              aria-label="Fotografia următoare"
              className={cn(ARROW, 'right-2 md:right-6')}
            >
              {waiting ? <T2Spinner className="size-6" /> : <ChevronRightIcon aria-hidden className="size-6" />}
            </button>
          </div>
          <p role="status" className="sr-only">
            {waiting ? 'Se încarcă…' : ''}
          </p>
          {stuck ? (
            <div role="alert" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 px-4 pt-3">
              <p className="t-caption text-lavender-3">{moreFailedText ?? 'Nu am putut încărca mai multe fotografii.'}</p>
              <button
                type="button"
                onClick={onRetryMore}
                className="min-h-11 cursor-pointer rounded-full bg-photo-scrim px-4 t-button-compact hover:bg-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-photo-scrim"
              >
                Încearcă din nou
              </button>
            </div>
          ) : null}
          <div
            className="flex min-h-12 flex-col gap-0.75 px-4 pt-4 pb-[max(--spacing(4),env(safe-area-inset-bottom))] md:px-6 md:pb-6"
            data-testid="lightbox-footer"
          >
            {footer ? footer(item, index ?? 0) : c ? (
              <>
                {c.weightKg != null ? (
                  <p className="flex items-baseline gap-1.25">
                    <span className="t-display">{fmtKg(c.weightKg)}</span>
                    <span className="t-heading text-lavender-3">kg</span>
                  </p>
                ) : null}
                {secondary ? <p className="t-body text-lavender-3">{secondary}</p> : null}
                {c.anglerName ? (
                  <p className="mt-1 flex min-w-0 items-center gap-2 t-body-strong">
                    {c.angler ? (
                      <span className="flex" data-testid="lightbox-angler-avatar">
                        <Avatar name={c.angler.name ?? c.anglerName} src={c.angler.avatarUrl} size={32} ring />
                      </span>
                    ) : null}
                    <span className="truncate">{c.anglerName}</span>
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </PhotoDialog>
  );
}

/**
 * The full-screen dark photo dialog (native <dialog> on the kit's useModalDialog: top layer, focus
 * containment, Escape, focus return, page scroll lock), faded in. Children draw its chrome, laid out
 * as a column; `labelledBy` names it.
 */
export function PhotoDialog({
  open,
  onClose,
  labelledBy,
  children,
  className,
  backdrop = true,
  ...rest
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  className?: string;
  /** false: a click outside a centred dialog does nothing (an editor that would lose work); Escape still closes. */
  backdrop?: boolean;
  onKeyDown?: KeyboardEventHandler<HTMLDialogElement>;
  'data-testid'?: string;
}) {
  const dialog = useModalDialog(open, onClose, { backdrop });
  return (
    <dialog
      {...dialog}
      {...rest}
      aria-labelledby={labelledBy}
      className={cn(
        'm-0 h-dvh max-h-none w-screen max-w-none bg-ink p-0 text-on-photo-scrim',
        'backdrop:bg-scrim open:flex open:flex-col',
        'opacity-100 transition-opacity duration-(--duration-medium) ease-medium starting:opacity-0',
        className,
      )}
    >
      {children}
    </dialog>
  );
}

/**
 * The original photo, contained. Until it decodes, the tile's grid rendition (cached) is drawn
 * blurred in its place with a spinner and a status line; a failed load is a muted glyph on the dark
 * ground, not a broken image.
 */
function LightboxPhoto({ src, preview, alt }: { src: string; preview?: string; alt: string }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  if (state === 'failed') {
    return (
      <span role="img" aria-label={`${alt} — fotografia nu s-a putut încărca`} className="mx-auto flex flex-col items-center gap-2 text-lavender-3">
        <PhotoIcon aria-hidden className="size-12" />
        <span className="t-caption">Fotografia nu s-a putut încărca.</span>
      </span>
    );
  }
  const loading = state === 'loading';
  return (
    // The frame fills the stage (so the preview has room before the original has a size); clicks on
    // its empty part fall through to the stage (a click on the dark ground closes).
    <span className="pointer-events-none relative flex w-full items-center justify-center self-stretch">
      {loading && preview && preview !== src ? (
        // A background, not an <img>: the stage's one image stays the original.
        <span aria-hidden className="absolute inset-0 scale-105 bg-contain bg-center bg-no-repeat blur-md" style={{ backgroundImage: `url("${preview}")` }} />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- the original photo, contained at its own ratio. */}
      <img
        src={src}
        alt={alt}
        onLoad={() => setState('loaded')}
        onError={() => setState('failed')}
        className={cn('pointer-events-auto relative max-h-full max-w-full object-contain transition-opacity duration-(--duration-medium)', loading ? 'opacity-0' : 'opacity-100')}
      />
      {loading ? (
        <span role="status" className="absolute inset-0 flex items-center justify-center" data-testid="lightbox-photo-loading">
          <span className="flex items-center gap-2 rounded-full bg-photo-scrim px-3 py-2">
            <T2Spinner className="size-5" />
            <span className="t-caption">Se încarcă fotografia…</span>
          </span>
        </span>
      ) : null}
    </span>
  );
}
