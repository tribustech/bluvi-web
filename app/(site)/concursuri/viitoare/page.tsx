import type { Metadata } from 'next';
import { CompetitionsRoute, competitionsMetadata } from '../_list/CompetitionsRoute';
import type { UrlParams } from '../_list/place';

/*
 * /concursuri/viitoare — the «Viitoare» tab of the Concursuri list as its own page (fish app/(app)/competitions/notStarted/index.tsx — parity competitions-list.viitoare).
 * A static segment: it wins over /concursuri/[id] (competition ids are cuids).
 */

export const metadata: Metadata = competitionsMetadata('notStarted');

export default function Page({ searchParams }: { searchParams: Promise<UrlParams> }) {
  return <CompetitionsRoute tab="notStarted" searchParams={searchParams} />;
}
