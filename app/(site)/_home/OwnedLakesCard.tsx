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
} from '@heroicons/react/24/outline';
import type { OwnedLakesStats } from '@/core/lakes';
import { ACTION_TILE, CountBadge, DashboardLine, DashboardLines, DashboardSection, ICON_TILE, type ActionTone } from '@/components/templates/T5';
import { cn } from '@/components/ui/cn';
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
 * The card's links sit above its stretched title link (the whole card opens the lake panel).
 * Rows are the kit's DashboardLines (dense in the 264–320px column: the link goes under the text,
 * so «Nicio rezervare de aprobat» keeps the row's full width and never reads backwards).
 */
const ABOVE_STRETCH = '[&_a]:relative [&_a]:z-above';

/**
 * fish components/OwnedLakesCard.tsx — the operator's glance on Acasă: is anything waiting on me?
 * Names the single oldest request; with nothing pending it still speaks («Nicio rezervare de
 * aprobat» + tomorrow). The shortcut row comes right under that status line, so it never moves:
 * cancellations (24h) and the review queue, shown only when non-zero, come under it. The whole
 * card opens the lake panel; the row links and the shortcuts keep their own targets. Pure markup
 * from the lakes and their stats: without stats there is no card (owner rule 4, ROADMAP §4b; fish
 * OwnedLakesCard.tsx:64 `!stats → null`) — slots.tsx OperatorSlot and LateBlocks.tsx decide that.
 */
export function OwnedLakesCard({
  lakes,
  stats,
  layout,
  className,
}: {
  lakes: { documentId: string; name: string }[];
  stats: OwnedLakesStats;
  layout: Layout;
  className?: string;
}) {

  const single = lakes.length === 1 ? lakes[0] : undefined;
  const multiLake = lakes.length > 1;
  const lakeId = single?.documentId;
  const dense = layout === 'desktop';
  const pending = stats.pending ?? 0;
  const oldest = stats.oldestPending;
  const occupancy = stats.occupancy;
  const cancelled = stats.cancelledLast24h ?? 0;
  const toReview = stats.pendingFeedback ?? 0;
  // reservationsByDay is today-first, so index 1 is tomorrow.
  const tomorrow = stats.reservationsByDay?.[1]?.count ?? 0;
  const title = single ? `Balta mea · ${single.name}` : `Bălțile mele · ${lakes.length} bălți`;

  return (
    // The T5 card, flush: the rows bring their own inset. The heading wraps (never truncates a
    // lake's name) and the occupancy is its caption line.
    <DashboardSection
      variant="card"
      flush
      className={cn('relative', className)}
      title={
        // The whole card opens the lake panel.
        <Link
          href={operatorHref(lakeId, 'panel')}
          className="outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:outline-2 focus-visible:after:outline-offset-[-2px] focus-visible:after:outline-accent"
        >
          {title}
        </Link>
      }
      caption={occupancy && occupancy.total > 0 ? <span className="tabular-nums">{`${occupancy.booked} / ${occupancy.total} standuri ocupate`}</span> : null}
    >
      <DashboardLines bare dense={dense} label="Situația bălții" className={ABOVE_STRETCH}>
        {pending > 0 ? (
          <DashboardLine
            tone="pending"
            icon={<ClockIcon />}
            title={pending === 1 ? '1 cerere așteaptă răspuns' : `${pending} cereri așteaptă răspuns`}
            description={oldest ? pendingDetail(oldest, multiLake) : undefined}
            action={{ label: 'Vezi', href: operatorHref(lakeId, 'bookings', 'pending'), srLabel: 'Vezi cererile în așteptare' }}
          />
        ) : (
          <DashboardLine
            tone="green"
            icon={<CheckCircleIcon />}
            title="Nicio rezervare de aprobat"
            description={tomorrow === 0 ? '0 rezervări mâine' : tomorrow === 1 ? '1 rezervare mâine' : `${tomorrow} rezervări mâine`}
            // «who is coming» when someone is, «why is it empty» when nobody is.
            action={tomorrow > 0 ? { label: 'Vezi ziua', href: operatorHref(lakeId, 'panel') } : { label: 'Vezi grila', href: operatorHref(lakeId, 'calendar') }}
          />
        )}
      </DashboardLines>

      <QuickActions>
        <QuickAction icon={<ChartBarSquareIcon />} tone="accent" label="Panou" href={operatorHref(lakeId, 'panel')} />
        <QuickAction icon={<CalendarDaysIcon />} tone="accent" label="Calendar" href={operatorHref(lakeId, 'calendar')} />
        {/* The badge counts unanswered requests, so the tap has to land on them. */}
        <QuickAction
          icon={<TicketIcon />}
          tone="success"
          label="Rezervări"
          badge={pending}
          href={pending > 0 ? operatorHref(lakeId, 'bookings', 'pending') : operatorHref(lakeId, 'bookings')}
        />
      </QuickActions>

      {cancelled > 0 || toReview > 0 ? (
        <DashboardLines bare dense={dense} label="De urmărit" className={cn('border-t border-hairline', ABOVE_STRETCH)}>
          {cancelled > 0 ? (
            <DashboardLine
              tone="red"
              icon={<XCircleIcon />}
              title={cancelled === 1 ? '1 rezervare anulată' : `${cancelled} rezervări anulate`}
              description="în ultimele 24 de ore"
              action={{ label: 'Vezi', href: operatorHref(lakeId, 'bookings', 'cancelled'), srLabel: 'Vezi rezervările anulate' }}
            />
          ) : null}
          {toReview > 0 ? (
            <DashboardLine
              tone="indigo"
              icon={<StarIcon />}
              title={toReview === 1 ? '1 evaluare de dat' : `${toReview} evaluări de dat`}
              description={toReview === 1 ? 'rezervare încheiată fără feedback' : 'rezervări încheiate fără feedback'}
              action={{ label: 'Vezi', href: operatorHref(lakeId, 'bookings', 'toreview'), srLabel: 'Vezi evaluările de dat' }}
            />
          ) : null}
        </DashboardLines>
      ) : null}
    </DashboardSection>
  );
}

