import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Harness } from './Harness';

export const metadata: Metadata = { title: 'Operator · acțiuni rezervare', robots: { index: false } };

/**
 * Dev harness for operator.actiuni-rezervare (tests/e2e/operator-actiuni-rezervare.spec.ts): the
 * bookings named in `?ids=a,b` (GET /feed/bookings/:id, owner-gated), each with the action row the
 * inbox / panel / detail give it, all acting through useOperatorBookingActions. `?lake=` scopes the
 * operator stats read (default: local Chita), `?rep=` mounts one angler's reputation read, so the e2e
 * can watch what each write invalidates.
 */
export default function OperatorActionsHarnessPage() {
  return (
    <Suspense fallback={null}>
      <Harness />
    </Suspense>
  );
}
