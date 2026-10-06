import type { ReactNode } from 'react';
import { ListEmpty } from '@/components/templates/T1/ListStates';
import { SignInGate } from '../SignInGate';
import { cn } from '@/components/ui/cn';
import { BAR_CELL, STATE_CARD } from './tones';
import { dashboardTracks } from './tracks';

export { DashboardError } from './DashboardError';

/*
 * The non-data states of a T5 page. Each renders inside <DashboardPage> under the real header
 * (fish keeps the panel header on error and while loading), so the page never jumps when data
 * lands. Empty, error and signed-out are one family: the templates' centred page-state card (T1
 * ListEmpty / ListError / ListSignInGate — icon disc, heading, caption, the action inside).
 */

/**
 * Bone fill on the surface (the shimmer, which paints its own soft-fill gradient), and on the navy
 * live tile (lavender at 15%, still: the shimmer's grey gradient would cover the navy).
 */
const BONE_FILL = { surface: 'bg-soft-fill animate-shimmer', navy: 'bg-lavender/15' } as const;

/** Grey text-skeleton block (Fundații §07: shimmer only for text and figures, never photos). */
function Bone({ className, on = 'surface' }: { className?: string; on?: keyof typeof BONE_FILL }) {
  return <span aria-hidden className={cn('block rounded-full', BONE_FILL[on], className)} />;
}

/**
 * A bone in the line box of a type step (`step`: «t-caption», «t-title1 md:t-page-title»…): the
 * zero-width space gives the line its real height at every width, so text bones never drift
 * from the text they stand for.
 */
function TextBone({ step, className, on }: { step: string; className?: string; on?: keyof typeof BONE_FILL }) {
  return (
    <span aria-hidden className={cn('flex items-center', step)}>
      {'\u200b'}
      <Bone className={className} on={on} />
    </span>
  );
}

/**
 * The caption's bone for a <DashboardHeader> drawn while the data loads (the real h1 stays), in
 * the caption's own line box. The header's action needs no bone: pass the real <DashboardRefresh />
 * (router.refresh needs no data and already has its final geometry), so nothing swaps at the top
 * of the page when the data lands.
 */
export function SkeletonCaption() {
  return <span aria-hidden className="inline-block h-3 w-28 rounded-full bg-soft-fill align-middle animate-shimmer" />;
}

const CARD = 'rounded-card bg-surface shadow-e0';

function SkeletonCard({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div aria-hidden className={cn('flex flex-col gap-4 p-4.5', CARD, className)}>
      <Bone className="h-4 w-32" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="size-10 shrink-0 rounded-full bg-soft-fill animate-shimmer" />
          <span className="flex flex-1 flex-col gap-2">
            <Bone className="h-3 w-[60%]" />
            <Bone className="h-2.5 w-[40%]" />
          </span>
          <Bone className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

/**
 * KpiTile's box: label, the number, the caption. `live`: the navy occupancy tile (lavender bones),
 * so the first tile is already dark while loading — no dark block flashing in when data lands.
 */
function SkeletonTile({ live = false, className }: { live?: boolean; className?: string }) {
  const on = live ? 'navy' : 'surface';
  return (
    <div aria-hidden className={cn('flex min-h-39 flex-col justify-between gap-2 rounded-bento p-4.5', live ? 'bg-navy' : 'bg-surface shadow-e0', className)}>
      <TextBone step="t-label" className="h-2.5 w-24" on={on} />
      <Bone className={cn('my-1 h-9', live ? 'w-16' : 'w-20')} on={on} />
      <TextBone step="t-caption" className="h-2.5 w-20" on={on} />
    </div>
  );
}

/**
 * The desktop «Azi la baltă» table (TodayCard table): the heading, the header band with its real,
 * static labels (Stand · Pescar · Azi · Plată, the thead's own columns and padding — the band
 * keeps its shape when the data lands) and 56px booking rows with the 32px avatar.
 */
function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden className={cn('flex flex-col overflow-hidden', CARD)}>
      <TextBone step="mx-4.5 mt-4.5 t-heading" className="h-4 w-28" />
      <TextBone step="mx-4.5 mt-0.5 t-caption" className="h-2.5 w-44" />
      <span className="mt-2 grid grid-cols-[--spacing(16)_1fr_1fr_--spacing(44)] border-y border-hairline bg-page t-label text-muted">
        <span className="py-2.5 pr-2 pl-4.5">Stand</span>
        <span className="px-3 py-2.5">Pescar</span>
        <span className="px-3 py-2.5">Azi</span>
        <span className="py-2.5 pr-4.5 pl-3 text-right">Plată</span>
      </span>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="flex h-14 items-center gap-3 border-b border-hairline px-4.5 last:border-b-0">
          <Bone className="h-3 w-6" />
          <span className="ml-6 size-8 shrink-0 rounded-full bg-soft-fill animate-shimmer" />
          <Bone className="h-3 w-[22%]" />
          <Bone className="ml-[8%] h-3 w-[20%]" />
          <Bone className="ml-auto h-3 w-24" />
        </span>
      ))}
    </div>
  );
}

