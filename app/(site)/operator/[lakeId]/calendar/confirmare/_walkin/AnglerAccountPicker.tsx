'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { TextInput } from '@/components/forms/TextInput';
import { T4Spinner } from '@/components/templates/T4';
import { Avatar } from '@/components/ui/Avatar';
import { anglerSearchInfiniteQuery, type AnglerListItem } from '@/core/social';
import { useOperatorTransport } from '../../../../_shared/useOperatorTransport';
import { MAX_RESULTS, PICKER_EMPTY, PICKER_HINT, pickerState, SEARCH_DEBOUNCE_MS } from './model';
import { ReputationLine } from './ReputationLine';

/*
 * «Cont Bluvi» half of «Date pescar» — fish features/lakes/booking/AnglerAccountPicker.tsx (c6, c7):
 * find the angler by username (social.anglerSearchInfiniteQuery, debounced 300 ms, from 2
 * characters — the server's own minimum), pick one, and the booking goes on their account (the
 * server snapshots the account's name and phone: no phone is typed here).
 *  - under the field: the hint under 2 characters, a spinner while the first answer is out, «Niciun
 *    cont găsit…» when empty, else up to 8 results (avatar, username, the server's subline) — a
 *    short capped column inside the form, never its own scroller. The state line is a polite live
 *    region, so the count of results is announced;
 *  - picked: a success-tinted card (fish teal) with the avatar, the username, the reputation line
 *    and «Schimbă», which clears the pick AND the search.
 */

export function AnglerAccountPicker({
  selected,
  onSelect,
  onClear,
  disabled = false,
}: {
  selected: AnglerListItem | null;
  onSelect: (item: AnglerListItem) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const t = useOperatorTransport();
  const [raw, setRaw] = useState('');
  const [q, setQ] = useState('');
  const statusId = useId();

  useEffect(() => {
    const id = setTimeout(() => setQ(raw), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [raw]);

  const search = useInfiniteQuery(anglerSearchInfiniteQuery(t, q));
  const items = useMemo(() => (search.data?.pages ?? []).flatMap((p) => p.data).slice(0, MAX_RESULTS), [search.data]);
  // The typed text decides the hint at once; the debounced query decides what the list holds.
  const state = raw.trim().length < 2 ? 'hint' : pickerState(q, search.isFetching || q !== raw, items.length);

  if (selected) {
    return (
      <div
        data-testid="walkin-selected-account"
        className="flex max-w-xl items-center gap-3 rounded-control border border-status-success-fg/40 bg-status-success-bg p-3.5"
      >
        <Avatar name={selected.username} src={selected.avatarUrl} size={48} shape="square" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="t-body-strong truncate text-ink">{selected.username}</p>
          <ReputationLine userId={selected.documentId} />
        </div>
        <button
          type="button"
          data-testid="walkin-clear-account"
          disabled={disabled}
          onClick={() => {
            setRaw('');
            setQ('');
            onClear();
          }}
          className="t-body-strong shrink-0 rounded-control px-2 py-1.5 text-accent-ink hover:underline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
        >
          Schimbă<span className="sr-only"> contul ales</span>
        </button>
      </div>
    );
  }

  return (
    // A username is ~12 characters: the search and its results stay ≤ 576 px, never the column's width.
    <div className="flex max-w-xl flex-col gap-3">
      <TextInput
        id="la-poarta-cont"
        label="Caută contul"
        placeholder="Nume de utilizator"
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        value={raw}
        onChange={(e) => setRaw(e.currentTarget.value)}
        readOnly={disabled}
        aria-describedby={statusId}
        data-testid="walkin-account-search"
      />
      <div id={statusId} aria-live="polite" className="flex flex-col">
        {state === 'hint' ? (
          <p className="t-caption text-muted" data-testid="walkin-account-hint">
            {PICKER_HINT}
          </p>
        ) : state === 'searching' ? (
          <p className="t-caption flex items-center gap-2 text-muted" data-testid="walkin-account-searching">
            <T4Spinner className="text-accent-ink" />
            Se caută…
          </p>
        ) : state === 'empty' ? (
          <p className="t-caption text-muted" data-testid="walkin-account-empty">
            {PICKER_EMPTY}
          </p>
        ) : (
          <p className="sr-only">{items.length === 1 ? '1 cont găsit' : `${items.length} conturi găsite`}</p>
        )}
      </div>
      {state === 'results' ? (
        <ul aria-label="Conturi găsite" data-testid="walkin-account-results" className="-mt-1 flex flex-col">
          {items.map((item) => (
            <li key={item.documentId} className="border-t border-hairline first:border-t-0">
              <button
                type="button"
                data-testid={`walkin-account-${item.username}`}
                disabled={disabled}
                onClick={() => onSelect(item)}
                className="flex w-full items-center gap-3 rounded-control px-1 py-2.5 text-left transition-colors duration-(--duration-fast) hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-accent"
              >
                <Avatar name={item.username} src={item.avatarUrl} size={40} shape="square" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="t-body-strong truncate text-ink">{item.username}</span>
                  {item.subline ? <span className="t-caption truncate text-muted">{item.subline}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
