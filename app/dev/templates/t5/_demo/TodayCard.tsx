import Link from 'next/link';
import { Fragment } from 'react';
import { ChevronRightIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { groupTodayByStand, stayProgress, todayListRows, todayMoment, todayMomentBand, todayPhase, type TodayPhase } from '@/core/booking';
import type { LakeOperatorStats, OperatorUpcomingBooking } from '@/core/lakes';
import { DashboardSection, SectionFooterLink } from '@/components/templates/T5';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill';
import { routes } from '@/lib/routes';
import { BookingRowName } from './BookingDetail';
import { dayTime, formatBookingPeriod, lei } from './format';
import { operatorLinks } from './links';

/** fish TODAY_STANDS_MAX: stands listed before «Vezi toate». */
const STANDS_MAX = 5;

type Props = { stats: LakeOperatorStats; lakeId: string; nowMs: number; layout: 'list' | 'table'; className?: string };

/**
 * «Azi la baltă» — fish operator/[lakeId]/index.tsx (TodayRow, TodayTurnoverRow, MoneyColumn).
 * list: the phone card (avatar rows, turnover stands as a joined timeline).
 * table: the desktop centre column — the same rows as a table, one line per booking, the stand
 * cell spanning a turnover stand's rows.
 */
export function TodayCard({ stats, lakeId, nowMs, layout, className }: Props) {
  const rows = stats.today ?? [];
  const groups = groupTodayByStand(rows);
  const shown = groups.slice(0, STANDS_MAX);
  const band = todayMomentBand(todayListRows(rows), nowMs);
  const competition = stats.todayCompetition;

  return (
    <DashboardSection
      title="Azi la baltă"
      caption={band || undefined}
      flush
      className={className}
      footer={
        groups.length > STANDS_MAX ? (
          <SectionFooterLink href={operatorLinks.bookings(lakeId)}>Vezi toate ({groups.length} standuri)</SectionFooterLink>
        ) : undefined
      }
    >
      {competition ? (
        <Link
          href={routes.competition(competition.documentId)}
          className="mx-4.5 mt-2 mb-1 flex items-center gap-3 rounded-control bg-accent-tint p-3 text-accent-ink transition-colors duration-(--duration-fast) ease-fast hover:bg-accent-tint-2"
        >
          <TrophyIcon aria-hidden className="size-6 shrink-0" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate t-body-strong">{competition.name}</span>
            {/* The period wraps rather than losing its end date on a phone. */}
            <span className="line-clamp-2 t-caption">Concurs · {formatBookingPeriod(competition.startDate, competition.endDate)}</span>
          </span>
          <ChevronRightIcon aria-hidden className="size-6 shrink-0" />
        </Link>
      ) : null}

      {groups.length === 0 ? (
        <p className="px-4.5 pt-2 pb-4.5 t-body text-muted">
          {competition ? 'Nicio rezervare în afara concursului.' : 'Nicio rezervare azi.'}
        </p>
      ) : layout === 'table' ? (
        <TodayTable groups={shown} nowMs={nowMs} />
      ) : (
        <ul className="mt-1 divide-y divide-hairline">
          {shown.map((g, i) =>
            g.bookings.length > 1 ? (
              <TurnoverItem key={g.standName ?? `s${i}`} stand={g.standName} bookings={g.bookings} nowMs={nowMs} />
            ) : (
              <RowItem key={g.standName ?? `s${i}`} booking={g.bookings[0]} nowMs={nowMs} />
            ),
          )}
        </ul>
      )}
    </DashboardSection>
  );
}

/**
 * A finished stay («Încheiat»): the avatar fades and the name turns muted — colour, never opacity
 * on text, so every line keeps AA contrast (WCAG 1.4.3). Captions, sums and pills stay at full
 * strength. A no-show is news, not history: it is never faded; its pill says it.
 */
const done = (p: TodayPhase) => p === 'done';
const FADED_AVATAR = 'opacity-60';
const nameTone = (p: TodayPhase) => (done(p) ? 'text-muted' : 'text-ink');
/** The row's accessible name: «Mihai Popescu, standul 1». */
const rowLabel = (name: string, stand: string | null) => (stand ? `${name}, standul ${stand}` : name);
/** A row that opens the booking detail: the hit area and the hover cover the row. */
const ROW_HOVER = 'relative transition-colors duration-(--duration-fast) ease-fast has-[button]:hover:bg-page';

function Stand({ name }: { name: string | null }) {
  return name ? <span className="t-label text-accent-ink">Standul {name}</span> : null;
}

/**
 * The part after the stand as one unit, its «·» included: when the caption wraps, the separator
 * moves to the next line with it instead of dangling after «Standul 1».
 */
function After({ stand, children }: { stand: string | null; children: string }) {
  return (
    <>
      {stand ? ' ' : null}
      <span className="whitespace-nowrap">{stand ? `· ${children}` : children}</span>
    </>
  );
}

/**
 * fish MoneyColumn: total, then the payment / attendance STATE as a pill (Fundații: a state is a
 * StatusPill): «N-a venit» / «Numerar» (due on arrival) / «Plătit»; nothing when free.
 */
function Money({ booking, phase, layout = 'stacked' }: { booking: OperatorUpcomingBooking; phase: TodayPhase; layout?: 'stacked' | 'inline' }) {
  const total = Number(booking.priceTotal) || 0;
  const pill: { label: string; tone: StatusTone } | null =
    phase === 'noshow'
      ? // TODO(kit): a `danger` StatusPill tone (fish shows no-show in red); neutral until the kit has it.
        { label: 'N-a venit', tone: 'neutral' }
      : total <= 0
        ? null
        : booking.balanceDue != null && booking.balanceDue > 0
          ? { label: 'Numerar', tone: 'warning' }
          : { label: 'Plătit', tone: 'success' };
  return (
    // stacked: the phone list (sum over the pill, fish). inline: the desktop table — the pill
    // before the sum on one line, so a booking stays one table row.
    <span className={cn('flex shrink-0', layout === 'inline' ? 'flex-row-reverse items-center gap-2' : 'flex-col items-end gap-1')}>
      {total > 0 ? <span className="t-body-strong whitespace-nowrap text-ink tabular-nums">{lei(total)} lei</span> : null}
      {pill ? <StatusPill tone={pill.tone}>{pill.label}</StatusPill> : null}
    </span>
  );
}

/**
 * The live stay. inline: bar + label on one line (phone rows). stacked: the bar on its own line and
 * the label under it (table cells), so it never runs into the next column.
 */
function StayBar({ booking, nowMs, layout = 'inline' }: { booking: OperatorUpcomingBooking; nowMs: number; layout?: 'inline' | 'stacked' }) {
  const stay = stayProgress(booking, nowMs);
  const pct = Math.round(stay.ratio * 100);
  return (
    <span className={cn('flex min-w-0', layout === 'stacked' ? 'flex-col gap-1' : 'items-center gap-2')}>
      <span
        role="progressbar"
        aria-label="Sejur"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={stay.label}
        // Inline, the bar is capped so its label stays next to the time range it belongs to.
        className={cn('h-1 overflow-hidden rounded-full bg-hairline', layout === 'stacked' ? 'w-full' : 'min-w-0 max-w-40 flex-1')}
      >
        <span className="block h-full bg-accent" style={{ width: `${pct}%` }} />
      </span>
      <span className="shrink-0 t-caption whitespace-nowrap text-ink-2 tabular-nums">{stay.label}</span>
    </span>
  );
}

/**
 * A one-booking stand on the phone list. Top-aligned, so the name and the sum share the first line;
 * the stand gets its own line and the range the next (a range never wraps after a dangling «·»).
 */
function RowItem({ booking, nowMs }: { booking: OperatorUpcomingBooking; nowMs: number }) {
  const name = booking.anglerName ?? 'Pescar';
  const phase = todayPhase(booking, nowMs);
  return (
    <li className={cn('flex items-start gap-3 px-4.5 py-2.75', ROW_HOVER)}>
      <span className={cn('shrink-0 self-center', done(phase) && FADED_AVATAR)}>
        <Avatar name={name} src={booking.anglerAvatar} size={40} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <BookingRowName booking={booking} label={rowLabel(name, booking.standName)} className={cn('truncate t-body-strong', nameTone(phase))} />
        <Stand name={booking.standName} />
        <span className="t-caption text-muted tabular-nums">
          {`${dayTime(booking.startDate)} → ${dayTime(booking.endDate)}`}
          {done(phase) ? ' · încheiat' : null}
        </span>
        {phase === 'live' ? <StayBar booking={booking} nowMs={nowMs} /> : null}
      </span>
      <Money booking={booking} phase={phase} />
    </li>
  );
}

/**
 * Substitution mark, football-style: a green dot = comes in, a red one = goes out. Directional
 * status, not presence (Fundații §05), so no glyph — the colour on the avatar's corner, and the
 * caption says it in words («vine 17:00» / «pleacă 12:00»).
 */
function MoveBadge({ kind }: { kind: 'arrives' | 'stays' | 'leaves' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-surface',
        kind === 'arrives' ? 'bg-success' : 'bg-status-danger-fg',
      )}
    />
  );
}

