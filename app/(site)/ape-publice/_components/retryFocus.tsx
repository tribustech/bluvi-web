'use client';

import { useEffect } from 'react';
import { focusLandingSpot } from '@/components/templates/T3';

/*
 * Where focus goes after a successful page «Încearcă din nou» (WCAG 2.4.3) — the lake page's
 * RetryFocus (balti/[id]/_components/RetryFocus.tsx) for the public-water screens: the retry button
 * unmounts when the page replaces the error, which would drop focus to <body>; so the error marks
 * the retry and the page that replaces it focuses its <h1> once.
 */

const WINDOW_MS = 30_000;
let pending: number | null = null;

/** error.tsx: the page retry is about to run. */
export const markWaterRetry = () => {
  pending = Date.now();
};

/** Rendered by the loaded screen: focuses `#<target>` once, if a page retry just ran. */
export function FocusAfterWaterRetry({ target }: { target: string }) {
  useEffect(() => {
    if (pending == null || Date.now() - pending > WINDOW_MS) return;
    pending = null;
    const el = document.getElementById(target);
    if (!el) return;
    focusLandingSpot(el, { preventScroll: false });
  }, [target]);
  return null;
}
