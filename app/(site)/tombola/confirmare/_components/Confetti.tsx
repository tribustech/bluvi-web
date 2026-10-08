'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/components/ui/cn';

/*
 * The celebration (fish plays a Lottie «success-confetti», raffle/confirmation.tsx:85-91): an SVG
 * burst of confetti in the kit's colours. On mount every piece flies out of the centre (where the
 * success disc sits) to its place, turning, then drifts a little lower — once (fish loops it; one
 * burst is enough on a page that stays open). prefers-reduced-motion: the pieces simply sit at their
 * place, no movement at all. Decorative (aria-hidden), never under the text's contrast: the pieces
 * stay in the band around the disc and fade towards the edges.
 */

/**
 * A 112px band centred on the success disc (the caller places it): wide enough for a desktop card,
 * height-bound there (meet), width-bound on a phone. Nothing reaches the heading under the disc.
 */
const W = 480;
const H = 112;
const CX = W / 2;
const CY = H / 2;
/** How far the pieces drift down after the burst (and their rest pose). */
const DRIFT = 8;

/** Kit colours only (token fills): accent, gold, success, live, indigo, rating, peach. */
const FILLS = ['fill-accent', 'fill-medal-gold', 'fill-status-success-fg', 'fill-live', 'fill-bento-indigo', 'fill-rating', 'fill-on-bento-peach'];

type Piece = { x: number; y: number; r: number; shape: 0 | 1 | 2; fill: string; delay: number };

/** Deterministic (the server and the client draw the same pieces): a tiny LCG. */
function pieces(count: number): Piece[] {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const out: Piece[] = [];
  for (let i = 0; i < count; i++) {
    // An ellipse around the disc, leaving its middle (and the heading below it) clear.
    const angle = (i / count) * Math.PI * 2 + rnd() * 0.5;
    const radius = 0.45 + rnd() * 0.55;
    out.push({
      x: Math.round(CX + Math.cos(angle) * radius * (W / 2 - 12)),
      y: Math.round(CY - DRIFT / 2 + Math.sin(angle) * radius * (H / 2 - 14)),
      r: Math.round(rnd() * 180),
      shape: (i % 3) as 0 | 1 | 2,
      fill: FILLS[i % FILLS.length],
      delay: Math.round(rnd() * 160),
    });
  }
  return out;
}

const PIECES = pieces(28);

export function Confetti({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg || typeof svg.animate !== 'function') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const animations: Animation[] = [];
    svg.querySelectorAll<SVGGElement>('[data-piece]').forEach((g, i) => {
      const p = PIECES[i];
      if (!p) return;
      const dx = CX - p.x;
      const dy = CY - p.y;
      animations.push(
        g.animate(
          [
            { transform: `translate(${dx}px, ${dy}px) rotate(0deg) scale(0.2)`, opacity: 0 },
            { transform: `translate(0px, 0px) rotate(${p.r}deg) scale(1)`, opacity: 1, offset: 0.45 },
            { transform: `translate(0px, ${DRIFT}px) rotate(${p.r + 120}deg) scale(1)`, opacity: 1 },
          ],
          { duration: 1600, delay: p.delay, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)', fill: 'both' },
        ),
      );
    });
    return () => animations.forEach((a) => a.cancel());
  }, []);

  return (
    <svg
      ref={ref}
      aria-hidden
      focusable="false"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className={cn('pointer-events-none', className)}
      data-testid="raffle-confetti"
    >
      {PIECES.map((p, i) => (
        // The rest pose is the final keyframe (drifted DRIFT lower): with reduced motion nothing moves.
        <g key={i} data-piece className={p.fill} style={{ transformBox: 'fill-box', transformOrigin: 'center', transform: `translate(0px, ${DRIFT}px) rotate(${p.r + 120}deg)` }}>
          {p.shape === 0 ? (
            <rect x={p.x - 5} y={p.y - 2} width={10} height={4} rx={1} />
          ) : p.shape === 1 ? (
            <circle cx={p.x} cy={p.y} r={3} />
          ) : (
            <path d={`M${p.x - 4} ${p.y + 3} L${p.x} ${p.y - 4} L${p.x + 4} ${p.y + 3} Z`} />
          )}
        </g>
      ))}
    </svg>
  );
}
