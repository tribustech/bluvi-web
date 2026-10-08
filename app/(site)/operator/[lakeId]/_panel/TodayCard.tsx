import Link from 'next/link';
import { ChevronRightIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { formatBookingPeriod, groupTodayByStand, todayListRows, todayMomentBand } from '@/core/booking';
import type { LakeOperatorStats } from '@/core/lakes';
import { DashboardSection, SectionFooterLink } from '@/components/templates/T5';
import { routes } from '@/lib/routes';
import { seeAllLabel, TODAY_STANDS_MAX } from './model';
import { TodayStandRow, type OpenBooking } from './TodayStandRow';
import { TurnoverBlock } from './TurnoverBlock';

/**
 * «Azi la baltă» (fish operator/[lakeId]/index.tsx DashboardBody §2).
 *  - c10 the caption band «2 vin · 3 stau · 1 pleacă» (pending excluded, empty segments dropped);
 *  - c11 today's competition: an indigo row → /concursuri/[id];
 *  - c12 rows from data.today (not upcoming: a stay begun at 06:00 is still listed), pending
 *    excluded, one group per stand in natural order, bookings inside by start time;
 *  - c13 five stands at most, then «Vezi toate (N standuri)» → the inbox;
 *  - c14 the empty copies;
 *  - c15–c19 the rows (TodayStandRow, TurnoverBlock), each opening the booking detail.
 */
export function TodayCard({
  stats,
  nowMs,
  seeAllHref,
  onOpen,
}: {
  stats: LakeOperatorStats;
  nowMs: number;
  seeAllHref: string;
  onOpen: OpenBooking;
}) {
  const rows = stats.today ?? [];
  const groups = groupTodayByStand(rows);
  const shown = groups.slice(0, TODAY_STANDS_MAX);
  const band = todayMomentBand(todayListRows(rows), nowMs);
  const competition = stats.todayCompetition;

  return (
    <DashboardSection
      title="Azi la baltă"
      caption={band || undefined}
      flush
      footer={groups.length > TODAY_STANDS_MAX ? <SectionFooterLink href={seeAllHref}>{seeAllLabel(groups.length)}</SectionFooterLink> : undefined}
    >
      {competition ? (
        <Link
          href={routes.competition(competition.documentId)}
          className="mx-4.5 mt-2 mb-1 flex items-center gap-3 rounded-control bg-accent-tint p-3 text-accent-ink transition-colors duration-(--duration-fast) ease-fast hover:bg-accent-tint-2"
        >
          <TrophyIcon aria-hidden className="size-6 shrink-0" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate t-body-strong">{competition.name}</span>
            {/* The period wraps rather than losing its end on a phone. */}
            <span className="line-clamp-2 t-caption">Concurs · {formatBookingPeriod(competition.startDate, competition.endDate)}</span>
          </span>
          <ChevronRightIcon aria-hidden className="size-6 shrink-0" />
        </Link>
      ) : null}

      {groups.length === 0 ? (
        <p className="px-4.5 pt-2 pb-4.5 t-body text-muted">{competition ? 'Nicio rezervare în afara concursului.' : 'Nicio rezervare azi.'}</p>
      ) : (
        <ul aria-label="Rezervările de azi, pe standuri" className="mt-1 divide-y divide-hairline">
          {shown.map((g, i) =>
            g.bookings.length > 1 ? (
              <TurnoverBlock key={g.standName ?? `s${i}`} group={g} nowMs={nowMs} onOpen={onOpen} />
            ) : (
              <TodayStandRow key={g.standName ?? `s${i}`} booking={g.bookings[0]} nowMs={nowMs} onOpen={onOpen} />
            ),
          )}
        </ul>
      )}
    </DashboardSection>
  );
}
