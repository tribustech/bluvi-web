import { Suspense } from 'react';
import { competitionQuery, competitionWeighingStatisticsQuery, rankingsQuery } from '@/core/competitions';
import { HydrateQueries, type Prefetchable } from '@/lib/client/hydration';
import { routes } from '@/lib/routes';
import { DetailBackButton, DetailError } from '@/components/templates/T3';
import { ButtonLink } from '@/components/ui/Button';
import { notFound } from 'next/navigation';
import { BreadcrumbBand } from '@/components/nav/Breadcrumbs';
import { COMPETITIONS_CRUMB } from './crumbs';
import { CompetitionScreen } from './CompetitionScreen';
import { CompetitionSkeleton } from './CompetitionSkeleton';
import { HEADER_ERROR_COPY, skeletonVariantOf } from './screen-state';
import { competitionDateLabel, competitionDateProse, competitionDateTime, competitionStartShort, competitionDateTimeCompact, displayEnd } from './dates';
import { competitionPageJsonLd, loadCompetition } from './load';
import { VIEWS, viewPath, type RankingViewKey } from './views';
import { COMPETITION_TABS, type CompetitionTab } from './tabs';
import type { HeaderCore } from './headerMeta';
import { jsonLdHtml } from '@/lib/json-ld';

/**
 * The band's trail and BreadcrumbList: Concursuri › {concurs} on Clasament, › {tab} on a route tab,
 * › {view} on a Clasament view with its own path (/cantare «Cântare», /capturi «Toți peștii»,
 * /statistici). The last step carries the page's own path (the visible crumb is never a link), so the
 * JSON-LD's last item is the page (global.b.seo-json-ld j2).
 */
function competitionTrail(name: string, id: string, tab: CompetitionTab, view: RankingViewKey) {
  const page = routes.competition(id);
  if (tab !== 'clasament') {
    const t = COMPETITION_TABS.find(x => x.key === tab)!;
    return [COMPETITIONS_CRUMB, { label: name, href: page }, { label: t.label, href: t.href(id) }];
  }
  if (view === 'clasament') return [COMPETITIONS_CRUMB, { label: name, href: page }];
  return [COMPETITIONS_CRUMB, { label: name, href: page }, { label: VIEWS.find(v => v.key === view)!.label, href: viewPath(page, view) }];
}

/** Only what the fallback header shows crosses to the client (not the whole core: registrations, sectors…). */
function headerCore(c: HeaderCore): HeaderCore {
  return { name: c.name, author: c.author, lake: c.lake, banner: c.banner, competitionStatus: c.competitionStatus };
}

/*
 * The competition page's body, shared by /concursuri/<id> (and /clasament) and the view segments
 * /cantare, /statistici, /capturi (parity competition-page.b.tab-deep-links): each segment renders
 * the same screen with its view already open, so the server sends that view's panel.
 */

/** The server prefetch of the ranking may take this long before the browser takes it over. */
const RANKING_BUDGET_MS = 2500;
/** The competition core, already read by load.ts (cached): the same bound as that read. */
const CORE_BUDGET_MS = 8000;

/**
 * A prefetch with a time budget: past it the queryFn rejects, which HydrateQueries treats as any
 * failed prefetch (skipped; the client query fetches and shows its own states).
 */
function withBudget<Q extends Prefetchable>(q: Q, ms: number): Q {
  const fn = q.queryFn;
  if (typeof fn !== 'function') return q;
  const queryFn = async (ctx: unknown) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`prefetch ${JSON.stringify(q.queryKey)}: over ${ms} ms`)), ms);
    });
    try {
      return await Promise.race([(fn as (ctx: unknown) => Promise<unknown>)(ctx), timeout]);
    } finally {
      clearTimeout(timer);
    }
  };
  return { ...q, queryFn } as Q;
}

