'use client';

import { XMarkIcon } from '@heroicons/react/20/solid';
import type { CompetitionDetail } from '@/core/competitions';
import { sectorFill } from '@/components/ranking/sector';
import { cn } from '@/components/ui/cn';
import { SECTOR_CARD, SECTOR_COLUMNS, SLOT_BOX, SLOT_TRACK } from './layout';
import type { Slots } from './model';

/*
 * The sectors and their slots (organizer.sectors c5–c7; fish configure/sectors: a «Sector X» heading
 * and 50×50 dashed boxes per sector).
 * - Phone: one sector under the other, its slots a wrapping grid of dashed boxes (fish).
 * - From 768: the sectors side by side as columns (more columns as the screen grows, 24 sectors wrap
 *   into rows), each a card with the sector colour as its top edge and the slots stacked in it.
 * A slot is one button: empty («-», dashed) opens the stand picker; filled (the stand, the red ✕
 * badge) empties it — fish empties on the box and on the badge alike. Disabled (inert) when the
 * competition has started or while a save runs.
 */

type Props = {
  sectors: CompetitionDetail['sectors'];
  slots: Slots;
  names: Map<string, string>;
  palette: Map<string, { color: string; letter: string | null }>;
  editable: boolean;
  busy: boolean;
  onOpen: (sectorId: string, index: number) => void;
  onClear: (sectorId: string, index: number) => void;
};

export function SlotGrid({ sectors, slots, names, palette, editable, busy, onOpen, onClear }: Props) {
  return (
    <div className={SECTOR_COLUMNS} data-testid="sector-columns">
      {sectors.map((sector) => {
        const sectorSlots = slots[sector.documentId] ?? [];
        const filled = sectorSlots.filter(Boolean).length;
        const tone = palette.get(sector.documentId);
        const fill = sectorFill(tone?.letter ?? '', tone?.color ?? 'var(--color-muted)');
        const headingId = `sector-${sector.documentId}`;
        return (
          <section key={sector.documentId} aria-labelledby={headingId} className={SECTOR_CARD} data-testid={`sector-${sector.name}`}>
            {/* The sector colour: a dot on the phone, the column's top edge from 768. */}
            <span aria-hidden className={cn('-mx-3 hidden h-1 md:block', fill.className)} style={fill.style} />
            <div className="flex items-center gap-2">
              <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full md:hidden', fill.className)} style={fill.style} />
              <h2 id={headingId} className={cn('t-title2 md:t-heading', editable ? 'text-ink' : 'text-ink-2')}>
                Sector {sector.name}
              </h2>
              <span className="t-caption ml-auto text-muted tabular-nums">
                {filled}/{sectorSlots.length}
                <span className="sr-only"> locuri ocupate</span>
              </span>
            </div>
            <ul className={SLOT_TRACK}>
              {sectorSlots.map((standId, index) => (
                <li key={index}>
                  <Slot
                    sectorName={sector.name}
                    index={index}
                    label={standId ? (names.get(standId) ?? '-') : null}
                    editable={editable}
                    busy={busy}
                    onActivate={() => (standId ? onClear(sector.documentId, index) : onOpen(sector.documentId, index))}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Slot({
  sectorName,
  index,
  label,
  editable,
  busy,
  onActivate,
}: {
  sectorName: string;
  index: number;
  label: string | null;
  editable: boolean;
  busy: boolean;
  onActivate: () => void;
}) {
  const filled = label !== null;
  const where = `Sector ${sectorName}, locul ${index + 1}`;
  const name = filled
    ? `${where}: standul ${label}${editable ? '. Golește locul' : ''}`
    : `${where}: liber${editable ? '. Alege standul' : ''}`;
  return (
    <button
      type="button"
      onClick={onActivate}
      disabled={!editable || busy}
      aria-label={name}
      aria-haspopup={!filled && editable ? 'dialog' : undefined}
      data-testid={`slot-${sectorName}-${index + 1}`}
      data-filled={filled || undefined}
      className={cn(
        'group relative flex w-full items-center justify-center rounded-control border-2 border-dashed px-2',
        SLOT_BOX,
        'transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        filled ? 'border-accent bg-accent-tint text-ink' : 'border-faint bg-surface text-muted',
        editable && !busy && (filled ? 'hover:bg-accent-tint-2' : 'hover:border-accent hover:bg-soft-fill'),
        !editable && 'cursor-default border-faint bg-soft-fill text-ink-2',
        busy && 'cursor-progress',
      )}
    >
      <span className={cn('min-w-0 truncate tabular-nums', filled ? 't-body-strong' : 't-body')}>{label ?? '-'}</span>
      {filled && editable ? (
        <span
          aria-hidden
          className={cn(
            'absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-status-danger-fg text-surface shadow-e0',
            busy && 'opacity-60',
          )}
        >
          <XMarkIcon className="size-3.5" />
        </span>
      ) : null}
    </button>
  );
}
