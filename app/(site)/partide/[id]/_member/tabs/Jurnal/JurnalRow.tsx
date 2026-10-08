'use client';

import { memo, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { FishIcon } from '@/components/icons/brand';
import { SafeImg } from '@/components/partide/session/SafeImg';
import { cn } from '@/components/ui/cn';
import { jurnalRowModel, type JurnalRowModel, type LocalEvent } from '@/core/partide';

/*
 * The one row the Jurnal has (fish features/partide/components/JurnalRow.tsx; parity
 * partide.partida-jurnal.c3).
 *
 * Every event — a 12 kg mirror carp with a photo, a lost fish, an hour with no bite — renders
 * through the same shape, because the register only reads as a register if the numbers line up.
 *  - Below 1280 (fish's row): a lead slot of FIXED width, right-aligned (the weight + «ESTIMAT», or
 *    «SCĂPAT», or «FĂRĂ TRĂSĂTURĂ», or the fish glyph), then the rod pill + species over the meta
 *    line, the 38px photo and the time; a 3px accent at the left edge (the rod's colour, amber for
 *    a scăpat, grey for a fără trăsătură).
 *  - From 1280 (owner rule 14: a timeline with every column visible): Ora · Lansetă · Rezultat ·
 *    Specie · Greutate · Poză, on the columns of <JurnalTableHead>.
 * The whole row is one button (it opens the share dialog). On a live partidă the delete shortcut
 * is fish's long-press: a touch held still, a right-click, or Delete / Backspace on the focused row.
 */

/** fish LEAD_WIDTH (74): the widest of «2,755 kg» and «TRĂSĂTURĂ». */
const LEAD = 'w-[74px]';
const LONG_PRESS_MS = 500;

/**
 * After a touch long-press fired, the finger's lift still ends in a click — and by then a surface
 * (a sheet, a dialog backdrop) sits under the finger, so that ghost click would dismiss it at once.
 * Swallow the one click that follows the lift (capture phase, before anything sees it).
 */
function swallowGhostClick() {
  const stop = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    done();
  };
  const done = () => {
    window.removeEventListener('click', stop, true);
    window.removeEventListener('pointerdown', done, true);
    window.clearTimeout(t);
  };
  // A new touch means no ghost is pending; a lift that produced no click must not eat a later one.
  const t = window.setTimeout(done, 10_000);
  window.addEventListener('click', stop, true);
  window.addEventListener('pointerdown', done, true);
}

/**
 * The ≥1280 columns, shared by the header and every row. Compact, never stretched (owner rule 16):
 * no `fr` track, Specie stops at 280px, so the weight stays beside the species and any spare width
 * is left after the table (the Jurnal gives it to the map panel).
 */
export const JURNAL_COLUMNS = 'xl:grid-cols-[44px_52px_116px_minmax(104px,280px)_76px_36px]';

const BADGE = 'inline-flex items-center justify-center rounded-[3px] px-1 py-1 text-center t-nano tracking-wide uppercase';

function LeadBadge({ kind, twoLines = false }: { kind: 'lost' | 'blank' | 'estimated'; twoLines?: boolean }) {
  if (kind === 'lost') return <span className={cn(BADGE, 'bg-status-warning-bg text-status-warning-fg')}>Scăpat</span>;
  if (kind === 'estimated') return <span className={cn(BADGE, 'bg-accent-tint text-accent-ink')}>Estimat</span>;
  return (
    <span className={cn(BADGE, 'bg-soft-fill text-ink-2')}>
      Fără{twoLines ? <br /> : ' '}trăsătură
    </span>
  );
}

function RodPill({ index, color }: { index: number; color: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-soft-fill px-1.75 py-1 t-nano text-ink-2">
      <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: color }} />L{index}
    </span>
  );
}

function Kg({ weight }: { weight: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
      <span className="t-num-18 text-ink tabular-nums">{weight}</span>
      <span className="t-micro-strong text-muted">kg</span>
    </span>
  );
}

