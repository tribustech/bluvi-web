'use client';

import Link from 'next/link';
import { Suspense, useId, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRightIcon, MapPinIcon } from '@heroicons/react/20/solid';
import { PhotoIcon } from '@heroicons/react/24/outline';
import { FishIcon } from '@/components/icons/brand';
import { BiggestCatch } from '@/components/partide/session/BiggestCatch';
import { CatchRow } from '@/components/partide/session/CatchRow';
import { EvolutionChart } from '@/components/partide/session/EvolutionChart';
import { FollowSessionButton } from '@/components/partide/session/FollowSessionButton';
import { catchCaption, dayMonthRo, durationLabel, longDateRo, spacedDuration } from '@/components/partide/session/format';
import { MemberRow } from '@/components/partide/session/MemberRow';
import { SafeImg } from '@/components/partide/session/SafeImg';
import { StatTiles } from '@/components/partide/session/StatTiles';
import { useNow } from '@/components/partide/session/useNow';
import { venueImageOf, venueWebHref, VenueCard } from '@/components/partide/session/VenueCard';
import { TotalWeighedCard } from '@/components/partide/session/WeightSegmentsBar';
import { Lightbox, type LightboxItem } from '@/components/surfaces/Lightbox';
import {
  DetailBackButton,
  DetailBand,
  DetailHeader,
  DetailHeroTopControls,
  DetailPage,
  DetailPhotoFillTile,
  DetailPhotoHero,
  DetailShareButton,
  PHOTO_PILL,
  PRESENCE_ICON,
} from '@/components/templates/T3';
import { DetailStickyAside } from '@/components/templates/T3/DetailStickyAside';
import { cn } from '@/components/ui/cn';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  communitySessionQuery,
  deriveSessionView,
  elapsedRoCompact,
  fullSource,
  gridSource,
  type CommunityMemberDTO,
  type CommunitySessionDetailDTO,
} from '@/core/partide';
import { isApiError } from '@/core/transport';
import { createBrowserTransport } from '@/lib/client/transport';
import { partideHrefs } from '@/lib/partide-pages';
import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../../_shell/SiteHeader';
import { useViewerState } from '../../../_shell/viewer-context';
import { isUnknownViewer, userOf } from '../../../_shell/viewer-state';
import { BODY_GRID, MAIN_COLUMN, SIDE_COLUMN, SIDE_STICKY } from './layout';
import { SpectatorSkeleton } from './SpectatorSkeleton';
import { SpectatorError, SpectatorNotFound } from './states';

/*
 * Partidă — the spectator view (parity partide.spectator; fish app/(app)/partide/comunitate/[id].tsx),
 * someone else's partidă, read-only, Revolut-clean (memory: feedback_partide_revolut_design):
 *  - phone: fish's photo-carousel hero (back + the bell over it), the title block (status pill,
 *    venue name linking to the lake / public water, «localitate · dată · durată»), then fish's
 *    order: TOTAL CÂNTĂRIT + the three tiles, Pescari, Evoluția capturilor, CEA MAI MARE CAPTURĂ,
 *    the catches, the venue card;
 *  - from 768 (owner rule 1, Airbnb): the title row first (share + bell at its right), then the
 *    photo grid (one large + four small; the venue image tops a short set up), then from 1024 two
 *    columns: the total, the chart, the biggest catch and the catches left; right, sticky under the
 *    bar, the tiles, «Pescari {n}» and the venue card.
 *
 * Data: core communitySessionQuery — seeded by the server's cached read (page.tsx, HydrationBoundary)
 * when it had one, else read here; it polls every 60 s while the partidă is live, never once it has
 * ended, and refetches on focus / reconnect (c14). TanStack keeps the last good data when a
 * background refetch fails on the network, so a blip never turns a shown partidă into an error
 * (fish); a 404 / 400 does turn it into «not found» — it went private or was deleted.
 * The session only shapes the bell and the member rows (behind their own Suspense, never the page).
 * Photos open the kit Lightbox, captioned «Crap · 3,4 kg · 14:30» (c10, c11); the gallery and the
 * full catch list (B8, lib/partide-pages) stay hidden until they ship (rule 4).
 */

