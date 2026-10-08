'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/components/ui/cn';
import { ART_HOLD_MS } from './model';

/**
 * organizer.panel.c2 — the decorative organizer animation in the header corner (fish: the
 * fishing-organizer Lottie at 0.55×, its last frame held 5 s, then replayed). The web draws its own
 * scene in the token colours, no Lottie dependency (precedent: PublishConfetti): a clipboard whose
 * ticks write themselves while a rod casts a line and the float settles. Web Animations API, one
 * pass (~2.6 s, fish's slowed pace), the end frame held ART_HOLD_MS, then again.
 *
 * Decorative: aria-hidden, never focusable. Reduced motion: the end frame, still (nothing plays).
 */
const PASS_MS = 2600;

export function OrganizerArt({ className }: { className?: string }) {
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const root = svg.current;
    if (!root || typeof root.animate !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const q = <T extends Element>(sel: string) => Array.from(root.querySelectorAll<T>(sel));
    let timer: ReturnType<typeof setTimeout> | null = null;
    let runs: Animation[] = [];
    let alive = true;

    const play = () => {
      runs = [
        // The rod tips back and casts.
        ...q<SVGGElement>('[data-art="rod"]').map((el) =>
          el.animate(
            [
              { transform: 'rotate(0deg)' },
              { transform: 'rotate(-14deg)', offset: 0.18 },
              { transform: 'rotate(6deg)', offset: 0.34 },
              { transform: 'rotate(0deg)', offset: 0.5 },
              { transform: 'rotate(0deg)' },
            ],
            { duration: PASS_MS, easing: 'ease-in-out' },
          ),
        ),
        // The line runs out to the water…
        ...q<SVGPathElement>('[data-art="line"]').map((el) =>
          el.animate([{ strokeDashoffset: 60 }, { strokeDashoffset: 60, offset: 0.3 }, { strokeDashoffset: 0, offset: 0.55 }, { strokeDashoffset: 0 }], {
            duration: PASS_MS,
            easing: 'ease-out',
            fill: 'both',
          }),
        ),
        // …the float lands and bobs…
        ...q<SVGGElement>('[data-art="float"]').map((el) =>
          el.animate(
            [
              { transform: 'translateY(-10px)', opacity: 0 },
              { transform: 'translateY(-10px)', opacity: 0, offset: 0.5 },
              { transform: 'translateY(0)', opacity: 1, offset: 0.6 },
              { transform: 'translateY(-2px)', offset: 0.72 },
              { transform: 'translateY(1px)', offset: 0.84 },
              { transform: 'translateY(0)', opacity: 1 },
            ],
            { duration: PASS_MS, easing: 'ease-out', fill: 'both' },
          ),
        ),
        // …and the ticks on the clipboard write themselves, one after the other.
        ...q<SVGPathElement>('[data-art="tick"]').map((el, i) =>
          el.animate([{ strokeDashoffset: 12 }, { strokeDashoffset: 12, offset: 0.25 + i * 0.2 }, { strokeDashoffset: 0, offset: 0.4 + i * 0.2 }, { strokeDashoffset: 0 }], {
            duration: PASS_MS,
            easing: 'ease-out',
            fill: 'both',
          }),
        ),
      ];
      void Promise.all(runs.map((r) => r.finished))
        .catch(() => undefined)
        .then(() => {
          if (alive) timer = setTimeout(play, ART_HOLD_MS);
        });
    };
    play();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      runs.forEach((r) => r.cancel());
    };
  }, []);

  return (
    <svg ref={svg} aria-hidden="true" focusable="false" viewBox="0 0 72 72" data-testid="organizer-art" className={cn('pointer-events-none shrink-0', className)}>
      {/* The disc it sits on. */}
      <circle cx="36" cy="36" r="34" className="fill-accent-tint" />
      {/* Water. */}
      <path d="M8 54c6-3 10 3 16 0s10 3 16 0 10 3 16 0 8 2 8 2v4H8z" className="fill-accent-tint-3" />
      {/* Clipboard. */}
      <g>
        <rect x="14" y="16" width="26" height="32" rx="4" className="fill-surface stroke-accent" strokeWidth="2" />
        <rect x="21" y="12.5" width="12" height="6" rx="2" className="fill-accent" />
        <path data-art="tick" d="M19 26l2.5 2.5L26 24" className="fill-none stroke-success" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="12" />
        <path d="M29 27h6" className="stroke-accent-tint-3" strokeWidth="2.2" strokeLinecap="round" />
        <path data-art="tick" d="M19 35l2.5 2.5L26 33" className="fill-none stroke-success" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="12" />
        <path d="M29 36h6" className="stroke-accent-tint-3" strokeWidth="2.2" strokeLinecap="round" />
      </g>
      {/* Rod, pivoting at its handle; the line and the float. */}
      <g data-art="rod" style={{ transformBox: 'view-box', transformOrigin: '44px 50px' }}>
        <path d="M44 50L60 14" className="stroke-navy" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="45.5" cy="46.5" r="2.2" className="fill-navy" />
      </g>
      <path data-art="line" d="M60 14c3 10 4 22 2 37" className="fill-none stroke-ink-2" strokeWidth="1" strokeDasharray="60" />
      <g data-art="float">
        <circle cx="62" cy="52" r="3" className="fill-sector-e" />
        <path d="M59 52h6" className="stroke-surface" strokeWidth="1.2" />
      </g>
    </svg>
  );
}
