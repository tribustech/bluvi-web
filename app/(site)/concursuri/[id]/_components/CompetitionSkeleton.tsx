'use client';

import { Suspense, type CSSProperties } from 'react';

import {
  DetailActionBar,
  DetailBackButton,
  DetailBand,
  DetailBody,
  DetailHeader,
  DetailPage,
  DetailSection,
} from '@/components/templates/T3';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { CompetitionThumb, competitionMeta, type HeaderCore } from './headerMeta';
import { StatRowBones } from './DesktopStats';
import { RankingSkeleton, rankingSkeletonKind } from './RankingView';
import type { SkeletonVariant } from './screen-state';
import type { CompetitionTab } from './tabs';
import { isUnknownViewer, useViewerState } from '../../../_shell/viewer-context';
import { ExtraScaleBones, HowItWorks, LIST_TITLE, NotStartedState } from './ExtraScalesTab';
import { bannerShape } from './infoParts';
import { ParticipantsBones } from './ParticipantsTab';

/*
 * The competition page while its core is read (loading.tsx, and the client fallback): the loaded
 * page's own shape in grey, built from the same parts, so nothing jumps when it lands —
 *  - the band: the T3 header (back / share chips on the phone; from 768 the thumbnail, three meta
 *    items — three lines on the phone, as a started / ended competition has —, the pill row at its
 *    fixed phone height, the actions — Chat, Urmărește, Distribuie) and the route tabs;
 *  - the body, by `variant`:
 *    · `ranking` (started / completed): from 768 the stat row (DesktopStats' grid) and the view
 *      tabs; on the phone the four view chips; then the ranking (RankingSkeleton — the table card
 *      with its toolbar band, or the feeder / club ranking's own shape by `rankingType` — the same
 *      one the view shows while the ranking loads);
 *    · `preview` (notStarted): the countdown + notice row, Detalii + Înscrieri, Sectoare;
 *    · `plain` (a ranking type the web cannot draw): one card;
 *    · `shell` (loading.tsx: the status is not known yet): no body — it appears under the band
 *      once the read says which one, instead of one shape swapped for another; its ground and bar
 *      are the ranking's (live / ended is the common case), so nothing flashes or pops in;
 *  - the phone's action bar, by CompetitionScreen's rules (barHasActions): on Clasament the
 *    ranking's tiles (or Înscrie-te before the start); on the other tabs Înscrie-te before the
 *    start, otherwise the Chat tile when the session the server streams is a signed-in reader
 *    (TabBarBones) — so the loaded bar never pops in.
 * Announced once.
 *
 * `head` (CompetitionRoute's fallback, the core already read): the header's server-known parts are
 * real — the title (the page's <h1>), the thumbnail, organiser · lake · dates — and only the
 * per-viewer and live parts stay bones. That fallback is what the static shell carries (the screen
 * itself is a TanStack client tree, which suspends while prerendering), so the static HTML has the
 * competition's name — the phone's largest contentful paint, and the page's <h1> for crawlers —
 * instead of a grey bar replaced by the request-time render (React reveals streamed content no
 * sooner than 300 ms after the first paint), and the loaded header lands on the same text in the
 * same place.
 */

const SHIMMER = 'animate-shimmer rounded-full';

/** A text bone inside a line of the given type step, so it is exactly as tall as the loaded text. */
function Line({ className }: { className: string }) {
  return (
    <span aria-hidden className={cn('relative block max-w-full', className)}>
      &nbsp;
      <span className={cn('absolute inset-x-0 top-1/2 h-[0.62em] -translate-y-1/2', SHIMMER)} />
    </span>
  );
}

/** A block bone (a button, a chip, a tile's icon box). */
function Block({ className }: { className: string }) {
  return <span aria-hidden className={cn('block shrink-0 animate-shimmer rounded-control', className)} />;
}

