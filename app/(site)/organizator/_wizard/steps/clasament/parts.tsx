'use client';

import { useId, type ReactNode } from 'react';
import { CheckCircleIcon, ChevronDownIcon } from '@heroicons/react/20/solid';
import { controlShell } from '@/components/forms/Field';
import { RING_SELECTED } from '@/components/templates/rings';
import { cn } from '@/components/ui/cn';

/**
 * Small building blocks of step 3 — fish CompetitionSectionHeader size sm, OptionTrigger,
 * ModeRadioRow and the «Vezi explicația completă» link.
 */

/** fish CompetitionSectionHeader size="sm": a 32px tinted disc with the glyph, the h3 beside it. */
export function SubHeader({ icon, title, id }: { icon: ReactNode; title: string; id?: string }) {
  return (
    <h3 id={id} className="flex items-center gap-2 t-body-strong text-ink">
      <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-ink [&>svg]:size-5">
        {icon}
      </span>
      {title}
    </h3>
  );
}

/** A labelled options block inside the expanded card (header + its control). */
export function OptionBlock({ icon, title, children, className, labelId }: { icon: ReactNode; title: string; children: ReactNode; className?: string; labelId?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-3', className)}>
      <SubHeader icon={icon} title={title} id={labelId} />
      {children}
    </div>
  );
}

/**
 * fish OptionTrigger: the field label, then a field-looking button with the current choice (or
 * «Selectează») and a chevron; it opens the picker dialog.
 */
export function OptionTrigger({ label, value, onOpen, disabled, testId }: { label: string; value?: string; onOpen: () => void; disabled?: boolean; testId?: string }) {
  const labelId = useId();
  const valueId = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id={labelId} className="t-label text-ink-2">
        {label}
      </span>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-labelledby={`${labelId} ${valueId}`}
        disabled={disabled}
        onClick={onOpen}
        data-testid={testId}
        className={cn(
          controlShell(false, disabled),
          'h-auto min-h-11 w-full cursor-pointer justify-between py-2 text-left hover:bg-accent-tint',
          'focus-visible:border-accent focus-visible:bg-surface focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_var(--color-accent-tint-2)]',
          'disabled:cursor-not-allowed',
        )}
      >
        <span id={valueId} className={cn('t-body min-w-0', value ? 'text-ink' : 'text-muted')}>
          {value || 'Selectează'}
        </span>
        <ChevronDownIcon aria-hidden className="size-5 shrink-0 text-ink-2" />
      </button>
    </div>
  );
}

/**
 * fish ModeRadioRow: a choice row inside a picker — emoji, title (wraps: these titles are whole
 * sentences), description, the check when chosen. A native radio (sr-only), so arrow keys move
 * the choice; same radius, ring, hover and focus ring as the T4 choice cards.
 */
export function ModeRadioRow({
  name,
  value,
  icon,
  title,
  description,
  checked,
  onSelect,
  indent = false,
}: {
  name: string;
  value: string;
  icon?: string;
  title: string;
  description: string;
  checked: boolean;
  onSelect: () => void;
  indent?: boolean;
}) {
  return (
    <label
      className={cn(
        'flex min-w-0 cursor-pointer items-center gap-3 rounded-card p-3.5',
        'transition-[box-shadow,background-color,opacity] duration-(--duration-fast) ease-fast active:opacity-70',
        checked ? cn('bg-accent-tint', RING_SELECTED) : 'bg-surface shadow-e0 hover:bg-soft-fill',
        'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent',
        indent && 'ml-3.5',
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onSelect} className="sr-only" />
      {icon ? (
        <span aria-hidden className="w-8 shrink-0 text-center t-title1 leading-none">
          {icon}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn('t-body-strong', checked ? 'text-accent-ink' : 'text-ink')}>{title}</span>
        <span className="t-caption text-muted">{description}</span>
      </span>
      <CheckCircleIcon aria-hidden className={cn('size-5 shrink-0 text-accent', !checked && 'invisible')} />
    </label>
  );
}

/** fish's tinted «Cum funcționează departajarea» box, with the link to the full explanation. */
export function HowItWorks({ text, onMore }: { text: string; onMore?: () => void }) {
  return (
    <div className="flex flex-col gap-1 rounded-card bg-accent-tint p-3">
      <p className="t-body-strong text-accent-ink">Cum funcționează departajarea</p>
      <p className="t-caption text-ink-2">{text}</p>
      {onMore ? <ExplanationLink onClick={onMore} className="mt-1.5 self-start" /> : null}
    </div>
  );
}

/** «Vezi explicația completă» (fish: an underlined indigo caption). */
export function ExplanationLink({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className={cn(
        't-label cursor-pointer text-accent-ink underline underline-offset-2 hover:text-accent active:opacity-70',
        'rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className,
      )}
    >
      Vezi explicația completă
    </button>
  );
}
