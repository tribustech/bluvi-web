'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import { ListError } from '@/components/templates/T1/ListStates';
import { cn } from '@/components/ui/cn';
import { STATE_CARD } from './tones';

/**
 * Load failure with nothing cached (fish ErrorScreen under the header) — the templates' one
 * page-state card (T1 ListError: centred, danger disc, the retry inside the card). A failed
 * refetch WITH data keeps the data on screen instead — don't render this then.
 *
 * `retry` re-renders the server page (router.refresh, in a transition: the button stays focusable
 * and busy). A refresh that settles with this card still mounted failed again: the attempt count
 * goes up, the card's alert re-mounts (spoken again) and «Tot nu merge. Încercarea N.» shows under
 * the button (ListError). Nothing claims success — a success replaces this card with the panel.
 * `attempt` overrides the count for a caller that has its own (TanStack errorUpdateCount).
 */
export function DashboardError({
  title = 'Panoul nu s-a putut încărca.',
  description = 'Verifică conexiunea și încearcă din nou.',
  retry = false,
  retryLabel = 'Încearcă din nou',
  action,
  attempt: attemptOverride,
  className,
}: {
  title?: string;
  description?: ReactNode;
  /** Offer «Încearcă din nou» (not for a refusal: 403 / 404 have nothing to retry). */
  retry?: boolean;
  retryLabel?: string;
  /**
   * The way out that is not a retry, inside the card (a secondary ButtonLink): a refusal (403 /
   * 404) has nothing to retry, so it offers where to go instead («Vezi bălțile tale»).
   */
  action?: ReactNode;
  /** How many times the read has failed (1 = the first failure); counted here when omitted. */
  attempt?: number;
  className?: string;
}) {
  const router = useRouter();
  const [retrying, start] = useTransition();
  const [attempt, setAttempt] = useState(1);
  const [wasRetrying, setWasRetrying] = useState(retrying);
  if (wasRetrying !== retrying) {
    setWasRetrying(retrying);
    // A refresh that settles with this card still mounted failed again.
    if (!retrying) setAttempt((n) => n + 1);
  }
  return (
    <div className={cn(STATE_CARD, className)}>
      <ListError
        title={title}
        description={description}
        retryLabel={retryLabel}
        retrying={retrying}
        attempt={attemptOverride ?? attempt}
        secondaryAction={action}
        onRetry={retry ? () => start(() => router.refresh()) : undefined}
      />
    </div>
  );
}
