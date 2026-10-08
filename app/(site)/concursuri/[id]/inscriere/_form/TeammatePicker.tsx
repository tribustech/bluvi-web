'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { CheckIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { paginatedUsersInfiniteQuery } from '@/core/social';
import type { Transport } from '@/core/transport';
import { controlShell } from '@/components/forms/Field';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { thumbUrl, userTag, type Teammate } from './model';

/*
 * fish components/competition/CompetitionParticipantsSelect.tsx (parity participant.register c9 /
 * c10): «Adaugă coechipieri» opens a picker — a bottom sheet on a phone, a dialog from 768
 * (ResponsiveSurface `info`). The search «Introdu numele» reads GET /user/all?page&pageSize=20&search
 * (core paginatedUsersInfiniteQuery), the next page loads when the end of the list comes into view,
 * with «Se încarcă...» under it. Each row: the thumb avatar (initials disc as the fallback), the
 * username and «#{username}{id}». Already-added users are disabled and dimmed. The anchor (the viewer,
 * or the entry's author in organizer mode) is on the team already: fish lists it as choosable and the
 * CMS refuses the duplicate only after submit; here its row is disabled with «tu» / «autorul
 * înscrierii». Choosing someone adds them and closes
 * the picker; closing it, in any way, clears the search.
 * The body mounts only while open: no user search runs for a closed picker.
 */

/** fish usePaginatedUsers' page size. */
const PAGE_SIZE = 20;
/** The search waits for a pause in typing before it reads (fish reads on every key). */
const SEARCH_DEBOUNCE_MS = 250;

type Props = {
  open: boolean;
  onClose: () => void;
  t: Transport;
  /** documentIds already on the team (dimmed, not choosable). */
  taken: ReadonlySet<string>;
  /** Who the entry is about (also in `taken`): its row says so instead of «adăugat deja». */
  anchor?: { documentId: string; label: string } | null;
  onPick: (user: Teammate) => void;
};

export function TeammatePicker({ open, onClose, t, taken, anchor = null, onPick }: Props) {
  return (
    <ResponsiveSurface open={open} onClose={onClose} intent="info" title="Adaugă coechipieri" sheetSnap={0.9} pinnedActions>
      {open ? <PickerBody t={t} taken={taken} anchor={anchor} onPick={onPick} /> : null}
    </ResponsiveSurface>
  );
}

function PickerBody({
  t,
  taken,
  anchor,
  onPick,
}: {
  t: Transport;
  taken: ReadonlySet<string>;
  anchor: { documentId: string; label: string } | null;
  onPick: (user: Teammate) => void;
}) {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const id = window.setTimeout(() => setSearch(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [input]);
  const users = useInfiniteQuery(paginatedUsersInfiniteQuery(t, { search, pageSize: PAGE_SIZE }));
  const rows = useMemo(() => users.data?.pages.flatMap(p => p.data) ?? [], [users.data]);

  // fish onMomentumScrollEnd → fetchNextPage: here, when the list's end scrolls into view.
  const end = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = users;
  useEffect(() => {
    const el = end.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, rows.length]);

  return (
    <div className="flex flex-col gap-3" data-testid="teammate-picker">
      <div className="sticky top-0 z-above -mx-1 bg-surface px-1 pt-1 pb-2">
        <div className={controlShell(false)}>
          <MagnifyingGlassIcon aria-hidden className="size-5 shrink-0 text-accent-ink" />
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.currentTarget.value)}
            placeholder="Introdu numele"
            aria-label="Caută pescari după nume"
            autoComplete="off"
            enterKeyHint="search"
            className="t-body h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted focus-visible:outline-none"
          />
        </div>
      </div>
      {users.isPending ? (
        <PickerState role="status">Se încarcă...</PickerState>
      ) : users.isError ? (
        <PickerState role="alert" tone="danger">
          Eroare la încărcarea datelor
        </PickerState>
      ) : rows.length === 0 ? (
        <PickerState role="status">Nu s-au găsit rezultate</PickerState>
      ) : (
        <ul aria-label="Pescari" className="flex flex-col gap-2" data-testid="teammate-options">
          {rows.map(user => {
            const self = anchor?.documentId === user.documentId ? anchor.label : null;
            const added = Boolean(self) || taken.has(user.documentId);
            return (
              <li key={user.documentId}>
                <button
                  type="button"
                  disabled={added}
                  onClick={() =>
                    onPick({
                      documentId: user.documentId,
                      username: user.username,
                    })
                  }
                  aria-label={self ? `${user.username}, ${self}` : added ? `${user.username}, adăugat deja` : `Adaugă ${user.username}`}
                  className={cn(
                    'flex min-h-14 w-full items-center gap-3 rounded-control border border-hairline px-3 py-2 text-left',
                    'transition-colors duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    added ? 'cursor-not-allowed bg-accent-tint opacity-50' : 'bg-surface hover:bg-soft-fill',
                  )}
                >
                  <Avatar name={user.username} src={thumbUrl(user.avatar)} size={32} />
                  <span className="t-body min-w-0 flex-1 truncate text-ink">{user.username}</span>
                  {self ? (
                    <span
                      aria-hidden
                      className="t-caption shrink-0 rounded-full bg-soft-fill px-2 py-0.5 text-ink-2"
                      data-testid="teammate-anchor"
                    >
                      {self}
                    </span>
                  ) : added ? (
                    <CheckIcon aria-hidden className="size-5 shrink-0 text-accent-ink" />
                  ) : null}
                  <span className="t-caption max-w-[45%] shrink-0 truncate text-muted">{userTag(user)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div ref={end} aria-hidden className="h-px" />
      {isFetchingNextPage ? (
        <p role="status" className="t-body pb-2 text-muted">
          Se încarcă...
        </p>
      ) : null}
    </div>
  );
}

function PickerState({ children, role, tone }: { children: string; role: 'status' | 'alert'; tone?: 'danger' }) {
  return (
    <p role={role} className={cn('t-body py-6 text-center', tone === 'danger' ? 'text-status-danger-fg' : 'text-muted')}>
      {children}
    </p>
  );
}
