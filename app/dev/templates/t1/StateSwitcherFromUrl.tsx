'use client';

import { useSearchParams } from 'next/navigation';
import { parseDemoState, StateSwitcher } from './StateSwitcher';

/**
 * The state band with its current pill read from the URL — for the layout's fallback, which cannot
 * read searchParams itself: the active pill is marked from the first paint, never re-highlighted.
 */
export function StateSwitcherFromUrl() {
  return <StateSwitcher current={parseDemoState(useSearchParams().get('state') ?? undefined)} />;
}
