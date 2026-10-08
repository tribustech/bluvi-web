'use client';

import { useId } from 'react';
import { CheckCircleIcon, ChevronDownIcon, ClockIcon, XCircleIcon } from '@heroicons/react/24/outline';
import type { Registration } from '@/core/competitions';
import { Avatar, FaceStack } from '@/components/ui/Avatar';
import { StatusPill } from '@/components/ui/StatusPill';
import { cn } from '@/components/ui/cn';
import { photo } from '../brokenImages';
import { RowActions } from './RowActions';
import { DELETED_ACCOUNT, isGuestRegistration, registrationName, statusText, type StatusAction } from './model';

/*
 * One registration (fish ExpandableRegistration): the face(s), the name, the stand or «Nealocat»,
 * the status. Below 1024 a card that opens on its actions (PhoneRow); from 1024 a row of the roster
 * table with every action inline (TableRow).
 */

type Common = {
  competitionId: string;
  competitionName: string;
  competitionStatus: string;
  team: boolean;
  registration: Registration;
  broken: ReadonlySet<string>;
  onStatus: (r: Registration, action: StatusAction) => void;
};

const FOCUS = 'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent';

/** fish renderAvatars: a team's faces stacked (up to 3 here, else 2 + «+N»), a guest's neutral face, an angler's photo. */
export function Faces({ registration: r, team, broken, name, size = 40 }: { registration: Registration; team: boolean; broken: ReadonlySet<string>; name: string; size?: 32 | 40 }) {
  const people = (r.participants ?? []).map(p => ({ name: p.username || DELETED_ACCOUNT, src: photo(p.avatar?.url, broken) }));
  if (team && people.length > 1) {
    const shown = people.length <= 3 ? people : people.slice(0, 2);
    return (
      <span className="flex w-22 shrink-0 items-center">
        <FaceStack size={32} people={shown} overflow={people.length - shown.length} />
      </span>
    );
  }
  const face = isGuestRegistration(r) || people.length === 0 ? <Avatar name={r.guestName || name} size={size} tone="neutral" /> : <Avatar name={people[0].name} src={people[0].src} size={size} />;
  return team ? <span className="flex w-22 shrink-0 items-center">{face}</span> : face;
}

const PILL = {
  pending: 'bg-status-pending-bg text-status-pending-fg',
  success: 'bg-status-success-bg text-status-success-fg',
  danger: 'bg-status-danger-bg text-status-danger-fg',
} as const;

function Glyph({ tone, className }: { tone: keyof typeof ICON; className?: string }) {
  const { Icon } = ICON[tone];
  return <Icon aria-hidden className={className} />;
}

const ICON = {
  pending: { Icon: ClockIcon, cls: 'text-status-pending-fg' },
  success: { Icon: CheckCircleIcon, cls: 'text-status-success-fg' },
  danger: { Icon: XCircleIcon, cls: 'text-status-danger-fg' },
} as const;

/** fish's status icon (clock · X · check) with its words for assistive tech (and the tooltip). */
export function StatusIcon({ status }: { status: string }) {
  const s = statusText(status);
  if (!s) return <span aria-hidden className="size-6 shrink-0" />;
  const { Icon, cls } = ICON[s.tone];
  return (
    <span role="img" aria-label={s.label} title={s.label} data-status={status} className={cn('flex size-6 shrink-0 items-center justify-center', cls)}>
      <Icon aria-hidden className="size-6" />
    </span>
  );
}

