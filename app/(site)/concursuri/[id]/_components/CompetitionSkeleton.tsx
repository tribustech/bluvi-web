'use client';

import {
  DetailActionBar,
  DetailBackButton,
  DetailBand,
  DetailBody,
  DetailHeader,
  DetailPage,
  DetailSection,
} from '@/components/templates/T3';
import { BentoTile } from '@/components/ui/BentoTile';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { RankingSkeleton } from './RankingView';
import type { SkeletonVariant } from './screen-state';

/*
 * The competition page while its core is read (loading.tsx, and the client fallback): the loaded
 * page's own shape in grey, built from the same parts, so nothing jumps when it lands —
 *  - the band: the T3 header (back / share chips on the phone; from 768 the thumbnail, three meta
 *    items — three lines on the phone, as a started / ended competition has —, the pill row at its
 *    fixed phone height, the actions — Urmărește, Distribuie) and the route tabs;
 *  - the body, by `variant`:
 *    · `ranking` (started / completed): from 768 the stat row (DesktopStats' grid) and the view
 *      tabs; on the phone the four view chips; then the ranking (RankingSkeleton — the table card
 *      with its toolbar band — the same one the view shows while the ranking loads);
 *    · `preview` (notStarted): the countdown + notice row, Detalii + Înscrieri, Sectoare;
 *    · `plain` (a ranking type the web cannot draw): one card;
 *    · `shell` (loading.tsx: the status is not known yet): no body — it appears under the band
 *      once the read says which one, instead of one shape swapped for another; its ground and bar
 *      are the ranking's (live / ended is the common case), so nothing flashes or pops in;
 *  - the phone's action bar.
 * Announced once.
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

export function CompetitionSkeleton({ variant = 'ranking' }: { variant?: SkeletonVariant }) {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        Se încarcă concursul…
      </p>
      <DetailPage phoneGround={variant === 'ranking' || variant === 'shell' ? 'surface' : 'page'}>
        <DetailBand>
          <DetailHeader
            phoneAlign="center"
            title={
              <>
                <span className="sr-only">Concurs</span>
                <Line className="inline-block w-48 align-top md:w-80" />
                {/* The phone title (a ~245px measure beside the chips) usually takes two lines. */}
                <Line className="mx-auto w-36 md:hidden" />
              </>
            }
            media={<Block className="size-16 rounded-card xl:size-24" />}
            // DetailHeader's own meta list: organiser, lake, dates (before the start the phone keeps
            // the dates in the preview).
            meta={[
              <Line key="author" className="w-40 md:w-32" />,
              <Line key="lake" className="w-28 md:w-20" />,
              <Line key="dates" className={cn('w-24', variant === 'preview' && 'max-md:hidden')} />,
            ]}
            // The state pill + followers (36px from 768); on the phone the compact Urmărește beside
            // them, in the loaded row's fixed 36px height.
            badges={
              <span aria-hidden className="flex items-center gap-2.5 max-md:min-h-9 md:h-9">
                <span className={cn('block h-6.5 w-36', SHIMMER)} />
                <Block className="h-9 w-36 md:hidden" />
              </span>
            }
            actions={
              <>
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

        {variant === 'ranking' ? (
          <DetailBody>
            {/* DesktopStats: the navy tile, two stat tiles, the weighing tile — two by two from 768, one row from 1280. */}
            <div aria-hidden className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1fr_1.1fr]">
              {[0, 1, 2, 3].map(i => (
                // Every tile one anatomy (the kit StatTile's): label, number, caption.
                <BentoTile key={i} tone="surface" className="shadow-e0">
                  <Line className="w-28 max-w-full t-label" />
                  <Line className={i === 0 ? 'w-40 t-num-64' : 'w-24 t-num-40'} />
                  <Line className="w-36 max-w-full t-caption" />
                </BentoTile>
              ))}
            </div>
            <DetailSection tone="plain" className="flex flex-col gap-4 max-md:pt-2">
              {/* The phone's four view chips (ViewChips). */}
              <span aria-hidden className="grid grid-cols-4 gap-3 md:hidden">
                {[0, 1, 2, 3].map(i => (
                  <span key={i} className="aspect-square animate-shimmer rounded-card" />
                ))}
              </span>
              {/* From 768: the four view tabs (ViewTabs: one row, 48px below 1280, 64px with the meta line from 1280). */}
              <span aria-hidden className="hidden grid-cols-4 gap-1.5 rounded-card bg-surface p-1.5 shadow-e0 md:grid xl:gap-2">
                {[0, 1, 2, 3].map(i => (
                  <span key={i} className="flex h-12 min-w-0 items-center gap-2 px-2.5 xl:h-16 xl:gap-3 xl:px-4">
                    <Block className="size-8 xl:size-10" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <Line className="w-20 t-body-strong xl:w-24 xl:t-heading" />
                      <Line className="w-32 t-caption max-xl:hidden" />
                    </span>
                  </span>
                ))}
              </span>
              <RankingSkeleton />
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
          // Înscrie-te: the full-width primary button.
          <DetailActionBar label="Bara de acțiuni">
            <Block className="h-12 w-full" />
          </DetailActionBar>
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

/** A section card's bones (DetailSection: title, then lines). */
function CardBones({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <span aria-hidden className={cn('flex flex-col gap-3 bg-surface px-4 py-5 md:rounded-card md:p-5 md:shadow-e0 xl:p-6', className)}>
      <Line className="w-40 t-heading" />
      {Array.from({ length: lines }, (_, i) => (
        <Line key={i} className={cn('t-body', i % 2 ? 'w-3/5' : 'w-4/5')} />
      ))}
    </span>
  );
}

/** Preview.tsx's shape: countdown + notice, Detalii + Înscrieri, Sectoare. */
function PreviewBody() {
  return (
    <DetailBody>
      <div className="grid gap-2 md:grid-cols-2 md:gap-4 xl:gap-5">
        <CardBones lines={2} />
        <CardBones lines={3} />
      </div>
      <div className="grid gap-2 md:grid-cols-2 md:gap-4 xl:gap-5">
        <CardBones lines={5} />
        <CardBones lines={2} />
      </div>
      <CardBones lines={2} />
    </DetailBody>
  );
}
