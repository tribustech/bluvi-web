import type { ReactNode } from 'react';
import { CheckIcon } from '@heroicons/react/20/solid';
import { cn } from '@/components/ui/cn';
import { RING_DANGER, RING_SELECTED } from '../rings';

type Layout = 'row' | 'stack' | 'tile' | 'tile-row';

type Props = {
  /** radio: one of a group (stand, ranking type). checkbox: any number (extras, species). */
  type: 'radio' | 'checkbox';
  name: string;
  value: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: ReactNode;
  /** Under the title: «150 lei/noapte · 1 noapte», «Ocupat», «Concurs: Cupa Toamnei». */
  description?: ReactNode;
  /** Over the title, small caps — a tile's weekday («SÂ»). */
  kicker?: ReactNode;
  /** Left of the text: a stand badge, an icon. Without it the selection marker leads (row / stack). */
  leading?: ReactNode;
  /** Right edge: the price («+150 lei»), a count. */
  meta?: ReactNode;
  /** Not choosable; `description` should say why. */
  disabled?: boolean;
  /** compact: 12px padding, for dense grids (stands). */
  density?: 'default' | 'compact';
  /**
   * row: marker / leading · text · meta on one line (extras, ranking types). stack: leading on top,
   * text under it. tile: a narrow centred cell whose title is a numeral in the stat step — the day
   * picker, the stands on a phone; it never draws the radio marker nor a corner check (a 64px cell
   * has no room for the 24px check disc over its numeral): the 2px ring and the accent-ink text
   * carry the choice. tile-row: a tile below 768, a row from 768 (the stand grid) — the same
   * marker-less choice, `leading` shown only as a row.
   */
  layout?: Layout;
  /**
   * A single control that failed on its own. A failed GROUP (no stand chosen) is marked on its
   * <T4Section invalid>, never on every card — 21 danger rings read as noise, not one problem.
   */
  invalid?: boolean;
  /** The control's spoken name when the visible text is terse («7» → «Standul 7, liber, Cabană»). */
  ariaLabel?: string;
  id?: string;
  className?: string;
};

const BOX: Record<Layout, string> = {
  row: 'items-center gap-3',
  stack: 'flex-col items-start gap-2',
  tile: 'flex-col items-center justify-center px-1.5 py-2 text-center',
  'tile-row': 'flex-col items-center justify-center px-1.5 py-2 text-center md:flex-row md:justify-start md:gap-3 md:text-left',
};

/** The tile's own text colour (the title inherits it): ink, accent-ink once chosen. */
const TILE_TEXT = 'text-ink has-checked:text-accent-ink';

/**
 * Not choosable (a taken stand, a closed day) — T6 ChoiceTile's disabled look, so a stand that
 * cannot be taken reads the same in every flow: empty ground with a dashed hairline edge (an
 * outline, so the content does not move by a pixel), the title in ink-2 and the reason in muted.
 * Never faded: the reason («Ocupat», «Concurs: …») is information and must stay AA outdoors.
 */
const DISABLED = 'cursor-not-allowed bg-transparent outline-1 -outline-offset-1 outline-faint outline-dashed';

/**
 * A choice as a card (fish ExtrasStep ExtraOption): a native radio / checkbox, visually hidden, so
 * arrow keys and Space work and a plain <form> posts it. Every choice of a T4 form is this one
 * component — one radius (rounded-card), one hover (soft-fill), one easing, one focus ring.
 * Checked: 2px accent ring + the accent marker (row / stack), the 24px corner check with its native
 * 20px glyph (with `leading`), or the ring and accent-ink text alone (tiles). Pressed: opacity .7
 * (Fundații §06, card). Disabled: dashed empty ground (DISABLED), not-allowed, read out with its
 * reason.
 */
export function T4ChoiceCard({
  type,
  name,
  value,
  checked,
  onChange,
  title,
  description,
  kicker,
  leading,
  meta,
  disabled = false,
  density = 'default',
  layout = 'row',
  invalid = false,
  ariaLabel,
  id,
  className,
}: Props) {
  const tile = layout === 'tile' || layout === 'tile-row';
  const pad = density === 'compact' ? 'p-3' : 'p-4';
  return (
    <label
      className={cn(
        'group relative flex min-w-0 rounded-card',
        BOX[layout],
        tile ? (layout === 'tile-row' ? cn('min-h-14', density === 'compact' ? 'md:p-3' : 'md:p-4') : 'min-h-14') : pad,
        tile && TILE_TEXT,
        'transition-[box-shadow,background-color,color,opacity] duration-(--duration-fast) ease-fast',
        disabled
          ? DISABLED
          : cn(
              'cursor-pointer bg-surface hover:bg-soft-fill active:opacity-70',
              checked
                ? RING_SELECTED
                : invalid
                  ? RING_DANGER
                  : 'shadow-e0',
            ),
        'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent',
        className,
      )}
    >
      <input
        id={id}
        type={type}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.currentTarget.checked)}
        className="sr-only"
      />
      {layout === 'tile-row' && leading ? (
        <span aria-hidden={ariaLabel ? true : undefined} className="hidden shrink-0 md:flex">
          {leading}
        </span>
      ) : tile ? null : (
        (leading ?? <Marker checked={checked} disabled={disabled} />)
      )}
      <span
        aria-hidden={ariaLabel ? true : undefined}
        className={cn(
          'flex min-w-0 flex-col',
          tile ? 'w-full items-center md:flex-1' : 'flex-1',
          layout === 'tile-row' && 'md:items-start',
          layout === 'stack' && 'w-full',
        )}
      >
        {kicker ? <span className="t-micro-strong uppercase">{kicker}</span> : null}
        <span
          className={cn(
            'max-w-full truncate',
            // A tile's title inherits the tile's colour (accent-ink once chosen); disabled: ink-2.
            tile ? 't-stat tabular-nums' : 't-body-strong',
            layout === 'tile-row' && 'md:t-body-strong',
            disabled ? 'text-ink-2' : !tile && 'text-ink',
          )}
        >
          {title}
        </span>
        {description ? (
          <span
            className={cn(
              't-caption text-muted',
              layout === 'stack' && 'line-clamp-2',
              tile && 'max-w-full truncate',
            )}
          >
            {description}
          </span>
        ) : null}
      </span>
      {meta ? <span className="shrink-0">{meta}</span> : null}
      {/* With `leading` the marker's place is taken: the 24px check disc in the corner, the solid
          glyph at its native 20 (Fundații §05). Tiles carry the choice with the ring and text. */}
      {leading && !tile ? (
        <span
          aria-hidden
          className={cn(
            'absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-accent text-on-accent',
            !checked && 'hidden',
          )}
        >
          <CheckIcon className="size-5" />
        </span>
      ) : null}
    </label>
  );
}

function Marker({ checked, disabled }: { checked: boolean; disabled: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        // A circle for both, as fish's ExtraOption: the group's wording says one or many.
        // 24px, so the solid check is drawn at its native 20 (Fundații §05).
        'flex size-6 shrink-0 items-center justify-center rounded-full',
        checked ? 'bg-accent text-on-accent' : 'border-2 border-faint',
        disabled && 'opacity-60',
      )}
    >
      {checked ? <CheckIcon className="size-5" /> : null}
    </span>
  );
}
