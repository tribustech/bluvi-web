'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '@/components/ui/cn';
import {
  clampTransform,
  coverScale,
  CROP_PRESETS,
  DEFAULT_CROP_PRESET,
  displayedImageRect,
  IDENTITY_TRANSFORM,
  MAX_ZOOM_MULTIPLIER,
  nextRotation,
  presetRatio,
  ratioFrameRect,
  resizeFreeFrame,
  rotatedSize,
  type CropCorner,
  type CropPreset,
  type CropPresetId,
  type CropRotation,
  type ImageTransform,
  type Rect,
  type Size,
} from '@/core/partide/domain/cropGeometry';
import type { CropChange } from '@/core/partide/domain/photoCropPipeline';
import { FlipIcon, RotateIcon } from './icons';

/*
 * fish features/partide/components/PhotoCropOverlay.tsx — TikTok-style crop: the crop FRAME is a
 * fixed viewport and the IMAGE pans and zooms beneath it; freeform («Liber») is the exception, where
 * the frame's corner handles resize it and the image stays put. «Original» crops nothing but rotate
 * and flip still apply.
 *
 * This component owns the interaction only. It reports the screen-space frame + image transform on
 * «Salvează»; turning that into pixels is core (cropGeometry / photoCropPipeline), not anything here.
 *
 * Web input: drag (pointer) pans, the wheel / a two-finger pinch zooms; from the keyboard the stage
 * takes the arrow keys (pan) and + / − (zoom), and each freeform handle the arrow keys (resize).
 */

const FRAME_EASE = 'transition-[left,top,width,height] duration-300 ease-out';
const KEY_STEP = 12;
const ZOOM_STEP = 1.1;

