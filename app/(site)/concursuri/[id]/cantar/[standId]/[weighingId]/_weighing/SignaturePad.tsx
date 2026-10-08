'use client';

import { useCallback, useEffect, useId, useImperativeHandle, useRef, type Ref } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';

/*
 * fish DrawingCanvas on the web: a white pad the referee and the witness sign on with a finger, a
 * stylus or the mouse (pointer events, touch-action none so a stroke never scrolls the page), the
 * strokes smoothed with quadratic curves as fish does, black 2.5px. «Resetează semnătura» clears it.
 * The pad is pointer-only, like fish's: a keyboard user is told so in the note under it (WCAG 2.1.1
 * exception: a signature depends on the path of the movement).
 * The parent reads the drawing as a PNG (`toBlob`) — what the CMS stores and «Vezi semnături» shows:
 * always EXPORT_SIZE square, the pad contained and centred on white, whatever the pad's box. fish
 * draws on a 350 square and shows it at 200×200 with expo-image's default `cover`: a wide web PNG
 * would lose its sides in the app.
 */

export type SignaturePadHandle = { toBlob: () => Promise<Blob | null>; clear: () => void };

type Point = { x: number; y: number };

const STROKE = 2.5;
/** The exported PNG's side (2× fish's 350 square). */
export const EXPORT_SIZE = 700;

/** Paints the strokes (pad CSS pixels) on white, scaled by `k` and shifted by (ox, oy). */
function paint(ctx: CanvasRenderingContext2D, strokes: Point[][], size: { width: number; height: number }, k: number, ox: number, oy: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.setTransform(k, 0, 0, k, ox, oy);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = STROKE;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const points of strokes) {
    if (points.length === 0) continue;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    if (points.length === 1) ctx.lineTo(points[0].x + 0.1, points[0].y + 0.1);
    // fish: Q through the midpoints of the last three points.
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    if (points.length > 1) ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();
  }
}

export function SignaturePad({
  onChange,
  label,
  ref,
}: {
  /** true once something is drawn, false after a reset. */
  onChange: (hasDrawing: boolean) => void;
  /** The pad's accessible name («Semnătură arbitru»). */
  label: string;
  ref?: Ref<SignaturePadHandle>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const drawing = useRef(false);
  const noteId = useId();

  const redraw = useCallback(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const ratio = el.width / el.clientWidth || 1;
    paint(ctx, strokes.current, { width: el.width, height: el.height }, ratio, 0, 0);
  }, []);

  // The backing store follows the pad's CSS size × the device pixel ratio (crisp on a phone).
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const fit = () => {
      const ratio = window.devicePixelRatio || 1;
      el.width = Math.max(1, Math.round(el.clientWidth * ratio));
      el.height = Math.max(1, Math.round(el.clientHeight * ratio));
      redraw();
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [redraw]);

  const at = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const clear = useCallback(() => {
    strokes.current = [];
    redraw();
    onChange(false);
  }, [onChange, redraw]);

  useImperativeHandle(
    ref,
    () => ({
      clear,
      toBlob: () =>
        new Promise<Blob | null>((resolve) => {
          const el = canvas.current;
          if (!el || strokes.current.length === 0) return resolve(null);
          // Contain the pad's CSS box in the square, centred.
          const w = el.clientWidth || 1;
          const h = el.clientHeight || 1;
          const k = EXPORT_SIZE / Math.max(w, h);
          const out = document.createElement('canvas');
          out.width = EXPORT_SIZE;
          out.height = EXPORT_SIZE;
          const ctx = out.getContext('2d');
          if (!ctx) return resolve(null);
          paint(ctx, strokes.current, { width: EXPORT_SIZE, height: EXPORT_SIZE }, k, (EXPORT_SIZE - w * k) / 2, (EXPORT_SIZE - h * k) / 2);
          out.toBlob((b) => resolve(b), 'image/png');
        }),
    }),
    [clear],
  );

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvas}
        role="img"
        aria-label={label}
        aria-describedby={noteId}
        data-testid="signature-pad"
        className="h-100 max-h-[60dvh] w-full shrink-0 touch-none rounded-control border-2 border-hairline bg-signature-paper md:h-80"
        style={{ cursor: 'crosshair' }}
        onPointerDown={(e) => {
          if (e.button !== 0 && e.pointerType === 'mouse') return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          strokes.current.push([at(e)]);
          redraw();
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          strokes.current[strokes.current.length - 1]?.push(at(e));
          redraw();
        }}
        onPointerUp={() => {
          if (!drawing.current) return;
          drawing.current = false;
          onChange(strokes.current.length > 0);
        }}
        onPointerCancel={() => {
          drawing.current = false;
          onChange(strokes.current.length > 0);
        }}
      />
      <p id={noteId} className="t-caption text-muted">
        Semnează cu degetul, cu stylusul sau cu mouse-ul în chenarul alb. Semnătura nu se poate introduce de la tastatură.
      </p>
      <Button variant="secondary" icon={<ArrowPathIcon />} onClick={clear} block>
        Resetează semnătura
      </Button>
    </div>
  );
}
