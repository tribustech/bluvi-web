'use client';

import { ChartBarIcon, MapIcon, PaperAirplaneIcon, PhotoIcon, UsersIcon } from '@heroicons/react/24/outline';
import { MapPinIcon } from '@heroicons/react/20/solid';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SetBreadcrumb } from '@/app/(site)/_shell/SiteHeader';
import {
  DetailAsideCard,
  DetailBand,
  DetailBody,
  DetailFacts,
  DetailHeader,
  DetailPage,
  DetailSection,
  DetailSectionNav,
  DetailSectionsProvider,
  DetailSectionToc,
  PRESENCE_ICON,
  type DetailSectionItem,
} from '@/components/templates/T3';
import { plural } from '@/components/cards/format';
import { ErrorState } from '@/components/surfaces/StateCard';
import { T2Spinner } from '@/components/templates/T2';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import {
  buildPublicWaterSectionChips,
  countiesHeading,
  PUBLIC_WATER_SECTION_LABEL,
  publicWaterFacts,
  publicWaterName,
  publicWaterSubtitle,
  type PublicWaterDetail,
} from '@/core/lakes';
import { communityVenueCatchesInfiniteQuery, communityVenueSectionQuery, hasPartideActivity } from '@/core/partide';
import { createBrowserTransport } from '@/lib/client/transport';
import { ON_WEB, routes } from '@/lib/routes';
import { CatchGrid, SpeciesChips } from './catches';
import { CoordinatesRow, DirectionsDialog, LinkCodeRow, QuickActions, waterDetailFacts, type QuickAction } from './parts';
import { VenuePartideSection } from './VenuePartideSection';
import { WaterHero } from './WaterHero';
import { FocusAfterWaterRetry } from '../retryFocus';
import { waterAltName as altName } from '../names';
import { waterTrail } from '../trail';

/*
 * The public-water page body — fish app/(app)/public-waters/[id].tsx on T3 (single scroll with
 * section chips, like the lake page): the still map hero, the title block, the sticky chips
 * (phone + tablet; the section index in the left column from 1280), then Prezentare, Partide,
 * Capturi, Locație. From 1280 the right column holds the water's facts and the way there.
 *
 * Remounted per water (keyed by the page), so a new water starts at Prezentare with no pagination
 * left over from the previous one (c30); Next scrolls the new page to the top.
 *
 * Targets the web does not have yet (/ape-publice/<id>/partide, /statistici, a partidă page) are
 * never dead links: the Partide and Statistici tiles are named in «În curând pe web: …», «Vezi tot»
 * is the muted «în curând» line, a live row is a plain row. Flip PUBLIC_WATER_ON_WEB in the batch
 * that ships the route.
 */

const PUBLIC_WATER_ON_WEB = { partide: true, statistici: true, partida: ON_WEB.partida } as const;

/** A promise React's `use` reads synchronously (already fulfilled), for the sections' `refined`. */
function settled<T>(value: T): Promise<T> {
  const p = Promise.resolve(value) as Promise<T> & { status?: string; value?: T };
  p.status = 'fulfilled';
  p.value = value;
  return p;
}

function sectionItems(key: string): DetailSectionItem[] {
  return (key.split('|') as (keyof typeof PUBLIC_WATER_SECTION_LABEL)[]).map((id) => ({ id, label: PUBLIC_WATER_SECTION_LABEL[id] }));
}

/** fish: the next catch page loads when the page is within 600px of its end. */
const END_REACHED_PX = 600;

export function PublicWaterScreen({
  routeId,
  water,
  countyNames,
  attribution,
}: {
  routeId: string;
  water: PublicWaterDetail;
  countyNames: string[];
  attribution: string | null;
}) {
  return <Screen key={water.id} routeId={routeId} water={water} countyNames={countyNames} attribution={attribution} />;
}

