'use client';

import type { RefObject } from 'react';
import { usePinned } from '@/components/nav/stickyStack';

/*
 * Owner rule 3 (ROADMAP §4b: a sticky header never floats), phone. The pinned T3 rows follow the
 * top bar by CSS alone (metrics STICKY_TOP / PINNED_TOP_PHONE): the bar and the rows move by the
 * same property (`top`) on the same timing, switched by one <html> flag — one mechanism, so they
 * cannot desync, also during iOS momentum scroll. No script moves them.
 */

/**
 * Whether a T3 row pinned under the bar is stuck (the shell's usePinned: its box at its own
 * `top`, read live while that `top` slides with the bar). Flags the sticky stack while pinned, so
 * the bar above drops its shadow.
 */
export function usePinnedFollowingBar(ref: RefObject<HTMLElement | null>): boolean {
  return usePinned(ref);
}
