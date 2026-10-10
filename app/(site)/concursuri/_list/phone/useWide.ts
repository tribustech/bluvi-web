'use client';

import { useSyncExternalStore } from 'react';

/*
 * Which of /concursuri's two layouts is on screen: fish's Competiții tab below 768 (ROADMAP §4b
 * rule 25) or the approved web layouts from 768. The server (and the hydration pass) cannot know:
 * it answers null and the page draws both, each hidden by CSS at the other's widths. Once mounted
 * the answer is real and the hidden layout is not rendered at all, so its reads (the Live strip's
 * 30s poll, the bento's person and featured draws) never run where nobody sees them.
 */

const QUERY = '(min-width: 768px)';

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** true from 768, false below, null until the client knows (server render and hydration). */
export function useWide(): boolean | null {
  return useSyncExternalStore<boolean | null>(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => null,
  );
}
