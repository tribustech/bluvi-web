'use client';

import { CheckIcon } from '@heroicons/react/24/outline';
import { Avatar, toneForId } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import type { SessionMember } from '@/core/partide/domain/types';

/*
 * fish features/partide/components/PhotoTagPicker.tsx (dark tone, the preview screen's). Member chips
 * for who is IN the photo. This decides ONLY whose photo gallery the catch appears in — catches are
 * team-owned and count in every member's stats regardless of tagging (partide.captura-poza.c5).
 *
 * `value === null` means «Toți» (everyone), the same "omit the field" contract the CMS resolves to
 * the full roster. Selecting a member deselects «Toți»; deselecting the last member returns to it —
 * there is no third "nobody" state. Renders NOTHING for a solo partidă (≤ 1 member).
 */

/** fish `toggleMember`: never an empty array — an empty selection collapses back to null («Toți»). */
export function togglePhotoTag(value: string[] | null, uid: string): string[] | null {
  const current = value ?? [];
  const next = current.includes(uid) ? current.filter(u => u !== uid) : [...current, uid];
  return next.length === 0 ? null : next;
}

export function PhotoTagPicker({
  members,
  value,
  onChange,
  className,
}: {
  members: SessionMember[];
  value: string[] | null;
  onChange: (value: string[] | null) => void;
  className?: string;
}) {
  if (members.length <= 1) return null;
  return (
    <div role="group" aria-labelledby="photo-tag-label" className={cn('flex min-w-0 flex-col gap-2.5', className)} data-testid="photo-tag-picker">
      <p id="photo-tag-label" className="t-eyebrow text-on-photo-scrim uppercase">
        Cine e în poză?
      </p>
      {/* The row scrolls out of frame on a phone (bleeds to the screen edges, fish's `bleed`), which is
          what signals that it scrolls at all; from 768 it wraps. */}
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        <li className="shrink-0">
          <TagChip testId="photo-tag-toti" label="Toți" selected={value === null} onPress={() => onChange(null)} />
        </li>
        {members.map(m => {
          const name = m.name ?? 'Pescar';
          return (
            <li key={m.uid} className="shrink-0">
              <TagChip
                testId={`photo-tag-member-${m.uid}`}
                label={name}
                selected={value?.includes(m.uid) ?? false}
                avatar={<Avatar name={name} src={m.avatar} size={24} tone={toneForId(m.uid)} />}
                onPress={() => onChange(togglePhotoTag(value, m.uid))}
              />
            </li>
          );
        })}
      </ul>
      {/* Tagging is a sharing decision, so it is said where it is made. Conditional ("dacă partida e
          publică") because the picker cannot see the partidă's visibility. */}
      <p className="t-caption text-on-photo-scrim" aria-live="polite" data-testid="photo-tag-helper">
        {value === null
          ? 'Poza apare pe profilul tuturor membrilor, dacă partida e publică.'
          : 'Poza apare doar pe profilul celor selectați, dacă partida e publică.'}
      </p>
    </div>
  );
}

function TagChip({
  testId,
  label,
  selected,
  avatar,
  onPress,
}: {
  testId: string;
  label: string;
  selected: boolean;
  avatar?: React.ReactNode;
  onPress: () => void;
}) {
  // fish dark tone: selected is a solid light chip; unselected is built on a DARK base (a translucent
  // light one vanished over a light photo).
  return (
    <button
      type="button"
      data-testid={testId}
      aria-pressed={selected}
      onClick={onPress}
      className={cn(
        'flex h-10 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] t-label whitespace-nowrap transition-opacity active:opacity-75',
        avatar ? 'pr-3 pl-1.5' : 'px-3.5',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-photo-scrim',
        selected ? 'border-photo-chip bg-photo-chip text-ink' : 'border-on-photo-scrim/35 bg-photo-scrim text-on-photo-scrim hover:border-on-photo-scrim/60',
      )}
    >
      {avatar}
      <span>{label}</span>
      {selected ? <CheckIcon aria-hidden className="size-3.5 stroke-3" /> : null}
    </button>
  );
}
