import type { Metadata } from 'next';
import { CompetitionRoute } from '../_components/CompetitionRoute';
import { competitionTabMetadata } from '../_components/tabMetadata';

/*
 * /concursuri/<id>/participanti — the competition's «Participanți» tab (fish CompetitionParticipants; parity
 * competition-page.b.tab-deep-links): the same header and tab strip as Clasament, this tab's body.
 * Its own title, description and canonical (tabMetadata.ts); the same prerendered completed ids
 * as ../page (the body is the static core: completed competitions are fully static).
 *
 * `?filtru=` (in-asteptare | aprobati | respinsi; lib/routes competitionParticipants) is the
 * organizer's registrations filter (competition-page.participanti-organizator). It is read on the
 * client by the author's list (_components/registrations/RegistrationsList.tsx, useSearchParams) —
 * not awaited here, so this page stays prerendered for everyone else.
 */
export { generateStaticParams } from '../page';
// Segment config is read statically from each page file, so it is not re-exported: same opt-out as ../page.
export const instant = false;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return competitionTabMetadata(id, 'participanti');
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  return <CompetitionRoute id={id} tab="participanti" />;
}
