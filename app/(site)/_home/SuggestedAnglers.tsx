'use client';

import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { suggestedAnglersHomeInfiniteQuery, withoutDismissed, type SuggestedAngler } from '@/core/social';
import { createBrowserTransport } from '@/lib/client/transport';
import { dismissedStore, useDismissedSuggestions } from '@/components/account/suggestions/dismissedStore';
import { SuggestedAnglerCard } from '@/components/account/suggestions/SuggestedAnglerCard';
import { announce, prepareAnnouncer, restoreFocusTo } from './announce';
import { HorizontalRail, RailItem, HOME_RAIL_BLEED } from './HorizontalRail';
import { RailSection } from './RailSection';
import { homeLinks } from './links';

/** Under this many VISIBLE cards the whole section disappears (fish, spec 2026-09-04). */
const MIN_VISIBLE_SUGGESTIONS = 3;

/**
 * fish features/anglers/components/SuggestedAnglersRail.tsx — signed in only, page 1 only, no
 * skeleton (a thin pool would watch a placeholder collapse into nothing): the section appears once
 * loaded and only with at least three visible cards.
 *
 * fish: a refresh never reshuffles the rail (useSuggestedAnglersHome cache policy). On the web the
 * page refresh re-renders the server prefetch, which hydrates a fresh page 1 — so the order (and
 * the set) of the first answer is pinned for the life of the page; later data only updates the
 * cards it shows (a follow).
 */
export function SuggestedAnglers() {
  const t = useMemo(() => createBrowserTransport(), []);
  const { data, isPending, isError } = useInfiniteQuery(suggestedAnglersHomeInfiniteQuery(t, { isAuthenticated: true }));
  // Shared with /pescari/sugerati for the browser session (account.b.suggestion-dismissals).
  const hidden = useDismissedSuggestions();
  const latest = data?.pages[0]?.data;
  const [pinned, setPinned] = useState<SuggestedAngler[] | undefined>(latest);
  if (pinned === undefined && latest !== undefined) setPinned(latest);
  const visible = useMemo(() => {
    const byId = new Map((latest ?? []).map((a) => [a.documentId, a]));
    return withoutDismissed((pinned ?? []).map((a) => byId.get(a.documentId) ?? a), hidden);
  }, [pinned, latest, hidden]);

  if (isPending || isError || visible.length < MIN_VISIBLE_SUGGESTIONS) return null;

  return (
    <RailSection title="Pescari pe care îi poți urmări" href={homeLinks.suggestedAnglers}>
      <PrepareAnnouncer />
      <HorizontalRail
              className={HOME_RAIL_BLEED} label="Pescari sugerați" width={160}>
        {visible.map((a, i) => (
          <RailItem key={a.documentId} width={160}>
            {/* fish's one SuggestedAnglerCard, followSource «home_rail» (the same card as «Vezi toate»). */}
            <SuggestedAnglerCard angler={a} source="home_rail" headingLevel={3} onDismiss={(e) => dismiss(e, visible, i)} />
          </RailItem>
        ))}
      </HorizontalRail>
    </RailSection>
  );
}

/** The announcer must exist before its first message (see announce.ts). */
function PrepareAnnouncer() {
  useEffect(() => prepareAnnouncer(), []);
  return null;
}

/**
 * Hides one suggestion without dropping keyboard focus: it moves to the next card's dismiss (else
 * the previous one's); when the rail falls under three cards and the whole section goes, to the
 * next section's heading. Either way «Sugestie ascunsă» is announced.
 */
function dismiss(e: MouseEvent<HTMLButtonElement>, visible: SuggestedAngler[], i: number) {
  const section = e.currentTarget.closest('section');
  const neighbour = visible[i + 1] ?? visible[i - 1];
  const collapses = visible.length - 1 < MIN_VISIBLE_SUGGESTIONS;
  let target: HTMLElement | null | undefined = null;
  if (!collapses && neighbour) {
    target = section?.querySelector<HTMLElement>(`[data-dismiss="${CSS.escape(neighbour.documentId)}"]`);
  } else {
    // The next block's heading in the same column, else this column's next focusable heading.
    let next = section?.nextElementSibling;
    while (next && !next.querySelector('h2, h3')) next = next.nextElementSibling;
    target = next?.querySelector<HTMLElement>('h2, h3');
  }
  dismissedStore.dismiss(visible[i].documentId);
  announce('Sugestie ascunsă.');
  if (target) restoreFocusTo(target);
}
