'use client';

import { T4Notice, T4Spinner } from '@/components/templates/T4';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { STATE_CARD_FRAME } from '@/components/templates/stateCard';

/*
 * What the step shows when there is no price to review — fish features/lakes/booking/QuoteUnavailable
 * (c3). Three ways to arrive, not the same thing: the answer is not back yet, the lake refuses this
 * tour (a 200 carrying its own sentence — the server's on purpose: a rule added next month explains
 * itself), or the request failed (no network, a 500). Every one offers «Înapoi la selecție» (the grid,
 * without the selection); a failure also «Încearcă din nou». The step has no CTA meanwhile.
 */

export function QuoteUnavailable({
  state,
  retrying,
  onRetry,
  onBack,
}: {
  state: { kind: 'quoting' } | { kind: 'refused'; message: string } | { kind: 'failed' };
  retrying?: boolean;
  onRetry: () => void;
  onBack: () => void;
}) {
  const back = (
    <Button variant="outline" size="compact" onClick={onBack} data-testid="quote-unavailable-back">
      Înapoi la selecție
    </Button>
  );
  if (state.kind === 'quoting') {
    return (
      <div className={cn(STATE_CARD_FRAME, 'flex flex-col items-center gap-3 rounded-card bg-surface px-5 py-8 text-center shadow-e0 md:py-10')}>
        <p role="status" data-testid="quote-pending" className="t-body flex items-center gap-2 text-muted">
          <T4Spinner className="text-accent-ink" />
          Se calculează prețul…
        </p>
        {back}
      </div>
    );
  }
  const refused = state.kind === 'refused';
  return (
    <T4Notice
      tone="danger"
      role="alert"
      className={STATE_CARD_FRAME}
      title={refused ? state.message : 'Nu am putut calcula prețul pentru acest interval.'}
      actions={
        <>
          {refused ? null : (
            <Button
              variant="secondary"
              size="compact"
              onClick={onRetry}
              disabled={retrying}
              aria-busy={retrying || undefined}
              data-testid="quote-unavailable-retry"
            >
              Încearcă din nou
            </Button>
          )}
          {back}
        </>
      }
    >
      {refused ? 'Alege alt interval sau alt stand.' : 'Verifică legătura la internet și încearcă din nou.'}
    </T4Notice>
  );
}
