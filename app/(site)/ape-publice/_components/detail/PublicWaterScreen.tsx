'use client';

import { ChartBarIcon, MapIcon, PaperAirplaneIcon, PhotoIcon, UsersIcon } from '@heroicons/react/24/outline';
import { MapPinIcon } from '@heroicons/react/20/solid';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SetBreadcrumb } from '@/app/(site)/_shell/SiteHeader';
import {
  DetailBand,
  DetailBody,
  DetailBackButton,
  DetailFacts,
  DetailHeader,
  DetailHeroTopControls,
  DetailPage,
  DetailSection,
  DetailSectionNav,
  DetailSectionsProvider,
  DetailShareButton,
  DetailSummaryCard,
  PRESENCE_ICON,
  type DetailSectionItem,
} from '@/components/templates/T3';
import { plural } from '@/components/cards/format';
import { ErrorState } from '@/components/surfaces/StateCard';
import { T2Spinner } from '@/components/templates/T2';
import { Button, buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import {
  buildPublicWaterSectionChips,
  countiesHeading,
  PUBLIC_WATER_SECTION_LABEL,
  PUBLIC_WATER_TYPE_LABEL,
  publicWaterFacts,
  publicWaterName,
  publicWaterSubtitle,
  type PublicWaterDetail,
} from '@/core/lakes';
import { communityVenueCatchesInfiniteQuery, communityVenueSectionQuery, hasPartideActivity, type LakeCatchDTO } from '@/core/partide';
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
 * section chips, like the lake page): the still map hero, the title block, the sticky chips (every
 * width), then Prezentare, Partide, Capturi, Locație. From 768 it is the Airbnb detail page (owner
 * rule 1, ROADMAP §4b): the title row, then the map as the media band (from 1024 two thirds, the
 * first catch photos beside it); from 1024 two columns — the sections left, a sticky summary card
 * right with the water's type, Direcții and its facts. One map entry per area: the band — from
 * 1024 the Direcții / Hartă tiles and Locație's «Vezi apa pe hartă» leave.
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

