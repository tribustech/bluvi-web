'use client';

import { useMemo, useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { lakesInfiniteQuery, type LakeCard } from '@/core/lakes';
import { organizerRecentLakesQuery } from '@/core/organizer';
import { SearchSelectDialog } from '@/components/forms/SearchSelectDialog';
import { cn } from '@/components/ui/cn';
import type { Transport } from '@/core/transport';
import { lakeOption, orderLakes, type LakeOption } from './model';

/*
 * «Selectare lac» picker (organizer.step-lake-sectors c1–c4): fish's indigo field («Alege un lac» /
 * the lake's name) opening SelectWithSearchSheet — here the kit SearchSelectDialog (a sheet on a
 * phone, a dialog from 768): server search («Introdu numele»), 20 lakes a page with infinite
 * loading, «Nu s-au găsit rezultate»; with no term the organizer's recent lakes come first.
 */

const PAGE_SIZE = 20;

type Props = {
  t: Transport;
  /** values.lake */
  currentId: string | undefined;
  /** The name to show in the field (the picked card's or the loaded detail's). */
  currentName: string | null;
  /** The name is not known yet (a saved lake whose detail is still loading). */
  nameLoading: boolean;
  /** A lake is saved but its name could not be read (the detail failed): «Lac salvat», never «Alege un lac». */
  savedUnnamed?: boolean;
  onPick: (lake: LakeCard) => void;
  disabled?: boolean;
};

export function LakePicker({ t, currentId, currentName, nameLoading, savedUnnamed = false, onPick, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // The picker's own cache entry: lakesInfiniteQuery's key carries no page size, and the home rail
  // (10 a page) and ⌘K (a few a page) share it — a page 2 of 20 on their page 1 would skip lakes.
  const base = lakesInfiniteQuery(t, { pageSize: PAGE_SIZE, search });
  const lakes = useInfiniteQuery({
    ...base,
    queryKey: [...base.queryKey, 'picker', PAGE_SIZE] as unknown as typeof base.queryKey,
    enabled: open,
  });
  const recent = useQuery(organizerRecentLakesQuery(t, { isOrganizer: true, enabled: open }));

  const options = useMemo<LakeOption[]>(() => {
    const all = lakes.data?.pages.flatMap(p => p.data) ?? [];
    const recentIds = (recent.data ?? []).map(l => l.documentId);
    return orderLakes(all, recentIds, search).map(l => lakeOption(l, currentId));
  }, [lakes.data, recent.data, search, currentId]);

  const close = () => {
    setOpen(false);
    setSearch('');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-label={currentName ? `Lac: ${currentName}. Schimbă lacul` : savedUnnamed ? 'Lac salvat. Schimbă lacul' : 'Alege un lac'}
        data-testid="lake-picker"
        className={cn(
          // fish's indigo field (indigo1 ground, indigo4 hairline, the indigo chevron).
          'flex h-12 w-full cursor-pointer items-center justify-between gap-2 rounded-control border border-accent-tint-2 bg-accent-tint px-3 text-left',
          'transition-[filter] duration-(--duration-fast) ease-fast hover:brightness-[0.98]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {nameLoading ? (
          <span aria-hidden className="h-[0.7em] w-40 animate-shimmer rounded-full bg-soft-fill" />
        ) : (
          <span className={cn('t-body min-w-0 truncate', currentName || savedUnnamed ? 'text-ink' : 'text-ink-2')}>
            {currentName ?? (savedUnnamed ? 'Lac salvat' : 'Alege un lac')}
          </span>
        )}
        <ChevronDownIcon aria-hidden className="size-5 shrink-0 text-accent-ink" />
      </button>
      <SearchSelectDialog<LakeOption>
        open={open}
        onClose={close}
        title="Alege un lac"
        searchLabel="Caută lacul"
        placeholder="Introdu numele"
        listLabel="Bălți"
        // fish SelectWithSearchSheet never reorders: the current lake stays where orderLakes put it.
        keepOrder
        testId="lake-picker-dialog"
        options={options}
        onQueryChange={setSearch}
        loading={lakes.isPending}
        error={lakes.isError && !lakes.data}
        onRetry={() => void lakes.refetch()}
        hasMore={Boolean(lakes.hasNextPage)}
        loadingMore={lakes.isFetchingNextPage}
        loadMoreError={lakes.isFetchNextPageError}
        onLoadMore={() => {
          if (lakes.hasNextPage && !lakes.isFetchingNextPage) void lakes.fetchNextPage();
        }}
        onSelect={option => {
          onPick(option.lake);
          close();
        }}
      />
    </>
  );
}
