import type { ReactNode } from 'react';

/*
 * The «În lumina reflectoarelor» section frame and its bones. No client hooks: the page's server
 * fallback (../CompetitionsRoute) draws the same bones before the list hydrates.
 */

export const SPOTLIGHT_TITLE_ID = 'concursuri-reflectoare';

/** The tab's Top: the live band over the spotlight (../tabs/UpcomingTab and the page's shell). */
export const UPCOMING_TOP = 'flex flex-col gap-8 xl:gap-10';

/** How many people «În lumina reflectoarelor» asks for (the server prefetches the same key). */
export const SPOTLIGHT_LIMIT = 6;

export function SpotlightFrame({ children, busy = false }: { children: ReactNode; busy?: boolean }) {
  return (
    <section aria-labelledby={SPOTLIGHT_TITLE_ID} aria-busy={busy || undefined} data-spotlight="" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id={SPOTLIGHT_TITLE_ID} className="t-title2 text-ink">
          În lumina reflectoarelor
        </h2>
        <span className="t-caption text-muted">Pescari de urmărit</span>
      </div>
      {children}
    </section>
  );
}

/** The big tile and four small ones (two by two from 768, a shelf on the phone). */
export function SpotlightSkeleton() {
  return (
    <SpotlightFrame busy>
      <div aria-hidden className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 md:gap-4">
        <span className="block min-h-56 animate-shimmer rounded-bento md:col-span-2 xl:col-span-1" />
        <span className="-mx-4 flex gap-3 overflow-hidden px-4 md:col-span-2 md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:px-0 xl:col-span-1">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="block min-h-47 w-64 shrink-0 animate-shimmer rounded-bento md:w-auto" />
          ))}
        </span>
      </div>
    </SpotlightFrame>
  );
}