function Thumb({ event, className }: { event: LocalEvent; className: string }) {
  const src = event.photoThumbUrl ?? event.photoUrl ?? event.photoLocalUri;
  if (!src) return null;
  return <SafeImg src={src} className={cn('shrink-0 bg-soft-fill object-cover', className)} fallback={<span aria-hidden className={cn('shrink-0 bg-soft-fill', className)} />} />;
}

/** The row's surface: the accent rule and the ground per lead (fish jurnalRowModel accent / background). */
function surface(m: JurnalRowModel): { className: string; accent?: string } {
  if (m.lead === 'lost') return { className: 'border-l-yellow-5 bg-status-warning-bg/35' };
  if (m.lead === 'blank') return { className: 'border-l-faint bg-page' };
  if (m.rodIndex === null) return { className: 'border-l-hairline bg-surface' };
  return { className: 'bg-surface', accent: m.rodColor };
}

const outcomeLabel = (m: JurnalRowModel) => (m.lead === 'lost' ? 'Scăpat' : m.lead === 'blank' ? 'Fără trăsătură' : 'Captură');

export const JurnalRow = memo(function JurnalRow({
  event,
  pending,
  onOpen,
  onDelete,
}: {
  event: LocalEvent;
  pending: boolean;
  onOpen: (e: LocalEvent) => void;
  /** Live partidă only (fish: no long-press on an ended one). */
  onDelete?: (e: LocalEvent) => void;
}) {
  const m = jurnalRowModel(event);
  const s = surface(m);
  const press = useRef<{ timer: number; fired: boolean } | null>(null);

  const startPress = (e: PointerEvent<HTMLButtonElement>) => {
    press.current = null;
    if (!onDelete || pending || e.pointerType !== 'touch') return;
    const p = { timer: 0, fired: false };
    p.timer = window.setTimeout(() => {
      p.fired = true;
      swallowGhostClick();
      onDelete(event);
    }, LONG_PRESS_MS);
    press.current = p;
  };
  const endPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!onDelete || pending) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDelete(event);
    }
  };

  const label = [m.time, m.rodIndex !== null ? `L${m.rodIndex}` : null, outcomeLabel(m), m.species, m.weight ? `${m.weight} kg` : null, m.estimated ? 'estimat' : null, m.meta || null, m.hasPhoto ? 'cu poză' : null]
    .filter(Boolean)
    .join(', ');

  return (
    <li data-testid="jurnal-row" data-client-id={event.clientId} data-outcome={event.outcome} data-pending={pending || undefined} className="border-b border-hairline last:border-b-0">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={label}
        aria-disabled={pending || undefined}
        aria-keyshortcuts={onDelete ? 'Delete' : undefined}
        onClick={() => {
          if (pending) return;
          if (press.current?.fired) {
            press.current = null;
            return;
          }
          onOpen(event);
        }}
        onContextMenu={e => {
          if (!onDelete || pending) return;
          e.preventDefault();
          endPress();
          if (press.current?.fired) return;
          onDelete(event);
        }}
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onPointerCancel={endPress}
        onKeyDown={onKeyDown}
        style={s.accent ? { borderLeftColor: s.accent } : undefined}
        className={cn(
          'block w-full cursor-pointer border-l-3 text-left transition-[background-color,opacity] duration-(--duration-fast) ease-fast select-none [-webkit-touch-callout:none]',
          'hover:brightness-[0.985] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
          s.className,
          pending && 'cursor-default opacity-45',
        )}
      >
        {/* below 1280 — fish's row */}
        <span className="flex items-center gap-2.25 px-3 py-2.5 md:px-4 xl:hidden">
          <span className={cn(LEAD, 'flex shrink-0 flex-col items-end gap-0.75')}>
            {m.lead === 'weight' && m.weight ? (
              <>
                <Kg weight={m.weight} />
                {m.estimated ? <LeadBadge kind="estimated" /> : null}
              </>
            ) : null}
            {m.lead === 'lost' ? <LeadBadge kind="lost" /> : null}
            {m.lead === 'blank' ? <LeadBadge kind="blank" twoLines /> : null}
            {m.lead === 'glyph' ? <FishIcon aria-hidden className="size-4.75 text-faint opacity-50" /> : null}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.75">
            {m.species ? (
              <>
                <span className="flex min-w-0 items-center gap-1.5">
                  {m.rodIndex !== null ? <RodPill index={m.rodIndex} color={m.rodColor} /> : null}
                  <span className="truncate t-body-strong text-ink">{m.species}</span>
                </span>
                {m.meta ? <span className="truncate t-caption text-muted">{m.meta}</span> : null}
              </>
            ) : (
              <span className="flex min-w-0 items-center gap-1.5">
                {m.rodIndex !== null ? <RodPill index={m.rodIndex} color={m.rodColor} /> : null}
                {m.meta ? <span className="truncate t-caption text-muted">{m.meta}</span> : null}
              </span>
            )}
          </span>
          {m.hasPhoto ? <Thumb event={event} className="size-9.5 rounded-lg" /> : null}
          <span className="shrink-0 t-label text-muted tabular-nums">{m.time}</span>
        </span>

        {/* from 1280 — the timeline's columns (owner rule 14) */}
        <span className={cn('hidden items-center gap-x-3 py-2.5 pr-4 pl-3.25 xl:grid', JURNAL_COLUMNS)}>
          <span className="t-label text-ink-2 tabular-nums">{m.time}</span>
          <span>{m.rodIndex !== null ? <RodPill index={m.rodIndex} color={m.rodColor} /> : <span className="t-caption text-muted">–</span>}</span>
          <span>
            {m.lead === 'lost' ? <LeadBadge kind="lost" /> : m.lead === 'blank' ? <LeadBadge kind="blank" /> : <span className={cn(BADGE, 'bg-accent-tint text-accent-ink')}>Captură</span>}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className={cn('truncate', m.species ? 't-body-strong text-ink' : 't-caption text-muted')}>{m.species ?? (m.meta ? '' : '–')}</span>
            {/* the meta line (lane · distance · bait) may take two lines — never cut mid-word */}
            {m.meta ? <span className="line-clamp-2 t-caption text-muted">{m.meta}</span> : null}
          </span>
          <span className="flex flex-col items-end justify-center gap-0.75">
            {m.lead === 'weight' && m.weight ? (
              <>
                <Kg weight={m.weight} />
                {m.estimated ? <LeadBadge kind="estimated" /> : null}
              </>
            ) : (
              <span className="t-caption text-muted">–</span>
            )}
          </span>
          <span className="flex justify-end">{m.hasPhoto ? <Thumb event={event} className="size-9 rounded-lg" /> : null}</span>
        </span>
      </button>
      {pending ? <PendingDeleteLabel /> : null}
    </li>
  );
});

/** fish PendingDeleteLabel: the list has no curtain to morph, so the row says what is happening. */
function PendingDeleteLabel() {
  return (
    <p role="status" data-testid="jurnal-row-pending" className="flex items-center justify-center gap-1.5 bg-surface py-1.5 t-caption text-muted">
      <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-hairline border-t-muted" />
      Ștergem captura…
    </p>
  );
}

/** The ≥1280 header row: the columns' names on a tinted band (a table that looks like one). */
export function JurnalTableHead() {
  return (
    <div aria-hidden className={cn('hidden gap-x-3 border-b border-hairline bg-soft-fill py-2 pr-4 pl-[calc(--spacing(3.25)_+_3px)] t-micro-strong tracking-wide text-ink-2 uppercase xl:grid', JURNAL_COLUMNS)}>
      <span>Ora</span>
      <span>Lansetă</span>
      <span>Rezultat</span>
      <span>Specie</span>
      <span className="text-right">Greutate</span>
      <span className="text-right">Poză</span>
    </div>
  );
}
