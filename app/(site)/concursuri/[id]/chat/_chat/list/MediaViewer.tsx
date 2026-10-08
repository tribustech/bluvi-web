'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type WheelEvent } from 'react';
import {
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  ShareIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { chat } from '@/core/realtime';
import { PhotoDialog } from '@/components/surfaces/Lightbox';
import { cn } from '@/components/ui/cn';
import { clampZoom, VIEWER_DISMISS_PX, VIEWER_MAX_ZOOM, viewerTitle } from './model';

/*
 * fish MediaViewer + ViewerChrome (participant.chat c21): the room's photos full screen, oldest
 * first (core buildRoomGallery: deleted and pending ones left out), opened on the one clicked.
 *
 *  - Top: who sent the current photo (mine «{nume} (eu)») and when (HH:mm), «{i} din {n}», «Închide».
 *  - Bottom: «Distribuie» (the system share sheet; without one the photo's link is copied) and
 *    «Salvează» (downloads the original).
 *  - Zoom up to 4×: the wheel or a pinch around the pointer, a double click toggles 1× / 2.5×, the
 *    + / − buttons and keys; zoomed, a drag pans. At 1× a drag down dismisses (fish's pan-down).
 *  - ← / → (buttons, keys, a horizontal swipe on touch) page; Escape closes (native <dialog>), focus
 *    returns to the photo that opened it.
 */

export type ViewerPhoto = { attachment: chat.ChatAttachment; senderName: string; isMine: boolean; sentAt: string };

type View = { scale: number; x: number; y: number };
const REST: View = { scale: 1, x: 0, y: 0 };
const SWIPE_PX = 50;

export function MediaViewer({ photos, index: initial, onClose }: { photos: ViewerPhoto[]; index: number; onClose: () => void }) {
  const titleId = useId();
  const [index, setIndex] = useState(Math.min(Math.max(0, initial), Math.max(0, photos.length - 1)));
  const [view, setView] = useState<View>(REST);
  const [dragY, setDragY] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  // The viewer unmounts on close (no dialog close()): focus goes back to the photo that opened it.
  const [opener] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null));
  useEffect(
    () => () => {
      const now = document.activeElement;
      if (opener?.isConnected && (!now || now === document.body || !now.isConnected)) opener.focus({ preventScroll: true });
    },
    [opener],
  );
  const photo = photos[index];
  const count = photos.length;

  const go = (next: number) => {
    if (next < 0 || next >= count || next === index) return;
    setIndex(next);
    setView(REST);
  };
  const zoomTo = (scale: number, origin?: { x: number; y: number }) =>
    setView(v => {
      const s = clampZoom(scale);
      if (s === 1) return REST;
      // Keep the point under the pointer still while zooming (origin relative to the stage centre).
      const k = s / v.scale;
      const ox = origin?.x ?? 0;
      const oy = origin?.y ?? 0;
      return { scale: s, x: ox - (ox - v.x) * k, y: oy - (oy - v.y) * k };
    });

  // The note («Link copiat», …) fades after 2 s.
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 2000);
    return () => clearTimeout(t);
  }, [note]);

  // Pointers on the stage: pinch (2), pan when zoomed, drag down to dismiss / swipe to page at 1×.
  const stage = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ x: number; y: number; view: View; pinch?: { d: number; scale: number } } | null>(null);
  const centreOf = (e: { clientX: number; clientY: number }) => {
    const r = stage.current?.getBoundingClientRect();
    return r ? { x: e.clientX - (r.left + r.width / 2), y: e.clientY - (r.top + r.height / 2) } : { x: 0, y: 0 };
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    gesture.current =
      pts.length === 2
        ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2, view, pinch: { d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), scale: view.scale } }
        : { x: e.clientX, y: e.clientY, view };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || !pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (g.pinch && pts.length >= 2) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      zoomTo((g.pinch.scale * d) / Math.max(1, g.pinch.d), centreOf({ clientX: g.x, clientY: g.y }));
      return;
    }
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.view.scale > 1) setView({ ...g.view, x: g.view.x + dx, y: g.view.y + dy });
    else if (dy > 0 && Math.abs(dy) > Math.abs(dx)) setDragY(dy);
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) return;
    gesture.current = null;
    setDragging(false);
    if (!g || g.pinch || g.view.scale > 1) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    setDragY(0);
    if (dy > VIEWER_DISMISS_PX && Math.abs(dy) > Math.abs(dx)) onClose();
    else if (e.pointerType !== 'mouse' && Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? index + 1 : index - 1);
  };
  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (!e.deltaY) return;
    zoomTo(view.scale * (e.deltaY < 0 ? 1.2 : 1 / 1.2), centreOf(e));
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === 'ArrowLeft') go(index - 1);
    else if (e.key === 'ArrowRight') go(index + 1);
    else if (e.key === '+' || e.key === '=') zoomTo(view.scale * 1.5);
    else if (e.key === '-') zoomTo(view.scale / 1.5);
    else return;
    e.preventDefault();
  };

  const share = async () => {
    const url = photo?.attachment.url;
    if (!url) return;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ url, title: 'Poză din chat-ul concursului' });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNote('Link copiat');
    } catch (e) {
      if ((e as { name?: string })?.name !== 'AbortError') setNote('Nu am putut distribui poza.');
    }
  };
  const save = async () => {
    const a = photo?.attachment;
    if (!a) return;
    const name = a.name || `bluvi-chat-${a.id}.jpg`;
    try {
      const res = await fetch(a.url);
      if (!res.ok) throw new Error(String(res.status));
      const href = URL.createObjectURL(await res.blob());
      download(href, name);
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
      setNote('Poza a fost salvată');
    } catch {
      // Another origin without CORS: the browser downloads (or opens) the original itself.
      download(a.url, name, true);
    }
  };

  if (!photo) return null;
  const title = viewerTitle(photo);
  const dim = Math.min(1, dragY / (VIEWER_DISMISS_PX * 3));
  const round =
    'flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-photo-scrim text-on-photo-scrim hover:bg-navy disabled:cursor-default disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-on-photo-scrim';
  return (
    <PhotoDialog open onClose={onClose} labelledBy={titleId} onKeyDown={onKeyDown} data-testid="chat-media-viewer" className="select-none">
      <div className="flex shrink-0 items-start gap-3 px-3 pt-[max(12px,env(safe-area-inset-top))] pb-2" style={{ opacity: 1 - dim }}>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="truncate t-body-strong">
            {title}
          </h2>
          <p className="t-caption text-on-photo-scrim/70">
            {photo.sentAt}
            {count > 1 ? <span> · {index + 1} din {count}</span> : null}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Închide" className={round}>
          <XMarkIcon aria-hidden className="size-6" />
        </button>
      </div>
      <div
        ref={stage}
        className="relative min-h-0 flex-1 touch-none overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onDoubleClick={e => zoomTo(view.scale > 1 ? 1 : 2.5, centreOf(e))}
      >
        <div
          className={cn('flex size-full items-center justify-center', !dragging && 'transition-transform duration-(--duration-fast) ease-fast')}
          style={{ transform: `translate(${view.x}px, ${view.y + dragY}px) scale(${view.scale})`, cursor: view.scale > 1 ? 'grab' : 'zoom-in' }}
        >
          <ViewerImage key={photo.attachment.id + index} attachment={photo.attachment} alt={`Poză de la ${title}, ${photo.sentAt}`} />
        </div>
        {count > 1 ? (
          <>
            <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Poza anterioară" className={cn(round, 'absolute top-1/2 left-3 -translate-y-1/2 max-md:hidden')}>
              <ChevronLeftIcon aria-hidden className="size-6" />
            </button>
            <button type="button" onClick={() => go(index + 1)} disabled={index === count - 1} aria-label="Poza următoare" className={cn(round, 'absolute top-1/2 right-3 -translate-y-1/2 max-md:hidden')}>
              <ChevronRightIcon aria-hidden className="size-6" />
            </button>
          </>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 px-3 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]" style={{ opacity: 1 - dim }}>
        <button type="button" onClick={() => void share()} aria-label="Distribuie" className={round}>
          <ShareIcon aria-hidden className="size-5.5" />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={() => zoomTo(view.scale / 1.5)} disabled={view.scale <= 1} aria-label="Micșorează" className={round}>
            <MagnifyingGlassMinusIcon aria-hidden className="size-5.5" />
          </button>
          <span aria-live="polite" className="min-w-12 text-center t-caption text-on-photo-scrim/80">
            {note ?? `${Math.round(view.scale * 100)}%`}
          </span>
          <button type="button" onClick={() => zoomTo(view.scale * 1.5)} disabled={view.scale >= VIEWER_MAX_ZOOM} aria-label="Mărește" className={round}>
            <MagnifyingGlassPlusIcon aria-hidden className="size-5.5" />
          </button>
        </div>
        <button type="button" onClick={() => void save()} aria-label="Salvează" className={round}>
          <ArrowDownTrayIcon aria-hidden className="size-5.5" />
        </button>
      </div>
    </PhotoDialog>
  );
}

function download(href: string, name: string, newTab = false) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  if (newTab) {
    a.target = '_blank';
    a.rel = 'noopener';
  }
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** The original, contained; its thumbnail (already in the cache) blurred underneath while it loads. */
function ViewerImage({ attachment, alt }: { attachment: chat.ChatAttachment; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative flex size-full items-center justify-center">
      {!loaded && attachment.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- the cached chat thumbnail, blurred placeholder
        <img src={attachment.thumbnailUrl} alt="" aria-hidden className="absolute max-h-full max-w-full object-contain blur-md" />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- chat attachments (CMS / blob URLs) */}
      <img src={attachment.url} alt={alt} draggable={false} onLoad={() => setLoaded(true)} className="relative max-h-full max-w-full object-contain" />
    </div>
  );
}