export function CompetitionSkeleton({
  variant = 'ranking',
  head,
  rankingType,
  tab = 'clasament',
}: {
  variant?: SkeletonVariant;
  /** A route tab other than Clasament: its own body (TabBones) instead of the ranking / preview. */
  tab?: CompetitionTab;
  /** The competition's ranking type, when known: the ranking's own skeleton (RankingSkeleton kinds). */
  rankingType?: string | null;
  /** The competition core and its date line, when already read (see the file's header). */
  head?: { competition: HeaderCore; datesProse: string };
}) {
  const c = head?.competition;
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Se încarcă concursul…
      </p>
      <DetailPage phoneGround={tab === 'clasament' && (variant === 'ranking' || variant === 'shell') ? 'surface' : 'page'}>
        <DetailBand>
          <DetailHeader
            phoneAlign="center"
            title={
              c ? (
                c.name
              ) : (
                <>
                  <span className="sr-only">Concurs</span>
                  <Line className="inline-block w-48 align-top md:w-80" />
                  {/* The phone title (a ~245px measure beside the chips) usually takes two lines. */}
                  <Line className="mx-auto w-36 md:hidden" />
                </>
              )
            }
            media={c ? <CompetitionThumb competition={c} /> : <Block className="size-16 rounded-card xl:size-24" />}
            // DetailHeader's own meta list: organiser, lake, dates (before the start the phone keeps
            // the dates in the preview).
            meta={
              c && head
                ? competitionMeta(c, head.datesProse)
                : [
                    <Line key="author" className="w-40 md:w-32" />,
                    <Line key="lake" className="w-28 md:w-20" />,
                    <Line key="dates" className={cn('w-24', variant === 'preview' && 'max-md:hidden')} />,
                  ]
            }
            // The (LIVE +) followers pills (36px from 768); on the phone the compact Urmărește beside
            // them, in the loaded row's fixed 36px height.
            badges={
              <span aria-hidden className="flex items-center gap-2.5 max-md:min-h-9 md:h-9">
                <span className={cn('block h-6.5 w-36', SHIMMER)} />
                <Block className="h-9 w-36 md:hidden" />
              </span>
            }
            actions={
              <>
                {/* Chat (signed in; ChatHeaderPlaceholder's footprint), first in the cluster. */}
                <Block className="size-12 xl:h-10 xl:w-24" />
                <Block className="h-12 w-36 xl:h-10" />
                {/* Distribuie: the icon button below 1280, labelled from 1280. */}
                <Block className="size-12 xl:h-10 xl:w-34" />
              </>
            }
            phoneStart={<DetailBackButton fallbackHref={routes.home()} />}
            phoneEnd={<Block className="size-12" />}
          />
          <span aria-hidden className="flex gap-6 overflow-hidden px-4 md:gap-7 md:px-6 xl:px-8">
            {['w-20', 'w-22', 'w-28', 'w-24', 'w-24'].map((w, i) => (
              <span key={i} className="flex min-h-11 shrink-0 items-center pb-2.5">
                <Line className={cn('t-body-strong', w)} />
              </span>
            ))}
          </span>
        </DetailBand>

        {tab !== 'clasament' ? (
          <TabBones tab={tab} competition={c} />
        ) : variant === 'ranking' ? (
          // As the loaded page: no side columns, the table takes the whole column (CompetitionScreen).
          <DetailBody>
            {/* DesktopStats: the navy tile, two stat tiles, the weighing tile — two by two from 768, one row from 1280. */}
            <div aria-hidden className="max-md:hidden">
              <StatRowBones />
            </div>
            <DetailSection tone="plain" className="flex flex-col gap-4 max-md:pt-2">
              {/* The phone's four view chips (ViewChips). */}
              <span aria-hidden className="grid grid-cols-4 gap-3 md:hidden">
                {[0, 1, 2, 3].map(i => (
                  <span key={i} className="aspect-square animate-shimmer rounded-card" />
                ))}
              </span>
              {/* From 768: the four view tabs, ViewTabs' exact box (the soft-fill track, p-1, 44px tabs below
                  1280 and 56px with the meta line from 1280: 52 / 64px in all), so nothing moves when it lands. */}
              <span aria-hidden className="hidden grid-cols-4 gap-1 rounded-card bg-soft-fill p-1 md:grid">
                {[0, 1, 2, 3].map(i => (
                  <span key={i} className="flex h-11 min-w-0 items-center gap-2 px-2.5 xl:h-14 xl:gap-3 xl:px-4">
                    <Block className="size-5 xl:size-6" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <Line className="w-20 t-body-strong xl:w-24 xl:t-heading" />
                      <Line className="w-32 t-caption max-xl:hidden" />
                    </span>
                  </span>
                ))}
              </span>
              <RankingSkeleton kind={rankingSkeletonKind(rankingType)} />
            </DetailSection>
          </DetailBody>
        ) : variant === 'preview' ? (
          <PreviewBody />
        ) : variant === 'plain' ? (
          <DetailBody>
            <span aria-hidden className="mx-auto block h-44 w-full max-w-140 animate-shimmer rounded-card" />
          </DetailBody>
        ) : null}

        {variant === 'preview' ? (
          // Înscrie-te: the full-width primary button and its reason line (ActionBar RegisterRow).
          <DetailActionBar label="Bara de acțiuni">
            <span aria-hidden className="flex flex-col gap-1">
              <Block className="h-12 w-full" />
              <Line className="mx-auto w-48 t-caption" />
            </span>
          </DetailActionBar>
        ) : tab !== 'clasament' ? (
          // The session is the server's streamed read: nothing in the static shell, the bar's bones
          // as soon as it says «signed in».
          <Suspense fallback={null}>
            <ChatBarBones />
          </Suspense>
        ) : variant === 'ranking' || variant === 'shell' ? (
          <DetailActionBar label="Bara de acțiuni">
            <span aria-hidden className="-mx-4 flex px-2">
              {/* Tot ecranul, Cântare, Sortare, Statistici. */}
              {Array.from({ length: 4 }, (_, i) => (
                <span key={i} className="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-0.5">
                  <Block className="size-8" />
                  <Line className="w-10 t-micro" />
                </span>
              ))}
            </span>
          </DetailActionBar>
        ) : null}
      </DetailPage>
    </div>
  );
}

