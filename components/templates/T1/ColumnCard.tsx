import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

/*
 * The shared skin of ListPage's side columns: the filter card on the left and the aside blocks on
 * the right use ONE padding and ONE header row, so «Filtre» and «Live acum» sit at the same inset
 * and their actions («Resetează», «Vezi toate») share a height and a look.
 */

/** Surface card of a side column (filters, aside blocks). */
export const COLUMN_CARD = 'rounded-card bg-surface p-4 shadow-e0';

/** Header row of a column card: title on the left, a text action on the right, one height. */
export function ColumnHeader({ id, title, action }: { id: string; title: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-2">
      <h2 id={id} className="t-heading text-ink">
        {title}
      </h2>
      {action}
    </div>
  );
}

/**
 * The compact text action of a section header («Resetează», «Vezi toate»): accent-ink label at the
 * kit's compact Button size (36, t-button-compact — Button size="compact"), soft-fill on hover,
 * pulled into the card's padding so the label lines up with the edge. Disabled reads faint
 * (nothing to reset).
 *
 * TODO(kit): a `text` variant in components/ui/Button (accent-ink label, soft-fill hover); then this
 * is `buttonClass({ variant: 'text', size: 'compact' })` (components/ui is outside T1).
 */
export const TEXT_ACTION = cn(
  '-mr-2 inline-flex h-9 shrink-0 cursor-pointer items-center rounded-control px-2 t-button-compact text-accent-ink',
  'transition-colors duration-(--duration-fast) ease-fast hover:bg-soft-fill active:opacity-80',
  'aria-disabled:cursor-default aria-disabled:text-faint aria-disabled:hover:bg-transparent aria-disabled:active:opacity-100',
);

/**
 * A TEXT_ACTION button. `disabled` is rendered as aria-disabled (and the click is ignored), so a
 * keyboard user keeps focus on it when it turns off under them.
 */
export function TextAction({
  disabled,
  onClick,
  className,
  type = 'button',
  ...rest
}: Omit<ComponentProps<'button'>, 'disabled'> & { disabled?: boolean }) {
  return (
    <button
      type={type}
      aria-disabled={disabled || undefined}
      onClick={(e) => {
        if (disabled) return;
        onClick?.(e);
      }}
      className={cn(TEXT_ACTION, className)}
      {...rest}
    />
  );
}
