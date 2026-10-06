'use client';

import { useEffect } from 'react';
import { DetailRetry, focusLandingSpot } from '@/components/templates/T3';

/*
 * Where focus goes after a successful «Încearcă din nou» (WCAG 2.4.3): the retry button unmounts
 * when the content replaces the error, which would drop focus to <body> — a keyboard or
 * screen-reader user thrown to the top of the document with nothing announced. So the retry marks
 * what it retried, and the content that replaces it takes focus on its heading once:
 *  - the page (error.tsx → `markPageRetry`) → the lake's h1 (FocusAfterRetry target «balta-titlu»);
 *  - a section (SectionRetry) → that section's h2 («concursuri-titlu», «recenzii-titlu»).
 * TODO(kit): DetailRetry / DetailError could do this themselves (focus `closest('section') h2`).
 */

const WINDOW_MS = 30_000;
let pending: { key: string; at: number } | null = null;

/** A retry is about to run: the content that replaces its error takes focus (FocusAfterRetry). */
export const markRetry = (key: string) => {
  pending = { key, at: Date.now() };
};
const mark = markRetry;

/** error.tsx: the page retry is about to run. */
export const markPageRetry = () => mark('page');

/** A section's «Încearcă din nou» (the kit DetailRetry) that hands focus to the section on success. */
export function SectionRetry({ section }: { section: string }) {
  return (
    <span className="contents" onClickCapture={() => mark(section)}>
      <DetailRetry />
    </span>
  );
}

/** Rendered by the content that replaces an error: focuses `#<target>` once, if its retry ran. */
export function FocusAfterRetry({ retry, target }: { retry: string; target: string }) {
  useEffect(() => {
    if (!pending || pending.key !== retry || Date.now() - pending.at > WINDOW_MS) return;
    const el = document.getElementById(target);
    // A copy that is not on screen (the phone's inline block while the docked one shows) leaves
    // the retry to the copy that is.
    if (!el || el.getClientRects().length === 0) return;
    pending = null;
    focusLandingSpot(el, { preventScroll: false });
  }, [retry, target]);
  return null;
}