function TurnoverItem({ stand, bookings, nowMs }: { stand: string | null; bookings: OperatorUpcomingBooking[]; nowMs: number }) {
  return (
    <li className="px-4.5 py-2.75">
      <ol aria-label={stand ? `Standul ${stand}, ${bookings.length} rezervări azi` : undefined}>
        {bookings.map((b, i) => {
          const phase = todayPhase(b, nowMs);
          const moment = todayMoment(b, nowMs);
          const name = b.anglerName ?? 'Pescar';
          return (
            <Fragment key={`${b.code ?? b.documentId ?? i}-${b.startDate}`}>
              <li className={cn('-mx-4.5 flex items-center gap-3 px-4.5', ROW_HOVER)}>
                <span className="relative shrink-0">
                  <span className={cn('block', done(phase) && FADED_AVATAR)}>
                    <Avatar name={name} src={b.anglerAvatar} size={40} />
                  </span>
                  <MoveBadge kind={moment.kind} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <BookingRowName booking={b} label={rowLabel(name, stand)} className={cn('truncate t-body-strong', nameTone(phase))} />
                  <span className="line-clamp-2 t-caption text-muted">
                    <Stand name={stand} />
                    <After stand={stand}>{moment.label}</After>
                  </span>
                  {phase === 'live' ? <StayBar booking={b} nowMs={nowMs} /> : null}
                </span>
                <Money booking={b} phase={phase} />
              </li>
              {i < bookings.length - 1 ? (
                // The thread: one leaves, the next arrives.
                <li aria-hidden className="flex h-5.5 w-10 flex-col items-center">
                  <span className="w-0.5 flex-1 bg-accent-tint-2" />
                  <span className="size-1.5 rounded-full bg-indigo-4" />
                  <span className="w-0.5 flex-1 bg-accent-tint-2" />
                </li>
              ) : null}
            </Fragment>
          );
        })}
      </ol>
    </li>
  );
}

