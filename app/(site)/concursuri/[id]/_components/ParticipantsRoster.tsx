'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { registrationDisplayName, registrationTeamSubtitle, type DetailRegistration } from '@/core/competitions';
import { formatWeight } from '@/components/ranking';
import { sectorFill } from '@/components/ranking/sector';
import { Avatar, FaceStack } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { echoes } from './names';
import { isGuest, type Group, type StatsAccess } from './participantParts';
import { photo } from './brokenImages';
import { Bone } from './tabParts';

/*
 * Participanți from 768 — owner rule 18: a designed roster, as a club's squad page lists its
 * players, not a grid of numbered boxes. Each sector is one surface with the sector's colour as its
 * accent (the 4px stripe across the top and the dot by its name — Fundații: a sector colour is never
 * under text). Inside, one entry per registration: the stand as a leading squad number (with the
 * sector's dot when the list is not grouped), the face (a team: its faces, a pair overlapping), the
 * name, the club or the team's members, and the headline stats inline under the name when signed
 * in, on one line («12 capturi  CMMC 8,4 kg  23 conc.»; a team: its catches and its biggest catch).
 * Signed out the layout is the same without the stats (the list says once above, quietly, why). A
 * registration typed in by the organizer carries «Adăugat manual» in a mixed list.
 *
 * Owner rule 16: an entry never stretches. Up to 1279 the entries share the row (auto-fill, 288px
 * at least: two to three per row); from 1280 each is at most 384px and the surface is only as wide
 * as its entries (`--roster-basis`: the columns it needs, balanced so a last row is never one lone
 * entry under a full one — 5 entries where 4 fit read 3 + 2), and sectors flow side by side
 * (flex-wrap), so a two-entry sector is not a full-width white band; the rest of the line is margin.
 * With two sectors or more, a sector is capped so that two share a line where two of 2+ columns fit
 * (colsCap): at 1920 the feeder's sectors of 5 are 2 columns (3 + 2), two per line.
 *
 * Pressing an entry opens the person's popover anchored to it (owner rule 17, PersonPopover) — only
 * from 1024 (`onOpen` set). From 768 to 1023 the entry already shows everything the popover would
 * (face, name, club, stand, stats inline; the profile is not on the web yet), so it is a plain row,
 * not a control; it becomes a link to the profile the moment anglerHref has one.
 */

/** A registration's stand as the page names it («12», NC «A3(12)»); null: not allocated. */
export type StandText = (r: DetailRegistration) => string | null;

type EntryProps = {
  team: boolean;
  stats: StatsAccess;
  broken: ReadonlySet<string>;
  mixed: boolean;
  standText: StandText;
  sectorOf: (r: DetailRegistration) => string | null;
  /** The registration whose popover is open (aria-expanded). */
  openId: string | null;
  /** ≥1024: an entry opens the person popover; null below (a plain row). */
  onOpen: ((registrationId: string, anchor: HTMLElement, standLabel: string | null) => void) | null;
};

/** Up to 1279 the entries share the row; from 1280 capped at 384px, from the left (owner rule 16). */
const ENTRY_GRID = cn(
  'grid grid-cols-[repeat(auto-fill,minmax(--spacing(72),1fr))] gap-x-2 gap-y-1',
  'xl:grid-cols-[repeat(auto-fill,minmax(--spacing(80),--spacing(96)))] xl:justify-start',
);
/** From 1280: an entry's widest (spacing 96), the gap between two (spacing 2), the list's padding (spacing 2 a side), in px. */
const ENTRY_PX = 384;
const GAP_PX = 8;
const PAD_PX = 16;
/** The surface's width for `cols` entries a row (px). */
const basisFor = (cols: number) => cols * ENTRY_PX + (cols - 1) * GAP_PX + PAD_PX;

/**
 * The columns a sector of `n` entries takes when `max` fit on a line: as few rows as possible, the
 * entries spread evenly over them (5 where 4 fit: 3 + 2, never 4 + 1).
 */
function balancedCols(n: number, max: number): number {
  const cols = Math.max(1, Math.min(n, max));
  return Math.ceil(n / Math.ceil(n / cols));
}

/** The flex gap between two sectors on a line (gap-4), in px. */
const ROW_GAP_PX = 16;

/**
 * The most columns a sector may take: what fits the roster's width, except in a grouped roster,
 * where two sectors share a line whenever two of at least two columns each fit side by side (1920:
 * sectors of 5 read 3 + 2 at 2 columns, two per line, instead of one 3-column sector a line with
 * the rest of it empty). A sector smaller than that is unchanged.
 */
