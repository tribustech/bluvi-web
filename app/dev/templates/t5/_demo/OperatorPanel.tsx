import type { ReactNode } from 'react';
import {
  CalendarDaysIcon,
  ClockIcon,
  NoSymbolIcon,
  StarIcon,
  TicketIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
// Solid only for presence marks (Fundații §05, at 20): the «all clear» check.
import { CheckCircleIcon } from '@heroicons/react/20/solid';
import { cashDueToday, todayListRows, todayPhase } from '@/core/booking';
import type { LakeOperatorStats } from '@/core/lakes';
import {
  DashboardAction,
  DashboardActions,
  DashboardAlert,
  DashboardLayout,
  DashboardLine,
  DashboardLines,
  DashboardSection,
  isLongValue,
  KpiGrid,
  KpiTile,
} from '@/components/templates/T5';
import { Avatar } from '@/components/ui/Avatar';
import { countdown, hourMinute, lei, waitedLabel } from './format';
import { operatorLinks } from './links';
import { TodayCard } from './TodayCard';

/** Romanian numerals from 20 take «de» («20 de cereri», «120 de cereri»; «3 cereri», «101 cereri»). */
const deFor = (n: number) => (n % 100 === 0 || n % 100 >= 20 ? 'de ' : '');

type Props = {
  lakeId: string;
  /** The context column's title: what the shortcuts belong to. */
  lakeName: string;
  stats: LakeOperatorStats;
  nowMs: number;
  /** «Cum merge balta»: the live or the simulated card (a client component). */
  trend: ReactNode;
};

/**
 * Panoul bălții (fish app/(app)/operator/[lakeId]/index.tsx) composed from T5.
 *
 * < 1280, fish order (operator.panou.c31): quick actions (sticky) · pending alert · Azi la baltă
 * (the list on a phone, the table from 768) ·
 * drop-outs / reviews · the two tiles · trend.
 * ≥ 1280: context = the lake (its name, its stands) and its shortcuts · centre = alert, the
 * signature figures (occupancy, cash today, cash in 7 days — and requests on a quiet day only: with
 * requests waiting the alert already says it, with the action), today as a table, trend · «ce mă
 * așteaptă» = what needs the operator next (drop-outs and reviews, then the next arrival).
 */
export function OperatorPanel({ lakeId, lakeName, stats, nowMs, trend }: Props) {
  const rows = stats.today ?? [];
  const pending = stats.pending;
  const cancelled = stats.cancelledLast24h ?? 0;
  const toReview = stats.pendingFeedback ?? 0;

  // c22: stands held right now; an older CMS → today's day count, and the label follows.
  const occ = stats.occupancyNow ?? stats.occupancyByDay?.at(-1) ?? { booked: 0, total: 0 };
  const occLabel = stats.occupancyNow ? 'Ocupate acum' : 'Ocupate azi';
  // c23 / c24: the server's figure wins; the client sum is the older-CMS fallback.
  const cashToday = stats.deIncasatAzi ?? cashDueToday(rows, nowMs);
  const cash7 = stats.deIncasat7z;
  const cashDetail =
    cash7 != null && cash7 > 0
      ? // Two caption lines at most in a 375 tile (KpiTile): «azi inclus» is the quad tile's detail.
        `la sosire · în 7 zile: ${lei(cash7)} lei`
      : rows.length === 0
        ? 'Nicio sosire azi'
        : cashToday === 0
          ? 'Totul e achitat'
          : 'la sosire';

  const listed = todayListRows(rows);
  const next = listed.filter((b) => todayPhase(b, nowMs) === 'next').sort((a, b) => a.startDate.localeCompare(b.startDate));

  const alert =
    pending > 0 ? (
      // The «în așteptare» pair: the same colour as the Rezervări badge and the pending pill.
      <DashboardAlert
        tone="pending"
        icon={<ClockIcon />}
        title={pending === 1 ? '1 cerere așteaptă răspuns' : `${pending} ${deFor(pending)}cereri așteaptă răspuns`}
        description={
          stats.oldestPending
            ? [
                stats.oldestPending.anglerName ?? 'Pescar',
                stats.oldestPending.standName ? `standul ${stats.oldestPending.standName}` : null,
                waitedLabel(stats.oldestPending.waitingMinutes),
              ]
                .filter(Boolean)
                .join(' · ')
            : 'Nu sunt confirmate până le răspunzi'
        }
        action={{ href: operatorLinks.bookings(lakeId, 'pending'), label: 'Răspunde', srLabel: 'Răspunde la cererile în așteptare' }}
      />
    ) : null;

  // dense: the 264–320px aside — the action under the text, a one-line description.
  const newsLines = (dense: boolean) =>
    [
      cancelled > 0 ? (
        <DashboardLine
          key="cancelled"
          tone="red"
          icon={<XCircleIcon />}
          // The aside is 264–320px: a short title there, so it never orphans a word.
          title={
            dense
              ? cancelled === 1
                ? '1 anulare de pescar'
                : `${cancelled} ${deFor(cancelled)}anulări de pescari`
              : cancelled === 1
                ? '1 rezervare anulată de un pescar'
                : `${cancelled} ${deFor(cancelled)}rezervări anulate de pescari`
          }
          description={dense ? 'în ultimele 24 h' : 'în ultimele 24 de ore · standurile sunt din nou libere'}
          action={{ href: operatorLinks.bookings(lakeId, 'cancelled'), label: 'Vezi', srLabel: 'Vezi rezervările anulate' }}
        />
      ) : null,
      toReview > 0 ? (
        <DashboardLine
          key="review"
          tone="indigo"
          icon={<StarIcon />}
          title={toReview === 1 ? '1 partidă de evaluat' : `${toReview} ${deFor(toReview)}partide de evaluat`}
          description="încheiate fără notă"
          action={{ href: operatorLinks.bookings(lakeId, 'toreview'), label: 'Vezi', srLabel: 'Vezi partidele de evaluat' }}
        />
      ) : null,
    ].filter(Boolean);
  const hasNews = cancelled > 0 || toReview > 0;

  // The one «happening now» figure: the navy CountTile (Fundații §07), with what is still free.
  const free = Math.max(0, occ.total - occ.booked);
  const occupancyTile = (
    <KpiTile live label={occLabel} value={occ.booked} unit={`/${occ.total}`} detail={occ.total > 0 ? `${free} ${free === 1 ? 'liber' : 'libere'}` : undefined} />
  );
  // The phone pair: cash today, with the 7-day figure as its detail (fish's two tiles).
  const cashTile = <KpiTile value={lei(cashToday)} unit=" lei" label="De încasat azi" detail={cashDetail} />;
  // The KPI row splits the cash label: «de încasat azi» + «la sosire» (or the day's state) as detail.
  const cashTodayDetail = rows.length === 0 ? 'Nicio sosire azi' : cashToday === 0 ? 'Totul e achitat' : 'la sosire';
  const cash7Value = cash7 != null ? lei(cash7) : '—';
  // The requests tile only on a quiet day («Totul e la zi»): with requests waiting, the alert right
  // above already says how many, with the action — the row keeps three figures then.
  const requestsTile = pending === 0;
  // One step for the whole row (KpiGrid compact): a long sum in a row of four (~150px tiles), or
  // one too long even for a third of the row.
  const quadValues = [lei(cashToday), cash7Value];
  const quadCompact = quadValues.some((v) => v.length > 6) || (requestsTile && quadValues.some(isLongValue));
  const quad = (className?: string) => (
    <KpiGrid label="Azi, pe scurt" columns="quad" compact={quadCompact} className={className}>
      {occupancyTile}
      <KpiTile value={lei(cashToday)} unit=" lei" label="De încasat azi" detail={cashTodayDetail} />
      <KpiTile
        value={cash7Value}
        unit={cash7 != null ? ' lei' : undefined}
        // Labels keep to one line in a four-up tile (≈ 14 characters), so the numbers share a line.
        label="În 7 zile"
        detail={cash7 == null ? 'Indisponibil pe această versiune' : 'de încasat, azi inclus'}
      />
      {requestsTile ? <KpiTile value={0} label="Cereri de aprobat" detail="Totul e la zi" detailTone="success" /> : null}
    </KpiGrid>
  );

  // The context column's one line of fact about the lake.
  const standsFact = occ.total > 0 ? `${occ.total} ${deFor(occ.total)}${occ.total === 1 ? 'stand' : 'standuri'}` : undefined;
  const actions = (layout: 'bar' | 'list') => (
    <DashboardActions
      label="Scurtături bălții"
      layout={layout}
      title={layout === 'list' ? lakeName : undefined}
      caption={layout === 'list' ? standsFact : undefined}
    >
      <DashboardAction href={operatorLinks.calendar(lakeId)} label="Calendar" icon={<CalendarDaysIcon />} tone="accent" />
      <DashboardAction
        href={pending > 0 ? operatorLinks.bookings(lakeId, 'pending') : operatorLinks.bookings(lakeId)}
        label="Rezervări"
        icon={<TicketIcon />}
        tone="accent"
        badge={pending}
        badgeLabel={pending === 1 ? 'cerere în așteptare' : 'cereri în așteptare'}
      />
      <DashboardAction href={operatorLinks.blocks(lakeId)} label="Blocaje" icon={<NoSymbolIcon />} tone="danger" />
    </DashboardActions>
  );

  const nextUp = next[0];

  return (
    <DashboardLayout
      stacked={
        <>
          {actions('bar')}
          {alert}
          {/* The phone list; from 768 there is room for the table (one line per booking). */}
          <TodayCard stats={stats} lakeId={lakeId} nowMs={nowMs} layout="list" className="md:hidden" />
          <TodayCard stats={stats} lakeId={lakeId} nowMs={nowMs} layout="table" className="max-md:hidden" />
          {hasNews ? <DashboardLines label="Noutăți">{newsLines(false)}</DashboardLines> : null}
          {/* A phone keeps fish's pair; from 768 there is room for the four figures. */}
          <KpiGrid label="Azi, pe scurt" columns="pair" compact={isLongValue(lei(cashToday))} className="md:hidden">
            {occupancyTile}
            {cashTile}
          </KpiGrid>
          {quad('max-md:hidden')}
          {trend}
        </>
      }
      context={actions('list')}
      main={
        <>
          {alert}
          {quad()}
          <TodayCard stats={stats} lakeId={lakeId} nowMs={nowMs} layout="table" />
          {trend}
        </>
      }
      aside={
        <>
          <DashboardSection title="De rezolvat" flush>
            <DashboardLines label="De rezolvat" bare dense>
              {hasNews
                ? newsLines(true)
                : [
                    <DashboardLine
                      key="clear"
                      tone="green"
                      icon={<CheckCircleIcon />}
                      solid
                      title="Nimic de rezolvat"
                      description="Nicio anulare, nicio partidă de evaluat."
                    />,
                  ]}
            </DashboardLines>
          </DashboardSection>
          <DashboardSection title="Următoarea sosire" caption={next.length > 1 ? `din ${next.length} sosiri până diseară` : undefined} flush>
            {nextUp ? (
              // The flush sections' inset rule: the first row 12px under the heading (pt-2).
              <div className="flex items-center gap-3 px-4.5 pt-2 pb-4.5">
                <Avatar name={nextUp.anglerName ?? 'Pescar'} src={nextUp.anglerAvatar} size={40} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate t-body-strong text-ink">{nextUp.anglerName ?? 'Pescar'}</span>
                  <span className="t-caption text-muted">
                    {nextUp.standName ? <span className="t-label text-accent-ink">Standul {nextUp.standName}</span> : null}
                    {nextUp.standName ? ' ' : ''}
                    <span className="whitespace-nowrap">{nextUp.standName ? '· ' : ''}vine {countdown(nextUp.startDate, nowMs)}</span>
                  </span>
                </span>
                <span className="shrink-0 t-body-strong text-ink tabular-nums">{hourMinute(nextUp.startDate)}</span>
              </div>
            ) : (
              <p className="px-4.5 pt-2 pb-4.5 t-body text-muted">Nicio sosire până diseară.</p>
            )}
          </DashboardSection>
        </>
      }
    />
  );
}
