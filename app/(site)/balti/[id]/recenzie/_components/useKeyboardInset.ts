'use client';

import { useEffect } from 'react';

/**
 * The on-screen keyboard's height over the page (VisualViewport): written to
 * `--review-kb-inset` on <html> while the form is mounted, so the sticky action bar
 * (`bottom-[var(--review-kb-inset,0px)]`) rides above the keyboard instead of under it — a phone
 * browser shrinks only the visual viewport, the sticky bar stays on the layout viewport's bottom.
 * 0 without a keyboard, and on every browser without the API.
 */
export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      // Pinch-zoom also shrinks the visual viewport: only a keyboard-sized gap counts.
      root.style.setProperty('--review-kb-inset', inset > 80 && vv.scale <= 1.01 ? `${inset}px` : '0px');
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.removeProperty('--review-kb-inset');
    };
  }, []);
}