/**
 * The operator shortcuts inside the card: three equal cells, tile over label at every width (three
 * fit the 264px column with air). Not the kit's DashboardActions: its bar is a sticky, self-carded
 * page bar (and lays tile beside label from 768), its list a card of its own — neither nests in a
 * card. TODO(kit): an in-card `inline` layout of DashboardActions; the tile, label and badge here
 * are already its parts (ICON_TILE + ACTION_TILE, t-label, CountBadge).
 */
function QuickActions({ children }: { children: ReactNode }) {
  return (
    <ul aria-label="Scurtături operator" className="flex border-t border-hairline px-2 py-2.5">
      {children}
    </ul>
  );
}

function QuickAction({ icon, tone, label, badge, href }: { icon: ReactNode; tone: ActionTone; label: string; badge?: number; href: string }) {
  const count = badge ? (badge > 99 ? '99+' : String(badge)) : null;
  return (
    <li className="flex flex-1">
      <Link
        href={href}
        className="relative z-above flex flex-1 flex-col items-center justify-center gap-1.5 rounded-control py-1 transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-soft-fill active:opacity-70"
      >
        <span className="relative">
          <span aria-hidden className={cn(ICON_TILE, ACTION_TILE[tone])}>
            {icon}
          </span>
          <CountBadge count={badge} className="absolute -top-1.5 -right-2" />
        </span>
        <span className="t-label text-ink">{label}</span>
        {count ? <span className="sr-only">, {count} în așteptare</span> : null}
      </Link>
    </li>
  );
}

/**
 * The card's footprint while its stats stream in — rendered only for a viewer the session already
 * names as an operator. Built from the card's own parts (the T5 card flush, a DashboardLines row in
 * the same density, the shortcut cells), each bone on the line box of the text it stands for: the
 * common shape (title, caption, the status line, the shortcuts). The rows that only some viewers
 * have come after the shortcuts, so their arrival never moves the shortcut row.
 */
export function OwnedLakesCardSkeleton({ layout, className }: { layout: Layout; className?: string }) {
  const bone = 'inline-block h-3.5 rounded-full bg-soft-fill align-middle animate-shimmer';
  return (
    <div role="status" className={className}>
      <DashboardSection
        variant="card"
        flush
        title={
          <>
            <span className="sr-only">Se încarcă balta ta</span>
            <span aria-hidden className={cn(bone, 'w-3/5')} />
          </>
        }
        caption={<span aria-hidden className={cn(bone, 'h-3 w-2/5')} />}
      >
        {/* inert: the row's link only holds the dense layout's link line, it is never a target. */}
        <div aria-hidden inert>
          <DashboardLines bare dense={layout === 'desktop'}>
            <DashboardLine
              icon={null}
              title={<span className={cn(bone, 'w-4/5')} />}
              description={<span className={cn(bone, 'h-3 w-1/2')} />}
              action={{ href: '#', label: '​' }}
            />
          </DashboardLines>
          <span className="flex border-t border-hairline px-2 py-2.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="flex flex-1 flex-col items-center justify-center gap-1.5 py-1">
                <span className={cn(ICON_TILE, 'bg-soft-fill animate-shimmer')} />
                <span className="t-label">
                  <span className={cn(bone, 'h-3 w-12')} />
                </span>
              </span>
            ))}
          </span>
        </div>
      </DashboardSection>
    </div>
  );
}
