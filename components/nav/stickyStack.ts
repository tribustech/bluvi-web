'use client';

import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { BREAKPOINT_MD } from '@/components/surfaces/rule';

/*
 * The sticky header stack (top bar → offline banner → a page's pinned row), driven by plain state
 * on <html> so every member follows one value and nothing depends on `:has()` invalidation (which
 * WebKit handles differently while scrolling):
 *  - `data-bar-concealed`: the phone bar has slid away (SiteTopBar useConcealOnScroll). Pinned rows
 *    move to the top edge with it (shell UNDER_BAR_TOP), section anchors drop the bar's 56px.
 *  - `--shell-banner-h`: the offline banner's height (NetworkBanner; unset = 0). Pinned rows sit
 *    under it instead of under the bar, so the banner never covers them nor they it.
 *  - `data-stack-pinned`: some row is pinned under the bar. Only the lowest member of the stack
 *    casts the shadow (TopBar drops its e1), so bar + row read as one header with a hairline.
 */

export const BAR_CONCEALED_ATTR = 'data-bar-concealed';
export const STACK_PINNED_ATTR = 'data-stack-pinned';
export const BANNER_HEIGHT_VAR = '--shell-banner-h';

/** The phone bar's height (TopBar h-14). Only the phone bar ever conceals. */
export const PHONE_BAR_PX = 56;
/** The phone bar comes back within its own height of the top (SiteTopBar useConcealOnScroll). */
export const CONCEAL_TOP_PX = PHONE_BAR_PX;

const isPhone = () => window.matchMedia(`(max-width: ${BREAKPOINT_MD - 1}px)`).matches;

/** Mirrors the phone bar's concealed state onto <html> (same commit as the bar's own attribute). */
export function useBarConcealedFlag(concealed: boolean) {
  useLayoutEffect(() => {
    if (!concealed) return;
    const root = document.documentElement;
    root.setAttribute(BAR_CONCEALED_ATTR, '');
    return () => root.removeAttribute(BAR_CONCEALED_ATTR);
  }, [concealed]);
}

/** How many stack members are pinned right now (a row may unmount while pinned). */
let pinnedCount = 0;

/** Marks <html> while `on` (counted, so two pinned rows on one page never clear each other). */
export function useStackPinnedFlag(on: boolean) {
  useLayoutEffect(() => {
    if (!on) return;
    const root = document.documentElement;
    pinnedCount += 1;
    root.setAttribute(STACK_PINNED_ATTR, '');
    return () => {
      pinnedCount = Math.max(0, pinnedCount - 1);
      if (pinnedCount === 0) root.removeAttribute(STACK_PINNED_ATTR);
    };
  }, [on]);
}

/**
 * Whether a sticky element is pinned (its box sits at its own `top`, the page scrolled), measured
 * on scroll / resize; flags the stack while it is, so the bar above it drops its shadow.
 */
export function usePinned(ref: RefObject<HTMLElement | null>): boolean {
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
      const next = el.getBoundingClientRect().top <= top + 0.5 && window.scrollY > 0;
      setPinned((prev) => (prev === next ? prev : next));
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
  return pinned;
}

/**
 * The scroll-margin an element will have once a programmatic scroll from `fromY` to `toY` ends.
 * Its computed scroll-margin follows the bar's state *now* (shell `data-bar-concealed` variants),
 * but a jump down conceals the phone bar and a jump up reveals it — so the target is computed for
 * the state the page will be in, and the heading lands 12px under the pinned rows either way.
 */
export function settledScrollMargin(el: HTMLElement, fromY: number, toY: number): number {
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  if (!isPhone()) return margin;
  const concealedNow = document.documentElement.hasAttribute(BAR_CONCEALED_ATTR);
  const concealedThen = toY > fromY ? toY >= CONCEAL_TOP_PX : false;
  return margin + (concealedNow ? PHONE_BAR_PX : 0) - (concealedThen ? PHONE_BAR_PX : 0);
}
