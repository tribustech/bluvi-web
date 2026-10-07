import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { absoluteUrl, routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../../../_shell/SiteHeader';
import { COMPETITIONS_CRUMB } from '../../_components/crumbs';
import { loadCompetition } from '../../_components/load';
import { e2eFault } from './e2e-faults';
import { effectiveImageQuery, imageQueryString, imageSummary, parseImageQuery, viewLabel, type ImageQuery } from './model';
import { plannedSheet, planRankingImage, type ImagePlan } from './plan';
import { RankingImageScreen, type RankingImageScreenProps } from './RankingImageScreen';

/*
 * /concursuri/<id>/clasament/imagine — «Imagine clasament» (fish app/(app)/competitions/
 * ranking-image.tsx + ranking-image-cn.tsx; parity competition-page.imagine-clasament). Opened from
 * «Clasament complet» (its «Imagine» button) with the table the reader had, named in the query
 * (model.ts): the link is shareable and survives a reload (c10).
 *
 * The competition core is the cached public read (as the competition page; a 404 is a real 404:
 * notFound() before anything streams). It alone decides the band (title, competition, the view in
 * words) and the PNG's URL — both from the EFFECTIVE query (model.ts effectiveImageQuery), never
 * the raw URL. The plan (plan.ts, the same decision png/route.tsx makes: the ranking read + the
 * model) streams in under it: until it lands the stage shows its skeleton; then «nothing to draw»
 * renders at once and the PNG is never requested, or the sheet's planned geometry shapes the
 * skeleton while the browser fetches the PNG (generating → ready / failed). When the plan's
 * ranking read fails, the browser's fetch decides instead.
 *
 * SEO: a utility view of the ranking — not indexed (the competition page is the canonical
 * content). Its Open Graph / Twitter image is the segment's file-convention card
 * (opengraph-image.tsx: the competition card labelled «Imagine clasament», with the podium once it
 * is over — parity global.b.seo-og-images), never named here: file-based metadata overrides this
 * object, and a 1200×630 card previews well where the tall ranking sheet would be cropped.
 */

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const TITLE = 'Imagine clasament';

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  const load = await loadCompetition(id).catch(() => null);
  if (!load) return { title: TITLE, robots: { index: false } };
  if (load.kind === 'missing') return { title: 'Concursul nu a fost găsit' };
  if (load.kind === 'invalid') return { title: TITLE, robots: { index: false } };
  const c = load.competition;
  const requested = parseImageQuery(await searchParams);
  // The plan's reads are the page's own cached reads: free here. A failure only drops the image.
  const plan = await planRankingImage(id, requested).catch(() => null);
  const query = imageQueryString(plan && plan.kind !== 'missing' ? plan.query : effectiveImageQuery(c, requested));
  const canonical = routes.competitionRankingImage(c.documentId, query);
  const title = `${TITLE} · ${c.name}`;
  const description = `Clasamentul concursului ${c.name}${c.lake?.name ? ` de pe ${c.lake.name}` : ''}, ca imagine de descărcat și distribuit.`;
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: false, follow: true },
    openGraph: {
      type: 'website',
      title,
      description,
      url: absoluteUrl(canonical),
      siteName: 'Bluvi',
      locale: 'ro_RO',
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function RankingImagePage({ params, searchParams }: Props) {
  const { id } = await params;
  await e2eFault(id, 'competition');
  const load = await loadCompetition(id);
  if (load.kind === 'missing') notFound();
  const name = load.kind === 'invalid' ? 'Concurs' : load.competition.name;
  const rankingType = load.kind === 'invalid' ? '' : load.competition.rankingType;
  const requested = parseImageQuery(await searchParams);
  const query = load.kind === 'invalid' ? requested : effectiveImageQuery(load.competition, requested);
  const label = viewLabel(rankingType, query);
  const screen: RankingImageScreenProps = {
    id,
    name,
    subtitle: label.full,
    phoneSubtitle: label.short,
    fileUrl: routes.competitionRankingImageFile(id, imageQueryString(query)),
    backHref: routes.competition(id),
    defaultHref: routes.competitionRankingImage(id),
    sheet: null,
  };
  return (
    <>
      <SetBreadcrumb
        trail={[COMPETITIONS_CRUMB, { label: name, href: routes.competition(id) }, { label: 'Clasament', href: routes.competitionRanking(id) }, { label: TITLE }]}
      />
      <Suspense fallback={<RankingImageScreen {...screen} planning />}>
        <PlannedScreen screen={screen} query={query} view={label.full} />
      </Suspense>
    </>
  );
}

/** The plan (the ranking read + the model), streamed under the band: the stage's skeleton until it lands. */
async function PlannedScreen({ screen, query, view }: { screen: RankingImageScreenProps; query: ImageQuery; view: string }) {
  let plan: ImagePlan | null = null;
  try {
    plan = await planRankingImage(screen.id, query);
  } catch (e) {
    // The ranking read failed or timed out: the browser's fetch of the PNG decides (with its own retry).
    console.error('[imagine-clasament] plan failed', e);
  }
  return (
    <RankingImageScreen
      {...screen}
      initial={plan?.kind === 'empty' ? { kind: 'empty', reason: plan.reason } : undefined}
      sheet={plan?.kind === 'ok' ? plannedSheet(plan) : null}
      summary={plan?.kind === 'ok' ? imageSummary(plan.model, view) : undefined}
    />
  );
}
