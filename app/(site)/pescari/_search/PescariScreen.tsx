'use client';

import { useEffect, useMemo, useState } from 'react';
import { SetBreadcrumb } from '@/app/(site)/_shell/SiteHeader';
import type { Crumb } from '@/components/nav/Breadcrumbs';
import { ICON_BUTTON_SIZE } from '@/components/nav/IconButton';
import { useBack } from '@/components/nav/useBack';
import { ListHeader, ListPage, useListUrlState } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { BrowseSections, BrowseSkeleton } from './BrowseSections';
import { ResultsList } from './ResultsList';
import { SearchField, SearchFieldPlaceholder } from './SearchField';

export const TITLE = 'Pescari';

/** «Acasă / Pescari» on the ≥768 band. */
export const TRAIL: Crumb[] = [{ label: 'Acasă', href: routes.home() }, { label: TITLE }];

/** fish SEARCH_DEBOUNCE_MS. */
export const SEARCH_DEBOUNCE_MS = 300;
/** Searching starts at 2 characters (fish, and the server's own minimum). */
export const MIN_SEARCH = 2;

/**
 * Pescari — fish app/(app)/partide/pescari.tsx (parity partide.pescari, T1), behind the page's
 * requireViewer gate (c1). The page's per-user data (isFollowedByMe, the viewer's suggestions)
 * loads in the browser through /api/cms.
 *
 *  - Header: back (in-app history, else Home) + h1 «Pescari» (c2), then the «Caută pescari» field.
 *  - The field's value is debounced 300 ms (Enter settles it at once); a settled term of 2+
 *    characters (trimmed) is a search (c4, ResultsList), anything shorter is browse mode (c3,
 *    BrowseSections) — as in fish, a single letter shows the suggestions again.
 *  - The settled term lives in the URL (?q=, T1 useListUrlState: replaceState, no history entry
 *    per keystroke), so a reload, the browser's back from a profile and a shared link keep it.
 *  - Rows / cards (c5, AnglerRow) open /pescari/{id}; the viewer's own one is marked «Tu».
 */
export function PescariScreen({ viewerId, initialQuery }: { viewerId: string; initialQuery: string }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const back = useBack(routes.home());
  const [raw, setRaw] = useState(initialQuery);
  const [term, setTerm] = useState(initialQuery.trim());

  useEffect(() => {
    const id = setTimeout(() => setTerm(raw.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [raw]);

  useListUrlState({ q: term || null });

  const searching = term.length >= MIN_SEARCH;

  return (
    <>
      <SetBreadcrumb trail={TRAIL} />
      <ListPage header={<ListHeader title={TITLE} back={{ label: 'Înapoi', onClick: back }} />}>
        <SearchField
          value={raw}
          onChange={setRaw}
          onSubmit={() => setTerm(raw.trim())}
          onClear={() => {
            setRaw('');
            setTerm('');
          }}
        />
        <div className="mt-2 md:mt-3">
          {searching ? <ResultsList t={t} term={term} viewerId={viewerId} /> : <BrowseSections t={t} viewerId={viewerId} />}
        </div>
      </ListPage>
    </>
  );
}

/**
 * The whole page while the gate reads the session (loading.tsx and the page's Suspense fallback):
 * the real title, the back control's place, the field's shell and «Activi recent» over the skeleton entries (the browse mode's own loading). The
 * header mirrors ListHeader's box by hand (its back control needs a client handler).
 */
export function PescariPageLoading() {
  return (
    <>
      <SetBreadcrumb trail={TRAIL} />
      <ListPage
        header={
          <div className="flex min-h-12 items-center gap-3 xl:min-h-10">
            <span aria-hidden className={cn(ICON_BUTTON_SIZE, 'shrink-0 rounded-control bg-surface shadow-e0')} />
            <h1 className="min-w-0 flex-1 t-title1 text-ink">{TITLE}</h1>
          </div>
        }
      >
        <SearchFieldPlaceholder />
        <div className="mt-2 md:mt-3">
          <BrowseSkeleton />
        </div>
      </ListPage>
    </>
  );
}