/** A route tab's bar for a signed-in reader once the competition runs or ended: the Chat tile (ActionBar). */
function ChatBarBones() {
  const state = useViewerState();
  if (!state || isUnknownViewer(state)) return null;
  return (
    <DetailActionBar label="Bara de acțiuni">
      <span aria-hidden data-bone="chat-bar" className="-mx-4 flex px-2">
        <span className="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-0.5">
          <Block className="size-8" />
          <Line className="w-10 t-micro" />
        </span>
      </span>
    </DetailActionBar>
  );
}

/** A section card's bones (DetailSection: title, then lines). */
function CardBones({ lines = 3, className, bone }: { lines?: number; className?: string; bone?: string }) {
  return (
    <span aria-hidden data-bone={bone} className={cn('flex flex-col gap-3 bg-surface px-4 py-5 md:rounded-card md:p-5 md:shadow-e0 xl:p-6', className)}>
      <Line className="w-40 t-heading" />
      {Array.from({ length: lines }, (_, i) => (
        <Line key={i} className={cn('t-body', i % 2 ? 'w-3/5' : 'w-4/5')} />
      ))}
    </span>
  );
}

/**
 * Preview.tsx's shape. Below 1280: countdown · notice, Detalii · Înscrieri, Sectoare. From 1280 the
 * three columns (DetailBody left / centre / aside): Detalii left, the notice and Sectoare in the
 * centre, the countdown and Înscrieri in the aside.
 */
function PreviewBody() {
  return (
    <DetailBody
      left={<CardBones lines={5} />}
      leftLabel="Detalii"
      aside={
        <>
          <CardBones lines={2} />
          <CardBones lines={3} />
        </>
      }
      asideLabel="Ce mă așteaptă"
      asideBelowXl="hidden"
    >
      <div className="grid gap-2 md:grid-cols-2 md:gap-4 xl:grid-cols-1 xl:gap-5">
        <CardBones lines={2} className="xl:hidden" />
        <CardBones lines={3} />
      </div>
      <div className="grid gap-2 md:grid-cols-2 md:gap-4 xl:hidden">
        <CardBones lines={5} />
        <CardBones lines={2} />
      </div>
      <CardBones lines={2} />
    </DetailBody>
  );
}