export function CropOverlay({
  src,
  imageSize,
  busy,
  onCancel,
  onSave,
}: {
  /** The working image (object URL). */
  src: string;
  /** Natural pixel size of the working image. */
  imageSize: Size;
  /** While the crop is applied: «Salvează» waits and «Anulează» is disabled. */
  busy: boolean;
  onCancel: () => void;
  onSave: (change: CropChange) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Size>({ width: 0, height: 0 });
  const [preset, setPreset] = useState<CropPresetId>(DEFAULT_CROP_PRESET);
  const [rotation, setRotation] = useState<CropRotation>(0);
  const [flip, setFlip] = useState(false);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setBox({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hasBox = box.width > 0 && box.height > 0;
  // Everything downstream (contain fit, freeform default, preset ratios) is computed against the
  // ROTATED size, never the raw one.
  const rotated = useMemo(() => rotatedSize(imageSize, rotation), [imageSize, rotation]);
  const contain: Rect = useMemo(() => (hasBox ? displayedImageRect(rotated, box) : { x: 0, y: 0, width: 0, height: 0 }), [hasBox, rotated, box]);
  const ratio = presetRatio(preset, rotated);
  const ratioFrame: Rect = useMemo(() => (hasBox && ratio ? ratioFrameRect(ratio, box) : { x: 0, y: 0, width: 0, height: 0 }), [hasBox, ratio, box]);

  // ── freeform frame ───────────────────────────────────────────────────────────────────────────
  const [freeFrame, setFreeFrame] = useState<Rect>(contain);
  // Reseed only when entering «Liber» or when the box/image is (re)measured — not on every drag.
  const [seededFor, setSeededFor] = useState<string>('');
  const seedKey = `${preset}|${box.width}x${box.height}|${rotation}`;
  if (preset === 'free' && hasBox && seededFor !== seedKey) {
    setSeededFor(seedKey);
    setFreeFrame(contain);
  }

  // ── pan / zoom (fixed frame, image moves) ─────────────────────────────────────────────────────
  const interactive = preset !== 'free' && preset !== 'original';
  const minScale = useMemo(() => (hasBox ? coverScale(contain, ratioFrame) : 1), [hasBox, contain, ratioFrame]);
  const maxScale = minScale * MAX_ZOOM_MULTIPLIER;
  const [transform, setTransform] = useState<ImageTransform>({ ...IDENTITY_TRANSFORM, scale: minScale });
  // A zoom/pan chosen for one frame shape means nothing for another: reset to "just covers, centred".
  const resetKey = `${preset}|${rotation}|${box.width}x${box.height}|${minScale}`;
  const [resetFor, setResetFor] = useState(resetKey);
  if (resetFor !== resetKey) {
    setResetFor(resetKey);
    setTransform({ translateX: 0, translateY: 0, scale: minScale });
  }

  const applyTransform = useCallback(
    (next: ImageTransform) => setTransform(clampTransform(next, contain, ratioFrame, minScale, maxScale)),
    [contain, ratioFrame, minScale, maxScale],
  );

  // Pointers on the stage: one drags, two pinch.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ start: ImageTransform; x: number; y: number; dist: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const spread = () => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const centroid = () => {
    const ps = [...pointers.current.values()];
    return { x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.y, 0) / ps.length };
  };
  // The latest transform for a gesture that (re)starts between renders (pinch → one-finger drag).
  const transformRef = useRef(transform);
  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);
  const restartGesture = () => {
    const c = centroid();
    gesture.current = pointers.current.size ? { start: transformRef.current, x: c.x, y: c.y, dist: spread() } : null;
  };

  const onStagePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    restartGesture();
    setDragging(true);
  };
  const onStagePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const c = centroid();
    const d = spread();
    const scale = g.dist > 0 && d > 0 ? g.start.scale * (d / g.dist) : g.start.scale;
    applyTransform({ scale, translateX: g.start.translateX + (c.x - g.x), translateY: g.start.translateY + (c.y - g.y) });
  };
  const onStagePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    // Leaving a pinch for a one-finger drag starts a fresh gesture from where the image is now.
    gesture.current = null;
    if (pointers.current.size) {
      requestAnimationFrame(restartGesture);
    } else {
      setDragging(false);
    }
  };

  // The wheel zooms (non-passive, or the page would scroll under the dialog).
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !interactive) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setTransform(t => clampTransform({ ...t, scale: t.scale * Math.exp(-e.deltaY / 400) }, contain, ratioFrame, minScale, maxScale));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [interactive, contain, ratioFrame, minScale, maxScale]);

  const onStageKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const t = transform;
    const moves: Record<string, ImageTransform> = {
      ArrowLeft: { ...t, translateX: t.translateX - KEY_STEP },
      ArrowRight: { ...t, translateX: t.translateX + KEY_STEP },
      ArrowUp: { ...t, translateY: t.translateY - KEY_STEP },
      ArrowDown: { ...t, translateY: t.translateY + KEY_STEP },
      '+': { ...t, scale: t.scale * ZOOM_STEP },
      '=': { ...t, scale: t.scale * ZOOM_STEP },
      '-': { ...t, scale: t.scale / ZOOM_STEP },
    };
    const next = moves[e.key];
    if (!next) return;
    e.preventDefault();
    applyTransform(next);
  };

  // ── freeform corner drags ─────────────────────────────────────────────────────────────────────
  // The pointer offset is CUMULATIVE since the drag began and always applies to the frame as it was
  // at the start (core resizeFreeFrame) — never to the latest one.
  const corner = useRef<{ corner: CropCorner; start: Rect; x: number; y: number; id: number } | null>(null);
  const onHandleDown = (c: CropCorner) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    corner.current = { corner: c, start: freeFrame, x: e.clientX, y: e.clientY, id: e.pointerId };
    setDragging(true);
  };
  const onHandleMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const s = corner.current;
    if (!s || s.id !== e.pointerId) return;
    setFreeFrame(resizeFreeFrame(s.start, s.corner, e.clientX - s.x, e.clientY - s.y, box));
  };
  const onHandleUp = () => {
    corner.current = null;
    setDragging(false);
  };
  const onHandleKey = (c: CropCorner) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const d = { ArrowLeft: [-KEY_STEP, 0], ArrowRight: [KEY_STEP, 0], ArrowUp: [0, -KEY_STEP], ArrowDown: [0, KEY_STEP] }[e.key];
    if (!d) return;
    e.preventDefault();
    setFreeFrame(f => resizeFreeFrame(f, c, d[0], d[1], box));
  };

  const frame = preset === 'free' ? freeFrame : ratioFrame;
  const shownTransform = interactive ? transform : IDENTITY_TRANSFORM;

  const save = () => {
    onSave({
      preset,
      frame,
      boxSize: box,
      displayed: contain,
      imageTransform: preset === 'original' || preset === 'free' ? IDENTITY_TRANSFORM : transform,
      rotation,
      flipHorizontal: flip,
    });
  };

  const reset = () => {
    setRotation(0);
    setFlip(false);
    setPreset(DEFAULT_CROP_PRESET);
  };

  // Pre-rotation size of the inner image: swapped for 90/270 so the ROTATED element's box exactly
  // fills `contain` ("rotate to fit").
  const quarter = rotation === 90 || rotation === 270;
  const inner = quarter ? { width: contain.height, height: contain.width } : { width: contain.width, height: contain.height };
  const ease = !dragging;

  return (
    <div className="flex min-h-0 flex-1 flex-col opacity-100 transition-opacity duration-200 starting:opacity-0" data-testid="crop-overlay">
      {/* Transform tools; cancel/save are the bottom bar's job. */}
      <div className="flex shrink-0 items-center justify-between px-4 pt-[max(--spacing(3),env(safe-area-inset-top))] pb-2 md:px-6 md:pt-4">
        <div className="flex items-center gap-1">
          <ToolButton label="Rotește" testId="crop-rotate" onClick={() => setRotation(nextRotation)}>
            <RotateIcon className="size-5.5" />
          </ToolButton>
          <ToolButton label="Oglindește" testId="crop-flip" pressed={flip} onClick={() => setFlip(f => !f)}>
            <FlipIcon className="size-5.5" />
          </ToolButton>
        </div>
        <h2 id="crop-title" className="t-body-strong">
          Decupează
        </h2>
        <button type="button" onClick={reset} className="h-11 cursor-pointer rounded-full px-3 t-body-strong text-on-photo-scrim/85 hover:bg-photo-scrim focus-visible:outline-2 focus-visible:outline-on-photo-scrim">
          Reset
        </button>
      </div>

      {/* Crop stage */}
      {/* The measured stage is inset in a clipping well, so the corner handles are never cut in half by
          the edge (the image is contain-fitted to the stage, its corners on the stage's edges). */}
      <div className="relative min-h-0 flex-1 overflow-hidden md:mx-6 md:my-2">
        <div
          ref={stageRef}
          className={cn('absolute inset-5 touch-none select-none', interactive && (dragging ? 'cursor-grabbing' : 'cursor-grab'))}
          data-testid="crop-stage"
          tabIndex={interactive ? 0 : -1}
          role={interactive ? 'application' : undefined}
          aria-label={interactive ? 'Poza în cadrul de decupare' : undefined}
          aria-roledescription={interactive ? 'zonă de decupare' : undefined}
          aria-describedby={interactive ? 'crop-help' : undefined}
          onPointerDown={onStagePointerDown}
          onPointerMove={onStagePointerMove}
          onPointerUp={onStagePointerUp}
          onPointerCancel={onStagePointerUp}
          onKeyDown={onStageKey}
        >
          {hasBox ? (
            <>
              <div
                className="absolute overflow-hidden"
                style={{
                  left: contain.x,
                  top: contain.y,
                  width: contain.width,
                  height: contain.height,
                  transform: `translate(${shownTransform.translateX}px, ${shownTransform.translateY}px) scale(${shownTransform.scale})`,
                  transition: ease ? 'transform 300ms ease-out' : undefined,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, never optimisable */}
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  className="absolute top-1/2 left-1/2 max-w-none"
                  style={{
                    width: inner.width,
                    height: inner.height,
                    transform: `translate(-50%, -50%) scaleX(${flip ? -1 : 1}) rotate(${rotation}deg)`,
                  }}
                />
              </div>
              <FrameMask box={box} frame={frame} ease={ease} />
              {(['tl', 'tr', 'bl', 'br'] as const).map(c => (
                <CornerHandle
                  key={c}
                  corner={c}
                  frame={frame}
                  ease={ease}
                  draggable={preset === 'free'}
                  onPointerDown={onHandleDown(c)}
                  onPointerMove={onHandleMove}
                  onPointerUp={onHandleUp}
                  onKeyDown={onHandleKey(c)}
                />
              ))}
            </>
          ) : null}
        </div>
        <p id="crop-help" className="sr-only">
          Trage poza sau folosește săgețile pentru a o muta; rotița, ciupirea sau tastele plus și minus o măresc.
        </p>
      </div>

      {/* Phone: presets row, then «Anulează» · «Salvează». From 768 one bar: Anulează | presets | Salvează. */}
      <div className="flex shrink-0 flex-col md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-4 md:border-t md:border-on-photo-scrim/15 md:px-6 md:py-4">
        <div className="overflow-x-auto [scrollbar-width:none] md:order-2" role="radiogroup" aria-label="Format decupare">
          <div className="flex w-max gap-1 px-3 py-2 md:px-0 md:py-0">
            {CROP_PRESETS.map(p => (
              <PresetChip key={p.id} preset={p} selected={p.id === preset} onSelect={() => setPreset(p.id)} />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between px-5 pt-3.5 pb-[max(--spacing(3.5),env(safe-area-inset-bottom))] md:contents">
          {/* Disabled while a crop is applied, as Escape is: a cancelled crop must never land. */}
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-11 cursor-pointer rounded-full px-3 t-body text-on-photo-scrim/85 hover:bg-photo-scrim focus-visible:outline-2 focus-visible:outline-on-photo-scrim disabled:cursor-default disabled:opacity-45 md:order-1 md:justify-self-start"
          >
            Anulează
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || !hasBox}
            aria-busy={busy || undefined}
            className="h-12 cursor-pointer rounded-full bg-photo-chip px-6.5 t-body-strong text-ink transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-photo-scrim disabled:cursor-default disabled:opacity-45 md:order-3 md:justify-self-end"
          >
            {busy ? 'Se aplică…' : 'Salvează'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolButton({ label, testId, pressed, onClick, children }: { label: string; testId: string; pressed?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      data-testid={testId}
      onClick={onClick}
      className="flex size-11 cursor-pointer items-center justify-center rounded-full hover:bg-photo-scrim focus-visible:outline-2 focus-visible:outline-on-photo-scrim aria-pressed:bg-photo-scrim"
    >
      {children}
    </button>
  );
}

/** How far the dim reaches past the stage: a zoomed image overflows into the well around it. */
const B = 200;

/** Everything outside the frame dimmed by four rects, the frame border and its mid-edge ticks. */
function FrameMask({ box, frame, ease }: { box: Size; frame: Rect; ease: boolean }) {
  const t = ease ? FRAME_EASE : '';
  const dim = cn('pointer-events-none absolute bg-photo-scrim', t);
  const tick = cn('pointer-events-none absolute bg-on-photo-scrim', t);
  const { x, y, width: w, height: h } = frame;
  return (
    <>
      <div className={dim} style={{ left: -B, top: -B, width: box.width + 2 * B, height: Math.max(0, y + B) }} />
      <div className={dim} style={{ left: -B, top: y + h, width: box.width + 2 * B, height: Math.max(0, box.height - y - h + B) }} />
      <div className={dim} style={{ left: -B, top: y, width: Math.max(0, x + B), height: h }} />
      <div className={dim} style={{ left: x + w, top: y, width: Math.max(0, box.width - x - w + B), height: h }} />
      <div className={cn('pointer-events-none absolute border border-on-photo-scrim/90', t)} style={{ left: x, top: y, width: w, height: h }} data-testid="crop-frame" />
      <div className={tick} style={{ left: x + w / 2 - 8, top: y - 1, width: 16, height: 2 }} />
      <div className={tick} style={{ left: x + w / 2 - 8, top: y + h - 1, width: 16, height: 2 }} />
      <div className={tick} style={{ left: x - 1, top: y + h / 2 - 8, width: 2, height: 16 }} />
      <div className={tick} style={{ left: x + w - 1, top: y + h / 2 - 8, width: 2, height: 16 }} />
    </>
  );
}

const CORNER_LEN = 18;
const CORNER_THICK = 3;
const CORNER_NAME: Record<CropCorner, string> = { tl: 'stânga sus', tr: 'dreapta sus', bl: 'stânga jos', br: 'dreapta jos' };

/** The L-shaped corner; a focusable, draggable handle in freeform only. */
function CornerHandle({
  corner,
  frame,
  ease,
  draggable,
  ...handlers
}: {
  corner: CropCorner;
  frame: Rect;
  ease: boolean;
  draggable: boolean;
  onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const left = corner === 'tl' || corner === 'bl';
  const top = corner === 'tl' || corner === 'tr';
  const cx = left ? frame.x : frame.x + frame.width;
  const cy = top ? frame.y : frame.y + frame.height;
  const bars = (
    <>
      <span aria-hidden className="absolute rounded-full bg-on-photo-scrim" style={{ left: left ? CORNER_LEN : 0, top: top ? CORNER_LEN : CORNER_LEN - CORNER_THICK, width: CORNER_LEN, height: CORNER_THICK }} />
      <span aria-hidden className="absolute rounded-full bg-on-photo-scrim" style={{ left: left ? CORNER_LEN : CORNER_LEN - CORNER_THICK, top: top ? CORNER_LEN : 0, width: CORNER_THICK, height: CORNER_LEN }} />
    </>
  );
  const style = { left: cx - CORNER_LEN, top: cy - CORNER_LEN, width: CORNER_LEN * 2, height: CORNER_LEN * 2 };
  const t = ease ? 'transition-[left,top] duration-300 ease-out' : '';
  if (!draggable) {
    return (
      <span aria-hidden className={cn('pointer-events-none absolute', t)} style={style}>
        {bars}
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label={`Colțul ${CORNER_NAME[corner]} al cadrului`}
      data-testid={`crop-handle-${corner}`}
      className={cn('absolute cursor-pointer touch-none rounded-full focus-visible:outline-2 focus-visible:outline-on-photo-scrim', corner === 'tl' || corner === 'br' ? 'cursor-nwse-resize' : 'cursor-nesw-resize', t)}
      style={style}
      onPointerDown={handlers.onPointerDown}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlers.onPointerUp}
      onPointerCancel={handlers.onPointerUp}
      onKeyDown={handlers.onKeyDown}
    >
      {bars}
    </button>
  );
}

const ICON_BOX = 28;

function PresetChip({ preset, selected, onSelect }: { preset: CropPreset; selected: boolean; onSelect: () => void }) {
  const icon = displayedImageRect({ width: preset.ratio ?? 1, height: 1 }, { width: ICON_BOX, height: ICON_BOX });
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      data-testid={`crop-preset-${preset.id}`}
      onClick={onSelect}
      className={cn(
        'flex cursor-pointer flex-col items-center gap-1 rounded-xl px-3 py-2 focus-visible:outline-2 focus-visible:outline-on-photo-scrim',
        selected ? 'bg-on-photo-scrim/18 text-on-photo-scrim' : 'text-on-photo-scrim/70 hover:text-on-photo-scrim',
      )}
    >
      <span aria-hidden className="flex size-7 items-center justify-center">
        <span
          className={cn('rounded-xs border-[1.5px]', selected ? 'border-on-photo-scrim' : 'border-on-photo-scrim/60', preset.id === 'free' && 'border-dashed')}
          style={{ width: icon.width, height: icon.height }}
        />
      </span>
      <span className="t-caption">{preset.label}</span>
    </button>
  );
}
