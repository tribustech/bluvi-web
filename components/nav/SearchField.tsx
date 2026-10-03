'use client';

import { useEffect, useRef } from 'react';
import Form from 'next/form';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

type Props = {
  /** Search results route; the query goes in `?q=`. */
  action?: string;
  placeholder?: string;
  defaultValue?: string;
  className?: string;
};

/**
 * Global search field of the desktop header. ⌘K (Ctrl+K elsewhere) focuses it from anywhere;
 * submitting navigates client-side to `action?q=…` (next/form).
 */
export function SearchField({
  action = '/cauta',
  placeholder = 'Caută bălți, concursuri, pescari',
  defaultValue,
  className = '',
}: Props) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Form action={action} role="search" className={`relative ${className}`}>
      <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-muted" aria-hidden />
      <input
        ref={ref}
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label="Caută"
        aria-keyshortcuts="Meta+K Control+K"
        className="t-field h-10 w-full rounded-control bg-soft-fill pr-10 pl-[38px] text-ink outline-none placeholder:text-muted focus-visible:bg-surface focus-visible:shadow-[inset_0_0_0_2px_var(--color-accent),0_0_0_4px_var(--color-accent-tint-2)] focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      <kbd
        aria-hidden
        className="t-nano pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded-badge bg-surface px-1 py-0.5 text-muted shadow-e0"
      >
        ⌘K
      </kbd>
    </Form>
  );
}
