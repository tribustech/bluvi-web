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
 * `retry` re-renders the server page (router.refresh). Each attempt that fails again mounts a
 * fresh sr-only alert (the card itself stays, so the focused button keeps focus), so the repeated
 * failure is announced again; nothing claims success — a success replaces this card with the panel.
 */
export function DashboardError({
  title = 'Panoul nu s-a putut încărca.',
  description = 'Verifică conexiunea și încearcă din nou.',
  retry = false,
  retryLabel = 'Încearcă din nou',
  action,
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
  className?: string;
}) {
  const router = useRouter();
  const [retrying, start] = useTransition();
  const [attempt, setAttempt] = useState(0);
  return (
    <div className={cn(STATE_CARD, className)}>
      <ListError
        title={title}
        description={description}
        retryLabel={retryLabel}
        retrying={retrying}
        secondaryAction={action}
        onRetry={
          retry
            ? () =>
                start(() => {
                  router.refresh();
                  // Commits with the refreshed tree: if this card is still there, the read failed again.
                  setAttempt((n) => n + 1);
                })
            : undefined
        }
      />
      {attempt > 0 ? (
        <p key={attempt} role="alert" className="sr-only">
          {title}
        </p>
      ) : null}
    </div>
  );
}
