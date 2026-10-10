import type { ReactNode } from 'react';
import type { CompetitionCard } from '@/core/competitions';
import { CardSkeleton, CompetitionCardItem } from '../CompetitionCardItem';

/*
 * The phone's list (below 768) — fish's Competiții FlashList: one column of the compact «Listă»
 * card (CompetitionCardPreview, density compact: the 76 poster, date line with the followers pill,
 * name, lake, the two chips, the status footer), 10 apart (fish ItemSeparator), for every status
 * tab, «Ale mele» and results alike. The owner dropped the Listă / Afiș toggle (2026-10-06): the
 * phone keeps fish's default density. From 768 each tab keeps its approved layout (../tabs).
 */

export function PhoneList({
  cards,
  labelledBy,
  priorityCount = 0,
}: {
  cards: CompetitionCard[];
  labelledBy?: string;
  /** The first posters with nothing tall above them (LCP). */
  priorityCount?: number;
}) {
  return (
    <ul aria-labelledby={labelledBy} className="flex flex-col gap-2.5">
      {cards.map((c, i) => (
        <li key={c.documentId} className="min-w-0">
          <CompetitionCardItem competition={c} aligned={false} priority={i < priorityCount} />
        </li>
      ))}
    </ul>
  );
}

/** fish CompetitionsListSkeleton: compact card bones (role=status, spoken once). */
export function PhoneListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div role="status">
      <span className="sr-only">Se încarcă concursurile…</span>
      <ul aria-hidden className="flex flex-col gap-2.5">
        {Array.from({ length: count }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </ul>
    </div>
  );
}

/** fish ListEmptyComponent: the heading and its caption, centred, 40 above and below. */
export function PhoneEmpty({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-10 text-center">
      <p className="t-heading text-ink">{title}</p>
      <p className="t-caption text-muted">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