export function SpectatorView({ documentId }: { documentId: string }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const query = useQuery(communitySessionQuery(t, documentId));
  // The CMS's 404 / 400 wins over data already shown (the server's cached copy, an earlier read):
  // the partidă went private or was deleted, and nothing of it may stay on screen (invariants
  // 14/15, b.private-partida). fish's «keep the last good data» rule is for network blips only.
  if (isApiError(query.error) && (query.error.status === 404 || query.error.status === 400)) return <SpectatorNotFound />;
  if (query.data) return <Loaded detail={query.data} />;
  if (query.isPending) return <SpectatorSkeleton />;
  return <SpectatorError onRetry={() => void query.refetch()} retrying={query.isFetching} />;
}

/* ------------------------------------------------------------------------------------------------ */

const TITLE_ID = 'partida-titlu';

/** A hero tile whose photo failed: fish's fish on the indigo tint (CatchThumb's fallback). */
const TILE_FALLBACK = (
  <span aria-hidden data-testid="partida-photo-failed" className="absolute inset-0 flex items-center justify-center bg-accent-tint text-accent">
    <FishIcon className="size-10 opacity-50" />
  </span>
);

function Loaded({ detail }: { detail: CommunitySessionDetailDTO }) {
  const view = useMemo(() => deriveSessionView(detail), [detail]);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const live = detail.endedAt == null;
  const venueHref = venueWebHref(detail);
  const venueImage = venueImageOf(detail);
  const catchPhotos = detail.photos.map(c => ({ src: fullSource(c) ?? '', alt: catchCaption(c) })).filter(p => p.src);
  const heroPhotos = catchPhotos.length ? catchPhotos : venueImage ? [{ src: venueImage, alt: `${detail.venueName}` }] : [];
  const fromCatches = catchPhotos.length > 0;
  const lightboxItems: LightboxItem[] = view.lightboxCatches.map(c => ({
    key: c.clientId,
    src: fullSource(c) ?? '',
    preview: gridSource(c) ?? undefined,
    alt: catchCaption(c),
  }));
  const openCatch = (clientId: string) => {
    const i = view.lightboxCatches.findIndex(p => p.clientId === clientId);
    return i >= 0 ? () => setLightbox(i) : undefined;
  };
  const members = detail.members;
  const catchesTitle = members.length > 1 ? 'Capturile echipei' : 'Capturi';
  const allCatches = detail.hasMoreCatches ? partideHrefs.partidaCatches(detail.documentId) : null;

  const follow = (look: 'photo' | 'header') => (
    <Suspense fallback={null}>
      <FollowSessionButton sessionDocumentId={detail.documentId} look={look} />
    </Suspense>
  );
  const photoPill =
    view.photoCount > 0 && lightboxItems.length > 0 ? (
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`${view.photoCount} ${view.photoCount === 1 ? 'fotografie' : 'fotografii'} — deschide`}
        data-testid="partida-photo-count"
        onClick={() => setLightbox(0)}
        className={cn(PHOTO_PILL, 'cursor-pointer hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-photo-scrim [&>svg]:size-5')}
      >
        <PhotoIcon aria-hidden />
        {view.photoCount}
      </button>
    ) : null;

  return (
    <div data-testid="partida-spectator" className="contents">
    <DetailPage phoneGround="page">
      <SetBreadcrumb trail={[{ label: 'Partide', href: routes.partide() }, { label: detail.venueName }]} />
      <DetailBand hairline={false}>
        {/* Phone: back + the bell over the hero (the photos, or the fish placeholder). */}
        <DetailHeroTopControls start={<DetailBackButton fallbackHref={routes.partide()} ground={heroPhotos.length ? 'photo' : 'page'} />} end={follow('photo')} />
        <DetailHeader
          title={
            venueHref ? (
              <Link href={venueHref} className="hover:underline focus-visible:rounded-badge focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" data-testid="partida-venue-link">
                {detail.venueName}
              </Link>
            ) : (
              detail.venueName
            )
          }
          titleId={TITLE_ID}
          eyebrow="Partidă"
          meta={[
            detail.locality ? (
              <span key="loc" className="inline-flex items-center gap-1 t-label text-muted">
                <MapPinIcon aria-hidden className={cn(PRESENCE_ICON.meta, 'shrink-0 text-accent')} />
                {detail.locality}
              </span>
            ) : null,
            <time key="date" dateTime={detail.startedAt} title={longDateRo(detail.startedAt)}>
              {dayMonthRo(detail.startedAt)}
            </time>,
            <TimeSpan key="time" detail={detail} />,
          ]}
          badges={
            <span data-testid="partida-status">
              {live ? <StatusPill tone="live">ÎN DESFĂȘURARE</StatusPill> : <StatusPill tone="neutral">ÎNCHEIATĂ</StatusPill>}
            </span>
          }
          actions={
            <>
              <DetailShareButton look="button" title={`Partidă la ${detail.venueName}`} text={`Urmărește partida de la ${detail.venueName} pe Bluvi.`} />
              {follow('header')}
            </>
          }
          className="md:pt-5"
        />
        {heroPhotos.length ? (
          <DetailPhotoHero
            className="max-md:-order-1"
            photos={heroPhotos}
            label={`Fotografii din partida de la ${detail.venueName}`}
            // Catch photos open the captioned lightbox; the venue image (no catch photo) opens nothing
            // until the gallery ships (B8).
            onOpenPhoto={fromCatches ? i => setLightbox(i) : undefined}
            // A photo that fails to load (a deleted S3 object): fish's fish on the indigo tint, as the
            // catch thumbnails — never the broken-image glyph.
            photoFallback={TILE_FALLBACK}
            fill={
              fromCatches && venueImage && catchPhotos.length < 5 ? (
                <DetailPhotoFillTile>
                  <SafeImg src={venueImage} className="absolute inset-0 size-full object-cover" fallback={TILE_FALLBACK} />
                </DetailPhotoFillTile>
              ) : undefined
            }
            bottomEnd={photoPill}
          />
        ) : (
          // No photo and no venue image: fish's fish on the indigo tint, phone only (from 768 the
          // title row carries everything; no empty slab).
          <div aria-hidden className="flex h-50 items-center justify-center bg-accent-tint text-accent max-md:-order-1 md:hidden">
            <FishIcon className="size-14 opacity-50" />
          </div>
        )}
      </DetailBand>

      <div className={BODY_GRID}>
        <div className={cn(MAIN_COLUMN, 'xl:grid xl:grid-cols-5 xl:[&>*]:col-span-5')}>
          {/* From 1280 the total and the biggest catch share the first row (bento). */}
          <div className={cn('flex flex-col gap-2 px-4 pt-2 md:gap-3 md:px-0 md:pt-0', view.featuredCatch && 'xl:col-span-3! xl:row-start-1')}>
            <TotalWeighedCard totalKg={view.totalKg} segments={view.segments} avgKg={view.avgKg} />
            <StatTiles detail={detail} className="min-[1024px]:hidden" />
          </div>
          <Members members={members} className="min-[1024px]:hidden" />
          <EvolutionChart catches={view.evolutionInput} totalKg={view.totalKg} />
          {view.featuredCatch ? (
            <div className="flex xl:col-span-2! xl:col-start-4 xl:row-start-1 [&>section]:flex-1">
              <BiggestCatch item={view.featuredCatch} onOpen={openCatch(view.featuredCatch.clientId)} />
            </div>
          ) : null}
          <section aria-labelledby="partida-capturi" data-testid="partida-catches" className="bg-surface py-5 md:rounded-card md:shadow-e0 xl:py-6">
            <h2 id="partida-capturi" className="mb-1.5 px-4 t-title2 md:px-5 xl:px-6">
              {catchesTitle}
            </h2>
            {detail.catches.length === 0 ? (
              <p className="px-4 py-6 text-center t-body text-muted">Nicio captură încă.</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {detail.catches.map(c => (
                  <CatchRow key={c.clientId} item={c} isMax={detail.maxKg != null && c.weightKg === detail.maxKg} onOpen={openCatch(c.clientId)} />
                ))}
              </ul>
            )}
            {allCatches ? (
              <Link
                href={allCatches}
                className="mx-4 mt-2 flex min-h-11 items-center justify-center gap-1.5 rounded-control t-label text-accent-ink hover:bg-page md:mx-5"
              >
                Vezi toate ({detail.catchCount})
                <ChevronRightIcon aria-hidden className="size-4" />
              </Link>
            ) : null}
          </section>
          <VenueCard detail={detail} className="min-[1024px]:hidden" />
        </div>
        <SideColumn>
          <StatTiles detail={detail} />
          <Members members={members} />
          <VenueCard detail={detail} />
        </SideColumn>
      </div>

      <Lightbox
        items={lightboxItems}
        index={lightbox}
        onIndex={setLightbox}
        total={lightboxItems.length}
        label="Fotografii"
        footer={item => <p className="t-body-strong text-on-photo-scrim">{item.alt}</p>}
      />
    </DetailPage>
    </div>
  );
}

