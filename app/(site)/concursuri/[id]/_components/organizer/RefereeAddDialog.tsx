'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { paginatedUsersInfiniteQuery } from '@/core/social';
import type { Transport } from '@/core/transport';
import { UsersSelect } from './UsersSelect';

/** fish usePaginatedUsers' page size. */
const PAGE_SIZE = 20;
/** The search waits for a pause in typing (fish reads on every key). */
const SEARCH_DEBOUNCE_MS = 250;

/**
 * fish RefereeAdderBottomSheet (organizare c9): «Alegeți un arbitru» — every user, searched
 * («Caută...»), 20 a page, the next page when the end of the list comes into view; one chosen, then
 * «Adaugă». The read runs only while it is open. Closed in any way (a write that answered, too) it
 * forgets the search and the choice (fish onSettled); a choice the list no longer shows is no choice.
 */
export function RefereeAddDialog({
  open,
  onClose,
  t,
  busy,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  t: Transport;
  busy: boolean;
  onAdd: (documentId: string) => void;
}) {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => setSearch(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [input]);
  const users = useInfiniteQuery({ ...paginatedUsersInfiniteQuery(t, { search, pageSize: PAGE_SIZE }), enabled: open });
  const options = useMemo(() => users.data?.pages.flatMap(p => p.data).map(u => ({ id: u.documentId, label: u.username })) ?? [], [users.data]);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = users;
  const onEnd = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  // Reset while rendering the close (React's «adjusting state when a prop changes»), not in an effect.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setInput('');
      setSearch('');
      setSelected(null);
    }
  }
  const visibleSelected = selected !== null && options.some(o => o.id === selected) ? selected : null;
  return (
    <UsersSelect
      open={open}
      onClose={onClose}
      title="Alegeți un arbitru"
      actionLabel="Adaugă"
      search={input}
      onSearch={setInput}
      options={options}
      loading={users.isPending && users.fetchStatus !== 'idle'}
      error={users.isError && !users.data ? 'Eroare la încărcarea datelor' : null}
      selected={visibleSelected}
      onSelect={setSelected}
      onAction={() => visibleSelected && onAdd(visibleSelected)}
      busy={busy}
      onEnd={onEnd}
      testId="referee-add"
      footerNote={
        isFetchingNextPage ? (
          <p role="status" className="t-body pb-2 text-muted">
            Se încarcă...
          </p>
        ) : null
      }
    />
  );
}
