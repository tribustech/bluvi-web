'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react';
import {
  ArrowRightIcon,
  ChartBarIcon,
  ChevronDownIcon,
  FlagIcon,
  MapIcon,
  Squares2X2Icon,
  TrophyIcon,
  UserGroupIcon,
} from '@heroicons/react/20/solid';
import { FishIcon, ScaleIcon } from '@/components/icons/brand';
import { sectorFill } from '@/components/ranking/sector';
import { Avatar } from '@/components/ui/Avatar';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { InlineNumber } from '@/components/ui/SignatureNumber';
import { StatusPill } from '@/components/ui/StatusPill';
import { type CompetitionCard } from '@/core/competitions';
import type { Transport } from '@/core/transport';
import { routes } from '@/lib/routes';
import { blur, Chips, posterOf } from '../cards/parts';
import type { DesktopViewer } from '../desktop/data';
import { dayParts } from '../desktop/dates';
import { valueText } from '../desktop/model';
import {
  entrantsLine,
  resultGroups,
  resultView,
  rowHeadline,
  typeStats,
  unitWord,
  type Entry,
  type ResultView,
  type RowHeadline,
  type Tile,
  type TileIcon,
} from './model';
import { Podium } from './Podium';
import { useResultReads, type ResultRead } from './reads';
import s from './results.module.css';

/*
 * Rezultate (/concursuri/rezultate) — the approved prototype (app/dev/hub/Results.tsx) on real data,
 * at every width: rows grouped by the day the competition ended. A row names the winner and the ONE
 * figure its ranking type is judged by (core resultHeadline: «Total 52,8 kg», «Medie Best 5»,
 * «3 puncte»); before the ranking is read that slot reads its label and «–» (opening fills it,
 * never swaps it); the card's heaviest fish is its own «CMMC» chip. The viewer's competitions say
 * «Înscris» closed (the «Ale mele» list), «Locul tău: N» once the ranking is read.
 * Opened (one at a time; click / Enter / Space), the row reads its ranking and shows the SVG podium
 * (angler photos, a team's faces, a club's podium for NC / FIPSed), the tiles of that ranking type,
 * places 4–8 (no no-catch rows), «Locul tău» and «Vezi clasamentul complet». ↑/↓ move between rows
 * (roving tab stop), Home / End jump. On the phone the opened row is a full-width panel.
 */

/** fish CardShell elevated: radius 16, e1 + hairline. */
const CARD = 'rounded-card bg-surface shadow-[var(--shadow-e1),var(--shadow-e0)]';

const noop = () => () => {};
/** Today in Bucharest — browser only (the page is prerendered): null on the server and at hydration. */
const useToday = () =>
  useSyncExternalStore(
    noop,
    () => dayParts(new Date()).index,
    () => null,
  );