/** The right column from 1024 (sticky under the bar; T5 StickyColumn's rule when taller than the window). */
function SideColumn({ children }: { children: ReactNode }) {
  return (
    <DetailStickyAside label="Pe scurt" offsetSteps={0} className={cn(SIDE_COLUMN, SIDE_STICKY, 'max-[1023px]:hidden')}>
      {children}
    </DetailStickyAside>
  );
}

/** The meta line's last item: an ended partidă's length, or how long a live one has run (browser clock). */
function TimeSpan({ detail }: { detail: CommunitySessionDetailDTO }) {
  const now = useNow();
  const ended = durationLabel(detail);
  if (ended) return <span>{spacedDuration(ended)}</span>;
  if (now == null) return <span aria-hidden className="inline-block h-[0.7em] w-10 animate-shimmer rounded-full align-middle" />;
  return (
    <span data-visual-mask data-testid="partida-elapsed">
      {spacedDuration(elapsedRoCompact(now, detail.startedAt))}
    </span>
  );
}

/* ------------------------------------------------------------------------------------------------ */

/**
 * «Pescari {n}» (c8): one card of member rows. The rows that depend on the viewer (follower count,
 * follow button) wait for the session behind Suspense; meanwhile the names and avatars are there.
 */
function Members({ members, className }: { members: CommunityMemberDTO[]; className?: string }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} data-testid="partida-members" className={cn('bg-surface py-5 md:rounded-card md:shadow-e0 xl:py-6', className)}>
      <h2 id={titleId} className="mb-1.5 px-4 t-title2 md:px-5 xl:px-6">
        Pescari <span className="text-muted">{members.length}</span>
      </h2>
      <Suspense fallback={<MemberList members={members} signedIn={null} viewerUid={null} />}>
        <MembersForViewer members={members} />
      </Suspense>
    </section>
  );
}

function MembersForViewer({ members }: { members: CommunityMemberDTO[] }) {
  const viewer = useViewerState();
  const unknown = isUnknownViewer(viewer);
  const user = userOf(viewer);
  return <MemberList members={members} signedIn={unknown ? null : !!user} viewerUid={user?.documentId ?? null} />;
}

function MemberList({ members, signedIn, viewerUid }: { members: CommunityMemberDTO[]; signedIn: boolean | null; viewerUid: string | null }) {
  return (
    <ul className="divide-y divide-hairline">
      {members.map(m => (
        <MemberRow key={m.uid} member={m} signedIn={signedIn} viewerUid={viewerUid} />
      ))}
    </ul>
  );
}