function Screen({ water, countyNames, attribution }: { routeId: string; water: PublicWaterDetail; countyNames: string[]; attribution: string | null }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const venue = useMemo(() => (water.linkCode ? ({ kind: 'water', code: water.linkCode } as const) : null), [water.linkCode]);
  const community = useQuery(communityVenueSectionQuery(t, venue));
  const catches = useInfiniteQuery(communityVenueCatchesInfiniteQuery(t, venue));
  const [directions, setDirections] = useState(false);

  const name = publicWaterName(water);
  const subtitle = publicWaterSubtitle(water);
  const key = water.linkCode ?? water.id;
  const facts = useMemo(() => waterDetailFacts(publicWaterFacts(water)), [water]);

  const catchesTotal = catches.data?.pages[0]?.meta.pagination.total ?? 0;
  const catchRows = useMemo(() => catches.data?.pages.flatMap((p) => p.data) ?? [], [catches.data]);
  const partideVisible = hasPartideActivity(community.data);
  const hasSpecies = (community.data?.speciesCounts?.length ?? 0) > 0;
  const idsKey = buildPublicWaterSectionChips({ hasPartide: partideVisible, hasCatches: catchesTotal > 0, hasSpecies }).join('|');
  const showPartide = idsKey.includes('partide');
  const showCapturi = idsKey.includes('capturi');
  const sections = useMemo(() => sectionItems(idsKey), [idsKey]);
  // The chip set changes when the community reads land / poll (a section appears or goes): the
  // provider takes the new list in place (no remount of the body).
  const refined = useMemo(() => settled(sections), [sections]);

  // c25: the next 20 catches when the page nears its end, one request at a time. A failed page is
  // not asked again by scrolling (that would flood the CMS): its own retry under the grid does it.
  const { hasNextPage, isFetchingNextPage, fetchNextPage, isFetchNextPageError } = catches;
  useEffect(() => {
    if (!hasNextPage || isFetchNextPageError) return;
    const check = () => {
      const doc = document.documentElement;
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - END_REACHED_PX && !isFetchingNextPage) void fetchNextPage();
    };
    window.addEventListener('scroll', check, { passive: true });
    return () => window.removeEventListener('scroll', check);
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);
  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage();
  };

  // The banner covers first-load failures (and a failed venue refresh); a failed NEXT page of
  // catches has its own line under the grid.
  const catchesFailed = catches.isError && !isFetchNextPageError;
  const communityFailed = venue != null && (community.isError || catchesFailed);
  // A retry of a read that never answered puts it back to «pending» (TanStack): the banner stays,
  // busy, until the retried reads settle — then it goes (they answered) or says they failed again.
  const [retrying, setRetrying] = useState(false);
  const retryCommunity = () => {
    if (retrying) return;
    setRetrying(true);
    // Only the failed read(s) again (c17).
    const runs = [community.isError ? community.refetch() : null, catchesFailed ? catches.refetch() : null];
    void Promise.allSettled(runs).then(() => setRetrying(false));
  };
  const scrollToCapturi = () => {
    const link = [...document.querySelectorAll<HTMLAnchorElement>('a[href="#capturi"]')].find((a) => a.getClientRects().length > 0);
    if (link) link.click();
    else document.getElementById('capturi')?.scrollIntoView();
  };

  const actions: QuickAction[] = [
    { key: 'directii', label: 'Direcții', icon: <PaperAirplaneIcon aria-hidden />, onClick: () => setDirections(true) },
    { key: 'harta', label: 'Hartă', icon: <MapIcon aria-hidden />, href: routes.publicWaterMap(key) },
    {
      key: 'partide',
      label: 'Partide',
      icon: <UsersIcon aria-hidden />,
      href: PUBLIC_WATER_ON_WEB.partide ? routes.publicWaterPartide(key) : undefined,
      badge: community.data?.stats.activeNow || undefined,
      badgeLabel: (n) => `${plural(n, 'partidă activă', 'partide active')} acum`,
    },
    { key: 'statistici', label: 'Statistici', icon: <ChartBarIcon aria-hidden />, href: PUBLIC_WATER_ON_WEB.statistici ? routes.publicWaterStats(key) : undefined },
    ...(catchesTotal > 0
      ? [{ key: 'capturi', label: 'Capturi', icon: <PhotoIcon aria-hidden />, onClick: scrollToCapturi, badge: catchesTotal, badgeLabel: (n: number) => plural(n, 'captură cu poză', 'capturi cu poză') }]
      : []),
  ];

  const alt = altName(water);
  const pin = <MapPinIcon aria-hidden className={cn(PRESENCE_ICON.meta, 'shrink-0 text-accent')} />;
  const meta = [
    <span key="sub" className="flex items-center gap-1 t-caption text-muted">
      {pin}
      {subtitle}
    </span>,
    ...(alt ? [<span key="alt">{`și: ${alt}`}</span>] : []),
  ];


  return (
    <>
      <SetBreadcrumb trail={waterTrail({ name, key })} />
      <FocusAfterWaterRetry target="apa-titlu" />
      <DetailPage>
        <DetailBand hairline={false}>
          <WaterHero water={water} name={name} mapHref={routes.publicWaterMap(key)} />
          <DetailHeader
            title={name}
            titleId="apa-titlu"
            meta={meta}
            className="md:pt-5"
            actions={
              // From 1280 «Cum ajungi» in the right column owns Direcții.
              <Button variant="secondary" icon={<PaperAirplaneIcon />} onClick={() => setDirections(true)} className="xl:hidden">
                Direcții
              </Button>
            }
          />
        </DetailBand>

        <DetailSectionsProvider sections={sections} refined={refined}>
          <DetailSectionNav
            pinnedTitle={name}
            pinnedMeta={
              <>
                {pin}
                <span className="truncate">{subtitle}</span>
              </>
            }
          />
          <DetailBody
            left={<DetailSectionToc />}
            asideBelowXl="hidden"
            asideSticky
            aside={
              <>
                {facts.length ? (
                  <DetailAsideCard title="Detalii">
                    <DetailFacts facts={facts} layout="list" />
                  </DetailAsideCard>
                ) : null}
                <DetailAsideCard title="Cum ajungi">
                  <div className="flex flex-col gap-3">
                    <CoordinatesRow lat={water.centerLat} lng={water.centerLng} />
                    <Button variant="secondary" icon={<PaperAirplaneIcon />} onClick={() => setDirections(true)} className="justify-center">
                      Direcții
                    </Button>
                  </div>
                </DetailAsideCard>
              </>
            }
          >
            <DetailSection id="prezentare">
              {/* The section's name (the chips and the index point here) and the h1 → h2 → h3 order. */}
              <h2 className="sr-only">Prezentare</h2>
              <div className="flex flex-col gap-5.5">
                <QuickActions actions={actions} />
                {facts.length ? (
                  <div className="flex flex-col gap-3 xl:hidden">
                    <h3 className="t-heading">Detalii</h3>
                    {/* The aside's list at every width: one compact row per fact, never an orphan tile. */}
                    <DetailFacts facts={facts} layout="list" />
                  </div>
                ) : null}
                {communityFailed || retrying ? <CommunityError retrying={retrying} onRetry={retryCommunity} /> : null}
              </div>
            </DetailSection>

            {showPartide ? (
              <VenuePartideSection
                venue={venue}
                title="Partide pe această apă"
                partideHref={PUBLIC_WATER_ON_WEB.partide ? routes.publicWaterPartide(key) : undefined}
                partidaHref={PUBLIC_WATER_ON_WEB.partida ? (id) => routes.partida(id) : undefined}
              />
            ) : null}

            {showCapturi ? (
              <DetailSection id="capturi" title="Capturi pe această apă">
                <div className="flex flex-col gap-3.5">
                  <SpeciesChips species={community.data?.speciesCounts} />
                  <CatchGrid
                    catches={catchRows}
                    status={catches.status}
                    total={catchesTotal}
                    waterName={name}
                    onEndReached={loadMore}
                    fetchingMore={isFetchingNextPage}
                    moreFailed={isFetchNextPageError}
                    onRetryMore={() => void fetchNextPage()}
                  />
                  {isFetchingNextPage ? (
                    <p role="status" className="flex items-center justify-center gap-2 py-2 t-caption text-muted">
                      <T2Spinner className="size-5 text-accent" />
                      Se încarcă mai multe capturi…
                    </p>
                  ) : isFetchNextPageError ? (
                    <div role="alert" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 py-2">
                      <p className="t-caption text-muted">Nu am putut încărca mai multe capturi.</p>
                      <Button variant="secondary" size="compact" onClick={() => void fetchNextPage()}>
                        Încearcă din nou
                      </Button>
                    </div>
                  ) : null}
                </div>
              </DetailSection>
            ) : null}

            <DetailSection id="locatie" title="Locație">
              <div className="flex flex-col gap-4.5">
                {countyNames.length ? (
                  <div className="flex flex-col gap-2">
                    <h3 className="t-body-strong text-ink-2">{countiesHeading(countyNames.length)}</h3>
                    <ul className="flex flex-wrap gap-1.75">
                      {countyNames.map((c) => (
                        <li key={c} className="rounded-full bg-soft-fill px-2.75 py-1.25 t-caption text-ink-2">
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <Link
                  href={routes.publicWaterMap(key)}
                  aria-label="Deschide apa pe hartă"
                  className="flex items-center gap-2.5 rounded-card bg-accent-tint p-3.5 transition-[filter] duration-(--duration-fast) hover:brightness-97 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <MapIcon aria-hidden className="size-6 shrink-0 text-accent-ink" />
                  <span className="flex min-w-0 flex-col">
                    <span className="t-body-strong text-accent-ink">Vezi apa pe hartă</span>
                    <span className="t-caption text-accent-ink">Deschide geometria completă și zona din jur</span>
                  </span>
                </Link>
                {water.linkCode ? <LinkCodeRow code={water.linkCode} /> : null}
                {attribution ? <p className="t-caption text-muted">{attribution}</p> : null}
              </div>
            </DetailSection>
          </DetailBody>
        </DetailSectionsProvider>
      </DetailPage>
      <DirectionsDialog open={directions} onClose={() => setDirections(false)} lat={water.centerLat} lng={water.centerLng} />
    </>
  );
}

/**
 * c17: the community reads failed — the kit's section ErrorState with the DetailRetry look: busy
 * while the failed read(s) run again («Se încarcă…», aria-busy, not pressable twice; aria-disabled,
 * never `disabled`, so focus stays on it), and a polite «Tot nu s-a putut încărca.» when they fail
 * again.
 */
function CommunityError({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  const [status, setStatus] = useState('');
  const tried = useRef(false);
  useEffect(() => {
    if (!retrying && tried.current) setStatus('Tot nu s-a putut încărca.');
  }, [retrying]);
  return (
    <ErrorState
      title="Activitatea comunității nu a putut fi încărcată."
      description={
        <span role="status">{status}</span>
      }
      action={
        <Button
          variant="secondary"
          size="compact"
          aria-busy={retrying || undefined}
          aria-disabled={retrying || undefined}
          onClick={() => {
            if (retrying) return;
            tried.current = true;
            setStatus('');
            onRetry();
          }}
        >
          {retrying ? 'Se încarcă…' : 'Încearcă din nou'}
        </Button>
      }
    />
  );
}

