'use client';

import type { CompetitionCard } from '@/core/competitions';
import type { Transport } from '@/core/transport';
import { useMineStates, type DesktopViewer } from './data';
import { MineRows } from './MineRows';
import { useDesktop } from './motion';

/*
 * «Ale mele» from 1024 (owner-approved prototype A2, 2026-10-06): my registrations, led by my
 * status (./MineRows), on the same list the phone shows as fish's cards (same query, same pages,
 * same «Încarcă mai multe»). (Viitoare draws its own poster groups: ../upcoming.)
 * Rendered next to the cards and swapped by CSS at `lg` (no layout shift on hydration); the extra
 * reads start only once the viewport really is ≥1024.
 */

export type DesktopTab = 'mine';

type Props = { tab: DesktopTab; cards: CompetitionCard[]; t: Transport; viewer: DesktopViewer };

export function DesktopTabView(props: Props) {
  return <MineView {...props} />;
}

function MineView({ cards, t, viewer }: Props) {
  const states = useMineStates(t, cards, viewer, useDesktop());
  return <MineRows cards={cards} states={states} />;
}

/** The desktop views' loading bones: rows in the shape the tab will land in. */
export function DesktopRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col divide-y divide-hairline overflow-hidden rounded-card bg-surface shadow-e0">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-5 px-5 py-4">
          <span className="size-16 shrink-0 animate-pulse rounded-control bg-soft-fill" />
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="h-3 w-32 animate-pulse rounded-full bg-soft-fill" />
            <span className="h-4 w-2/3 animate-pulse rounded-full bg-soft-fill" />
            <span className="h-3 w-40 animate-pulse rounded-full bg-soft-fill" />
          </span>
          <span className="hidden h-8 w-48 animate-pulse rounded-full bg-soft-fill xl:block" />
          <span className="h-9 w-24 animate-pulse rounded-control bg-soft-fill" />
        </div>
      ))}
    </div>
  );
}
