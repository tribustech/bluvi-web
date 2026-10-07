import type { Metadata } from 'next';
import { CompetitionRoute } from '../_components/CompetitionRoute';
import { competitionViewMetadata } from '../_components/tabMetadata';

/*
 * /concursuri/<id>/statistici: the competition screen with the «statistici» view already open (parity
 * competition-page.b.tab-deep-links), so the server renders that view's panel. Its own metadata
 * (competitionViewMetadata) and the same prerendered completed ids as ../page.
 */

export { generateStaticParams } from '../page';

/** Its own title, description and canonical once the competition has started (tabMetadata.ts). */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return competitionViewMetadata((await params).id, 'statistici');
}
// Segment config is read statically from each page file, so it is not re-exported: same opt-out as ../page.
export const instant = false;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CompetitionRoute id={id} initialView="statistici" />;
}