function colsCap(width: number | null, groups: number): number {
  if (width == null) return 3; // Until measured (the server render, hydration): what fits 1280–1919.
  const fit = Math.max(1, Math.floor((width - PAD_PX + GAP_PX) / (ENTRY_PX + GAP_PX)));
  if (groups < 2) return fit;
  // The columns `c` of two surfaces side by side with the gap between them: 2 × basisFor(c) + ROW_GAP_PX ≤ width.
  const c = Math.floor((width - ROW_GAP_PX - 2 * PAD_PX + 2 * GAP_PX) / (2 * (ENTRY_PX + GAP_PX)));
  return c >= 2 ? Math.min(fit, c) : fit;
}

/** The roster's width (null until measured). */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setWidth(el.clientWidth);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function ParticipantsRoster({ groups, ...entry }: { groups: Group[] } & EntryProps) {
  const [ref, width] = useWidth();
  const maxCols = colsCap(width, groups.length);
  return (
    <div ref={ref} data-participants="roster" className="flex flex-col gap-4 xl:flex-row xl:flex-wrap xl:items-start">
      {groups.map(group => (
        <section
          key={group.key}
          aria-labelledby={group.title ? `roster-${group.key}` : undefined}
          aria-label={group.title ? undefined : 'Toți participanții'}
          style={{ '--roster-basis': `${basisFor(balancedCols(group.registrations.length, maxCols))}px` } as CSSProperties}
          className="min-w-0 overflow-hidden rounded-card bg-surface shadow-e0 xl:max-w-full xl:flex-[0_1_var(--roster-basis)]"
        >
          <SectorStripe sector={group.sector} />
          {group.title ? (
            <header className="flex items-baseline gap-2 px-4 pt-4 pb-1">
              <h3 id={`roster-${group.key}`} className="flex items-center gap-2 t-heading text-ink">
                {group.sector ? <SectorDot name={group.sector} /> : null}
                {group.title}
              </h3>
              <span className="t-caption text-muted tabular-nums">
                {group.registrations.length === 1 ? '1 înscriere' : `${group.registrations.length} înscrieri`}
              </span>
            </header>
          ) : null}
          <ul className={cn(ENTRY_GRID, 'p-2')}>
            {group.registrations.map(r => (
              <li key={r.documentId} className="min-w-0">
                <RosterEntry registration={r} grouped={!!group.title && !!group.sector} {...entry} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function SectorStripe({ sector }: { sector: string | null }) {
  if (!sector) return <span aria-hidden className="block h-1 bg-accent-tint" />;
  const fill = sectorFill(sector, 'var(--color-accent)');
  return <span aria-hidden className={cn('block h-1', fill.className)} style={fill.style} />;
}

function SectorDot({ name }: { name: string }) {
  const fill = sectorFill(name, 'var(--color-accent)');
  return <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', fill.className)} style={fill.style} />;
}

function RosterEntry({
  registration: r,
  grouped,
  team,
  stats,
  broken,
  mixed,
  standText,
  sectorOf,
  openId,
  onOpen,
}: EntryProps & { registration: DetailRegistration; grouped: boolean }) {
  const type = team ? 'team' : 'single';
  const name = registrationDisplayName(r, type);
  const rawSubtitle = registrationTeamSubtitle(r, type);
  const members = team && rawSubtitle && !echoes(rawSubtitle, name) ? rawSubtitle : null;
  const club = r.club?.name ?? null;
  const guest = isGuest(r);
  const stand = standText(r);
  const sector = sectorOf(r);
  const open = openId === r.documentId;
  const body = (
    <>
      <Face registration={r} team={team} name={name} broken={broken} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate t-body-strong text-ink">{name}</span>
        {members ? <span className="truncate t-caption text-ink-2">{members}</span> : null}
        {club && club !== name ? <span className="truncate t-caption text-muted">{club}</span> : null}
        {guest ? mixed ? <span className="t-caption text-muted">Adăugat manual</span> : null : <InlineStats registration={r} stats={stats} team={team} />}
      </span>
      {/* Read after the name (the entry is named by its person), drawn first. */}
      <StandNumber stand={stand} sector={grouped ? null : sector} />
    </>
  );
  const ROW = 'flex w-full items-center gap-3 rounded-control p-2.5 text-left';
  if (!onOpen) return <div className={ROW}>{body}</div>;
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={e => onOpen(r.documentId, e.currentTarget, stand)}
      className={cn(
        ROW,
        'group cursor-pointer transition-colors duration-(--duration-fast)',
        'hover:bg-soft-fill focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent',
        open && 'bg-accent-tint hover:bg-accent-tint',
      )}
    >
      {body}
    </button>
  );
}

/**
 * The stand as a leading squad number: «Stand» small above, the number big, in a fixed slot so the
 * faces of a column line up (NC «A3(12)» widens it); «Nealocat» in the danger pair when none.
 */
function StandNumber({ stand, sector }: { stand: string | null; sector: string | null }) {
  if (!stand) {
    return (
      <span className="order-first flex w-12 shrink-0 justify-center">
        <span className="rounded-badge bg-status-danger-bg px-1 py-0.5 t-micro-strong text-status-danger-fg">Nealocat</span>
      </span>
    );
  }
  return (
    <span data-stand={stand} className="order-first flex min-w-12 shrink-0 flex-col items-center">
      <span className="t-micro text-muted">Stand</span>
      <span className="flex items-center gap-1 t-num-18 whitespace-nowrap text-ink-2 group-hover:text-ink">
        {sector ? <SectorDot name={sector} /> : null}
        {stand}
      </span>
    </span>
  );
}

function Face({ registration: r, team, name, broken }: { registration: DetailRegistration; team: boolean; name: string; broken: ReadonlySet<string> }) {
  if (r.participants.length === 0) return <Avatar name={r.guestName || name} size={48} tone="neutral" shape={team ? 'square' : 'round'} />;
  if (team && r.participants.length > 1) {
    // A pair of faces (fish's stack, two shown, «+N» for the rest) in a fixed slot: names start on one line.
    const people = r.participants.map(p => ({ name: p.username, src: photo(p.avatar?.url, broken) }));
    return (
      <span className="flex w-18 shrink-0 items-center">
        <FaceStack size={40} people={people.slice(0, 2)} overflow={Math.max(0, people.length - 2)} />
      </span>
    );
  }
  const p = r.participants[0];
  return <Avatar name={p.username} src={photo(p.avatar?.url, broken)} size={48} />;
}

/**
 * «12 capturi  CMMC 8,4 kg  23 conc.» — the numbers in ink, the words and units muted (rule 10).
 * Real text (read as «12 capturi, CMMC 8,4 kg, 23 concursuri»): the separators and the full word
 * for «conc.» are sr-only, the short form is the one visible form whatever the count.
 */
function InlineStats({ registration: r, stats, team }: { registration: DetailRegistration; stats: StatsAccess; team: boolean }) {
  if (stats.kind === 'signIn' || stats.kind === 'failed') return null;
  if (stats.kind === 'pending') return <Bone className="w-40 t-caption" />;
  const all = r.participants.map(p => stats.map[p.documentId]);
  const catches = all.reduce((a, s) => a + (s?.catches ?? 0), 0);
  const biggest = all.reduce<number | null>((a, s) => (s?.biggestCatchKg == null ? a : a == null ? s.biggestCatchKg : Math.max(a, s.biggestCatchKg)), null);
  const competitions = team ? null : (all[0]?.competitions ?? 0);
  return (
    // One line, every entry the same height: short labels; past the width the line is cut, never wrapped.
    <span className="flex items-baseline gap-x-2.5 overflow-hidden t-caption whitespace-nowrap text-muted">
      <span className="whitespace-nowrap">
        <span className="t-label text-ink tabular-nums">{catches}</span> {catches === 1 ? 'captură' : 'capturi'}
        <span className="sr-only">,</span>
      </span>
      <span className="whitespace-nowrap">
        CMMC{' '}
        {biggest == null ? (
          <>
            <span aria-hidden className="t-label text-ink">
              –
            </span>
            <span className="sr-only">necunoscut</span>
          </>
        ) : (
          <>
            <span className="t-label text-ink tabular-nums">{formatWeight(biggest)}</span> <span className="t-micro">kg</span>
          </>
        )}
        {competitions == null ? null : <span className="sr-only">,</span>}
      </span>
      {competitions == null ? null : (
        <span className="whitespace-nowrap">
          <span className="t-label text-ink tabular-nums">{competitions}</span> <span aria-hidden>conc.</span>
          <span className="sr-only">{competitions === 1 ? 'concurs' : 'concursuri'}</span>
        </span>
      )}
    </span>
  );
}

/** The roster's bones: one sector surface, its stripe, a header and eight entries. */
export function ParticipantsRosterBones() {
  return (
    <span aria-hidden data-bone="roster" className="block overflow-hidden rounded-card bg-surface shadow-e0">
      <span className="block h-1 bg-soft-fill" />
      <span className="block px-4 pt-4 pb-1">
        <Bone className="w-28 t-heading" />
      </span>
      <span className={cn(ENTRY_GRID, 'p-2')}>
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="flex items-center gap-3 p-2.5">
            <Bone className="w-12 t-num-18" />
            <span className="size-12 shrink-0 animate-shimmer rounded-full" />
            <span className="flex min-w-0 flex-1 flex-col">
              <Bone className="w-32 t-body-strong" />
              <Bone className="w-40 t-caption" />
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}
