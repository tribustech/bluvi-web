'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { WifiIcon } from '@heroicons/react/24/outline';
import { BAR_EDGE_TOP, SHELL_MAX } from '@/components/nav/shell';
import { BANNER_HEIGHT_VAR, useStackPinnedFlag } from '@/components/nav/stickyStack';
import { cn } from '@/components/ui/cn';

/** fish helpers/network/connectionQuality.ts bannerFor — the offline copy. */
const OFFLINE_MESSAGE = 'Nu ești conectat la internet.';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/**
 * The app-wide connection banner (fish contexts/NetInfoContextProvider.tsx, inventory
 * global.network-banner, shell.c16): while the browser is offline, «Nu ești conectat la internet.»
 * in a strip right under the top bar, sticky with it (56 / 64, at the top edge while the phone bar is
 * hidden), inside the shell's column — so it never covers the bar, the ☰ panel (an overlay above
 * it) or a page's bottom action bar. It is part of the sticky header stack: its height is published
 * as `--shell-banner-h` on <html>, and every pinned row (shell UNDER_BAR_TOP) sits under it instead
 * of under the bar, so neither ever covers the other; while it shows, the bar drops its shadow (the
 * banner's edge is the stack's). Online it
 * renders nothing: no empty strip. The server and the first client render are «online» (the
 * server cannot know), so hydration never mismatches.
 *
 * A polite live region (role=status) that stays mounted, so going offline is announced; back
 * online every active query is refetched (fish: quality back to ok → refetch), so a page stuck on
 * an error state recovers by itself. Enters with a short slide/fade (none under reduced motion).
 * The web reads the browser's online flag only — fish's quality probe (poor / server down) is not
 * ported yet.
 */
export function NetworkBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  const queryClient = useQueryClient();
  const wasOffline = useRef(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      void queryClient.refetchQueries({ type: 'active' });
    }
  }, [online, queryClient]);

  // Mount, then show: the strip slides in from its collapsed state (fish FadeInDown 260 ms; the medium step).
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(!online));
    return () => cancelAnimationFrame(id);
  }, [online]);

  // Publish the strip's height (0 / unset online) for the rows pinned under it.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => {
      const h = el.offsetHeight;
      if (h > 0) root.style.setProperty(BANNER_HEIGHT_VAR, `${h}px`);
      else root.style.removeProperty(BANNER_HEIGHT_VAR);
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty(BANNER_HEIGHT_VAR);
    };
  }, []);
  useStackPinnedFlag(!online);

  return (
    <div ref={ref} role="status" className={cn('sticky z-sticky mx-auto', BAR_EDGE_TOP, SHELL_MAX)}>
      {online ? null : (
        <p
          className={cn(
            'flex items-center justify-center gap-2 border-b border-status-danger-line bg-status-danger-bg px-4 py-2 text-center t-body-strong text-status-danger-fg',
            'transition-[opacity,translate] duration-(--duration-medium) ease-out motion-reduce:transition-none',
            shown ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100',
          )}
        >
          <WifiIcon aria-hidden className="size-5 shrink-0" />
          {OFFLINE_MESSAGE}
        </p>
      )}
    </div>
  );
}
