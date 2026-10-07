import type { Metadata } from 'next';
import { absoluteUrl, routes } from '@/lib/routes';
import { CompetitionRoute } from './_components/CompetitionRoute';
import { competitionSummary, completedCompetitionIds, loadCompetition } from './_components/load';

/*
 * Concurs · Clasament — fish app/(app)/competitions/[competitionId].tsx (Clasament tab).
 *
 * The competition core and its ranking are public CMS reads (auth 'none'): cached under the
 * CMS's own CDN-Cache-Control (30 s live, 30 days completed) and purged through the
 * `competition-<id>` tag, so completed competitions are fully static. The browser takes over the
 * same queries (HydrateQueries); everything per-user (follow state, statute, active weighing,
 * chat) loads there.
 *
 * Loading and 404: loading.tsx shows the page's skeleton while the competition is read, so the
 * 200 is committed first and an unknown id is a soft 404 (the not-found UI + `noindex`; docs:
 * streaming.md, «The HTTP contract»). Production was already soft for every id outside
 * generateStaticParams (served from the prerendered shell); the skeleton is worth losing the dev
 * 404. A real 404 would need an existence check in proxy.ts. The read is the cached public GET
 * that generateMetadata shares, bounded at 8 s (load.ts): a hung CMS ends in error.tsx.
 *
 * The body (CompetitionRoute) is shared with the view segments (cantare/, statistici/, capturi/).
 *
 * Streaming: loading.tsx is the band alone (the status is unknown until the read); once it lands,
 * the body's own skeleton (ranking / preview, skeletonVariantOf) shows while the ranking is
 * prefetched. That prefetch has a short budget (RANKING_BUDGET_MS): a slow ranking read is skipped,
 * so the header and tabs are never held back by it — the browser then reads it itself, with the
 * view's skeleton, error and «Încearcă din nou».
 */

type Props = { params: Promise<{ id: string }> };

// The page blocks on the competition read (behind loading.tsx): without this the dev validator
// reports every non-prerendered id (live, upcoming) as a blocking route in the console.
export const instant = false;

/**
 * Completed competitions never change again (modulo a tag purge), so they are prerendered.
 * Cache Components needs at least one param: an unknown placeholder renders the 404.
 */
export async function generateStaticParams() {
  const ids = await completedCompetitionIds();
  return (ids.length ? ids : ['_']).map(id => ({ id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const load = await loadCompetition(id);
  // Unknown id: the not-found UI emits its own `noindex`, so only the title is set here.
  if (load.kind === 'missing') return { title: 'Concursul nu a fost găsit' };
  if (load.kind === 'invalid') return { title: 'Concurs', robots: { index: false } };
  const c = load.competition;
  const description = competitionSummary(c);
  const canonical = routes.competition(c.documentId);
  return {
    title: c.lake?.name ? `${c.name} · ${c.lake.name}` : c.name,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      title: c.name,
      description,
      url: absoluteUrl(canonical),
      siteName: 'Bluvi',
      locale: 'ro_RO',
      // No `images` here: the segment's generated card (opengraph-image.tsx, parity global.b.seo-og-images)
      // is og:image — it already carries the photo, sized 1200×630, with its alt.
    },
    twitter: { card: 'summary_large_image', title: c.name, description },
  };
}


export default async function CompetitionPage({ params }: Props) {
  const { id } = await params;
  return <CompetitionRoute id={id} initialView="clasament" />;
}
