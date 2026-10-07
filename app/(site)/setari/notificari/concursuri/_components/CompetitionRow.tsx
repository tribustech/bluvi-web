'use client';

import { useId } from 'react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { AvatarPhoto } from '@/components/ui/AvatarPhoto';
import { cn } from '@/components/ui/cn';
import type { FollowedCompetition } from '@/core/competitions';
import { competitionInitials, mutedSummary } from './summary';

/** fish IMAGE = 36: the banner thumb's circle. Initials at the kit's 32 step (11px / 800). */
const THUMB = 'relative inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full font-extrabold leading-none text-initials-32 select-none';
/** fish $indigo4 disc with white letters: the kit's solid accent pair (AA in both themes). */
const INITIALS_TONE = 'bg-accent text-on-accent';

/**
 * One followed competition — fish notification-preferences.tsx renderItem (parity c4, c5): a
 * white row-card, the whole card one button named by the competition (its summary is the
 * description). The 36px banner thumb (the kit's remote photo: initials if it fails to load), or
 * the letters-only initials on the accent disc; the name bold on one line (the full name as the
 * title when cut); the summary under it, in the danger ink when some types are muted; a chevron.
 */
export function CompetitionRow({ item, onOpen }: { item: FollowedCompetition; onOpen: () => void }) {
  const summaryId = useId();
  const initials = competitionInitials(item.name);
  return (
    <li>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={item.name}
        aria-describedby={summaryId}
        title={item.name}
        onClick={onOpen}
        data-testid="followed-row"
        data-id={item.documentId}
        className="flex min-h-15 w-full cursor-pointer items-center gap-3 rounded-card bg-surface p-3 text-left shadow-e0 transition-shadow duration-(--duration-fast) ease-fast hover:shadow-e1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {item.bannerThumbUrl ? (
          <AvatarPhoto src={item.bannerThumbUrl} className={THUMB} fallbackClassName={INITIALS_TONE} initials={initials} a11y={{ 'aria-hidden': true }} />
        ) : (
          <span aria-hidden className={cn(THUMB, INITIALS_TONE)} data-testid="followed-initials">
            {initials}
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate t-body-strong text-ink">{item.name}</span>
          <span id={summaryId} className={cn('t-caption', item.mutedCount ? 'text-status-danger-fg' : 'text-muted')} data-testid="followed-summary">
            {mutedSummary(item.mutedCount)}
          </span>
        </span>
        <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-muted" />
      </button>
    </li>
  );
}
