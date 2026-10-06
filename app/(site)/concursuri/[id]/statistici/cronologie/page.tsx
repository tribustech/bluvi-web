import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { competitionQuery } from '@/core/competitions';
import { HydrateQueries } from '@/lib/client/hydration';
import { absoluteUrl, routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../../../_shell/SiteHeader';
import { COMPETITIONS_CRUMB } from '../../_components/crumbs';
import { loadCompetition } from '../../_components/load';
import { TimelineScreen, TimelineScreenSkeleton } from './TimelineScreen';

/*
 * /concursuri/<id>/statistici/cronologie — «Cronologia standurilor» on the whole page (fish
 * app/(app)/competitions/stand-timeline/[competitionId].tsx; parity competition-page.cronologie):
 * the back control, the title, the chart with every stand. Opened from the Statistici card (its
 * expand control and «Vezi toate»).
 *
 * The snapshot is a signed-in read (as the Statistici view it belongs to): the competition core
 * is the cached public read (prerendered for completed competitions), the chart loads in the
 * browser. Not indexed (no content without a session); the canonical is the page itself.
 */

type Props = { params: Promise<{ id: string }> };

export { generateStaticParams } from '../../page';
export const instant = false;

const TITLE = 'Cronologia standurilor';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const load = await loadCompetition(id);
  if (load.kind === 'missing') return { title: 'Concursul nu a fost găsit' };
  if (load.kind === 'invalid') return { title: TITLE, robots: { index: false } };
  const c = load.competition;
  const canonical = routes.competitionStandTimeline(c.documentId);
  const title = `${TITLE} · ${c.name}`;
  const description = `Evoluția scorului fiecărui stand pe parcursul concursului ${c.name}${c.lake?.name ? `, ${c.lake.name}` : ''}.`;
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: false, follow: true },
    openGraph: { type: 'website', title, description, url: absoluteUrl(canonical), siteName: 'Bluvi', locale: 'ro_RO' },
  };
}

export default async function StandTimelinePage({ params }: Props) {
  const { id } = await params;
  const load = await loadCompetition(id);
  if (load.kind === 'missing') notFound();
  const name = load.kind === 'invalid' ? 'Concurs' : load.competition.name;
  return (
    <>
      <SetBreadcrumb
        trail={[
          COMPETITIONS_CRUMB,
          { label: name, href: routes.competition(id) },
          { label: 'Statistici', href: routes.competitionStatistics(id) },
          { label: TITLE },
        ]}
      />
      <Suspense fallback={<TimelineScreenSkeleton id={id} />}>
        <HydrateQueries queries={t => [competitionQuery(t, id, { isAuthenticated: false })]} tags={[`competition-${id}`]}>
          <TimelineScreen id={id} />
        </HydrateQueries>
      </Suspense>
    </>
  );
}
