import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  CalendarDaysIcon,
  ChartBarSquareIcon,
  CheckCircleIcon,
  ClockIcon,
  StarIcon,
  TicketIcon,
  XCircleIcon,
} from '@heroicons/react/20/solid';
import type { OwnedLakesStats } from '@/core/lakes';
import { cn } from '@/components/ui/cn';
import { loadOwnedLakes } from './data';
import { waitedLabel } from './format';
import { operatorHref } from './links';

type Layout = 'mobile' | 'desktop';

/**
 * The line under the request: who, where, how long. Multi-lake operators get the lake rather than
 * the stand — with several lakes "which lake" is the question (fish `pendingDetail`).
 */
function pendingDetail(p: NonNullable<OwnedLakesStats['oldestPending']>, multiLake: boolean): string {
  const where = multiLake ? p.lakeName : p.standName ? `standul ${p.standName}` : null;
  return [p.anglerName, where, waitedLabel(p.waitingMinutes)].filter(Boolean).join(' · ');
}

/**
 * fish components/OwnedLakesCard.tsx — the operator's glance on Acasă: is anything waiting on me?
 * Names the single oldest request; with nothing pending it still speaks («Nicio rezervare de
 * aprobat» + tomorrow). Cancellations (24h) and the review queue appear only when non-zero. The
 * whole card opens the lake panel; «Vezi» links and the quick actions keep their own targets.
 */
export async function OwnedLakesCard({ layout, className }: { layout: Layout; className?: string }) {
  const owned = await loadOwnedLakes();
  if (!owned) return null;
  const { lakes, stats } = owned;

  const single = lakes.length === 1 ? lakes[0] : undefined;
  const multiLake = lakes.length > 1;
  const lakeId = single?.documentId;
  const pending = stats.pending ?? 0;
  const oldest = stats.oldestPending;
  const occupancy = stats.occupancy;
  const cancelled = stats.cancelledLast24h ?? 0;
  const toReview = stats.pendingFeedback ?? 0;
  // reservationsByDay is today-first, so index 1 is tomorrow.
  const tomorrow = stats.reservationsByDay?.[1]?.count ?? 0;
  const desktop = layout === 'desktop';
  const title = single ? `Balta mea · ${single.name}` : `Bălțile mele · ${lakes.length} bălți`;

  return (
    <section aria-labelledby={`acasa-balta-mea-${layout}`} className={cn('relative rounded-card bg-surface', className)}>
      <div className={cn('flex items-center gap-2', desktop ? 'px-3.5 pt-3.5 pb-2.5' : 'px-4 pt-4 pb-3')}>
        <h2 id={`acasa-balta-mea-${layout}`} className="min-w-0 flex-1 truncate t-heading text-ink">
          {/* The whole card opens the lake panel. */}
          <Link
            href={operatorHref(lakeId, 'panel')}
            className="outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent"
          >
            {title}
          </Link>
        </h2>
        {occupancy && occupancy.total > 0 ? (
          <p className="shrink-0 t-caption text-muted">
            {desktop ? `${occupancy.booked} / ${occupancy.total}` : `${occupancy.booked} / ${occupancy.total} standuri`}
            {desktop ? <span className="sr-only"> standuri</span> : null}
          </p>
        ) : null}
      </div>

      {pending > 0 ? (
        <Row
          layout={layout}
          icon={<ClockIcon />}
          tone="bg-status-warning-bg text-rating"
          title={pending === 1 ? '1 cerere așteaptă răspuns' : `${pending} cereri așteaptă răspuns`}
          sub={oldest ? pendingDetail(oldest, multiLake) : null}
          action={{ label: 'Vezi', href: operatorHref(lakeId, 'bookings', 'pending') }}
        />
      ) : (
        <Row
          layout={layout}
          icon={<CheckCircleIcon />}
          tone="bg-status-success-bg text-status-success-fg"
          title="Nicio rezervare de aprobat"
          sub={tomorrow === 0 ? '0 rezervări mâine' : tomorrow === 1 ? '1 rezervare mâine' : `${tomorrow} rezervări mâine`}
          // «who is coming» when someone is, «why is it empty» when nobody is.
          action={tomorrow > 0 ? { label: 'Vezi ziua', href: operatorHref(lakeId, 'panel') } : { label: 'Vezi grila', href: operatorHref(lakeId, 'calendar') }}
        />
      )}

      {cancelled > 0 ? (
        <Row
          layout={layout}
          icon={<XCircleIcon />}
          tone="bg-status-danger-bg text-status-danger-fg"
          title={cancelled === 1 ? '1 rezervare anulată' : `${cancelled} rezervări anulate`}
          sub="în ultimele 24 de ore"
          action={{ label: 'Vezi', href: operatorHref(lakeId, 'bookings', 'cancelled') }}
        />
      ) : null}

      {toReview > 0 ? (
        <Row
          layout={layout}
          icon={<StarIcon />}
          tone="bg-accent-tint text-accent"
          title={toReview === 1 ? '1 evaluare de dat' : `${toReview} evaluări de dat`}
          sub={toReview === 1 ? 'rezervare încheiată fără feedback' : 'rezervări încheiate fără feedback'}
          action={{ label: 'Vezi', href: operatorHref(lakeId, 'bookings', 'toreview') }}
        />
      ) : null}

      <div className="h-px bg-hairline" />

      <ul aria-label="Scurtături operator" className={cn('flex px-2', desktop ? 'py-2.5' : 'py-3.5')}>
        <QuickAction layout={layout} icon={<ChartBarSquareIcon />} tone="bg-accent-ink" label="Panou" href={operatorHref(lakeId, 'panel')} />
        <QuickAction layout={layout} icon={<CalendarDaysIcon />} tone="bg-accent" label="Calendar" href={operatorHref(lakeId, 'calendar')} />
        {/* The badge counts unanswered requests, so the tap has to land on them. */}
        <QuickAction
          layout={layout}
          icon={<TicketIcon />}
          tone="bg-success"
          label="Rezervări"
          badge={pending}
          href={pending > 0 ? operatorHref(lakeId, 'bookings', 'pending') : operatorHref(lakeId, 'bookings')}
        />
      </ul>
    </section>
  );
}