/** «Următoarea sosire»: the heading, then the 40px round avatar, two lines and the hour. */
function SkeletonNextUp() {
  return (
    <div aria-hidden className={cn('flex flex-col', CARD)}>
      <Bone className="mx-4.5 mt-4.5 mb-2 h-4 w-32" />
      <span className="flex items-center gap-3 px-4.5 pt-2 pb-4.5">
        <span className="size-10 shrink-0 rounded-full bg-soft-fill animate-shimmer" />
        <span className="flex flex-1 flex-col gap-2">
          <Bone className="h-3 w-[70%]" />
          <Bone className="h-2.5 w-[50%]" />
        </span>
        <Bone className="h-3 w-10" />
      </span>
    </div>
  );
}

/** «Cum merge balta»: title, the chip row (+ the segmented control), the chart, the summary. */
function SkeletonTrend() {
  return (
    <div aria-hidden className={cn('flex flex-col p-4.5', CARD)}>
      <TextBone step="t-heading" className="h-4 w-36" />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-9 w-20 rounded-full bg-soft-fill animate-shimmer" />
          ))}
        </span>
        <span className="h-9 basis-full rounded-control bg-soft-fill animate-shimmer md:ml-auto md:w-56 md:basis-auto" />
      </div>
      <span className="mt-4 h-44 rounded-control bg-soft-fill animate-shimmer xl:h-56" />
      <TextBone step="mt-4 t-caption" className="h-3 w-48" />
    </div>
  );
}

/** The 36px tile of the shortcuts and the summary lines. */
const TILE_BONE = 'size-9 shrink-0 rounded-control bg-soft-fill animate-shimmer';

/** The context column's card: the lake's name and its fact line, then 44px rows with the 36px tile. */
function SkeletonNavList({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden className={cn('flex flex-col p-2', CARD)}>
      <span className="flex flex-col gap-0.5 px-2.5 pt-2.5 pb-2">
        <TextBone step="t-heading" className="h-4 w-28" />
        <TextBone step="t-caption" className="h-2.5 w-24" />
      </span>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="flex h-11 items-center gap-3 px-2.5">
          <span className={TILE_BONE} />
          <Bone className="h-3 w-24" />
        </span>
      ))}
    </div>
  );
}

/** A titled card of summary lines (36px tile + two lines). */
function SkeletonLines({ rows = 1 }: { rows?: number }) {
  return (
    <div aria-hidden className={cn('flex flex-col', CARD)}>
      <Bone className="mx-4.5 mt-4.5 mb-2 h-4 w-28" />
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="flex items-center gap-3 p-4.5 first:pt-2">
          <span className={TILE_BONE} />
          <span className="flex flex-1 flex-col gap-2">
            <Bone className="h-3 w-[70%]" />
            <Bone className="h-2.5 w-[50%]" />
          </span>
        </span>
      ))}
    </div>
  );
}

/** The phone/tablet shortcut bar: DashboardActions' own box and cells (BAR_CELL, a label line). */
function SkeletonActionBar() {
  return (
    <div aria-hidden className="flex rounded-card border-b border-transparent bg-surface px-2 py-2.5 shadow-e0 md:gap-2">
      {[0, 1, 2].map((i) => (
        <span key={i} className={BAR_CELL}>
          <span className={TILE_BONE} />
          <TextBone step="t-label" className="h-2.5 w-14" />
        </span>
      ))}
    </div>
  );
}

/**
 * Loading — the page's own geometry in grey, announced once (the live region's TEXT; a status
 * announces content, not its name): the header (the back and refresh chips on the phone band, the
 * refresh button from 768), phone/tablet: action bar · today · tiles (a pair, a row of four from
 * 768) · trend; from 1280 the three columns on the layout's own tracks: the lake's shortcuts ·
 * tiles, today, trend · two «ce mă așteaptă» cards. Use as the <Suspense> fallback of the dashboard body.
 */
