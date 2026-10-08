'use client';

import { Fragment, memo } from 'react';
import { ArrowDownLeftIcon, ArrowUpRightIcon, CheckIcon, ChevronRightIcon, PhoneIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { BookingStatusPill } from '@/components/booking';
import { AnglerRatingBadge, NoShowPill } from '@/components/operator';
import { Avatar, toneForId } from '@/components/ui/Avatar';
import { Button, buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import type { BookingDTO } from '@/core/booking';
import { track } from '@/lib/analytics';
import { BookingAgeLabel } from './BookingAgeLabel';
import { AREA, ROW_BOX, rowGrid } from './layout';
import { rowAccessibleName, rowModel, type MoneyTone } from './model';
import { ReasonLine } from './ReasonLine';

export type RowHandlers = {
  /** c24 — the card itself: opens the booking detail with this row as its seed. */
  onOpen: (b: BookingDTO) => void;
  onAccept: (b: BookingDTO) => void;
  onReject: (b: BookingDTO) => void;
  onRate: (b: BookingDTO) => void;
};

const MONEY: Record<MoneyTone, string> = {
  success: 'bg-status-success-bg text-status-success-fg',
  warning: 'bg-status-warning-bg text-status-warning-fg',
  accent: 'bg-accent-tint text-accent-ink',
  neutral: 'bg-status-neutral-bg text-status-neutral-fg',
};

/**
 * One booking of the inbox — fish features/operator/OperatorBookingRow.tsx, in the panel's
 * language: avatar (rating pill, the turnover in/out badge) · name (no-show pill, request age) ·
 * bold stand + extras · period with its length or the live progress · total + status / money pill;
 * then the note, the reason and — only in the lists that owe a decision — the action buttons.
 *
 * A card on the phone, a table row from 768 of list width (./layout.ts). The whole row opens the
 * detail: the angler's name is the one control (a button stretched over the row, named by the
 * angler, the stand and the period), and the row's other controls — the reason toggle, «Sună»,
 * the action buttons — sit above it.
 *
 * `bare` (inside a turnover card): no card of its own; `turnover` swaps the period for what today
 * means («pleacă 18:00», «vine 18:00 · 12h») and badges the avatar.
 */
function OperatorBookingRowComponent({
  booking,
  nowMs,
  cardActions,
  withActions,
  acting,
  bare = false,
  turnover = false,
  selected = false,
  lakeId,
  lakeName,
  handlers,
}: {
  booking: BookingDTO;
  nowMs: number;
  /** c23 — this list keeps the buttons on its cards (De aprobat, Confirmate · De evaluat). */
  cardActions: boolean;
  /** The list's grid has an «Acțiuni» column (= cardActions of the list). */
  withActions: boolean;
  /** c25 — a write is running for this booking: its buttons are disabled. */
  acting: boolean;
  bare?: boolean;
  turnover?: boolean;
  /** The booking the docked detail shows (master–detail): tinted, an accent edge, aria-current. */
  selected?: boolean;
  lakeId: string;
  lakeName?: string | null;
  handlers: RowHandlers;
}) {
  const m = rowModel(booking, nowMs, { cardActions, turnover });
  const Badge = m.turnover?.kind === 'arrives' ? ArrowDownLeftIcon : ArrowUpRightIcon;
  return (
    <div
      data-testid="inbox-row"
      data-booking={m.id}
      data-quiet={m.quiet || undefined}
      data-selected={selected || undefined}
      className={cn(
        'relative grid',
        rowGrid(withActions),
        ROW_BOX,
        !bare && 'rounded-card @3xl:rounded-none',
        'transition-[background-color,box-shadow] duration-(--duration-fast) ease-fast',
        // The open booking keeps the turnover's language: an accent edge, here over an accent tint —
        // persistent, so it survives the mouse leaving and Acceptă / Refuză reordering the list.
        selected
          ? 'bg-accent-tint shadow-[inset_3px_0_0_var(--color-accent)]'
          : cn(
              !bare && 'bg-surface @3xl:bg-transparent',
              !bare && (m.quiet ? 'shadow-e0 @3xl:shadow-none' : 'shadow-e1 @3xl:shadow-none'),
              !bare && 'hover:shadow-e2 @3xl:hover:bg-soft-fill @3xl:hover:shadow-none',
              bare && '@3xl:hover:bg-soft-fill',
            ),
        'has-[[data-open]:focus-visible]:outline-2 has-[[data-open]:focus-visible]:-outline-offset-2 has-[[data-open]:focus-visible]:outline-solid has-[[data-open]:focus-visible]:outline-accent',
      )}
    >
      {/* Avatar: the rating pill on it (c15), the turnover arrow (c14). */}
      <div className={cn(AREA.av, 'relative self-start')}>
        <Avatar name={m.name} src={m.avatar} size={40} tone={toneForId(m.anglerId ?? m.id)} />
        <AnglerRatingBadge userId={m.anglerId} />
        {m.turnover ? (
          <span
            data-testid="inbox-turnover-badge"
            data-kind={m.turnover.kind}
            className={cn(
              'absolute -bottom-1 -left-1 flex size-4.5 items-center justify-center rounded-full border-2 border-surface text-on-accent',
              m.turnover.kind === 'arrives' ? 'bg-success' : 'bg-status-danger-fg',
            )}
          >
            <Badge aria-hidden className="size-2.5" strokeWidth={3} />
            <span className="sr-only">{m.turnover.kind === 'arrives' ? 'Sosește' : m.turnover.kind === 'leaves' ? 'Pleacă' : 'Stă'}</span>
          </span>
        ) : null}
      </div>

      {/* Name · no-show pill · request age (c15, c16). The name is the row's open control (c24). */}
      <div className={cn(AREA.name, 'flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 self-start @3xl:self-center')}>
        <button
          type="button"
          data-open=""
          onClick={() => handlers.onOpen(booking)}
          aria-label={rowAccessibleName(m)}
          aria-current={selected || undefined}
          className={cn(
            'min-w-0 truncate text-left t-body-strong outline-hidden',
            m.quiet ? 'text-muted' : 'text-ink',
            // Stretched over the whole row: the row is one big target, the name its accessible control.
            "after:absolute after:inset-0 after:content-['']",
          )}
        >
          {m.name}
        </button>
        <NoShowPill userId={m.anglerId} />
        <BookingAgeLabel age={m.age} stale={m.stale} />
      </div>

      {/* «Standul …» bold indigo + a green chip per extra (c17). */}
      <div className={cn(AREA.stand, 'mt-0.75 flex min-w-0 flex-wrap items-center gap-1.5 self-start @3xl:mt-0 @3xl:self-center')}>
        {m.standLabel ? <span className="truncate t-caption font-extrabold text-accent-ink">{m.standLabel}</span> : null}
        {m.extras.map((e) => (
          <span key={e.key} className="truncate rounded-full bg-status-success-bg px-1.75 py-px t-caption font-bold text-status-success-fg">
            {e.label}
          </span>
        ))}
      </div>

      {/* The period, or today's moment in a turnover; the live stay's progress under it (c18, c14). */}
      <div className={cn(AREA.period, 'mt-0.75 flex min-w-0 flex-col gap-1 self-start @3xl:mt-0 @3xl:self-center')}>
        <p data-testid="inbox-period" className="line-clamp-2 t-caption text-muted">
          <PeriodText text={m.periodText} />
        </p>
        {m.live ? (
          <div data-testid="inbox-progress" className="flex items-center gap-2">
            <span aria-hidden className="h-1 flex-1 overflow-hidden rounded-full bg-hairline">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${m.live.pct}%` }} />
            </span>
            <span className="shrink-0 t-caption text-ink-2">{m.live.label}</span>
          </div>
        ) : null}
      </div>

      {/* «{total} lei» — the unit apart (owner rule 10) — then the status or the money pill (c19). */}
      <p
        data-testid="inbox-price"
        className={cn(AREA.price, 'self-start text-right whitespace-nowrap @3xl:self-end @5xl:self-center', m.quiet ? 'text-muted' : 'text-ink')}
      >
        <span className="t-body-strong tabular-nums">{m.price}</span> <span className="t-caption text-muted">lei</span>
      </p>
      <div className={cn(AREA.pill, 'mt-1 flex justify-end self-start @3xl:mt-1 @5xl:mt-0 @5xl:self-center @5xl:justify-start')}>
        {m.pill.kind === 'status' ? (
          <BookingStatusPill status={booking.bookingStatus} cancelledBy={booking.cancelledBy} noShow={booking.noShow} viewer="operator" />
        ) : (
          <span
            data-testid="inbox-money"
            className={cn('inline-flex h-6.5 shrink-0 items-center rounded-full px-2.5 t-label whitespace-nowrap', MONEY[m.pill.tone])}
          >
            {m.pill.label}
          </span>
        )}
      </div>

      {/* The angler's message, one line (c21). */}
      {m.note ? (
        <p data-testid="inbox-note" className={cn(AREA.note, 'mt-3 truncate t-caption text-ink-2 @3xl:mt-1.5')}>
          {`„${m.note}”`}
        </p>
      ) : null}

      {m.reason ? <ReasonLine className={cn(AREA.reason, 'mt-2 @3xl:mt-1.5')} label={m.reason.label} text={m.reason.text} long={m.reason.long} /> : null}

      {/* The buttons the card keeps (c23), right-aligned; disabled while this booking acts (c25). */}
      {m.actions ? (
        <div
          data-testid="inbox-actions"
          className={cn(AREA.acts, 'relative z-above mt-3 flex items-center justify-end gap-2 @3xl:mt-2 @5xl:mt-0 @5xl:self-center')}
        >
          {m.phone ? (
            <a
              href={`tel:${m.phone}`}
              aria-label={`Sună pe ${m.name}`}
              title="Sună"
              data-testid="inbox-call"
              onClick={() =>
                track('contact_pressed', {
                  contact_type: 'Operator guest contact',
                  lake_id: booking.lake?.documentId ?? lakeId,
                  lake_name: booking.lake?.name ?? lakeName,
                })
              }
              className={buttonClass({
                variant: 'secondary',
                size: 'compact',
                className: 'w-9 px-0!',
              })}
            >
              <PhoneIcon aria-hidden className="size-4" />
            </a>
          ) : null}
          {m.actions === 'pending' ? (
            <>
              <Button variant="danger" size="compact" disabled={acting} onClick={() => handlers.onReject(booking)} icon={<XMarkIcon strokeWidth={2.4} />}>
                Refuză
              </Button>
              <Button size="compact" disabled={acting} onClick={() => handlers.onAccept(booking)} icon={<CheckIcon strokeWidth={2.4} />}>
                Acceptă
              </Button>
            </>
          ) : (
            <Button size="compact" onClick={() => handlers.onRate(booking)} icon={<StarIcon className="text-rating" />}>
              Evaluează pescarul
            </Button>
          )}
        </div>
      ) : (
        // Table rows say they open (the phone card needs no chevron, fish).
        <span aria-hidden className={cn(AREA.end, 'hidden items-center justify-end self-center text-faint @3xl:flex', withActions && '@5xl:hidden')}>
          <ChevronRightIcon className="size-4" strokeWidth={2} />
        </span>
      )}
    </div>
  );
}

export const OperatorBookingRow = memo(OperatorBookingRowComponent);

/** The period may wrap only at its arrow: each end («Du 11 oct 00:50», «Du 11 oct 12:50 · 12h») stays whole. */
function PeriodText({ text }: { text: string }) {
  const parts = text.split(' → ');
  return parts.map((part, i) => (
    <Fragment key={i}>
      {i > 0 ? ' ' : null}
      <span className="whitespace-nowrap">{i < parts.length - 1 ? `${part} →` : part}</span>
    </Fragment>
  ));
}
