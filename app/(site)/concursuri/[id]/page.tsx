import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { competitionQuery, rankingsQuery } from '@/core/competitions';
import { HydrateQueries } from '@/lib/client/hydration';
import { absoluteUrl, routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../_shell/SiteHeader';
import { CompetitionScreen } from './_components/CompetitionScreen';
import { competitionDateLabel, competitionDateTime } from './_components/dates';
import { competitionJsonLd, competitionSummary, completedCompetitionIds, loadCompetition } from './_components/load';

/*
 * Concurs · Clasament — fish app/(app)/competitions/[competitionId].tsx (Clasament tab).
 *
 * The competition core and its ranking are public CMS reads (auth 'none'): cached under the
 * CMS's own CDN-Cache-Control (30 s live, 30 days completed) and purged through the
 * `competition-<id>` tag, so completed competitions are fully static. The browser takes over the
 * same queries (HydrateQueries); everything per-user (follow state, statute, active weighing,
 * chat) loads there.
 *
 * The competition is read (and an unknown id 404s) BEFORE any Suspense boundary. In `next dev`
 * that is a real HTTP 404; in production an id outside generateStaticParams is served from the
 * prerendered shell, so the 200 is already committed and Next injects `noindex` with the
 * not-found UI instead (docs: streaming.md, «The HTTP contract»; checked 2026-10-04). A real
 * production 404 would need an existence check in proxy.ts. The read is the cached public GET
 * that generateMetadata shares.
 */

type Props = { params: Promise<{ id: string }> };

// The page blocks on the competition read on purpose (real HTTP 404, above): without this the dev
// validator reports every non-prerendered id (live, upcoming) as a blocking route in the console.
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
  if (load.kind !== 'ok' && load.kind !== 'unsupported') return { title: 'Concurs', robots: { index: false } };
  const c = load.competition;
  const description = competitionSummary(c);
  const canonical = routes.competition(c.documentId);
  const image = c.banner?.formats.large?.url ?? c.banner?.url;
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
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title: c.name, description },
  };
}

export default async function CompetitionPage({ params }: Props) {
  const { id } = await params;
  const load = await loadCompetition(id);
  if (load.kind === 'missing') notFound();
  if (load.kind === 'invalid') {
    return (
      // Design «Eroare header»: a centred, text-only card (a shape core cannot read at all).
      <div className="px-4 py-6 md:px-6 xl:px-8 xl:py-8">
        <div role="alert" className="flex min-h-[115px] items-center justify-center rounded-card bg-surface px-6 text-center shadow-e0">
          <p className="t-body-strong">Ceva nu a mers bine, vă rugăm să încercați din nou mai târziu.</p>
        </div>
      </div>
    );
  }
  const c = load.competition;
  const dates = {
    label: competitionDateLabel(c.startDate, c.endDate),
    start: competitionDateTime(c.startDate),
    end: competitionDateTime(c.endDate),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // JSON-LD: `<` escaped so CMS text can never close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(competitionJsonLd(c)).replace(/</g, '\\u003c') }}
      />
      {/* «Competiții» is not linked until the competitions list page (/concursuri) exists. */}
      <SetBreadcrumb trail={[{ label: 'Competiții' }, { label: c.name }]} />
      {load.kind === 'ok' ? (
        <HydrateQueries
          queries={t => [
            competitionQuery(t, id, { isAuthenticated: false }),
            rankingsQuery(t, id, c.competitionStatus),
          ]}
          tags={[`competition-${id}`]}
        >
          <CompetitionScreen id={id} dates={dates} />
        </HydrateQueries>
      ) : (
        // Feeder (or a newer ranking type): header + preview from the loosened core, the ranking
        // as «indisponibil pe web». The browser cannot parse this core either, so it is handed down.
        <CompetitionScreen id={id} dates={dates} unsupported={c} />
      )}
    </>
  );
}