function Row({
  layout,
  icon,
  tone,
  title,
  sub,
  action,
}: {
  layout: Layout;
  icon: ReactNode;
  tone: string;
  title: string;
  sub: string | null;
  action: { label: string; href: string };
}) {
  const desktop = layout === 'desktop';
  return (
    <div className={cn('flex items-center', desktop ? 'gap-2.5 px-3.5 pb-3' : 'gap-3 px-4 pb-4')}>
      <span
        aria-hidden
        className={cn('flex shrink-0 items-center justify-center rounded-full', desktop ? 'size-8 [&>svg]:size-[17px]' : 'size-9 [&>svg]:size-[19px]', tone)}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-ink', desktop ? 't-label' : 't-body-strong')}>{title}</p>
        {sub ? <p className="truncate t-caption text-muted">{sub}</p> : null}
      </div>
      <Link href={action.href} className={cn('relative z-10 shrink-0 rounded-control text-accent-ink hover:underline', desktop ? 't-label' : 't-body-strong')} aria-label={`${action.label}: ${title}`}>
        {action.label}
      </Link>
    </div>
  );
}

/** fish features/operator/OperatorQuickAction.tsx — 28px coloured tile, white solid icon, label. */
function QuickAction({
  layout,
  icon,
  tone,
  label,
  badge,
  href,
}: {
  layout: Layout;
  icon: ReactNode;
  tone: string;
  label: string;
  badge?: number;
  href: string;
}) {
  const desktop = layout === 'desktop';
  const count = badge ? (badge > 99 ? '99+' : String(badge)) : null;
  return (
    <li className="flex flex-1">
      <Link
        href={href}
        className={cn(
          'relative z-10 flex flex-1 items-center justify-center rounded-control py-1 hover:bg-soft-fill',
          desktop ? 'gap-[7px]' : 'flex-col gap-1.5'
        )}
      >
        <span className="relative">
          <span
            aria-hidden
            className={cn(
              'flex items-center justify-center text-on-accent',
              desktop ? 'size-6 rounded-[7px] [&>svg]:size-3.5' : 'size-7 rounded-lg [&>svg]:size-4',
              tone
            )}
          >
            {icon}
          </span>
          {count && !desktop ? (
            <span aria-hidden className="absolute -top-1.5 -right-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-live px-[5px] t-micro text-status-live-fg">
              {count}
            </span>
          ) : null}
        </span>
        <span className={cn('text-ink', desktop ? 't-label' : 't-caption')}>{label}</span>
        {count && desktop ? (
          <span aria-hidden className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-live px-[5px] t-micro-strong text-status-live-fg">
            {count}
          </span>
        ) : null}
        {count ? <span className="sr-only">, {count} în așteptare</span> : null}
      </Link>
    </li>
  );
}
