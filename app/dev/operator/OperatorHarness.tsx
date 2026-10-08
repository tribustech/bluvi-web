'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ToastProvider } from '@/app/(site)/_shell/Toast';
import { useOperatorBookingActions } from '@/components/operator/actions/useOperatorBookingActions';
import { BookingDetailDialog, bookingDetailModel, useBookingDetailParam } from '@/components/operator';
import { BookingStatusPill } from '@/components/booking';
import { Button } from '@/components/ui/Button';
import { getLakeBookings, ownedLakesQuery, type BookingDTO } from '@/core/booking';
import { createBrowserTransport } from '@/lib/client/transport';

export function OperatorHarness() {
  return (
    <ToastProvider>
      <Harness />
    </ToastProvider>
  );
}

function Harness() {
  const t = useMemo(() => createBrowserTransport({ direct: false }), []);
  const lakes = useQuery(ownedLakesQuery(t));
  const lake = lakes.data?.[0] ?? null;
  const lakeId = lake?.documentId ?? '';
  const list = useQuery({
    queryKey: ['bookings', 'lake', lakeId, 'harness'],
    queryFn: () => getLakeBookings(t, lakeId, { bucket: 'all', pageSize: 50 }),
    enabled: !!lakeId,
  });
  const { bookingId, open, close } = useBookingDetailParam();
  const [seed, setSeed] = useState<BookingDTO | null>(null);
  const [nowMs] = useState(() => Date.now());
  const actions = useOperatorBookingActions({ lakeId, lakeName: lake?.name });

  return (
    <main className="mx-auto flex max-w-[1680px] flex-col gap-4 px-4 py-6 md:px-8">
      <h1 className="t-page-title">Operator · {lake?.name ?? '…'}</h1>
      {lakes.isError || list.isError ? <p role="alert">Nu am putut încărca rezervările.</p> : null}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3" data-testid="harness-bookings">
        {(list.data?.data ?? []).map((b) => {
          const m = bookingDetailModel(b, nowMs);
          return (
            <li key={b.documentId} data-row={b.documentId} className="flex flex-col gap-2 rounded-card bg-surface p-4 shadow-e1">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate t-body-strong">{m.name}</p>
                <BookingStatusPill status={b.bookingStatus} cancelledBy={b.cancelledBy} noShow={b.noShow} viewer="operator" />
              </div>
              <p className="t-caption text-muted">{m.periodLine}</p>
              <div className="flex gap-2">
                <Button size="compact" variant="secondary" onClick={() => { setSeed(null); open(b.documentId); }} aria-label={`Deschide ${b.code} după id`}>
                  După id
                </Button>
                <Button size="compact" variant="outline" onClick={() => { setSeed(b); open(b.documentId); }} aria-label={`Deschide ${b.code} din rând`}>
                  Din rând
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <BookingDetailDialog
        lakeId={lakeId}
        lakeName={lake?.name}
        bookingId={bookingId}
        seed={seed}
        onClose={close}
        actions={actions}
      />
      {actions.dialogs}
    </main>
  );
}
