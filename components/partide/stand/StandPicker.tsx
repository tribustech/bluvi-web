'use client';

import { useMemo } from 'react';
import { CheckIcon } from '@heroicons/react/24/outline';
import type { LakeDetailStand } from '@/core/lakes';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { cn } from '@/components/ui/cn';

/*
 * «Alege standul» — the single-select stand list (fish features/partide/components/StandPickerSheet.tsx),
 * shared by the partidă's Setări and Începe. «Fără stand» first, then the lake's stands in natural
 * order («Stand 2» before «Stand 10» — stand names are usually numbered). A row click selects and
 * closes (no footer): `onSelect` runs first, then `onClose` — the caller that needs to act once the
 * list is gone (Setări opens the adjust map) does it from `onClose`, as fish does from onDismiss.
 *
 * A bottom sheet on the phone, a dialog from 768 (ResponsiveSurface «info»).
 */

export type StandPickerProps = {
  open: boolean;
  stands: LakeDetailStand[];
  /** documentId of the current stand, or null («Fără stand»). */
  selectedId: string | null;
  onSelect: (stand: LakeDetailStand | null) => void;
  onClose: () => void;
};

/** fish StandPickerSheet `rows`: a copy, natural Romanian order. */
export function sortStandsByName(stands: LakeDetailStand[]): LakeDetailStand[] {
  return [...stands].sort((a, b) => a.name.localeCompare(b.name, 'ro', { numeric: true }));
}

export function StandPicker({ open, stands, selectedId, onSelect, onClose }: StandPickerProps) {
  const rows = useMemo(() => sortStandsByName(stands), [stands]);
  const pick = (stand: LakeDetailStand | null) => {
    onSelect(stand);
    onClose();
  };
  return (
    <ResponsiveSurface open={open} onClose={onClose} intent="info" title="Alege standul" sheetSnap={0.9} pinnedActions>
      <ul data-testid="stand-picker" aria-label="Standuri" className="flex flex-col gap-1">
        <StandRow label="Fără stand" checked={selectedId == null} muted onClick={() => pick(null)} />
        {rows.map(stand => (
          <StandRow key={stand.documentId} label={stand.name} checked={stand.documentId === selectedId} onClick={() => pick(stand)} />
        ))}
      </ul>
    </ResponsiveSurface>
  );
}

function StandRow({ label, checked, muted, onClick }: { label: string; checked: boolean; muted?: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={checked}
        onClick={onClick}
        className={cn(
          'flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-control px-3.5 text-left transition-colors duration-(--duration-fast)',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
          checked ? 'bg-accent-tint' : 'hover:bg-soft-fill',
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate', checked ? 't-body-strong text-ink' : 't-body', !checked && (muted ? 'text-ink-2' : 'text-ink'))}>{label}</span>
        {checked ? <CheckIcon aria-hidden className="size-5 shrink-0 stroke-[2.4] text-accent" /> : null}
      </button>
    </li>
  );
}
