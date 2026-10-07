'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

/*
 * The full-page save curtain (fish features/partide/components/SaveCurtain.tsx): while a save is in
 * flight the hero's indigo grows down over the whole page and one line of copy cycles in the middle
 * (saveCurtainCopy.ts), stopping on the LAST line (a loop reads as "stuck"). It starts as the hero
 * itself (`from`, the hero's viewport rect) so it reads as the hero expanding, never a new sheet
 * dropping over the page (fish's two-beat handoff):
 *  - below 768 the hero is a full-width band from the top: the panel scales down from its bottom
 *    edge (scaleY; the text is its own layer that only fades — a scaled parent would stretch it);
 *  - from 768 the hero is a rounded card in a centred column under the header: the panel opens out
 *    of that card's exact rect and radius to the viewport (a clip-path inset);
 *  - the hero scrolled out of view (or no rect): a plain fade.
 * It covers everything, the top bar included, and takes every pointer event while up. The minimum
 * time on screen is the caller's (core atLeast / MIN_CURTAIN_MS). Reduced motion: a fade.
 */

export type CurtainOrigin = { top: number; left: number; width: number; height: number };

const MESSAGE_INTERVAL_MS = 1100;
const EXIT_MS = 300;

export function SaveCurtain({ visible, messages, from, enterDelayMs = 0 }: { visible: boolean; messages: string[]; from: CurtainOrigin | null; enterDelayMs?: number }) {
  // hidden → entering (mounted collapsed) → shown (grown) → exiting (collapsing) → hidden.
  const [phase, setPhase] = useState<'hidden' | 'entering' | 'shown' | 'exiting'>('hidden');
  const [index, setIndex] = useState(0);
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    // Restart the copy from the first line on each new save; exit at once on a failure.
    if (visible) setIndex(0);
    setPhase(visible ? 'entering' : phase === 'hidden' ? 'hidden' : 'exiting');
  }

  useEffect(() => {
    if (phase === 'entering') {
      // Grow on the next frames, after the hero emptied (`enterDelayMs`).
      let raf = 0;
      const timer = setTimeout(() => {
        raf = requestAnimationFrame(() => requestAnimationFrame(() => setPhase('shown')));
      }, enterDelayMs);
      return () => {
        clearTimeout(timer);
        cancelAnimationFrame(raf);
      };
    }
    if (phase === 'exiting') {
      const timer = setTimeout(() => setPhase('hidden'), EXIT_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [phase, enterDelayMs]);

  useEffect(() => {
    if (!visible) return undefined;
    const id = setInterval(() => setIndex(i => Math.min(i + 1, Math.max(0, messages.length - 1))), MESSAGE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [visible, messages.length]);

  const rendered = phase !== 'hidden';
  const grown = phase === 'shown';
  if (!rendered || typeof document === 'undefined') return null;
  const message = messages[index] ?? messages[messages.length - 1] ?? '';

  return createPortal(
    <div data-testid="save-curtain" data-phase={phase} className="fixed inset-0 z-toast" aria-busy="true">
      <div
        aria-hidden
        data-testid="save-curtain-panel"
        className="absolute inset-0 origin-top bg-accent transition-[transform,clip-path,border-radius,opacity] duration-(--duration-slow) ease-slow motion-reduce:transition-opacity"
        style={grown ? GROWN : collapsedStyle(from)}
      />
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-4.5 px-10 text-center text-on-accent transition-opacity duration-(--duration-medium) ease-medium"
        style={{ opacity: grown ? 1 : 0, transitionDelay: grown ? '220ms' : '0ms' }}
      >
        <span aria-hidden className="size-7 animate-spin rounded-full border-[3px] border-current border-t-transparent" />
        <p role="status" aria-live="polite" className="t-title2 max-w-90">
          {message}
        </p>
      </div>
    </div>,
    document.body,
  );
}

const GROWN: CSSProperties = { transform: 'none', clipPath: 'inset(0px 0px 0px 0px round 0px)', borderRadius: 0, opacity: 1 };

/** The panel's start (and exit) shape: the hero, by breakpoint (see the header). */
function collapsedStyle(from: CurtainOrigin | null): CSSProperties {
  const vw = Math.max(1, window.innerWidth);
  const vh = Math.max(1, window.innerHeight);
  const bottom = from ? from.top + from.height : 0;
  // Off-screen (scrolled past) or unknown: no shape to grow from — fade.
  if (!from || bottom <= 0 || from.top >= vh) return { ...GROWN, opacity: 0 };
  if (vw < 768) {
    return {
      transform: `scaleY(${Math.min(1, bottom / vh)})`,
      clipPath: GROWN.clipPath,
      borderRadius: '0 0 var(--radius-bento) var(--radius-bento)',
      opacity: 1,
    };
  }
  const top = Math.max(0, from.top);
  const left = Math.max(0, from.left);
  const right = Math.max(0, vw - (from.left + from.width));
  const below = Math.max(0, vh - bottom);
  const radius = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--radius-bento')) || 0;
  return { transform: 'none', clipPath: `inset(${top}px ${right}px ${below}px ${left}px round ${radius}px)`, borderRadius: 0, opacity: 1 };
}
