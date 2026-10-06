'use client';

import { useEffect, useState, type RefObject } from 'react';
import { BAR_CONCEALED_ATTR, PHONE_BAR_PX, useStackPinnedFlag } from '@/components/nav/stickyStack';
import { BREAKPOINT_MD } from '@/components/surfaces/rule';

/*
 * Owner rule 3 (ROADMAP §4b: a sticky header never floats), phone. The top bar slides away with a
 * composited `translate`; a pinned T3 row that followed it by transitioning `top` (a layout
 * property, on a sticky element) runs on the main thread instead — on iOS Safari, with momentum
 * scroll or a busy main thread, it lags the bar and a band hangs under the edge.
 *
 * So STICKY_TOP / PINNED_TOP_PHONE carry no transition, and when the bar's flag flips this hook
 * picks the motion, on the bar's own timing (conceal: medium / ease-slow, reveal: fast / ease-fast —
 * the TopBar's):
 *  - the row is PINNED (the common case: the bar toggles mid-page): its `top` jumps and the move is
 *    played back as a compositor animation of `transform`, from where the row was on screen to where
 *    the new `top` puts it — bar and row both composited, started in the same frame (the <html>
 *    flag is set in the bar's layout effect; the observer runs before paint);
 *  - the row is still IN FLOW: `top` changes nothing on screen yet, but the row may reach its stick
 *    point while the bar is still sliding — so its `top` transitions this once (an inline
 *    transition), and the stick point follows the bar's edge instead of jumping under / below it.
 * Reduced motion: the jump alone (the bar fades then).
 */

const parseMs = (v: string, fallback: number) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? (v.trim().endsWith('s') && !v.trim().endsWith('ms') ? n * 1000 : n) : fallback;
};

export function useFollowBar(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const phone = window.matchMedia(`(max-width: ${BREAKPOINT_MD - 1}px)`);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let concealed = root.hasAttribute(BAR_CONCEALED_ATTR);
    let running: Animation | null = null;
    let inlineTimer = 0;
    // Read once: the observer must not read any style before it sets the inline transition (a read
    // would flush the new `top` untransitioned).
    const tokens = getComputedStyle(root);
    const timing = {
      conceal: { duration: parseMs(tokens.getPropertyValue('--duration-medium'), 300), easing: tokens.getPropertyValue('--ease-slow').trim() || 'ease-out' },
      reveal: { duration: parseMs(tokens.getPropertyValue('--duration-fast'), 180), easing: tokens.getPropertyValue('--ease-fast').trim() || 'ease-out' },
    };
    /** Where the row was last seen on screen (its running animation included), and whether it was pinned. */
    let seen = 0;
    let seenPinned = false;
    let seenShown = false;
    const remember = () => {
      const rect = el.getBoundingClientRect();
      seen = rect.top;
      seenShown = el.getClientRects().length > 0;
      seenPinned = seenShown && rect.top - currentTranslateY(el) <= (parseFloat(getComputedStyle(el).top) || 0) + 0.5 && window.scrollY > 0;
    };
    remember();

    const observer = new MutationObserver(() => {
      const now = root.hasAttribute(BAR_CONCEALED_ATTR);
      if (now === concealed) return;
      concealed = now;
      const before = seen;
      running?.cancel();
      running = null;
      window.clearTimeout(inlineTimer);
      const { duration, easing } = now ? timing.conceal : timing.reveal;
      const animate = phone.matches && !reduce.matches && seenShown;
      if (animate && !seenPinned) {
        // In flow: the stick point follows the bar's edge (set BEFORE the next style read, so the
        // `top` change it sees transitions).
        el.style.transition = `top ${duration}ms ${easing}`;
        inlineTimer = window.setTimeout(() => {
          el.style.transition = '';
          remember();
        }, duration + 50);
        return;
      }
      el.style.transition = '';
      const after = el.getBoundingClientRect().top;
      remember();
      if (!animate) return;
      const delta = Math.max(-PHONE_BAR_PX, Math.min(PHONE_BAR_PX, before - after));
      if (Math.abs(delta) < 0.5) return;
      const frames: Keyframe[] = [{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }];
      try {
        running = el.animate(frames, { duration, easing });
      } catch {
        // An engine without CSS linear() easing: the same move on a plain curve.
        running = el.animate(frames, { duration, easing: 'ease-out' });
      }
      running.onfinish = () => {
        running = null;
        remember();
      };
    });
    observer.observe(root, { attributes: true, attributeFilter: [BAR_CONCEALED_ATTR] });
    window.addEventListener('scroll', remember, { passive: true });
    window.addEventListener('resize', remember);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', remember);
      window.removeEventListener('resize', remember);
      running?.cancel();
      window.clearTimeout(inlineTimer);
      el.style.transition = '';
    };
  }, [ref]);
}

/** The row's own vertical translate right now (the follow animation's), in px. */
function currentTranslateY(el: HTMLElement): number {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return 0;
  return new DOMMatrixReadOnly(t).m42;
}

/**
 * The shell's usePinned for a row that follows the bar (useFollowBar): pinned = its box, minus the
 * follow animation's offset, sits at its own `top` — so the row does not read as unpinned (mini
 * title fading, surface dropping) while it is still sliding to its new place. Flags the sticky
 * stack while pinned, so the bar above drops its shadow.
 */
export function usePinnedFollowingBar(ref: RefObject<HTMLElement | null>): boolean {
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      // display:none at this width (a phone-only row on a desktop): never pinned.
      if (el.getClientRects().length === 0) return setPinned(false);
      const top = parseFloat(getComputedStyle(el).top) || 0;
      const next = el.getBoundingClientRect().top - currentTranslateY(el) <= top + 0.5 && window.scrollY > 0;
      setPinned(prev => (prev === next ? prev : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref]);
  useStackPinnedFlag(pinned);
  useFollowBar(ref);
  return pinned;
}
