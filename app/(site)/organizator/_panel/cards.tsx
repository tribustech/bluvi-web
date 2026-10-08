'use client';

import Image from 'next/image';
import Link from 'next/link';
import { CalendarDaysIcon, ChevronRightIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { MapPinIcon, PencilIcon } from '@heroicons/react/20/solid';
import { CardShell, CardTitle } from '@/components/cards/CardShell';
import { Eyebrow, Pill, Tag } from '@/components/cards/parts';
import { cn } from '@/components/ui/cn';
import type { DraftCompetition } from '@/core/organizer';
import { routes } from '@/lib/routes';
import { canCancel, cardBadges, cardImage, cardParticipants, cardStatus, dateRangeLabel, draftDate, draftImage, draftStep, editEntry } from './model';

/*
 * The panel's two cards (organizer.panel c17–c22, organizer.b.card-edit-entry): fish
 * MiniatureDraftCard for the Ciorne tab, fish CompetitionCard (compact) for the rest. Each is ONE
 * stretched link (the kit CardTitle); its actions (delete, cancel, «Modifică») are buttons above
 * the link (z-above), on the photo's top-right corner as in fish.
 */

const PHOTO = 'relative h-25 shrink-0 overflow-hidden bg-soft-fill md:h-30';
/** The round action on a photo (fish: white 90% disc, red trash), 40px with a 44px hit area. */
const PHOTO_ACTION = cn(
  'relative z-above flex size-10 cursor-pointer items-center justify-center rounded-full bg-photo-chip text-status-danger-fg shadow-e1',
  'before:absolute before:-inset-0.5 before:content-[""]',
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
  'aria-disabled:cursor-not-allowed aria-disabled:opacity-60',
);
/** The «Modifică» chip on the photo: the kit's light photo chip with a pencil. */
const PHOTO_CHIP = cn(
  'relative z-above flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-photo-chip px-3 t-label text-ink shadow-e1',
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
);
const CARD_STATES = 'overflow-visible has-[a:active]:opacity-70';

function Spinner({ className }: { className?: string }) {
  return <span aria-hidden className={cn('size-4.5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none', className)} />;
}

/** c17–c20 — a draft: its banner (or the indigo placeholder), name, lake, start date and «Pas N/5». */
export function DraftCard({ draft, deleting, onDelete }: { draft: DraftCompetition; deleting: boolean; onDelete: () => void }) {
  const img = draftImage(draft);
  const date = draftDate(draft.startDate);
  return (
    <CardShell interactive className={cn('h-full', CARD_STATES)} label={draft.name}>
      <div className={cn(PHOTO, 'rounded-t-card')}>
        {img ? (
          <Image src={img} alt="" fill sizes="(min-width: 768px) 260px, 50vw" className="object-cover" />
        ) : (
          // fish: the indigo gradient with a pencil and «Ciornă».
          <div data-testid="draft-placeholder" className="flex h-full flex-col items-center justify-center gap-1 bg-linear-135 from-bento-indigo-2 to-accent-tint-3">
            <PencilIcon aria-hidden className="size-5 text-on-bento-indigo-2" />
            <span className="t-label text-on-bento-indigo">Ciornă</span>
          </div>
        )}
        <div className="absolute top-2 right-2 flex">
          <button
            type="button"
            aria-label={deleting ? `Se șterge ciorna ${draft.name}` : `Șterge ciorna ${draft.name}`}
            aria-disabled={deleting || undefined}
            aria-busy={deleting || undefined}
            data-testid="delete-draft"
            onClick={() => {
              if (!deleting) onDelete();
            }}
            className={PHOTO_ACTION}
          >
            {deleting ? <Spinner /> : <TrashIcon aria-hidden className="size-4.5" />}
          </button>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <CardTitle
          href={routes.organizerCompetitionNew('detalii', { ciorna: draft.documentId, inapoi: routes.organizer() })}
          className="t-heading line-clamp-2 text-ink"
        >
          {draft.name}
        </CardTitle>
        {draft.lake?.name ? (
          <p className="flex min-w-0 items-center gap-1 t-label text-ink-2">
            <MapPinIcon aria-hidden className="size-3 shrink-0 text-muted" />
            <span className="truncate">{draft.lake.name}</span>
          </p>
        ) : null}
        {date ? (
          <p className="flex min-w-0 items-center gap-1 t-label text-ink-2">
            <CalendarDaysIcon aria-hidden className="size-3 shrink-0 text-muted" />
            <span className="truncate">{date}</span>
          </p>
        ) : null}
        <p className="mt-auto flex items-center gap-1 pt-1 t-micro-strong text-accent-ink">
          {draftStep(draft)}
          <ChevronRightIcon aria-hidden className="size-3" />
        </p>
      </div>
    </CardShell>
  );
}

/**
 * c21 / c22 / b.card-edit-entry — a published competition: fish's compact CompetitionCard (photo,
 * date, name on two lines, lake, registered / limit, pending while notStarted, type + ranking
 * badges). notStarted adds the red cancel button (a spinner while its cancel runs) and «Modifică»
 * (the edit wizard, returning here); started adds «Modifică» (the cannot-edit notice).
 */
export function CompetitionTile({
  competition: c,
  cancelling,
  onCancel,
  onCannotEdit,
}: {
  competition: DraftCompetition;
  cancelling: boolean;
  onCancel: () => void;
  onCannotEdit: () => void;
}) {
  const img = cardImage(c);
  const status = cardStatus(c.competitionStatus);
  const dates = dateRangeLabel(c.startDate, c.endDate);
  const people = cardParticipants(c);
  const edit = editEntry(c.competitionStatus);
  return (
    <CardShell interactive className={cn('h-full', CARD_STATES)} label={c.name}>
      <div className={cn(PHOTO, 'rounded-t-card')}>
        {img ? <Image src={img} alt="" fill sizes="(min-width: 768px) 260px, 50vw" className="object-cover" /> : null}
        <div className="absolute top-2 left-2 flex">
          {status?.live ? <Pill tone="live">LIVE</Pill> : status ? <Pill tone={status.tone}>{status.label}</Pill> : null}
        </div>
        <div className="absolute top-2 right-2 flex gap-1.5">
          {edit === 'wizard' ? (
            <Link
              href={routes.competitionEdit(c.documentId, 'detalii', { inapoi: routes.organizer() })}
              className={PHOTO_CHIP}
              aria-label={`Modifică ${c.name}`}
            >
              <PencilSquareIcon aria-hidden className="size-4" />
              <span className="max-md:sr-only">Modifică</span>
            </Link>
          ) : edit === 'notice' ? (
            <button type="button" onClick={onCannotEdit} className={PHOTO_CHIP} aria-label={`Modifică ${c.name}`}>
              <PencilSquareIcon aria-hidden className="size-4" />
              <span className="max-md:sr-only">Modifică</span>
            </button>
          ) : null}
          {canCancel(c.competitionStatus) ? (
            <button
              type="button"
              aria-label={cancelling ? `Se anulează ${c.name}` : `Anulează ${c.name}`}
              aria-disabled={cancelling || undefined}
              aria-busy={cancelling || undefined}
              data-testid="cancel-competition"
              onClick={() => {
                if (!cancelling) onCancel();
              }}
              className={PHOTO_ACTION}
            >
              {cancelling ? <Spinner /> : <TrashIcon aria-hidden className="size-4.5" />}
            </button>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        {dates ? <Eyebrow>{dates}</Eyebrow> : null}
        <CardTitle href={routes.competition(c.documentId)} className="t-heading line-clamp-2 min-h-[2lh] text-ink">
          {c.name}
        </CardTitle>
        {c.lake?.name ? (
          <p className="flex min-w-0 items-center gap-1 t-label text-accent-ink">
            <MapPinIcon aria-hidden className="size-3 shrink-0 text-accent" />
            <span className="truncate">{c.lake.name}</span>
          </p>
        ) : null}
        <div className="mt-auto flex flex-col gap-1.5 pt-1">
          <div className="h-px bg-hairline" />
          <p className="t-label text-accent-ink">{people.line}</p>
          {people.pending ? <p className="t-label text-status-pending-fg">{people.pending}</p> : null}
          <div className="flex flex-wrap gap-1">
            {cardBadges(c).map((b) => (
              <Tag key={b.label} tone={b.tone}>
                {b.label}
              </Tag>
            ))}
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/** c16 — one card's bones (the first page loading). */
export function CardSkeleton() {
  return (
    <li aria-hidden className="list-none">
      <CardShell className="h-full">
        <span className={cn(PHOTO, 'block animate-shimmer')} />
        <span className="flex flex-col gap-2 p-3">
          <span className="h-2.5 w-20 rounded-full bg-soft-fill" />
          <span className="h-4 w-4/5 rounded-full bg-soft-fill" />
          <span className="h-3 w-2/5 rounded-full bg-soft-fill" />
          <span className="h-5 w-28 rounded-badge bg-soft-fill" />
        </span>
      </CardShell>
    </li>
  );
}