export async function CompetitionRoute({
  id,
  initialView = 'clasament',
  tab = 'clasament',
}: {
  id: string;
  initialView?: RankingViewKey;
  /** The route tab (tabs.ts): Clasament (the ranking views) or Informații / Participanți / Extra Cântare / Regulament. */
  tab?: CompetitionTab;
}) {
  const load = await loadCompetition(id);
  if (load.kind === 'missing') notFound();
  if (load.kind === 'invalid') {
    // The CMS answered with a shape core cannot read at all (fish CompetitionHeader's error line,
    // parity competition-page.shell.c15): the T3 page error with error.tsx's back chip, no retry
    // (the same answer would come back) — the way on is Acasă.
    return (
      <>
        <DetailError
          trail={[COMPETITIONS_CRUMB]}
          back={<DetailBackButton fallbackHref={routes.home()} ground="page" />}
          heading="Concursul nu a putut fi afișat"
          description={HEADER_ERROR_COPY}
          action={
            <ButtonLink href={routes.home()} variant="secondary">
              Mergi la Acasă
            </ButtonLink>
          }
        />
      </>
    );
  }
  const c = load.competition;
  // An end before the start (seeded / reopened data) would print a backwards range: the start day
  // alone — the same clamp as the metadata and the JSON-LD (displayEnd).
  const endIso = displayEnd(c);
  const jsonLd = await competitionPageJsonLd(c, tab === 'clasament' ? initialView : null);
  const dates = {
    label: competitionDateLabel(c.startDate, endIso),
    prose: competitionDateProse(c.startDate, endIso),
    start: competitionDateTime(c.startDate),
    end: competitionDateTime(endIso),
    startShort: competitionStartShort(c.startDate),
    startCompact: competitionDateTimeCompact(c.startDate),
    endCompact: competitionDateTimeCompact(endIso),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // JSON-LD: `<` escaped so CMS text can never close the script tag.
        dangerouslySetInnerHTML={jsonLdHtml(jsonLd)}
      />
      {/* The breadcrumb band, server-rendered with the real title and its BreadcrumbList JSON-LD
          (the layout's band skips this route: SiteHeader ownsBreadcrumbBand), as the T3 demo. */}
      <BreadcrumbBand trail={competitionTrail(c.name, id, tab, initialView)} jsonLd />
      {load.kind === 'ok' ? (
        // The fallback is what the static shell carries (the screen is a TanStack client tree, which
        // suspends while prerendering): the header's real title and meta, so the first paint has
        // the competition's name (CompetitionSkeleton `head`).
        <Suspense
          fallback={
            <CompetitionSkeleton
              variant={skeletonVariantOf(c.competitionStatus)}
              rankingType={c.rankingType}
              head={{ competition: headerCore(c), datesProse: dates.prose }}
              tab={tab}
            />
          }
        >
          <HydrateQueries
            queries={t =>
              tab === 'clasament'
                ? [
                    withBudget(competitionQuery(t, id, { isAuthenticated: false }), CORE_BUDGET_MS),
                    withBudget(rankingsQuery(t, id, c.competitionStatus), RANKING_BUDGET_MS),
                    // The stat row's weighing tile (from 768): read here, so the row is painted once with
                    // its four tiles instead of three, then four (CLS).
                    withBudget(competitionWeighingStatisticsQuery(t, id, c.competitionStatus), RANKING_BUDGET_MS),
                  ]
                : // The other tabs draw from the core alone (Extra Cântare reads its list in the browser).
                  [withBudget(competitionQuery(t, id, { isAuthenticated: false }), CORE_BUDGET_MS)]
            }
            tags={[`competition-${id}`]}
          >
            <CompetitionScreen id={id} dates={dates} statusHint={c.competitionStatus} initialView={initialView} tab={tab} />
          </HydrateQueries>
        </Suspense>
      ) : (
        // A ranking type newer than this build (core cannot parse it): header + preview from the
        // loosened core, the ranking as «indisponibil pe web». Feeder legs and the club rankings are
        // parsed and drawn (FeederRanking.tsx, NcRanking.tsx). The browser cannot parse this core
        // either, so it is handed down.
        <CompetitionScreen id={id} dates={dates} unsupported={c} statusHint={c.competitionStatus} initialView={initialView} tab={tab} />
      )}
    </>
  );
}
