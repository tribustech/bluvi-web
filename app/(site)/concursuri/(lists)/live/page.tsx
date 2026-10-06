import type { Metadata } from 'next';
import { StatusListPage, statusListMetadata } from '../_status/StatusListPage';

/* fish app/(app)/competitions/started/index.tsx — parity competitions-list.live. */

export const metadata: Metadata = statusListMetadata('live');

export default function Page() {
  return <StatusListPage list="live" />;
}
