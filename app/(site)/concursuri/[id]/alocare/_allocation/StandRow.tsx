'use client';

import { PencilSquareIcon, TrashIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { ROW_BOX } from './layout';
import type { Occupant } from './model';

/*
 * One stand of the allocation (organizer.participants c4, c6; fish configure/participants
 * :271-321): «Stand N» and its occupant — the club, then «<echipă>:» bold and the participants (or
 * the guest) — or «-»; a filled row is green (fish $green2), an empty one the indigo tint.
 * - The row itself opens the registration picker (fish: the row's onPress, filled or not).
 * - The trailing icon: filled → the red trash, which empties the stand; empty → the pencil, which
 *   opens the picker (fish's two-faced icon). Two sibling buttons, never nested.
 * - The occupant's avatar leads the row (rule 14: people rows carry their face); a team is a square
 *   avatar, an empty stand a dashed disc.
 * - Phone: the club on one line, the team + members on two (fish). From 768 the rows sit in sector
 *   columns, so the occupant wraps in full (the organizer checks who sits where without opening the
 *   picker); the row's title carries the full name too.
 * - `busy` (a save running): both inert.
 */

type Props = {
  standName: string;
  sectorName: string;
  occupant: Occupant | null;
  /** A registration is seated but its occupant cannot be described (not in the competition). */
  filled: boolean;
  busy: boolean;
  onOpen: () => void;
  onClear: () => void;
};

export function StandRow({ standName, sectorName, occupant, filled, busy, onOpen, onClear }: Props) {
  const stand = `Stand ${standName}`;
  const where = `Sector ${sectorName}, ${stand.toLowerCase()}`;
  const who = occupant?.name ?? (filled ? 'ocupat' : 'liber');
  return (
    <div
      data-testid={`alloc-stand-${sectorName}-${standName}`}
      data-filled={filled || undefined}
      className={cn(
        'flex items-stretch overflow-hidden rounded-control transition-colors',
        ROW_BOX,
        filled ? 'bg-status-success-bg' : 'bg-accent-tint',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={busy}
        aria-haspopup="dialog"
        aria-label={`${where}: ${who}. ${filled ? 'Schimbă participantul' : 'Alege participantul'}`}
        title={occupant?.name}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3 py-2 pr-1 pl-3 text-left',
          '-outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent',
          busy ? 'cursor-progress' : 'cursor-pointer hover:bg-surface/40 active:bg-surface/60',
        )}
      >
        {occupant ? (
          <Avatar
            name={occupant.avatar.name}
            src={occupant.avatar.src}
            size={40}
            shape={occupant.avatar.square ? 'square' : 'round'}
          />
        ) : (
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-faint text-muted"
          >
            <UserPlusIcon className="size-5" />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="t-body-strong text-ink tabular-nums">{stand}</span>
          {occupant ? (
            <>
              {occupant.club ? <span className="t-caption truncate text-ink-2 md:break-words md:whitespace-normal">{occupant.club}</span> : null}
              {occupant.team || occupant.people ? (
                <span className="t-caption line-clamp-2 break-words text-ink-2 md:line-clamp-none">
                  {occupant.team ? (
                    <strong className="font-bold text-ink">
                      {occupant.team}
                      {occupant.people ? ': ' : ''}
                    </strong>
                  ) : null}
                  {occupant.people}
                </span>
              ) : null}
            </>
          ) : (
            <span className="t-caption text-muted">-</span>
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={filled ? onClear : onOpen}
        disabled={busy}
        aria-haspopup={filled ? undefined : 'dialog'}
        aria-label={filled ? `Golește ${stand.toLowerCase()} din sectorul ${sectorName}` : `Alege participantul pentru ${stand.toLowerCase()} din sectorul ${sectorName}`}
        data-testid={filled ? 'alloc-clear' : 'alloc-edit'}
        className={cn(
          'flex w-12 shrink-0 items-center justify-center',
          '-outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent',
          filled ? 'text-status-danger-fg' : 'text-accent-ink',
          busy ? 'cursor-progress opacity-60' : 'cursor-pointer hover:bg-surface/50 active:bg-surface/70',
        )}
      >
        {filled ? <TrashIcon aria-hidden className="size-6" /> : <PencilSquareIcon aria-hidden className="size-6" />}
      </button>
    </div>
  );
}
