import { useId, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { ROW_HELPER, ROW_ICON, ROW_LINE, ROW_PAD_X, SECTION_LABEL, SETTINGS_CARD } from './styles';

/**
 * fish SettingsCard: a white card holding one or more rows. Several rows are split by a hairline.
 * `inactive` is fish's `opacity: 0.5` card (a section that does not apply right now, e.g. CONCURSURI
 * while every notification is off): half opacity and nothing in it reacts to the pointer. The rows
 * themselves say they are disabled (NavRow `disabled`, SwitchRow `disabled`) — the card only looks it.
 */
export function SettingsCard({
  children,
  inactive = false,
  className,
  ...rest
}: {
  children: ReactNode;
  inactive?: boolean;
  className?: string;
} & Pick<HTMLAttributes<HTMLDivElement>, 'id' | 'aria-label' | 'aria-labelledby'> & { 'data-testid'?: string }) {
  return (
    <div
      {...rest}
      data-inactive={inactive || undefined}
      className={cn(
        SETTINGS_CARD,
        'divide-y divide-hairline transition-opacity duration-(--duration-fast) ease-fast',
        inactive && 'opacity-50',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * A titled group of cards (fish: the caps caption above a card, «CONCURSURI»). The label is the
 * section's h2 (its accessible name), drawn as fish's caps caption — the source text stays in
 * sentence case, so a screen reader says the word, not the letters.
 */
export function SettingsSection({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn('flex flex-col gap-2', className)}>
      <h2 id={id} className={SECTION_LABEL}>
        {label}
      </h2>
      {children}
    </section>
  );
}

/**
 * fish InfoCardItem with a `value`: a read-only fact (label left, value right, e.g. «Versiune» ·
 * «3.4.12»). `trailing` adds a control or mark after the value.
 */
export function InfoRow({ icon, label, value, trailing }: { icon?: ReactNode; label: string; value?: ReactNode; trailing?: ReactNode }) {
  return (
    <div className={cn(ROW_LINE, ROW_PAD_X)}>
      {icon ? (
        <span aria-hidden className={ROW_ICON}>
          {icon}
        </span>
      ) : null}
      <span className={cn('t-body-strong text-ink', value === undefined ? 'min-w-0 flex-1' : 'shrink-0')}>{label}</span>
      {value !== undefined ? <span className="t-body-strong min-w-0 flex-1 truncate text-right text-ink">{value}</span> : null}
      {trailing}
    </div>
  );
}

/** The helper line under a row (fish helper2 $gray6, on the label's edge). */
export function RowHelper({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className={ROW_HELPER}>
      {children}
    </p>
  );
}

/** Skeleton rows in the real rows' geometry: icon disc, label bar, the trailing control's box, the helper. */
export function SettingsRowSkeleton({ trailing = 'chevron', helper = true }: { trailing?: 'switch' | 'chevron' | 'none'; helper?: boolean }) {
  return (
    <div aria-hidden className={ROW_PAD_X}>
      <div className={ROW_LINE}>
        <span className="size-5 shrink-0 animate-shimmer rounded-full" />
        <span className="h-4 w-40 max-w-[50%] animate-shimmer rounded-full" />
        <span className="flex-1" />
        {trailing === 'switch' ? <span className="h-7 w-12 shrink-0 animate-shimmer rounded-full" /> : null}
        {trailing === 'chevron' ? <span className="size-5 shrink-0 animate-shimmer rounded-full" /> : null}
      </div>
      {helper ? (
        <div className="-mt-1.5 pb-3.5 pl-8">
          <span className="block h-3 w-64 max-w-[80%] animate-shimmer rounded-full" />
        </div>
      ) : null}
    </div>
  );
}

/** A section label's skeleton (the caps caption's height). */
export function SettingsSectionLabelSkeleton() {
  return <span aria-hidden className="mx-1 block h-3.5 w-24 animate-shimmer rounded-full" />;
}