/*
 * The table of «Azi la baltă» (from 768). Fixed layout so it always fits its column (no horizontal
 * scroll): Stand 64 · Pescar and Azi fluid (names and times truncate) · Plată 176, right-aligned,
 * the pill before the sum on one line. A booking is one ~58px row: the 32px avatar, the time over
 * its phase (or the live stay bar). Cells are vertically centred; a turnover stand's spanning
 * cell sits at the top, its label on the first row's centre line (10 + 38 / 2 = 29 = 21 + 16 / 2).
 */
function TodayTable({ groups, nowMs }: { groups: ReturnType<typeof groupTodayByStand>; nowMs: number }) {
  return (
    <div className="mt-2">
      <table className="w-full table-fixed border-collapse t-table">
        <caption className="sr-only">Rezervările de azi, pe standuri</caption>
        <colgroup>
          <col className="w-16" />
          <col />
          <col />
          <col className="w-44" />
        </colgroup>
        <thead>
          <tr className="border-y border-hairline bg-page text-left t-label text-muted">
            <th scope="col" className="py-2.5 pr-2 pl-4.5">Stand</th>
            <th scope="col" className="px-3 py-2.5">Pescar</th>
            <th scope="col" className="px-3 py-2.5">Azi</th>
            <th scope="col" className="py-2.5 pr-4.5 pl-3 text-right">Plată</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g, gi) =>
            g.bookings.map((b, i) => {
              const phase = todayPhase(b, nowMs);
              const moment = todayMoment(b, nowMs);
              const name = b.anglerName ?? 'Pescar';
              const turnover = g.bookings.length > 1;
              const last = i === g.bookings.length - 1;
              return (
                <tr key={`${gi}-${i}`} className={cn('align-middle', ROW_HOVER, last && 'border-b border-hairline last:border-b-0')}>
                  {i === 0 ? (
                    <th scope="row" rowSpan={g.bookings.length} className="pt-5.25 pr-2 pb-2.5 pl-4.5 text-left align-top t-label text-accent-ink">
                      {g.standName ?? '—'}
                    </th>
                  ) : null}
                  <td className="px-3 py-2.5">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="relative shrink-0">
                        <span className={cn('block', done(phase) && FADED_AVATAR)}>
                          <Avatar name={name} src={b.anglerAvatar} size={32} />
                        </span>
                        {turnover ? <MoveBadge kind={moment.kind} /> : null}
                      </span>
                      <BookingRowName booking={b} label={rowLabel(name, g.standName)} className={cn('min-w-0 truncate t-body-strong', nameTone(phase))} />
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-ink-2 tabular-nums">{turnover ? moment.label : `${dayTime(b.startDate)} → ${dayTime(b.endDate)}`}</span>
                      {phase === 'live' ? (
                        <StayBar booking={b} nowMs={nowMs} />
                      ) : phase !== 'noshow' && phaseLabel(phase) ? (
                        // A no-show already says «N-a venit» in its pill.
                        <span className="t-caption text-muted">{phaseLabel(phase)}</span>
                      ) : null}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4.5 pl-3">
                    <span className="flex justify-end">
                      <Money booking={b} phase={phase} layout="inline" />
                    </span>
                  </td>
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
    </div>
  );
}

function phaseLabel(p: TodayPhase): string {
  if (p === 'next') return 'Urmează';
  if (p === 'done') return 'Încheiat';
  if (p === 'noshow') return 'N-a venit';
  return '';
}
