'use client';

import type { ReactNode } from 'react';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { ExclamationCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/20/solid';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { RING_DANGER } from '@/components/templates/rings';
import { SectorBadge } from '../lac-si-sectoare/SectorBuilder';
import { MISSING, type ReviewNote, type ReviewRow, type ReviewSection as Section } from './model';

/*
 * One card of «Revizuire» (organizer.step-review c1, c2; fish step-review.tsx SectionHeader,
 * ReviewRow, MissingField): the section's disc + title, «Editează» back to its step — red
 * «Completează» while the section has an error, the card ringed in red — then its rows.
 */

export const editButtonId = (id: string) => `revizuire-editeaza-${id}`;
/** A problem row's id (model problems[].key = `${section}-${row}`): the error summary's link target. */
export const rowId = (problemKey: string) => `revizuire-${problemKey}`;

type Props = {
  section: Section;
  icon: ReactNode;
  onEdit: () => void;
  busy: boolean;
  className?: string;
};

export function ReviewSection({ section, icon, onEdit, busy, className }: Props) {
  const { hasError } = section;
  return (
    <section
      aria-label={section.title}
      data-testid={`review-section-${section.id}`}
      data-error={hasError || undefined}
      className={cn(
        '@container flex flex-col gap-4 rounded-card bg-surface p-4 md:p-5 xl:p-6',
        hasError ? RING_DANGER : 'shadow-e0',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full [&>svg]:size-6',
            hasError ? 'bg-status-danger-bg text-status-danger-fg' : 'bg-accent-tint text-accent-ink',
          )}
        >
          {hasError ? <ExclamationCircleIcon /> : icon}
        </span>
        <h2 className="t-heading min-w-0 flex-1 text-ink">{section.title}</h2>
        <Button
          id={editButtonId(section.id)}
          variant={hasError ? 'danger' : 'secondary'}
          size="compact"
          onClick={onEdit}
          disabled={busy}
          aria-label={`${hasError ? 'Completează' : 'Editează'} ${section.title.toLowerCase()}`}
          data-testid={`review-edit-${section.id}`}
          className="shrink-0"
        >
          {/* The pencil only where the card has room: a narrow bento card keeps its title on one line. */}
          <PencilSquareIcon aria-hidden className="hidden size-5 shrink-0 @sm:block" />
          {hasError ? 'Completează' : 'Editează'}
        </Button>
      </div>

      {section.rows.length ? <Rows section={section.id} rows={section.rows} /> : null}
      {section.warning ? <Warning note={section.warning} /> : null}
      {section.tail?.length ? <Rows section={section.id} rows={section.tail} /> : null}
      {section.sectors?.length ? <SectorTiles rows={section.sectors} /> : null}
    </section>
  );
}

function Rows({ section, rows }: { section: string; rows: ReviewRow[] }) {
  return (
    <dl className="flex flex-col gap-3">
      {rows.map((r) => (
        <Row key={r.key} id={rowId(`${section}-${r.key}`)} row={r} />
      ))}
    </dl>
  );
}

/** A long error reads under its label (a phone cannot hold it at the right). */
const STACK_AT = 34;

function Row({ id, row }: { id: string; row: ReviewRow }) {
  const bad = Boolean(row.missing || row.error);
  const stacked = Boolean(row.error && row.error.length > STACK_AT);
  // A problem row takes focus from the error summary (no ring: not a control, owner rule 8).
  const target = bad || row.note?.tone === 'danger';
  return (
    <div
      id={id}
      tabIndex={target ? -1 : undefined}
      className={cn('grid gap-x-4 gap-y-0.5', stacked ? 'grid-cols-1' : 'grid-cols-[auto_minmax(0,1fr)] items-baseline', target && 'outline-none')}
      data-testid={`review-row-${row.key}`}
      data-state={row.missing ? 'missing' : row.error ? 'error' : 'ok'}
    >
      <dt className={cn('t-body', bad ? 't-body-strong text-status-danger-fg' : 'text-muted')}>{row.label}</dt>
      <dd
        className={cn(
          'min-w-0',
          stacked ? 't-caption text-status-danger-fg' : 't-body-strong text-right',
          !stacked && (bad ? 'text-status-danger-fg' : 'text-ink'),
        )}
      >
        {row.missing ? MISSING : row.error ? row.error : row.value === null ? <ValueSkeleton /> : row.value}
      </dd>
      {row.note ? <Note note={row.note} /> : null}
    </div>
  );
}

/** The lake's name on its way (rule 4: a neutral bar, never a guess). */
function ValueSkeleton() {
  return (
    <span aria-hidden className="inline-block h-4 w-28 animate-shimmer rounded-full bg-soft-fill align-middle" data-testid="review-value-loading" />
  );
}

function Note({ note }: { note: ReviewNote }) {
  return (
    <dd className="t-caption col-span-full mt-1 flex items-start gap-1.5 text-status-danger-fg" data-testid="review-note">
      <ExclamationCircleIcon aria-hidden className="mt-px size-4 shrink-0" />
      <span>{note.text}</span>
    </dd>
  );
}

/** fish's amber box under «Sectoare» (c9). */
function Warning({ note }: { note: ReviewNote }) {
  return (
    <p
      className="t-caption flex items-start gap-2 rounded-control bg-status-warning-bg px-3 py-2.5 text-status-warning-fg"
      data-testid="review-capacity-warning"
    >
      <ExclamationTriangleIcon aria-hidden className="mt-px size-4 shrink-0" />
      <span>{note.text}</span>
    </p>
  );
}

/** One tile per sector: its coloured badge, «Sector A», stands and the minimum (c8). */
function SectorTiles({ rows }: { rows: ReviewRow[] }) {
  return (
    <ul aria-label="Sectoare" className="grid grid-cols-1 gap-2 @md:grid-cols-2 @2xl:grid-cols-3">
      {rows.map((r) => (
        <li
          key={r.key}
          data-testid={`review-row-${r.key}`}
          data-state={r.error ? 'error' : 'ok'}
          className={cn('flex items-center gap-3 rounded-control bg-soft-fill px-3 py-2.5', r.error && RING_DANGER)}
        >
          <SectorBadge name={r.sector ?? ''} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="t-body-strong block text-ink">{r.label}</span>
            <span className={cn('t-caption block', r.error ? 'text-status-danger-fg' : 'text-muted')}>{r.error ?? r.value}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
