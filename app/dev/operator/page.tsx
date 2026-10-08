import type { Metadata } from 'next';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { OperatorHarness } from './OperatorHarness';

export const metadata: Metadata = { title: 'Operator · harness', robots: { index: false } };

/**
 * Dev harness for the M7-B1 operator dialogs (operator.detaliu-rezervare, used by its e2e only): the
 * signed-in QA user's first owned lake (Chita locally) and its bookings, each openable in the booking
 * detail by id (?rezervare=, the panel's way: fetch + skeleton) or with the row as seed (the inbox's
 * way: painted at once, revalidated). Dev only: 404 in production builds.
 */
export default function OperatorHarnessPage() {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_KIT !== '1') notFound();
  return (
    <Suspense fallback={null}>
      <OperatorHarness />
    </Suspense>
  );
}
