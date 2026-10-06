'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/*
 * parity competition-page.shell.c27 (fish [competitionId].tsx:304-309,545-568): arriving with
 * ?fromPublish=1 (the create wizard's publish redirect, b.publish-redirect) plays a one-shot confetti
 * over the page that never blocks input, and the param is dropped from the URL. fish plays a Lottie
 * (just-confetti.json at half speed, ~3 s); the web draws its pieces with the Web Animations API in
 * the token colours. Reduced motion: nothing plays (the param is still dropped).
 */

export const FROM_PUBLISH_PARAM = 'fromPublish';

const PIECES = 90;
/** Token colours only (globals.css): the accent, the live red and the sector palette. */
const COLORS = ['accent', 'live', 'sector-a', 'sector-c', 'sector-e', 'sector-g', 'sector-k', 'sector-w', 'sector-n', 'sector-m'];

type Piece = { left: number; size: number; color: string; delay: number; duration: number; drift: number; spin: number; round: boolean };

function makePieces(): Piece[] {
  return Array.from({ length: PIECES }, (_, i) => ({
    left: Math.random() * 100,
    size: 6 + Math.round(Math.random() * 6),
    color: COLORS[i % COLORS.length],
    delay: Math.random() * 600,
    duration: 2200 + Math.random() * 1600,
    drift: (Math.random() - 0.5) * 160,
    spin: (Math.random() - 0.5) * 1080,
    round: i % 3 === 0,
  }));
}

export function PublishConfetti() {
  const router = useRouter();
  const handled = useRef(false);
  const [pieces, setPieces] = useState<Piece[] | null>(null);
  const layer = useRef<HTMLDivElement>(null);

  // Read once on arrival (fish hasHandledPublishConfettiRef), then drop the param.
  useEffect(() => {
    if (handled.current) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get(FROM_PUBLISH_PARAM) !== '1') return;
    handled.current = true;
    url.searchParams.delete(FROM_PUBLISH_PARAM);
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Next frame, and never cancelled: the ref already marks it handled (a dev re-run of the effect).
    requestAnimationFrame(() => setPieces(makePieces()));
  }, [router]);

  useEffect(() => {
    const root = layer.current;
    if (!pieces || !root) return;
    const nodes = Array.from(root.children) as HTMLElement[];
    const runs = nodes.map((node, i) => {
      const p = pieces[i];
      return node.animate(
        [
          { transform: 'translate3d(0, -5vh, 0) rotate(0deg)', opacity: 1 },
          { transform: `translate3d(${p.drift}px, 105vh, 0) rotate(${p.spin}deg)`, opacity: 0.9 },
        ],
        { duration: p.duration, delay: p.delay, easing: 'cubic-bezier(0.25, 0.6, 0.45, 1)', fill: 'both' },
      );
    });
    let live = true;
    void Promise.all(runs.map(r => r.finished))
      .catch(() => undefined)
      .then(() => {
        if (live) setPieces(null);
      });
    return () => {
      live = false;
      runs.forEach(r => r.cancel());
    };
  }, [pieces]);

  if (!pieces) return null;
  return (
    <div ref={layer} aria-hidden data-publish-confetti className="pointer-events-none fixed inset-0 z-toast overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={p.round ? 'absolute top-0 rounded-full' : 'absolute top-0 rounded-badge'}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 1.6,
            background: `var(--color-${p.color})`,
          }}
        />
      ))}
    </div>
  );
}
