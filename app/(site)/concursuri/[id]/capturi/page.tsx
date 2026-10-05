import { CompetitionRoute } from '../_components/CompetitionRoute';

/*
 * /concursuri/<id>/capturi: the competition screen with the «capturi» view already open (parity
 * competition-page.b.tab-deep-links), so the server renders that view's panel. Same metadata (its
 * canonical is /concursuri/<id>) and the same prerendered completed ids as ../page.
 */
export { generateMetadata, generateStaticParams } from '../page';
// Segment config is read statically from each page file, so it is not re-exported: same opt-out as ../page.
export const instant = false;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CompetitionRoute id={id} initialView="allFish" />;
}
