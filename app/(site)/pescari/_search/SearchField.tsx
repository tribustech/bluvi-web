'use client';

import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useId, useRef, type FormEvent } from 'react';
import { FOCUS_RING, SEARCH_SHELL } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';

/** The field's box at every width: full width on the phone, a ~720 pill from 768 (owner rule 6). */
export const SEARCH_FIELD_BOX = 'w-full md:max-w-180';

/**
 * «Caută pescari» — fish's search pill on app/(app)/partide/pescari.tsx (partide.pescari c2): one
 * designed unit (owner rule 6) in the page flow, never floating (rule 3). Unlike T1 ListSearch
 * (Enter commits), it searches as you type, like fish: the screen debounces the value (300 ms) and
 * searches from 2 characters. Enter settles the term at once (no wait for the debounce, no page
 * load); Escape and the ✕ clear it, keeping focus in the field.
 * Without JS it is a GET form on /pescari?q=, which the page reads itself.
 */
export function SearchField({
  value,
  onChange,
  onSubmit,
  onClear,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit();
  };
  const clear = () => {
    onClear();
    // The ✕ unmounts with the text: keep a keyboard user in the field, not on <body>.
    inputRef.current?.focus();
  };

  return (
    <form role="search" action="/pescari" onSubmit={submit} className={SEARCH_FIELD_BOX}>
      <label htmlFor={id} className="sr-only">
        Caută pescari
      </label>
      <div className={SEARCH_SHELL}>
        <MagnifyingGlassIcon aria-hidden className="size-5 shrink-0 text-muted" />
        <input
          ref={inputRef}
          id={id}
          type="search"
          name="q"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && value) {
              e.preventDefault();
              e.stopPropagation();
              clear();
            }
          }}
          placeholder="Caută pescari"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="t-body h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {value ? (
          <button
            type="button"
            aria-label="Șterge căutarea"
            onClick={clear}
            className={cn(
              'flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control text-muted hover:bg-soft-fill hover:text-ink',
              FOCUS_RING,
            )}
          >
            <XMarkIcon aria-hidden className="size-5" />
          </button>
        ) : null}
      </div>
    </form>
  );
}

/** The field's place while the gate reads the session: the same shell, inert. */
export function SearchFieldPlaceholder() {
  return (
    <div aria-hidden className={SEARCH_FIELD_BOX}>
      <div className={SEARCH_SHELL}>
        <MagnifyingGlassIcon className="size-5 shrink-0 text-muted" />
        <span className="t-body text-muted">Caută pescari</span>
      </div>
    </div>
  );
}
