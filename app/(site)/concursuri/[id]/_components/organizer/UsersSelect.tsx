'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { CheckIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { controlShell } from '@/components/forms/Field';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';

/*
 * fish components/UsersSelectSheet.tsx — the referee pickers' frame (organizare c9 c10): the title,
 * «Caută...», one choosable row at a time (indigo tint + check), «Nu există opțiuni» when the list is
 * empty, and the action («Adaugă» / «Șterge») pinned under it, busy while it is sent. A sheet on the
 * phone, a dialog from 768 (ResponsiveSurface `info`). Closing it in any way clears the search and
 * the choice (fish onDismiss). `onEnd`: the list's end came into view (fish onMomentumScrollEnd →
 * the next page).
 */

export type UserOption = { id: string; label: string };

export function UsersSelect({
  open,
  onClose,
  title,
  actionLabel,
  search,
  onSearch,
  options,
  loading,
  error,
  selected,
  onSelect,
  onAction,
  busy,
  onEnd,
  footerNote,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  actionLabel: string;
  search: string;
  onSearch: (s: string) => void;
  options: UserOption[];
  /** The first page is being read (a status line, not «Nu există opțiuni»). */
  loading?: boolean;
  error?: string | null;
  selected: string | null;
  onSelect: (id: string) => void;
  onAction: () => void;
  busy: boolean;
  onEnd?: () => void;
  footerNote?: ReactNode;
  testId: string;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = end.current;
    if (!el || !onEnd || !open) return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) onEnd();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [onEnd, open, options.length]);

  return (
    <ResponsiveSurface
      open={open}
      onClose={onClose}
      intent="info"
      title={title}
      sheetSnap={0.9}
      pinnedActions
      actions={
        <Button
          block
          onClick={() => {
            if (!busy && selected) onAction();
          }}
          aria-disabled={busy || !selected || undefined}
          aria-busy={busy || undefined}
          className={cn((busy || !selected) && 'cursor-not-allowed opacity-50')}
        >
          {busy ? 'Se trimite…' : actionLabel}
        </Button>
      }
    >
      {open ? (
        <div className="flex flex-col gap-3" data-testid={testId}>
          <div className="sticky top-0 z-above -mx-1 bg-surface px-1 pt-1 pb-2">
            <div className={controlShell(false)}>
              <MagnifyingGlassIcon aria-hidden className="size-5 shrink-0 text-accent-ink" />
              <input
                type="search"
                value={search}
                onChange={e => onSearch(e.currentTarget.value)}
                placeholder="Caută..."
                aria-label="Caută utilizatori după nume"
                autoComplete="off"
                enterKeyHint="search"
                className="t-body h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted focus-visible:outline-none"
              />
            </div>
          </div>
          {loading ? (
            <p role="status" className="t-body py-6 text-center text-muted">
              Se încarcă...
            </p>
          ) : error ? (
            <p role="alert" className="t-body py-6 text-center text-status-danger-fg">
              {error}
            </p>
          ) : options.length === 0 ? (
            <p role="status" className="t-body-strong py-6 text-center text-ink">
              Nu există opțiuni
            </p>
          ) : (
            <div role="radiogroup" aria-label={title} className="flex flex-col gap-1.5">
              {options.map(o => {
                const on = selected === o.id;
                return (
                    <button
                      key={o.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => onSelect(o.id)}
                      className={cn(
                        'flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-control px-3 py-2 text-left transition-colors duration-(--duration-fast)',
                        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent',
                        on ? 'bg-accent-tint text-accent-ink' : 'bg-surface text-ink hover:bg-soft-fill',
                      )}
                    >
                      <span className="t-body-strong min-w-0 flex-1 truncate">{o.label}</span>
                      {on ? <CheckIcon aria-hidden className="size-5 shrink-0 text-accent-ink" /> : null}
                    </button>
                );
              })}
            </div>
          )}
          <div ref={end} aria-hidden className="h-px" />
          {footerNote}
        </div>
      ) : null}
    </ResponsiveSurface>
  );
}
