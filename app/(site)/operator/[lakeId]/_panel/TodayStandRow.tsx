import type { ReactNode } from 'react';
import { stayProgress, todayPhase, type TodayPhase } from '@/core/booking';
import type { OperatorUpcomingBooking } from '@/core/lakes';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { StatusPill } from '@/components/ui/StatusPill';
import { isDimmed, moneyColumn, periodLine } from './model';

/** Opens the booking detail (?rezervare=, operator.detaliu-rezervare) on a booking's documentId. */
export type OpenBooking = (documentId: string) => void;

/**
 * c16 — a finished stay or a no-show is dimmed (fish opacity .55): the photo fades, initials go to the
 * neutral pair and the name turns muted — colour, never opacity on text, so every line keeps AA
 * contrast (WCAG 1.4.3). The pills and the sums stay at full strength: «N-a venit» is news.
 */
export const nameTone = (phase: TodayPhase) => (isDimmed(phase) ? 'text-muted' : 'text-ink');

/** The row's avatar, dimmed with it (c16). */
export function RowAvatar({ name, src, phase }: { name: string; src: string | null | undefined; phase: TodayPhase }) {
  const dim = isDimmed(phase);
  return <Avatar name={name} src={src} size={40} tone={dim ? 'neutral' : undefined} className={cn(dim && src && 'opacity-55')} />;
}

/**
 * A today row's surface: the hover covers the row when it opens the detail (its name is a button
 * whose ::after stretches over the row), the keyboard ring is drawn on the row, not on the name.
 */
export const ROW_INTERACTIVE =
  'relative transition-colors duration-(--duration-fast) ease-fast has-[button]:hover:bg-page has-[button:focus-visible]:outline-2 has-[button:focus-visible]:-outline-offset-2 has-[button:focus-visible]:outline-accent';

/**
 * A today row's name + caption column. Capped (448), so on a wide card the money column stays next to
 * the name and the row reads as one unit, not a name and a sum 600px apart.
 */
export const ROW_TEXT = 'flex min-w-0 max-w-md flex-1 flex-col gap-0.5';

/**
 * c19 — the angler's name: a button that opens the detail when the row has a documentId (its ::after
 * makes the whole row the target), plain text otherwise (rows without documentId are not interactive).
 */
export function RowName({
  booking,
  stand,
  phase,
  onOpen,
}: {
  booking: OperatorUpcomingBooking;
  stand: string | null;
  phase: TodayPhase;
  onOpen: OpenBooking;
}) {
  const name = booking.anglerName ?? 'Pescar';
  const cls = cn('min-w-0 truncate text-left t-body-strong', nameTone(phase));
  const id = booking.documentId;
  if (!id) return <span className={cls}>{name}</span>;
  return (
    <button
      type="button"
      onClick={() => onOpen(id)}
      // «Ion Popescu, standul 1» — the visible name first (WCAG 2.5.3).
      aria-label={stand ? `${name}, standul ${stand}` : name}
      aria-haspopup="dialog"
      className={cn(cls, 'cursor-pointer outline-none after:absolute after:inset-0 after:content-[""]')}
    >
      {name}
    </button>
  );
}

/** «Standul 4», bold indigo (fish weight 800, $indigo7); null without a stand (no empty part). */
export function StandLabel({ name }: { name: string | null }) {
  return name ? <span className="t-label text-accent-ink">Standul {name}</span> : null;
}

/** The stand as a caption part (none without a stand). */
export const standPart = (name: string | null) => (name ? <StandLabel key="s" name={name} /> : null);

/**
 * The row's caption parts joined by «·» («Standul 4 · Vi 06:00 → Sâ 06:00»). Each part stays whole;
 * when the line wraps, the separator that would open the new line is clipped (every separator hangs
 * in the 12px left of its part, and the row is pulled 12px left inside an overflow-hidden box), so a
 * line never starts with a dangling «·».
 */
export function CaptionParts({ parts, className }: { parts: ReactNode[]; className?: string }) {
  const shown = parts.filter((p) => p !== null && p !== undefined && p !== false && p !== '');
  return (
    <span className={cn('block overflow-hidden t-caption text-muted tabular-nums', className)}>
      <span className="-ml-3 flex flex-wrap">
        {shown.map((p, i) => (
          <span key={i} className="relative pl-3 whitespace-nowrap before:absolute before:left-1 before:content-['·']">
            {p}
          </span>
        ))}
      </span>
    </span>
  );
}

/** c16 — the live stay: «{elapsed}h din {total}h» beside a progress bar. */
export function StayBar({ booking, nowMs }: { booking: OperatorUpcomingBooking; nowMs: number }) {
  const stay = stayProgress(booking, nowMs);
  const pct = Math.round(stay.ratio * 100);
  return (
    <span className="mt-0.5 flex min-w-0 items-center gap-2">
      <span
        role="progressbar"
        aria-label="Sejur"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={stay.label}
        className="h-1 min-w-0 max-w-48 flex-1 overflow-hidden rounded-full bg-hairline"
      >
        <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </span>
      <span className="shrink-0 t-caption whitespace-nowrap text-ink-2 tabular-nums">{stay.label}</span>
    </span>
  );
}

/** c17 — fish MoneyColumn: «150 lei» over «N-a venit» / «Numerar» / «Plătit»; nothing when free. */
export function MoneyColumn({ booking, phase }: { booking: OperatorUpcomingBooking; phase: TodayPhase }) {
  const m = moneyColumn(booking, phase);
  if (!m.total && !m.pill) return null;
  return (
    <span className="flex shrink-0 flex-col items-end gap-1" data-testid="money">
      {m.total ? <span className="t-body-strong whitespace-nowrap text-ink tabular-nums">{m.total}</span> : null}
      {m.pill ? <StatusPill tone={m.pill.tone}>{m.pill.label}</StatusPill> : null}
    </span>
  );
}

/**
 * c15 — a stand with one booking today (fish TodayRow): avatar (initials fallback), name, «Standul X ·
 * Lu 06:00 → Ma 06:00», the live bar, the money column on the right.
 */
export function TodayStandRow({ booking, nowMs, onOpen }: { booking: OperatorUpcomingBooking; nowMs: number; onOpen: OpenBooking }) {
  const name = booking.anglerName ?? 'Pescar';
  const phase = todayPhase(booking, nowMs);
  return (
    <li
      data-testid="today-row"
      data-phase={phase}
      data-dimmed={isDimmed(phase) || undefined}
      className={cn('flex items-center gap-3 px-4.5 py-2.75', ROW_INTERACTIVE)}
    >
      <span className="shrink-0">
        <RowAvatar name={name} src={booking.anglerAvatar} phase={phase} />
      </span>
      <span className={ROW_TEXT}>
        <RowName booking={booking} stand={booking.standName} phase={phase} onOpen={onOpen} />
        <CaptionParts parts={[standPart(booking.standName), periodLine(booking)]} />
        {phase === 'live' ? <StayBar booking={booking} nowMs={nowMs} /> : null}
      </span>
      <MoneyColumn booking={booking} phase={phase} />
    </li>
  );
}