/** `bare`: Prezentare holds nothing from 1024 (its tiles and facts are in the summary card there). */
function sectionItems(key: string, bare: boolean): DetailSectionItem[] {
  return (key.split('|') as (keyof typeof PUBLIC_WATER_SECTION_LABEL)[]).map((id) => ({
    id,
    label: PUBLIC_WATER_SECTION_LABEL[id],
    hideFromLg: id === 'prezentare' && bare ? true : undefined,
  }));
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
  const shareText = `Intră în Bluvi să vezi ${name}.`;
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
  // The reads' error banner is the one thing Prezentare keeps from 1024; without it the section
  // (and its chip) leaves there — never an empty card.
  const prezentareBare = !(communityFailed || retrying);
  const sections = useMemo(() => sectionItems(idsKey, prezentareBare), [idsKey, prezentareBare]);
  // The chip set changes when the community reads land / poll (a section appears or goes): the
  // provider takes the new list in place (no remount of the body).
  const refined = useMemo(() => settled(sections), [sections]);

  const scrollToCapturi = () => {
    const link = [...document.querySelectorAll<HTMLAnchorElement>('a[href="#capturi"]')].find((a) => a.getClientRects().length > 0);
    if (link) link.click();
    else document.getElementById('capturi')?.scrollIntoView();
  };

  // From 1024 the right third of the media band (owner rule 1): the first photographed catches.
  const heroCatches = useMemo(() => catchRows.filter((c) => c.photoGridUrl || c.photoUrl || c.photoThumbUrl).slice(0, 2), [catchRows]);

  const actions: QuickAction[] = [
    // From 1024 the summary card has both (its map and Direcții): one map entry per area.
    { key: 'directii', label: 'Direcții', icon: <PaperAirplaneIcon aria-hidden />, onClick: () => setDirections(true), belowSummary: true },
    { key: 'harta', label: 'Hartă', icon: <MapIcon aria-hidden />, href: routes.publicWaterMap(key), belowSummary: true },
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

  // From 1024 the tiles leave Prezentare: the pages no section links to sit in the summary card as
  // the lake's «Mai multe despre baltă» buttons (Direcții and the map are already there).
  const more = actions.filter((a) => (a.key === 'partide' || a.key === 'statistici') && a.href);

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
          {/* Phone: back + share over the map, first in the DOM as on screen; then the header, then
              the map band (lifted to the top on the phone) — from 768 the DOM reads title → actions
              → map, as the screen does. */}
          <DetailHeroTopControls
            start={<DetailBackButton fallbackHref={routes.publicWaters()} onPhoto />}
            end={<DetailShareButton look="photo" title={name} text={shareText} label="Distribuie apa" />}
          />
          <DetailHeader
            title={name}
            titleId="apa-titlu"
            meta={meta}
            className="md:pt-5"
            actions={
              <>
                <DetailShareButton look="button" title={name} text={shareText} />
                {/* From 1024 the summary card owns Direcții. */}
                <Button variant="secondary" icon={<PaperAirplaneIcon />} onClick={() => setDirections(true)} className="min-[1024px]:hidden">
                  Direcții
                </Button>
              </>
            }
          />
          <WaterHero water={water} name={name} mapHref={routes.publicWaterMap(key)} fill={heroCatches.length ? <HeroCatches catches={heroCatches} onOpen={scrollToCapturi} /> : undefined} />
        </DetailBand>

        <DetailSectionsProvider sections={sections} refined={refined}>
          <DetailSectionNav
            pinnedTitle={name}
            // fish VenuePinnedNav leftAccessory: the way back once the hero and the bar are gone.
            pinnedStart={<DetailBackButton fallbackHref={routes.publicWaters()} ground="surface" size="size-11" />}
            pinnedMeta={
              <>
                {pin}
                <span className="truncate">{subtitle}</span>
              </>
            }
            hideFromXl={false}
          />
          <DetailBody
            layout="summary"
            asideBelowXl="hidden"
            asideSticky
            asideLabel="Pe scurt"
            aside={
              <DetailSummaryCard
                headline={<span className="t-title2">{PUBLIC_WATER_TYPE_LABEL[water.type]}</span>}
                actions={
                  <Button icon={<PaperAirplaneIcon />} onClick={() => setDirections(true)} block>
                    Direcții
                  </Button>
                }
              >
                <CoordinatesRow lat={water.centerLat} lng={water.centerLng} />
                {facts.length ? <DetailFacts facts={facts} layout="list" /> : null}
                {more.length ? (
                  <ul aria-label="Mai multe despre apă" className="flex flex-wrap gap-2">
                    {more.map((a) => (
                      <li key={a.key}>
                        <Link href={a.href!} className={buttonClass({ variant: 'secondary', size: 'compact', className: '[&>svg]:size-5' })}>
                          {a.icon}
                          {a.label}
                          {a.badge && a.badgeLabel ? <span className="sr-only">{`, ${a.badgeLabel(a.badge)}`}</span> : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </DetailSummaryCard>
            }
          >
            <DetailSection id="prezentare" className={prezentareBare ? 'min-[1024px]:hidden' : undefined}>
              {/* The section's name (the chips and the index point here) and the h1 → h2 → h3 order. */}
              <h2 className="sr-only">Prezentare</h2>
              <div className="flex flex-col gap-5.5">
                {/* From 1024: Direcții and the map in the summary card, Partide / Statistici under its facts. */}
                <QuickActions actions={actions} className="min-[1024px]:hidden" />
                {facts.length ? (
                  <div className="flex flex-col gap-3 min-[1024px]:hidden">
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
                {/* From 1024 the summary card's map is the way to it. */}
                <Link
                  href={routes.publicWaterMap(key)}
                  aria-label="Deschide apa pe hartă"
                  className="flex items-center min-[1024px]:hidden gap-2.5 rounded-card bg-accent-tint p-3.5 transition-[filter] duration-(--duration-fast) hover:brightness-97 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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

/** The media band's right third (from 1024): up to two catch photos, each opening Capturi. */
function HeroCatches({ catches, onOpen }: { catches: LakeCatchDTO[]; onOpen: () => void }) {
  return catches.map((c) => {
    const cap = [c.species, c.weightKg != null ? `${String(c.weightKg).replace('.', ',')} kg` : null].filter(Boolean).join(' · ');
    return (
      <button
        key={c.clientId}
        type="button"
        onClick={onOpen}
        aria-label={`Captură${cap ? `: ${cap}` : ''} — vezi capturile`}
        className="group/fill relative block cursor-pointer overflow-hidden bg-soft-fill outline-none focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-accent"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- CMS photo variants (S3 / local uploads), already sized. */}
        <img
          src={(c.photoGridUrl || c.photoUrl || c.photoThumbUrl) as string}
          alt=""
          className="absolute inset-0 size-full object-cover transition-[filter] duration-(--duration-fast) ease-fast group-hover/fill:brightness-90"
        />
      </button>
    );
  });
}
