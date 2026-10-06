import type { Metadata } from 'next';
import { CompetitionsRoute, competitionsMetadata } from '../_list/CompetitionsRoute';
import type { UrlParams } from '../_list/place';

/*
 * /concursuri/rezultate — the «Rezultate» tab of the Concursuri list as its own page (fish app/(app)/competitions/completed/index.tsx — parity competitions-list.incheiate).
 * A static segment: it wins over /concursuri/[id] (competition ids are cuids).
 */

export const metadata: Metadata = competitionsMetadata('completed');

export default function Page({ searchParams }: { searchParams: Promise<UrlParams> }) {
  return <CompetitionsRoute tab="completed" searchParams={searchParams} />;
}