export function DashboardSkeleton({
  header = true,
  context = true,
  aside = true,
  trend = true,
  label = 'Se încarcă panoul…',
}: {
  /**
   * Also draw the header in grey. Prefer a real <DashboardHeader> with the fallback title
   * («Panoul bălții», SkeletonCaption, the real DashboardRefresh) and `header={false}`: the page
   * keeps its h1 and its way back while loading, and only the title text changes when data lands.
   */
  header?: boolean;
  context?: boolean;
  aside?: boolean;
  /** The trend card under the list. */
  trend?: boolean;
  label?: string;
}) {
  return (
    <div role="status" className="flex flex-col gap-4 md:gap-5 xl:gap-6">
      <span className="sr-only">{label}</span>
      {header ? (
        // DashboardHeader's own box: the phone's surface band with the 48px chips, the title block
        // and, from 768, the ghost refresh button's content (no fill: a 24px icon bone and a label
        // bone, inset by the button's 12px padding), centred on it.
        <div
          aria-hidden
          className="flex items-center gap-3 pt-2 max-md:-mx-4 max-md:border-b max-md:border-hairline max-md:bg-surface max-md:px-4 max-md:pb-3 md:gap-4 md:pt-6 xl:pt-8"
        >
          <span className="size-12 shrink-0 rounded-control bg-soft-fill md:hidden" />
          <span className="flex min-w-0 flex-1 flex-col items-center gap-0.5 md:items-start">
            <TextBone step="t-title1 md:t-page-title" className="h-5 w-40 md:h-7 xl:w-64" />
            <TextBone step="t-caption md:t-body" className="h-3 w-28" />
          </span>
          <span className="size-12 shrink-0 rounded-control bg-soft-fill md:hidden" />
          <span className="hidden h-12 shrink-0 items-center gap-2 px-3 md:flex xl:h-10">
            <span className="size-6 rounded-control bg-soft-fill animate-shimmer" />
            <TextBone step="t-body-strong" className="h-3 w-28" />
          </span>
        </div>
      ) : null}
      {/* phone / tablet */}
      <div className="flex flex-col gap-4 md:gap-5 xl:hidden">
        <SkeletonActionBar />
        {/* «Azi la baltă»: the phone list, the table from 768. */}
        <SkeletonCard rows={3} className="md:hidden" />
        <div className="max-md:hidden">
          <SkeletonTable rows={3} />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fit,minmax(--spacing(38),1fr))]">
          <SkeletonTile live />
          <SkeletonTile />
          <SkeletonTile className="max-md:hidden" />
          <SkeletonTile className="max-md:hidden" />
        </div>
        {trend ? <SkeletonTrend /> : null}
      </div>
      {/* desktop: the three columns, on the layout's tracks */}
      <div className={cn('hidden items-start gap-6 xl:grid', dashboardTracks(context, aside))}>
        {context ? <SkeletonNavList /> : null}
        <div className="flex flex-col gap-6">
          {/* KpiGrid quad: one row in the centre column at every desktop width. */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(38),1fr))] gap-4">
            <SkeletonTile live />
            <SkeletonTile />
            <SkeletonTile />
            <SkeletonTile />
          </div>
          <SkeletonTable rows={5} />
          {trend ? <SkeletonTrend /> : null}
        </div>
        {aside ? (
          <div className="flex flex-col gap-5">
            <SkeletonLines rows={1} />
            <SkeletonNextUp />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Nothing to administer / nothing yet (fish «Nu administrezi niciun lac.»): the action in the card. */
export function DashboardEmpty({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: ReactNode;
  /** A secondary Button / ButtonLink (the state cards' one CTA look). */
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(STATE_CARD, className)}>
      <ListEmpty title={title} description={description} icon={icon} action={action} />
    </div>
  );
}

/**
 * Signed out. fish routes a guest to sign-in and back; the web page renders the templates' one
 * sign-in gate (../SignInGate.tsx) so the moment looks the same on every template; «Intră»
 * returns to `next`.
 */
export function DashboardSignedOut({
  title = 'Intră în cont ca să vezi panoul',
  description = 'Panoul arată datele bălților și concursurilor pe care le administrezi.',
  next,
  className,
}: {
  title?: string;
  description?: ReactNode;
  /** The page to come back to after sign-in. */
  next: string;
  className?: string;
}) {
  return <SignInGate title={title} description={description} next={next} className={className} />;
}