export function ResultsList({
  cards,
  t,
  viewer,
  isAuthenticated,
  labelledBy,
}: {
  cards: CompetitionCard[];
  t: Transport;
  viewer: DesktopViewer;
  isAuthenticated: boolean;
  labelledBy: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  // Every row opened once keeps its ranking (so it never re-hides while closing).
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const { reads, entered } = useResultReads(t, cards, viewer, isAuthenticated, opened);
  const groups = resultGroups(cards, useToday());

  // Keyboard order = reading order (the groups, latest day first).
  const order = groups.flatMap((g) => g.cards.map((c) => c.documentId));
  // The roving tab stop: the focused row while it is still in the list, else the first row — a
  // refetch that drops it never leaves the list without a tab stop.
  const current = focusId && order.includes(focusId) ? focusId : (order[0] ?? null);

  const toggle = useCallback((id: string) => {
    setFocusId(id);
    setOpened((o) => (o.has(id) ? o : new Set(o).add(id)));
    setOpen((o) => (o === id ? null : id));
  }, []);

  const move = (e: KeyboardEvent<HTMLButtonElement>, id: string) => {
    const i = order.indexOf(id);
    const to =
      e.key === 'ArrowDown' ? order[Math.min(order.length - 1, i + 1)] : e.key === 'ArrowUp' ? order[Math.max(0, i - 1)] : e.key === 'Home' ? order[0] : e.key === 'End' ? order.at(-1) : null;
    if (!to) return;
    e.preventDefault();
    setFocusId(to);
    refs.current.get(to)?.focus();
  };

  return (
    <div data-results-list className="flex flex-col gap-8 xl:gap-10" aria-labelledby={labelledBy} role="group">
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`rezultate-${g.key}`} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <h3 id={`rezultate-${g.key}`} className="flex items-baseline gap-2 t-title2 text-ink">
              {g.label}
              <span className="t-label text-muted tabular-nums">
                <span className="sr-only">, </span>
                {g.cards.length}
                <span className="sr-only"> {g.cards.length === 1 ? 'concurs' : 'concursuri'}</span>
              </span>
            </h3>
            {g.date ? <span className="t-caption text-muted">{g.date}</span> : null}
          </div>
          <ul className="flex flex-col gap-2">
            {g.cards.map((c) => (
              <ResultRow
                key={c.documentId}
                card={c}
                read={reads[c.documentId] ?? { state: 'none' }}
                entered={entered.has(c.documentId)}
                open={open === c.documentId}
                tabbable={current === c.documentId}
                onToggle={toggle}
                onKey={move}
                buttonRef={(el) => {
                  if (el) refs.current.set(c.documentId, el);
                  else refs.current.delete(c.documentId);
                }}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- the row */

function ResultRow({
  card: c,
  read,
  entered,
  open,
  tabbable,
  onToggle,
  onKey,
  buttonRef,
}: {
  card: CompetitionCard;
  read: ResultRead;
  entered: boolean;
  open: boolean;
  tabbable: boolean;
  onToggle: (id: string) => void;
  onKey: (e: KeyboardEvent<HTMLButtonElement>, id: string) => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
}) {
  const ready = read.state === 'ready' ? read : null;
  const view = resultView(c, ready?.ranking ?? null);
  const h = rowHeadline(c, ready?.ranking ?? null, ready?.raw ?? null, view);
  const mine = ready?.mine ?? null;
  const loading = read.state === 'pending';
  const { media, thumb } = posterOf(c);
  const id = c.documentId;
  const panelId = `rezultate-panel-${id}`;
  // Keep the panel mounted after the first open, so closing animates too.
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  const warned = useRef(false);
  useEffect(() => {
    if (!view.disagrees || warned.current) return;
    warned.current = true;
    const named = view.podium[0]?.name;
    console.warn(`[rezultate] ${id}: the ranking's first is not the card's winner («${named}»); showing the card's podium.`);
  }, [view.disagrees, view.podium, id]);

  const grid =
    'grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 p-3 text-start md:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1fr)_minmax(150px,auto)_auto] md:gap-x-5 md:px-4';
  return (
    <li
      data-result-row={id}
      className={cn(CARD, 'overflow-hidden', open ? 'shadow-e2 max-md:-mx-4 max-md:rounded-none' : s.lift)}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-labelledby={`rezultate-name-${id}`}
        aria-describedby={`rezultate-sum-${id}`}
        tabIndex={tabbable ? 0 : -1}
        onClick={() => onToggle(id)}
        onKeyDown={(e) => onKey(e, id)}
        className={cn(grid, 'cursor-pointer outline-none hover:bg-soft-fill focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent')}
      >
        <span className="relative row-span-2 block size-12 shrink-0 overflow-hidden rounded-avatar bg-soft-fill md:row-span-1">
          {thumb ? <Image src={thumb} alt="" fill sizes="48px" className="object-cover" {...blur(media)} /> : null}
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span id={`rezultate-name-${id}`} className="truncate t-body-strong text-ink">
            {c.name}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate t-label text-accent-ink">{[c.lake?.name, c.dateLabel].filter(Boolean).join(' · ')}</span>
            <span className="hidden min-w-0 shrink gap-1.5 md:inline-flex">
              <Chips c={c} />
              {h.cmmcKg != null ? <Cmmc kg={h.cmmcKg} /> : null}
            </span>
            {mine ? (
              <StatusPill tone="info" className="shrink-0">
                Locul tău: {mine.position}
              </StatusPill>
            ) : entered ? (
              <StatusPill tone="info" className="shrink-0">
                Înscris
              </StatusPill>
            ) : null}
          </span>
        </span>

        {/* Winner + the headline figure (phone: one line under the name). */}
        <span id={`rezultate-sum-${id}`} className="contents">
          <span className="col-span-2 col-start-2 flex min-w-0 items-center gap-2 md:col-span-1 md:col-start-auto">
            {h.winner ? (
              <>
                <span className="relative shrink-0">
                  <Avatar name={h.winner.name} src={h.winner.faces[0]} size={32} shape={h.winner.club ? 'square' : 'round'} />
                  <span className="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full bg-medal-gold text-on-medal ring-2 ring-surface">
                    <TrophyIcon className="size-2.5" aria-hidden />
                  </span>
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="hidden t-micro text-muted md:block">{h.winnerLabel}</span>
                  <span className="truncate t-label text-ink md:t-body-strong">
                    <span className="sr-only md:hidden">{h.winnerLabel}: </span>
                    {h.winner.name}
                  </span>
                  <PhoneFigure h={h} loading={loading} />
                </span>
              </>
            ) : c.results?.hasCatches === false ? (
              <span className="t-label text-muted">Fără capturi</span>
            ) : (
              // Nobody to name yet (no card podium, or results unavailable): no claim either way.
              <span className="flex min-w-0 flex-col">
                <span className="truncate t-label text-muted">
                  {h.winnerLabel}: <Dash loading={loading} />
                </span>
                <PhoneFigure h={h} loading={loading} />
              </span>
            )}
          </span>
          <span className="hidden flex-col items-end md:flex">
            {h.figure ? (
              <>
                <span className="t-micro text-muted">{h.figure.label}</span>
                {h.figure.value != null ? (
                  <span className="t-num-26 text-ink">
                    {valueText(h.figure.value, h.figure.unit)}{' '}
                    <span className="t-body-strong tracking-normal text-muted">{unitWord(h.figure.unit, h.figure.value)}</span>
                  </span>
                ) : (
                  <span className="flex h-8 items-center t-num-26 text-muted">
                    <Dash loading={loading} />
                  </span>
                )}
              </>
            ) : null}
          </span>
        </span>
        <span aria-hidden className="row-start-1 grid size-8 place-items-center rounded-full bg-soft-fill text-ink-2 md:row-start-auto" style={{ gridColumnEnd: -1 }}>
          <ChevronDownIcon className={cn('size-5', s.chevron)} data-open={open} />
        </span>
      </button>
      <div id={panelId} role="region" aria-label={`Rezultate ${c.name}`} className={s.collapse} data-open={open} inert={!open}>
        <div>{mounted ? <Expanded card={c} read={read} view={view} /> : null}</div>
      </div>
    </li>
  );
}

/** «–» until the ranking is read (a bone while it loads); screen readers hear why. */
function Dash({ loading }: { loading: boolean }) {
  if (loading) return <span aria-hidden className="inline-block h-3 w-10 animate-pulse rounded-full bg-soft-fill align-middle" />;
  return (
    <>
      <span aria-hidden>–</span>
      <span className="sr-only">se vede la deschidere</span>
    </>
  );
}

/** The card's heaviest fish: its own chip, never the headline. */
function Cmmc({ kg, className }: { kg: number; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full bg-soft-fill px-2 py-0.5 t-micro text-ink-2', className)}>
      <TrophyIcon aria-hidden className="size-3 text-award" />
      CMMC <span className="t-micro-strong text-ink">{valueText(kg, 'kg')} kg</span>
    </span>
  );
}

/** Phone: the headline under the winner, then the CMMC chip (md+ has its own columns for both). */
function PhoneFigure({ h, loading }: { h: RowHeadline; loading: boolean }) {
  if (!h.figure && h.cmmcKg == null) return null;
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 md:hidden">
      {h.figure ? (
        <span className="truncate t-micro text-muted">
          {h.figure.label}:{' '}
          {h.figure.value != null ? (
            <span className="t-micro-strong text-ink">
              {valueText(h.figure.value, h.figure.unit)} {unitWord(h.figure.unit, h.figure.value)}
            </span>
          ) : (
            <Dash loading={loading} />
          )}
        </span>
      ) : null}
      {h.cmmcKg != null ? <Cmmc kg={h.cmmcKg} className="px-1.5 py-0" /> : null}
    </span>
  );
}

/* ---------------------------------------------------------------- the opened row */

function Expanded({ card: c, read, view }: { card: CompetitionCard; read: ResultRead; view: ResultView }) {
  const ready = read.state === 'ready' ? read : null;
  const pending = read.state === 'pending' || read.state === 'idle';
  const mine = ready?.mine ?? null;

  const actions = (
    <div className="flex w-full flex-col-reverse gap-2 md:w-auto md:flex-row md:items-center">
      <Link href={routes.competition(c.documentId)} className={buttonClass({ variant: 'ghost', className: 'w-full md:w-auto' })}>
        Vezi concursul
      </Link>
      {c.results?.hasCatches !== false ? (
        <Link href={routes.competitionRanking(c.documentId)} className={buttonClass({ variant: 'primary', className: 'w-full md:w-auto' })}>
          Vezi clasamentul complet <ArrowRightIcon className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );

  // «Fără capturi» only when the card says so; a missing snapshot (results null) whose ranking
  // could not be read says just that (fish ResultsFooter), the full ranking still one click away.
  if (c.results?.hasCatches === false || (c.results == null && read.state === 'none')) {
    return (
      <div className="flex flex-col gap-3 border-t border-hairline bg-page p-4 md:flex-row md:items-center md:justify-between md:p-6">
        <p className="t-body text-muted">{c.results?.hasCatches === false ? 'Concursul s-a încheiat fără capturi cântărite.' : 'Rezultatele nu sunt disponibile.'}</p>
        {actions}
      </div>
    );
  }

  const stats = typeStats(c, ready?.raw ?? null);
  const shown = view.places;
  const mineBelow = mine && !view.podium.concat(shown).some((e) => e.position === mine.position);

  return (
    <div className="flex flex-col gap-6 border-t border-hairline bg-page p-4 md:p-6">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-end xl:gap-10">
        <div className="flex flex-col gap-2">
          {view.podium.length ? <Podium entries={view.podium} pending={pending} /> : null}
          {view.lowerIsBetter && view.fromRanking ? <p className="text-center t-caption text-muted">Cele mai puține puncte câștigă</p> : null}
        </div>
        <div className="flex flex-col gap-4">
          {stats.fish ? <FishRow title={stats.fish.title} kgs={stats.fish.kgs} /> : null}
          {stats.tiles.length ? <Tiles title={stats.title} tiles={stats.tiles} /> : null}
        </div>
      </div>

      {pending ? (
        <div aria-hidden className="grid grid-cols-[minmax(0,1fr)] gap-2 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-11 animate-pulse rounded-control bg-surface shadow-e0" />
          ))}
        </div>
      ) : shown.length ? (
        <div className="flex flex-col gap-2">
          <span className="t-eyebrow text-muted uppercase">
            Locurile {shown[0].position}–{shown.at(-1)?.position}
          </span>
          <ol className="grid grid-cols-[minmax(0,1fr)] gap-2 md:grid-cols-2">
            {shown.map((e) => (
              <Place key={e.key} entry={e} me={mine?.position === e.position} />
            ))}
          </ol>
        </div>
      ) : null}

      {mineBelow && mine ? (
        <p className="flex items-center justify-between rounded-control bg-accent-tint px-4 py-2.5 t-label text-accent-ink">
          <span>Locul tău: {mine.position}</span>
          {mine.value != null ? (
            <span className="tabular-nums">
              {valueText(mine.value, view.unit)} {unitWord(view.unit, mine.value)}
            </span>
          ) : null}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-hairline pt-4 md:flex-row md:items-center md:justify-between">
        <span className="t-caption text-muted">{entrantsLine(c, ready?.raw ?? null)}</span>
        {actions}
      </div>
    </div>
  );
}

function Place({ entry: e, me }: { entry: Entry; me: boolean }) {
  const fill = e.sector ? sectorFill(e.sector, 'var(--color-muted)') : null;
  return (
    <li
      aria-current={me ? 'true' : undefined}
      className={cn(
        'relative flex items-center gap-3 overflow-hidden rounded-control py-2.5 ps-4 pe-3 shadow-e0 transition-colors duration-(--duration-fast) hover:bg-soft-fill',
        me ? 'bg-accent-tint' : 'bg-surface',
      )}
    >
      {fill ? <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', fill.className)} style={fill.style} /> : null}
      <span className="w-5 shrink-0 text-end t-num-16 text-ink-2">{e.position}</span>
      <Avatar name={e.name} src={e.faces[0]} size={24} shape={e.club ? 'square' : 'round'} />
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate t-label text-ink">
          {e.name}
          {me ? <span className="ms-1.5 t-micro-strong text-accent-ink">· tu</span> : null}
        </span>
        {e.sector ? <span className="hidden truncate t-caption text-muted md:inline">Sector {e.sector}</span> : null}
      </span>
      {e.value != null ? <InlineNumber value={valueText(e.value, e.unit)} unit={unitWord(e.unit, e.value)} valueClassName="t-label text-ink-2" /> : <span className="t-label text-muted">–</span>}
    </li>
  );
}

/* ---------------------------------------------------------------- stats per ranking type */

const ICONS: Record<TileIcon, ReactNode> = {
  cmmc: <TrophyIcon aria-hidden className="size-4.5 text-award" />,
  fish: <FishIcon size={18} className="text-accent" />,
  scale: <ScaleIcon size={18} className="text-accent" />,
  chart: <ChartBarIcon aria-hidden className="size-4.5 text-accent" />,
  grid: <Squares2X2Icon aria-hidden className="size-4.5 text-accent" />,
  flag: <FlagIcon aria-hidden className="size-4.5 text-accent" />,
  trophy: <TrophyIcon aria-hidden className="size-4.5 text-award" />,
  map: <MapIcon aria-hidden className="size-4.5 text-accent" />,
  group: <UserGroupIcon aria-hidden className="size-4.5 text-accent" />,
};

function Tiles({ title, tiles }: { title: string; tiles: Tile[] }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="t-eyebrow text-muted uppercase">{title}</span>
      <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {tiles.map((t) => (
          <li key={t.label} className="flex min-w-0 flex-col gap-1 rounded-card bg-surface p-3 shadow-e0">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="flex shrink-0">
                {ICONS[t.icon]}
              </span>
              <span className="t-num-18 text-ink">
                {t.value}
                {t.unit ? <span className="ms-1 t-micro-strong tracking-normal text-muted">{t.unit}</span> : null}
              </span>
            </span>
            <span className="t-micro text-muted">{t.label}</span>
            {t.sub ? <span className="truncate t-micro text-ink-2">{t.sub}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FishRow({ title, kgs }: { title: string; kgs: number[] }) {
  const avg = kgs.reduce((a, b) => a + b, 0) / kgs.length;
  return (
    <div className="flex flex-col gap-2">
      <span className="t-eyebrow text-muted uppercase">{title}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {kgs.map((kg, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full bg-surface py-1 ps-2 pe-2.5 t-label text-ink shadow-e0">
            <FishIcon size={14} className="text-accent" />
            {valueText(kg, 'kg')} <span className="t-micro text-muted">kg</span>
          </span>
        ))}
        <span className="ms-1 t-caption text-muted">
          medie{' '}
          <span className="t-label text-ink">
            {valueText(avg, 'kg')} kg
          </span>
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- skeleton */

/** The rows' bones: a day header and rows in the shape they land in. */
export function ResultsListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">Se încarcă concursurile…</span>
      <span aria-hidden className="h-6 w-40 animate-pulse rounded-full bg-soft-fill" />
      <ul aria-hidden className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className={cn(CARD, 'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3 md:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1fr)_150px_auto] md:gap-x-5 md:px-4')}>
            <span className="size-12 animate-pulse rounded-avatar bg-soft-fill" />
            <span className="flex min-w-0 flex-col gap-2">
              <span className="h-4 w-2/3 animate-pulse rounded-full bg-soft-fill" />
              <span className="h-3 w-1/2 animate-pulse rounded-full bg-soft-fill" />
            </span>
            <span className="hidden items-center gap-2 md:flex">
              <span className="size-8 animate-pulse rounded-full bg-soft-fill" />
              <span className="h-4 w-28 animate-pulse rounded-full bg-soft-fill" />
            </span>
            <span className="hidden h-7 w-24 animate-pulse justify-self-end rounded-full bg-soft-fill md:block" />
            <span className="size-8 animate-pulse rounded-full bg-soft-fill" />
          </li>
        ))}
      </ul>
    </div>
  );
}
