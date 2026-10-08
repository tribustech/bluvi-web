import { Fragment } from 'react';
import { todayMoment, todayPhase, type TodayStandGroup } from '@/core/booking';
import type { OperatorUpcomingBooking } from '@/core/lakes';
import { cn } from '@/components/ui/cn';
import { formatCount } from '@/core/realtime/chat/format';
import { isDimmed } from './model';
import { CaptionParts, MoneyColumn, ROW_INTERACTIVE, ROW_TEXT, RowAvatar, RowName, standPart, StayBar, type OpenBooking } from './TodayStandRow';

/**
 * Substitution mark, football-style (fish: a green in / red out badge on the avatar's corner): green =
 * arrives, red = leaves or stays. Directional status, not a glyph (Fundații §05 has no 10px icon) —
 * the colour on the corner, and the caption says it in words («vine 17:00» / «pleacă 12:00»).
 */
function MoveBadge({ kind }: { kind: 'arrives' | 'stays' | 'leaves' }) {
  return (
    <span
      aria-hidden
      data-move={kind === 'arrives' ? 'in' : 'out'}
      className={cn('absolute -right-1 -bottom-1 size-4 rounded-full border-2 border-surface', kind === 'arrives' ? 'bg-success' : 'bg-status-danger-fg')}
    />
  );
}

/**
 * c18 — a stand that changes hands today (fish TodayTurnoverRow): one block, the anglers in time order
 * joined by an indigo thread, each avatar with its in / out mark, the moment label as the caption
 * («vine 17:00 · 24h», «a venit 06:00 · pleacă 18:00», «a plecat 12:00» …).
 */
export function TurnoverBlock({ group, nowMs, onOpen }: { group: TodayStandGroup<OperatorUpcomingBooking>; nowMs: number; onOpen: OpenBooking }) {
  const stand = group.standName;
  return (
    <li className="px-4.5 py-2.75" data-testid="today-turnover">
      <ol aria-label={stand ? `Standul ${stand}, ${formatCount(group.bookings.length, 'rezervare', 'rezervări')} azi` : undefined}>
        {group.bookings.map((b, i) => {
          const phase = todayPhase(b, nowMs);
          const moment = todayMoment(b, nowMs);
          const name = b.anglerName ?? 'Pescar';
          return (
            <Fragment key={`${b.code ?? b.documentId ?? i}-${b.startDate}`}>
              <li
                data-testid="today-row"
                data-phase={phase}
                data-dimmed={isDimmed(phase) || undefined}
                className={cn('-mx-4.5 flex items-center gap-3 px-4.5', ROW_INTERACTIVE)}
              >
                <span className="relative shrink-0">
                  <RowAvatar name={name} src={b.anglerAvatar} phase={phase} />
                  <MoveBadge kind={moment.kind} />
                </span>
                <span className={ROW_TEXT}>
                  <RowName booking={b} stand={stand} phase={phase} onOpen={onOpen} />
                  <CaptionParts parts={[standPart(stand), moment.label]} />
                  {phase === 'live' ? <StayBar booking={b} nowMs={nowMs} /> : null}
                </span>
                <MoneyColumn booking={b} phase={phase} />
              </li>
              {i < group.bookings.length - 1 ? (
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
