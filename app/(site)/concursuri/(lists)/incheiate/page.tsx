import type { Metadata } from 'next';
import { StatusListPage, statusListMetadata } from '../_status/StatusListPage';

/* fish app/(app)/competitions/completed/index.tsx — parity competitions-list.incheiate. */

export const metadata: Metadata = statusListMetadata('incheiate');

export default function Page() {
  return <StatusListPage list="incheiate" />;
}
