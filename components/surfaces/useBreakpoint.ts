'use client';

import { useSyncExternalStore } from 'react';
import { BREAKPOINT_MD, BREAKPOINT_XL, type Breakpoint } from './rule';

const QUERIES = [`(min-width: ${BREAKPOINT_MD}px)`, `(min-width: ${BREAKPOINT_XL}px)`];

function subscribe(cb: () => void) {
  const lists = QUERIES.map((q) => window.matchMedia(q));
  lists.forEach((l) => l.addEventListener('change', cb));
  return () => lists.forEach((l) => l.removeEventListener('change', cb));
}

function snapshot(): Breakpoint {
  if (window.matchMedia(QUERIES[1]).matches) return 'desktop';
  if (window.matchMedia(QUERIES[0]).matches) return 'tablet';
  return 'mobile';
}

/** Current layout breakpoint (mobile <768, tablet 768–1279, desktop ≥1280). Server render: mobile. */
export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, snapshot, () => 'mobile');
}
