'use client';

import { useState } from 'react';
import { refereeOptions } from './model';
import { UsersSelect } from './UsersSelect';

/**
 * fish RefereeRemoverBottomSheet (organizare c10): «Șterge arbitru» — the competition's referees,
 * filtered by the search text, one chosen, then «Șterge»; «Nu există opțiuni» when there is none.
 * Closed in any way (a write that answered, too) it forgets the search and the choice (fish onSettled
 * setSelectedRefereeOptionId(null)); a choice the list no longer shows (removed, or hidden by the
 * search) is no choice: «Șterge» stays closed rather than writing for someone the reader cannot see.
 */
export function RefereeRemoveDialog({
  open,
  onClose,
  referees,
  busy,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  referees: { documentId: string; username: string }[];
  busy: boolean;
  onRemove: (refereeId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  // Reset while rendering the close (React's «adjusting state when a prop changes»), not in an effect.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setSearch('');
      setSelected(null);
    }
  }
  const options = refereeOptions(referees, search);
  const visibleSelected = selected !== null && options.some(o => o.id === selected) ? selected : null;
  return (
    <UsersSelect
      open={open}
      onClose={onClose}
      title="Șterge arbitru"
      actionLabel="Șterge"
      search={search}
      onSearch={setSearch}
      options={options}
      selected={visibleSelected}
      onSelect={setSelected}
      onAction={() => visibleSelected && onRemove(visibleSelected)}
      busy={busy}
      testId="referee-remove"
    />
  );
}
