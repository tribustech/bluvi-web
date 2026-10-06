'use client';

import { useCallback, useState } from 'react';

/**
 * The avatar photos that failed to load (a dead CMS URL): the kit Avatar has no fallback for a
 * broken <img> yet, so the list listens for image errors (capture phase: `error` does not bubble)
 * and the card renders the initials instead. TODO(kit, ui owner): Avatar should keep a `failed`
 * state from its <img> onError and show the initials itself; then drop this.
 */
export function useBrokenImages<T extends HTMLElement>() {
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  // A callback ref: the list mounts after the tab (behind its Suspense boundary).
  const ref = useCallback((el: T | null) => {
    if (!el) return;
    const mark = (img: HTMLImageElement) => {
      const src = img.getAttribute('src');
      if (src) setBroken(b => (b.has(src) ? b : new Set(b).add(src)));
    };
    const onError = (e: Event) => {
      if (e.target instanceof HTMLImageElement) mark(e.target);
    };
    el.addEventListener('error', onError, true);
    // One that failed before hydration (server-rendered, no listener yet).
    el.querySelectorAll('img').forEach(img => {
      if (img.complete && img.naturalWidth === 0) mark(img);
    });
    return () => el.removeEventListener('error', onError, true);
  }, []);
  return [ref, broken] as const;
}

/** A photo URL, or none when it failed to load (useBrokenImages): the initials instead. */
export const photo = (src: string | null | undefined, broken: ReadonlySet<string>) => (src && !broken.has(src) ? src : undefined);
