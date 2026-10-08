'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useOperatorBookingActions } from '@/components/operator/actions/useOperatorBookingActions';
import { Button } from '@/components/ui/Button';
import { bookingActionGates, bookingName, bookingPeriod, bookingQuery, formatLei, type BookingDTO } from '@/core/booking';
import { lakeOperatorStatsQuery } from '@/core/lakes';
import { userReputationQuery } from '@/core/social';
import { createBrowserTransport } from '@/lib/client/transport';

const CHITA = 's84u55lo4n9z0emngozttt6e';

export function Harness() {
  const sp = useSearchParams();
  const ids = (sp.get('ids') ?? '').split(',').filter(Boolean);
  const lakeId = sp.get('lake') ?? CHITA;
  const rep = sp.get('rep') ?? undefined;
  const t = useMemo(() => createBrowserTransport(), []);
  const actions = useOperatorBookingActions({ lakeId, lakeName: 'Chita Lake' });
  const stats = useQuery(lakeOperatorStatsQuery(t, lakeId));
  const reputation = useQuery(userReputationQuery(t, rep));

  return (
    <div className="flex flex-col gap-4 px-4 py-6 md:px-6 xl:px-8">
      <header className="flex flex-col gap-1">
        <p className="t-eyebrow text-muted uppercase">Dev · operator</p>
        <h1 className="t-title1 text-ink">Acțiuni rezervare</h1>
        <p className="t-caption text-muted" data-testid="harness-stats">
          {stats.data ? `De aprobat: ${stats.data.pending}` : 'Statistici…'}
          {rep ? ` · reputație ${reputation.data ? 'încărcată' : '…'}` : ''}
        </p>
      </header>
      <ul className="grid gap-3 md:grid-cols-[repeat(auto-fill,minmax(--spacing(90),1fr))]">
        {ids.map((id) => (
          <Row key={id} id={id} actingId={actions.actingId} actions={actions} />
        ))}
      </ul>
      {actions.dialogs}
    </div>
  );
}

function Row({ id, actingId, actions }: { id: string; actingId: string | null; actions: ReturnType<typeof useOperatorBookingActions> }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const q = useQuery(bookingQuery(t, id));
  const b: BookingDTO | undefined = q.data;
  if (!b) return <li className="h-32 animate-pulse rounded-card bg-soft-fill" />;
  const { isPending, canCancel } = bookingActionGates(b);
  const acting = actingId === b.documentId;
  return (
    <li className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-e0" data-testid={`row-${id}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="t-body-strong truncate text-ink">{bookingName(b)}</p>
          <p className="t-caption text-muted">
            {b.stand?.name ? `Stand ${b.stand.name} · ` : ''}
            {bookingPeriod(b)}
          </p>
        </div>
        <p className="shrink-0 whitespace-nowrap">
          <span className="t-body-strong tabular-nums text-ink">{formatLei(b.priceTotal)}</span>{' '}
          <span className="t-caption text-muted">lei</span>
        </p>
      </div>
      <p className="t-caption text-ink-2" data-testid={`status-${id}`}>
        {b.noShow ? 'noShow' : b.bookingStatus}
      </p>
      {isPending ? (
        <div className="flex justify-end gap-2">
          <Button size="compact" variant="danger" icon={<XMarkIcon />} disabled={acting} onClick={() => actions.reject(b)}>
            Refuză
          </Button>
          <Button size="compact" icon={<CheckIcon />} disabled={acting} onClick={() => actions.accept(b)}>
            Acceptă
          </Button>
        </div>
      ) : canCancel ? (
        <div className="flex justify-end gap-2">
          <Button size="compact" variant="danger" disabled={acting} onClick={() => actions.cancel(b)}>
            Anulează rezervarea
          </Button>
        </div>
      ) : null}
    </li>
  );
}
