import type { Metadata } from 'next';
import { StatusListPage, statusListMetadata } from '../_status/StatusListPage';

/* fish app/(app)/competitions/notStarted/index.tsx — parity competitions-list.viitoare. */

export const metadata: Metadata = statusListMetadata('viitoare');

export default function Page() {
  return <StatusListPage list="viitoare" />;
}
