import type { Metadata } from 'next';
import { CompetitionsRoute, competitionsMetadata } from './_list/CompetitionsRoute';
import type { UrlParams } from './_list/place';

/* /concursuri — Live when at least one competition is live, else Viitoare (./_list/CompetitionsRoute). */

export const metadata: Metadata = competitionsMetadata();

export default function CompetitionsPage({ searchParams }: { searchParams: Promise<UrlParams> }) {
  return <CompetitionsRoute searchParams={searchParams} />;
}
