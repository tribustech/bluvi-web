'use client';

import { formatPenaltyTimestamp, penaltyActionLabel, type GatheredPenalty } from '@/core/organizer';
import { formatDecimal } from '@/components/cards/format';
import { InlineNumber } from '@/components/ui/SignatureNumber';
import { cn } from '@/components/ui/cn';

/*
 * One applied penalty (fish penalties/[competitionId]/index.tsx:164-211, parity organizer.penalties
 * c4/c6): the marker — red for «Eliminare», yellow otherwise —, the action («Penalizare greutate ·
 * 1,5 kg», the unit its own muted word, rule 10), the competitor «Stand N · nume», the reason and
 * «autor · dd.mm.yyyy, hh:mm» (no author → «Organizator»). «Revocă» only when the viewer may.
 */

export function penaltyHeadline(p: Pick<GatheredPenalty, 'action' | 'value'>): string {
  const label = penaltyActionLabel(p.action);
  return p.action === 'DEDUCT_TOTAL_WEIGHT' && p.value != null ? `${label} · ${formatDecimal(p.value, 0, 3)} kg` : label;
}

export function PenaltyCard({
  penalty: p,
  canRevoke,
  revoking,
  onRevoke,
}: {
  penalty: GatheredPenalty;
  canRevoke: boolean;
  revoking: boolean;
  onRevoke: () => void;
}) {
  const eliminate = p.action === 'ELIMINATE';
  const label = penaltyActionLabel(p.action);
  return (
    <li
      className={cn('flex items-start gap-3 rounded-card border border-hairline bg-surface p-4', eliminate && 'border-status-danger-line')}
      data-testid={`penalty-${p.documentId}`}
      data-action={p.action}
    >
      <span
        aria-hidden
        data-testid="penalty-marker"
        data-tone={eliminate ? 'danger' : 'warning'}
        className={cn('mt-1.5 h-3.5 w-2.5 shrink-0 rounded-badge', eliminate ? 'bg-status-danger-fg' : 'bg-badge-yellow-fg')}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h3 className="t-heading text-ink" data-testid="penalty-action">
          {p.action === 'DEDUCT_TOTAL_WEIGHT' && p.value != null ? (
            <>
              {label} ·{' '}
              <InlineNumber value={formatDecimal(p.value, 0, 3)} unit="kg" valueClassName="t-heading text-ink" />
            </>
          ) : (
            label
          )}
        </h3>
        <p className="t-caption text-muted" data-testid="penalty-team">
          {p.teamLabel}
        </p>
        {p.reason ? (
          <p className="t-body-strong mt-1 break-words text-ink-2" data-testid="penalty-reason">
            {p.reason}
          </p>
        ) : null}
        <p className="t-caption mt-1 text-muted tabular-nums" data-testid="penalty-author">
          {p.author?.username || 'Organizator'} · {formatPenaltyTimestamp(p.createdAt)}
        </p>
      </div>
      {canRevoke ? (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={`Revocă: ${penaltyHeadline(p)}, ${p.teamLabel}`}
          aria-busy={revoking || undefined}
          onClick={onRevoke}
          data-testid={`revoke-${p.documentId}`}
          className={cn(
            't-label -my-2 -mr-2 shrink-0 cursor-pointer rounded-control px-2 py-3 text-status-danger-fg',
            'hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          )}
        >
          Revocă
        </button>
      ) : null}
    </li>
  );
}
