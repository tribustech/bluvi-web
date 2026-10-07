'use client';

import { useId, useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { groupState, type NotificationPreferenceGroup } from '@/core/competitions';
import { FOCUS_RING } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';

/**
 * One notification group — fish PreferenceGroupRow (parity account.notification-preferences c8,
 * c9). The disclosure (chevron + the group's label + «parțial» when some but not all of its types
 * are muted) opens the per-type switches; it is named «Desfășoară {grup}» / «Restrânge {grup}» as in
 * fish. The group switch is named by the label and is on unless every type is muted; toggling it
 * turns all the group's types on or off. Each type's switch is on when the type is not muted.
 * Every group has the disclosure, a one-type group too (fish).
 */
export function PreferenceGroupRow({
  group,
  muted,
  onToggleGroup,
  onToggleType,
}: {
  group: NotificationPreferenceGroup;
  muted: string[];
  onToggleGroup: (group: NotificationPreferenceGroup, on: boolean) => void;
  onToggleType: (key: string, on: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const typesId = useId();
  const partialId = useId();
  const state = groupState(muted, group);
  return (
    <li className="border-b border-hairline last:border-b-0" data-testid="preference-group" data-key={group.key}>
      <div className="flex min-h-14 items-center gap-2 py-1">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={typesId}
          aria-label={expanded ? `Restrânge ${group.label}` : `Desfășoară ${group.label}`}
          onClick={() => setExpanded(v => !v)}
          className={cn(
            '-ml-2 flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-control py-1 pr-2 pl-2 text-left hover:bg-soft-fill',
            FOCUS_RING,
          )}
        >
          <ChevronDownIcon
            aria-hidden
            className={cn('size-5 shrink-0 text-muted transition-transform duration-(--duration-fast) ease-fast', expanded && 'rotate-180')}
          />
          <span className="min-w-0 flex-1">
            <span className="block t-body-strong text-ink">{group.label}</span>
            {state === 'partial' ? (
              <span id={partialId} className="block t-caption text-muted">
                parțial
              </span>
            ) : null}
          </span>
        </button>
        <Switch
          label={group.label}
          describedBy={state === 'partial' ? partialId : undefined}
          checked={state !== 'off'}
          onChange={on => onToggleGroup(group, on)}
        />
      </div>
      <ul id={typesId} hidden={!expanded} className="flex flex-col pb-2 pl-7">
        {group.types.map(type => (
          <li key={type.key} className="flex min-h-11 items-center gap-3">
            <span aria-hidden className="min-w-0 flex-1 t-body text-ink-2">
              {type.label}
            </span>
            <Switch label={type.label} checked={!muted.includes(type.key)} onChange={on => onToggleType(type.key, on)} small />
          </li>
        ))}
      </ul>
    </li>
  );
}

/** The kit switch's look (T1 FilterSwitch), named by `label`; `small` for the types under a group. */
function Switch({
  label,
  describedBy,
  checked,
  onChange,
  small = false,
}: {
  label: string;
  describedBy?: string;
  checked: boolean;
  onChange: (on: boolean) => void;
  small?: boolean;
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        aria-describedby={describedBy}
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className={cn(
          'peer cursor-pointer appearance-none rounded-full bg-muted transition-colors duration-(--duration-fast) ease-fast checked:bg-accent',
          small ? 'h-6 w-10' : 'h-7 w-12',
          FOCUS_RING,
        )}
      />
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-0.75 left-0.75 rounded-full bg-surface transition-[translate] duration-(--duration-fast) ease-select',
          small ? 'size-4.5 peer-checked:translate-x-4' : 'size-5.5 peer-checked:translate-x-5',
        )}
      />
    </span>
  );
}