/**
 * The route tabs' bodies (fish InfoSkeleton / CompetitionParticipantsSkeleton / LoadingScreen),
 * each in its loaded page's shape. `competition`: the core's header fields when the route's
 * Suspense fallback already has them (CompetitionRoute) — the banner's shape, the status; unknown
 * in loading.tsx (the read is in flight), where no banner is guessed: a banner-less competition
 * would then see its content jump up, and the route's fallback (the core known) follows at once.
 *  - informatii: the banner (its stage, as CompetitionBanner), Descriere, the facts' tiles (below
 *    1280), Durata; the facts on the left and Contact on the right from 1280;
 *  - participanti: the auto-fill grid of cards;
 *  - extraCantare: the loaded list's frame (title, count, 4 cards — ExtraScalesTab's own bones),
 *    or before the start the explanation itself (the list is not read then);
 *  - regulament: the index / details on the left, one reading card, the contact card on the right.
 */
function TabBones({ tab, competition }: { tab: CompetitionTab; competition?: HeaderCore }) {
  // `contents`: the marker for tests (the tab's own shape) without a box of its own.
  return (
    <div data-skeleton-tab={tab} className="contents">
      <TabBody tab={tab} competition={competition} />
    </div>
  );
}

function TabBody({ tab, competition: c }: { tab: CompetitionTab; competition?: HeaderCore }) {
  if (tab === 'informatii') {
    return (
      <DetailBody left={<CardBones lines={4} bone="facts-aside" />}
        leftLabel="Detalii"
        aside={<CardBones lines={4} bone="contact" />}
        asideLabel="Contact și sponsori"
      >
        {c?.banner ? <BannerBone banner={c.banner} /> : null}
        <CardBones lines={2} bone="descriere" />
        <FactsBones />
        <CardBones lines={2} bone="durata" />
      </DetailBody>
    );
  }
  if (tab === 'regulament') {
    return (
      <DetailBody left={<CardBones lines={4} bone="facts-aside" />} leftLabel="Detalii" aside={<CardBones lines={3} bone="contact" />} asideLabel="Contact">
        <CardBones lines={8} bone="reading" />
      </DetailBody>
    );
  }
  if (tab === 'extraCantare') {
    const notStarted = c?.competitionStatus === 'notStarted';
    return (
      <DetailBody aside={notStarted ? undefined : <HowItWorks />} asideLabel="Despre extra cântare" asideBelowXl="hidden">
        {notStarted ? (
          <NotStartedState />
        ) : (
          <DetailSection tone="plain" title={LIST_TITLE} description={<Line className="w-24 t-caption" />}>
            <ExtraScaleBones />
          </DetailSection>
        )}
      </DetailBody>
    );
  }
  return (
    <DetailBody>
      <ParticipantsBones />
    </DetailBody>
  );
}

/** CompetitionBanner's box: a small banner's card; a large one at its own ratio (≤ its width, ≤ 480 tall from 768); unknown size 16:9. */
function BannerBone({ banner }: { banner: NonNullable<HeaderCore['banner']> }) {
  const { w, h, known, small } = bannerShape(banner);
  if (small) {
    return (
      <span aria-hidden className="flex justify-center rounded-card bg-surface p-6 max-md:rounded-none md:shadow-e0">
        <span className="block w-full animate-shimmer rounded-control" style={{ maxWidth: `${w}px`, aspectRatio: `${w} / ${h}` }} />
      </span>
    );
  }
  if (!known) return <span aria-hidden className="block aspect-video w-full animate-shimmer md:rounded-card" />;
  return (
    <span aria-hidden className="flex justify-center">
      <span
        className="block aspect-(--banner-ratio) w-full animate-shimmer md:max-h-120 md:rounded-card"
        style={{ '--banner-ratio': `${w} / ${h}`, maxWidth: `${w}px` } as CSSProperties}
      />
    </span>
  );
}

/** Informații's «Detalii» below 1280: the title and the four DetailFacts tiles (two by two, four in a row from 768). */
function FactsBones() {
  return (
    <span aria-hidden className="flex flex-col gap-3 bg-surface px-4 py-5 md:rounded-card md:p-5 md:shadow-e0 xl:hidden">
      <Line className="w-24 t-title2" />
      <span className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {[0, 1, 2, 3].map(i => (
          <span key={i} data-bone="fact" className="flex flex-col rounded-card bg-page p-3">
            <Line className="w-20 t-body-strong" />
            <Line className="mt-0.5 w-24 t-label" />
          </span>
        ))}
      </span>
    </span>
  );
}