export function PhoneRow({ expanded, onToggle, ...p }: Common & { expanded: boolean; onToggle: () => void }) {
  const r = p.registration;
  const panelId = useId();
  const { name, members } = registrationName(r, p.team ? 'team' : 'single');
  return (
    <article
      aria-label={name}
      data-registration={r.documentId}
      className="overflow-hidden bg-surface shadow-e0 transition-shadow duration-(--duration-fast) md:rounded-card md:hover:shadow-[var(--shadow-e1),var(--shadow-e0)]"
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        className={cn('flex min-h-18 w-full cursor-pointer items-center gap-3 py-3 pr-3 pl-4 text-left', !expanded && 'max-md:hover:bg-soft-fill', FOCUS)}
      >
        <Faces registration={r} team={p.team} broken={p.broken} name={name} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate t-body-strong text-ink">{name}</span>
          {members ? <span className="truncate t-caption text-muted">{members}</span> : null}
        </span>
        <span className={cn('shrink-0 t-label tabular-nums', r.stand?.name ? 'text-ink-2' : 'text-status-danger-fg')}>{r.stand?.name ? `Stand ${r.stand.name}` : 'Nealocat'}</span>
        <StatusIcon status={r.registrationStatus} />
        <span className="sr-only">, {expanded ? 'ascunde acțiunile' : 'arată acțiunile'}</span>
        <ChevronDownIcon aria-hidden className={cn('size-4 shrink-0 text-muted transition-transform duration-(--duration-fast)', expanded && 'rotate-180')} />
      </button>
      <div
        id={panelId}
        inert={!expanded}
        className={cn(
          'grid transition-[grid-template-rows] duration-(--duration-fast) ease-fast motion-reduce:transition-none',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-hairline px-2 py-3">
            <RowActions
              competitionId={p.competitionId}
              competitionName={p.competitionName}
              competitionStatus={p.competitionStatus}
              registration={r}
              subject={name}
              variant="tiles"
              onStatus={a => p.onStatus(r, a)}
              onLeave={onToggle}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

export function TableRow({ onPerson, personOpen, ...p }: Common & { onPerson: ((el: HTMLElement) => void) | null; personOpen: boolean }) {
  const r = p.registration;
  const { name, members } = registrationName(r, p.team ? 'team' : 'single');
  const status = statusText(r.registrationStatus);
  const hasAccount = (r.participants ?? []).length > 0;
  const identity = (
    <>
      <Faces registration={r} team={p.team} broken={p.broken} name={name} />
      <span className="flex min-w-0 flex-col gap-0.5 text-left">
        <span className="truncate t-body-strong text-ink">{name}</span>
        {members ? <span className="truncate t-caption text-muted">{members}</span> : null}
        {r.club?.name ? <span className="truncate t-caption text-muted">{r.club.name}</span> : null}
      </span>
    </>
  );
  return (
    <tr data-registration={r.documentId} className="border-t border-hairline transition-colors duration-(--duration-fast) first:border-t-0 hover:bg-soft-fill/60">
      <td className="py-3 pr-2 pl-5 align-middle">
        {r.stand?.name ? (
          <span className="t-title2 text-ink tabular-nums">{r.stand.name}</span>
        ) : (
          <StatusPill tone={r.registrationStatus === 'rejected' ? 'neutral' : 'warning'}>Nealocat</StatusPill>
        )}
      </td>
      <td className="max-w-0 py-2 pr-4 align-middle">
        {onPerson && hasAccount ? (
          <button
            type="button"
            data-row-focus
            aria-haspopup="dialog"
            aria-expanded={personOpen}
            onClick={e => onPerson(e.currentTarget)}
            className={cn('-mx-2 flex max-w-full min-w-0 cursor-pointer items-center gap-3 rounded-control px-2 py-1 hover:bg-soft-fill', FOCUS)}
          >
            {identity}
          </button>
        ) : (
          // tabIndex -1: where focus lands after a status change keeps the row (RegistrationsList).
          <div data-row-focus tabIndex={-1} className={cn('-mx-2 flex min-w-0 items-center gap-3 rounded-control px-2 py-1', FOCUS)}>
            {identity}
          </div>
        )}
      </td>
      <td className="py-3 pr-4 align-middle whitespace-nowrap">
        {status ? (
          <span data-status={r.registrationStatus} className={cn('inline-flex h-7 items-center gap-1.5 rounded-full pr-3 pl-1.5 t-label', PILL[status.tone])}>
            <Glyph tone={status.tone} className="size-5" />
            {status.label}
          </span>
        ) : null}
      </td>
      <td className="py-3 pr-5 align-middle">
        <RowActions
          competitionId={p.competitionId}
          competitionName={p.competitionName}
          competitionStatus={p.competitionStatus}
          registration={r}
          subject={name}
          variant="inline"
          onStatus={a => p.onStatus(r, a)}
        />
      </td>
    </tr>
  );
}
