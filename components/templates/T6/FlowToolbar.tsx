'use client';

import { useId, useRef, type ReactNode } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { controlShell } from '@/components/forms/Field';
// Its own module, not the T1 barrel: T6 must not load (or break with) all of T1 for one string.
import { SEARCH_SHELL } from '@/components/templates/T1/toolbarStyles';
import { cn } from '@/components/ui/cn';

/**
 * The one control above a long list of choices: a find-as-you-type field («stand sau pescar»)
 * and, after it, an optional segmented filter. Not sticky: the phone top bar hides and shows on
 * scroll, and a second sticky row would slide under it.
 */
export function FlowToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="search" className={cn('flex flex-col gap-2 md:flex-row md:items-start', className)}>
      {children}
    </div>
  );
}

/**
 * The search field inside the task card: the kit control shell (forms/Field controlShell — radius
 * 10, soft-fill at rest, surface + 2px accent border and tint ring on focus) at the task-control
 * height, 48 / 40 from 1280. A field placed on the page ground (`ground`) takes T1's SEARCH_SHELL
 * instead (surface + e0: soft-fill would vanish on the ground), so «Caută» is one shape and one
 * radius in every template. The `!` overrides are needed because cn() does not merge.
 */
const CARD_SEARCH_SHELL = cn(controlShell(false), 'h-12! pr-1.5 xl:h-10!');

/**
 * Filters while typing (a stand list is short and local); the result count is announced.
 * TODO(kit): T1 ListSearch commits on Enter (a draft it owns); once it takes `value`/`onChange`
 * and a `shell` override, this becomes `<ListSearch shell={CARD_SEARCH_SHELL} …>` — T1 is outside
 * the T6 folders. Until then the ✕ keeps ListSearch's focus rule.
 */
export function FlowSearch({
  label,
  value,
  onChange,
  placeholder,
  resultLabel,
  ground = false,
}: {
  /** Visually hidden label (the placeholder says the same). */
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Announced count («3 standuri»), shown under the field while filtering. */
  resultLabel?: string;
  /** The field sits on the page ground rather than inside the task card. */
  ground?: boolean;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 md:max-w-120">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className={ground ? SEARCH_SHELL : CARD_SEARCH_SHELL}>
        <MagnifyingGlassIcon className="size-5 shrink-0 text-muted" aria-hidden />
        <input
          ref={inputRef}
          id={id}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="search"
          className="t-body h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange('');
              // The ✕ unmounts with the value: keep a keyboard user in the field, not on <body> (as T1 ListSearch).
              inputRef.current?.focus();
            }}
            aria-label="Șterge căutarea"
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control text-muted hover:bg-soft-fill hover:text-ink"
          >
            <XMarkIcon className="size-4.5" aria-hidden />
          </button>
        ) : null}
      </div>
      <p aria-live="polite" className={cn('t-caption text-muted', !value && 'sr-only')}>
        {value ? resultLabel : ''}
      </p>
    </div>
  );
}
