import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { TileChevron } from './TileChevron';

/**
 * The grid of big choices (stands, prizes, penalties…): one column on a phone, auto-filled
 * columns of at least 280px from 768 — more columns as the screen grows, never wider tiles.
 */
export function ChoiceGrid({
  children,
  label,
  className,
  compact = false,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
  /** Short one-word choices (the raffle's prize types): side by side from 96px (144 from 768), filling the row. */
  compact?: boolean;
}) {
  return (
    <ul
      aria-label={label}
      className={cn(
        'grid gap-2 md:gap-3',
        compact
          ? 'grid-cols-[repeat(auto-fit,minmax(--spacing(24),1fr))] md:grid-cols-[repeat(auto-fit,minmax(--spacing(36),1fr))]'
          : 'grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(--spacing(70),1fr))]',
        className,
      )}
    >
      {children}
    </ul>
  );
}

type ChoiceTileProps = {
  /** «Stand 3». */
  title: ReactNode;
  /** Accent line under the title (club on NC). */
  kicker?: ReactNode;
  /** Who / what is behind the choice (anglers, team). Clamped to two lines. */
  description?: ReactNode;
  /** Right column: a number and its caption («15,500 kg» / «2 cântăriri»). */
  value?: ReactNode;
  valueCaption?: ReactNode;
  /** A 4px stripe on the leading edge (sector colour): a token class on `stripeClassName`. */
  stripeClassName?: string;
  /** Navigates (the next step is a page) … */
  href?: string;
  /** … or nothing: a disabled tile («Liber») explains why in `description`. */
  disabled?: boolean;
  /** Small state under the value («Liber», «Cântărit»). */
  badge?: ReactNode;
  /**
   * accent: the tile opens the task (indigo-1, fish stand row). neutral: it opens a read-only view
   * (the task is closed for this user), so it must not promise the action.
   */
  tone?: 'accent' | 'neutral';
  /**
   * The grid sits on the page ground rather than inside the task card (as FlowSearch's `ground`):
   * the neutral tile is then a surface card (surface + e0). Inside the task card it is the kit's
   * in-card resting fill instead — a card never sits inside a card.
   */
  ground?: boolean;
  /**
   * A one-of choice made in place (the raffle's prize type): the tile is a label around a visually
   * hidden native radio, so arrow keys move within `name` and Space picks. Selected = filled accent
   * (on-accent text). Wrap the grid in a fieldset/legend (or give ChoiceGrid a label) for its name.
   */
  radio?: { name: string; value: string; checked: boolean; onChange: () => void };
};

/**
 * One big choice: at least 64px tall (fish stand row: indigo-1, padding 8 — here 12/16 on the
 * kit radius), the whole tile is the target, a chevron says it opens the next step. Pressed is
 * .7, the card rule (Fundații §06). A disabled tile is empty ground with a dashed edge and an
 * ink-2 title, so «Liber» reads as empty next to both tones; its text stays ink-2 (not faded) so
 * it is legible outdoors.
 */
export function ChoiceTile({
  title,
  kicker,
  description,
  value,
  valueCaption,
  stripeClassName,
  href,
  disabled,
  badge,
  tone = 'accent',
  ground = false,
  radio,
}: ChoiceTileProps) {
  const filled = Boolean(radio?.checked);
  const body = (
    <>
      {stripeClassName ? (
        <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1 rounded-l-card', stripeClassName)} />
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn('t-body-strong', filled ? 'text-on-accent' : disabled ? 'text-ink-2' : 'text-ink')}>{title}</span>
        {kicker ? <span className={cn('t-label truncate', filled ? 'text-on-accent' : 'text-accent-ink')}>{kicker}</span> : null}
        {/* ink-2, not muted: muted on the indigo-1 tile is 4.48:1, just under AA. */}
        {description ? <span className={cn('t-caption line-clamp-2', filled ? 'text-on-accent' : 'text-ink-2')}>{description}</span> : null}
      </span>
      {value || valueCaption || badge ? (
        <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
          {value ? <span className="t-body-strong text-ink tabular-nums">{value}</span> : null}
          {valueCaption ? <span className="t-caption text-ink-2">{valueCaption}</span> : null}
          {badge}
        </span>
      ) : null}
      {href && !disabled ? <TileChevron /> : null}
    </>
  );
  // Top-aligned: tiles in one grid row stretch to the tallest, so a neighbour's two-line
  // description must not push this tile's title and value down — titles and values share one line
  // across the row. The chevron alone is centred (self-center, TileChevron).
  const shape = 'relative flex min-h-16 items-start gap-3 overflow-hidden rounded-card py-3 pr-3 pl-4';
  // Neutral at rest: soft-fill in the task card (Fundații §04 keeps e0 for lists and tables on the
  // page ground), a surface card on the ground. Hover goes one token step darker, like the accent
  // tone (tint → tint-2): soft-fill → the grey step above it (#e4e7ec, the shimmer's peak — the
  // only token one step over soft-fill; TODO(kit): alias it as --color-soft-fill-2 in globals.css),
  // soft-fill on the surface card.
  const neutralRest = ground ? 'bg-surface shadow-e0' : 'bg-soft-fill';
  const neutralHover = ground ? 'hover:bg-soft-fill' : 'hover:bg-shimmer';
  if (radio && !disabled) {
    return (
      <li className="flex">
        <label
          className={cn(
            shape,
            'w-full cursor-pointer transition-[background-color,opacity] duration-(--duration-fast) ease-fast active:opacity-70',
            'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent',
            filled ? 'bg-accent shadow-button' : tone === 'accent' ? 'bg-accent-tint hover:bg-accent-tint-2' : cn(neutralRest, neutralHover),
          )}
        >
          <input type="radio" name={radio.name} value={radio.value} checked={radio.checked} onChange={radio.onChange} className="sr-only" />
          {body}
        </label>
      </li>
    );
  }
  return (
    <li className="flex">
      {href && !disabled ? (
        <Link
          href={href}
          className={cn(
            shape,
            'w-full transition-[background-color,opacity] duration-(--duration-fast) ease-fast active:opacity-70',
            tone === 'accent' ? 'bg-accent-tint hover:bg-accent-tint-2' : cn(neutralRest, neutralHover),
          )}
        >
          {body}
        </Link>
      ) : (
        <div
          aria-disabled={disabled || undefined}
          className={cn(
            shape,
            'w-full',
            // An outline, not a border: the dashed edge must not shift the content by a pixel.
            disabled
              ? 'bg-transparent outline-1 -outline-offset-1 outline-faint outline-dashed'
              : tone === 'accent'
                ? 'bg-accent-tint'
                : neutralRest,
          )}
        >
          {body}
        </div>
      )}
    </li>
  );
}
