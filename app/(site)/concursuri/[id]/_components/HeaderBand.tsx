'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * ≥1440 main is held to 1120px and centred in the content column: the header band's white (and
 * the tab strip's hairline) continue into the column's side gutters, and stop at the column's
 * edges, so they never reach the side menu.
 *
 * The band is a pseudo-element behind the header, widened by `--band-gutter` on each side. The
 * gutter is measured (column width − main width) / 2, because CSS cannot tell the column width
 * apart from a classic scrollbar. Before hydration a conservative estimate (assuming a scrollbar
 * up to 16px) stands in: at worst a few px short, never over the menu or past the viewport.
 */
export function HeaderBand({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const main = el?.closest('main');
    const column = main?.parentElement;
    if (!el || !main || !column) return;
    const update = () => {
      const gutter = Math.max(0, (column.clientWidth - main.clientWidth) / 2);
      el.style.setProperty('--band-gutter', `${gutter}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(column);
    ro.observe(main);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="relative isolate [--band-gutter:max(0px,calc((100vw-248px-1120px-16px)/2))] 2xl:before:absolute 2xl:before:inset-y-0 2xl:before:right-[calc(-1*var(--band-gutter))] 2xl:before:left-[calc(-1*var(--band-gutter))] 2xl:before:-z-10 2xl:before:border-b 2xl:before:border-hairline 2xl:before:bg-surface 2xl:before:content-['']"
    >
      {children}
    </div>
  );
}
