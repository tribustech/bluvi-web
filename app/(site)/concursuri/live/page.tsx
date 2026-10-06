import type { Metadata } from 'next';
import { CompetitionsRoute, competitionsMetadata } from '../_list/CompetitionsRoute';
import type { UrlParams } from '../_list/place';

/*
 * /concursuri/live — the «Live» tab of the Concursuri list as its own page (fish app/(app)/competitions/started/index.tsx — parity competitions-list.live).
 * A static segment: it wins over /concursuri/[id] (competition ids are cuids).
 */

export const metadata: Metadata = competitionsMetadata('started');

export default function Page({ searchParams }: { searchParams: Promise<UrlParams> }) {
  return <CompetitionsRoute tab="started" searchParams={searchParams} />;
}
