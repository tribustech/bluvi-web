'use client';

import { useCallback, useEffect, useRef } from 'react';

/*
 * Nothing leaves the review while its submit runs (c2; fish setPending → the flow's goBack ignored,
 * the header frozen) — the angler review's own guard (rezerva/confirmare/ReviewStep.tsx,
 * booking.b.double-submit-guard), for the walk-in:
 *  - a click on any same-tab link (the site header's too) is swallowed before Next's <Link> sees it;
 *  - a traversal, push or replace to another URL is cancelled through the Navigation API;
 *  - without the API, a sentinel entry over the review turns the browser's Back into a no-op.
 * `freeze()` when the submit starts; `thaw(stay)` when it ends — `stay`: the review goes on (an
 * error it shows), the sentinel is popped; a way out (success) replaces it.
 */

type NavigationLike = {
  addEventListener?: (t: 'navigate', l: (e: Event) => void) => void;
  removeEventListener?: (t: 'navigate', l: (e: Event) => void) => void;
};
type NavigateEventLike = Event & { navigationType?: string; cancelable: boolean; hashChange?: boolean; destination?: { url: string } };

const FREEZE_MARK = 'bluviWalkInFrozen';

function navigationApi(): NavigationLike | undefined {
  return (window as unknown as { navigation?: NavigationLike }).navigation;
}

export function useSubmitFreeze(onHold: (holding: boolean) => void) {
  const frozen = useRef(false);
  const sentinel = useRef(false);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!frozen.current || e.defaultPrevented) return;
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!a || (a as HTMLAnchorElement).target === '_blank' || a.hasAttribute('download')) return;
      e.preventDefault();
    };
    const navApi = navigationApi();
    const onNavigate = (e: Event) => {
      const ev = e as NavigateEventLike;
      if (!frozen.current || !ev.cancelable || ev.hashChange) return;
      // Next's own bookkeeping (a replace of this very URL) passes; leaving does not.
      if (ev.navigationType !== 'traverse' && ev.destination?.url === window.location.href) return;
      ev.preventDefault();
    };
    const onPop = () => {
      if (!frozen.current || !sentinel.current) return;
      if ((window.history.state as Record<string, unknown> | null)?.[FREEZE_MARK]) return;
      window.history.pushState({ [FREEZE_MARK]: 1 }, '', window.location.href);
    };
    window.addEventListener('click', onClick, true);
    if (navApi?.addEventListener) navApi.addEventListener('navigate', onNavigate);
    else window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('click', onClick, true);
      navApi?.removeEventListener?.('navigate', onNavigate);
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  const freeze = useCallback(() => {
    frozen.current = true;
    onHold(true);
    if (navigationApi()?.addEventListener || sentinel.current) return;
    sentinel.current = true;
    window.history.pushState({ [FREEZE_MARK]: 1 }, '', window.location.href);
  }, [onHold]);

  const thaw = useCallback(
    (stay: boolean) => {
      frozen.current = false;
      if (stay) onHold(false);
      if (!sentinel.current) return;
      sentinel.current = false;
      if (stay && (window.history.state as Record<string, unknown> | null)?.[FREEZE_MARK]) window.history.back();
    },
    [onHold],
  );

  return { freeze, thaw };
}
