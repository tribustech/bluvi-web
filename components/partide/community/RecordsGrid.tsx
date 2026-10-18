'use client';

import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRightIcon, MapPinIcon, TrophyIcon } from '@heroicons/react/20/solid';
import { CalendarDaysIcon, ChartBarIcon, SunIcon } from '@heroicons/react/24/outline';
import { buildRecordSlots, communityStatsQuery, fmtKg, fmtKgStat, gridSource, type CommunityRecordDTO, type CommunityStatsDTO, type RecordSlot } from '@/core/partide';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { BentoArt, bentoSurface, type BentoTone } from '@/components/ui/BentoTile';
import { cn } from '@/components/ui/cn';
import { appLinks } from '@/lib/app-links';
import { createBrowserTransport } from '@/lib/client/transport';
import { PERIOD_TITLE } from '@/lib/stats-period';
import { partideHrefs } from '@/lib/partide-pages';
import { AnglerAvatars, FOCUS, Photo } from './parts';

/*
 * fish features/partide/components/community/RecordsGrid.tsx — «Recorduri», ALWAYS a 2×2 of equal
 * tiles (parity partide.comunitate.c18–c20): AZI, SĂPTĂMÂNA, LUNA (a record, or an invitation when
 * the window is empty) and the «Statistici comunitate» tile. Apple-style bento (owner rule 19): each
 * tile its own surface — a record is its catch photo under a scrim with the window's badge (amber,
 * teal, deep indigo + trophy, fish's three); an invitation takes the window's colour as its whole
 * surface (amber, teal, deep indigo) with a large corner glyph; the statistics tile is the navy
 * signature surface. Links go through lib/partide-pages (plain while a page is off).
 */

type Window = CommunityRecordDTO['window'];

const BADGE: Record<Window, { label: string; className: string; onSurface: string; trophy?: boolean }> = {
  today: { label: 'AZI', className: 'bg-medal-gold text-on-medal', onSurface: 'bg-medal-gold text-on-medal' },
  week: { label: 'SĂPTĂMÂNA', className: 'bg-bento-sky text-on-bento-sky', onSurface: 'bg-on-bento-sky text-bento-sky' },
  month: { label: 'LUNA', className: 'bg-bento-indigo text-on-bento-indigo', onSurface: 'bg-on-bento-indigo text-bento-indigo', trophy: true },
};

const INVITE: Record<Window, { copy: string; tone: BentoTone; art: ReactNode }> = {
  today: { copy: 'Recordul de azi te așteaptă', tone: 'amber', art: <SunIcon /> },
  week: { copy: 'Recordul săptămânii te așteaptă', tone: 'sky', art: <CalendarDaysIcon /> },
  month: { copy: 'Recordul lunii te așteaptă', tone: 'indigo', art: <TrophyIcon /> },
};

const TILE = 'group relative isolate flex h-42.5 flex-col overflow-hidden rounded-bento';

/**
 * The window's badge. On a photo it carries the window's colour; on an invitation (`onSurface`) the
 * tile already IS that colour, so the pill is inverted — the surface's ink as the fill, the surface's
 * colour as the text — and still reads as a badge (AZI keeps the gold, apart from the amber tint).
 */
function WindowBadge({ window: w, onSurface = false }: { window: Window; onSurface?: boolean }) {
  const b = BADGE[w];
  return (
    <span className={cn('inline-flex items-center gap-1.25 self-start rounded-badge px-1.75 py-1 t-micro-strong tracking-[0.5px]', onSurface ? b.onSurface : b.className)}>
      {b.trophy ? <TrophyIcon aria-hidden className="size-2.5" /> : null}
      {b.label}
    </span>
  );
}

/** A tile that is a link when its page is on the web, a plain block otherwise. */
function TileFrame({ href, label, className, children, testId }: { href: string | null; label: string; className: string; children: ReactNode; testId: string }) {
  return href ? (
    <Link href={href} aria-label={label} className={cn(className, FOCUS)} data-testid={testId}>
      {children}
    </Link>
  ) : (
    <div role="group" aria-label={label} className={className} data-testid={testId}>
      {children}
    </div>
  );
}

function RecordTile({ record }: { record: CommunityRecordDTO }) {
  const href = record.sessionDocumentId ? partideHrefs.partida(record.sessionDocumentId) : null;
  const species = record.species ?? 'Captură';
  const label = `Record ${BADGE[record.window].label.toLowerCase()}: ${fmtKg(record.weightKg)} kg, ${species}, ${record.venueName}`;
  return (
    // From 768 the catch cards' portrait shape (owner 2026-10-18: the wide strips cropped the catch).
    <TileFrame href={href} label={label} className={cn(TILE, 'bg-soft-fill shadow-e1 md:aspect-4/5 md:h-auto')} testId={`record-${record.window}`}>
      <span className="absolute inset-0 z-behind">
        <Photo src={gridSource(record)} whole className="transition-transform duration-(--duration-slow) group-hover:scale-[1.03]" />
      </span>
      <span aria-hidden className="absolute inset-x-0 bottom-0 z-behind h-[55%] bg-linear-to-t from-photo-scrim to-transparent" />
      <span className="p-2.25">
        <WindowBadge window={record.window} />
      </span>
      <span className="mt-auto flex items-end justify-between gap-1.5 px-2.5 pb-2.25 text-on-photo-scrim">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-baseline gap-1">
            <span className="shrink-0 t-heading md:t-title1">{fmtKg(record.weightKg)}</span>
            <span className="shrink-0 t-micro-strong">kg</span>
            <span className="ml-0.5 min-w-0 truncate t-micro">{species}</span>
          </span>
          <span className="mt-0.75 flex min-w-0 items-center gap-1">
            <MapPinIcon aria-hidden className="size-2.5 shrink-0" />
            <span className="truncate t-micro">{record.venueName}</span>
          </span>
        </span>
        <AnglerAvatars angler={record.angler} extraMembers={record.extraMembers} />
      </span>
    </TileFrame>
  );
}

/**
 * An empty window's invitation. Starting a partidă is app-only on web (owner 2026-10-08, ROADMAP §4b
 * rule 21): the tile is the universal link into the app's start flow (it opens the app on a phone,
 * the store listing elsewhere — bluvi-redirect-stores).
 */
function InviteTile({ window: w }: { window: Window }) {
  const inv = INVITE[w];
  return (
    <a href={appLinks.startPartida()} aria-label={`${inv.copy} Începe o partidă în aplicația Bluvi`} className={cn(TILE, bentoSurface(inv.tone), 'justify-between gap-2 p-3.5', FOCUS)} data-testid={`record-invite-${w}`}>
      <BentoArt>{inv.art}</BentoArt>
      <WindowBadge window={w} onSurface />
      {/* The invitation is the tile's headline and its second line can run over the corner art.
          On indigo the art lifts the ground to #655EE9: the label colour (#E0E7FF) drops to 4.35:1
          there, white keeps 4.9:1 (M8 a11y audit, pixel probe at 1280). */}
      <span className={cn('t-body-strong', inv.tone === 'indigo' && 'text-on-bento-indigo')}>{inv.copy}</span>
      <TileAction>Începe în aplicație</TileAction>
    </a>
  );
}

/**
 * «Statistici comunitate». `tall` (from 768, beside three record photos, so as tall as they are —
 * owner 2026-10-18: the empty navy block «nu-mi place»): this month's community figures read from
 * the public stats (communityStatsQuery 'month', the Statistici page's read) — capturi as the
 * headline, kg · partide · pescari under it, the catches per day as small bars. Until they answer,
 * or when the read fails or the month is empty, the short tile's content (owner rule 4).
 */
function StatsTile({ tall = false }: { tall?: boolean }) {
  const href = partideHrefs.stats();
  const wide = useBreakpoint() !== 'mobile';
  const t = useMemo(() => createBrowserTransport(), []);
  const q = useQuery({ ...communityStatsQuery(t, 'month'), enabled: tall && wide });
  const stats = tall && wide && q.data && q.data.totals.partide > 0 ? q.data : null;
  return (
    <TileFrame href={href} label="Statistici comunitate" className={cn(TILE, bentoSurface('signature'), 'justify-between gap-2 p-3.5', stats && 'md:p-5')} testId="record-stats">
      {stats ? (
        <MonthFigures stats={stats} />
      ) : (
        <>
          <BentoArt>
            <ChartBarIcon />
          </BentoArt>
          <span aria-hidden className="flex size-9.5 items-center justify-center rounded-control bg-lavender/15 text-lavender [&>svg]:size-5">
            <ChartBarIcon />
          </span>
          <span className="t-body-strong text-lavender">Statistici comunitate</span>
        </>
      )}
      {href ? <TileAction>Vezi cifrele</TileAction> : <span aria-hidden className="h-4" />}
    </TileFrame>
  );
}

function MonthFigures({ stats }: { stats: CommunityStatsDTO }) {
  const { totals } = stats;
  const kg = fmtKgStat(totals.totalKg);
  const n = (v: number) => v.toLocaleString('ro-RO');
  const series = stats.weeklySeries;
  const peak = Math.max(1, ...series.map(s => s.count));
  return (
    <span className="flex min-h-0 flex-1 flex-col gap-4" data-testid="record-stats-figures">
      <span className="flex flex-col gap-0.5">
        <span className="t-body-strong text-lavender">Statistici comunitate</span>
        <span className="t-micro text-lavender-2">{PERIOD_TITLE.month}</span>
      </span>
      <span className="flex flex-col">
        <span className="t-num-40 leading-none text-lavender tabular-nums xl:t-num-64">{n(totals.catches)}</span>
        <span className="mt-1 t-label text-lavender-2">{totals.catches === 1 ? 'captură' : 'capturi'}</span>
      </span>
      <dl className="grid grid-cols-3 gap-2 border-t border-lavender/15 pt-3">
        {[
          { label: kg.unit === 't' ? 'tone' : 'kg', value: kg.value },
          { label: 'partide', value: n(totals.partide) },
          { label: 'pescari', value: n(totals.anglers) },
        ].map(f => (
          <span key={f.label} className="flex min-w-0 flex-col-reverse gap-0.5">
            <dt className="truncate t-micro text-lavender-2">{f.label}</dt>
            <dd className="truncate t-heading text-lavender tabular-nums">{f.value}</dd>
          </span>
        ))}
      </dl>
      {series.length > 1 ? (
        // Catches per day, the month's shape at a glance; the numbers above say it for assistive tech.
        <span aria-hidden className="flex max-h-28 min-h-10 flex-1 items-end gap-px">
          {series.map((s, i) => (
            <span
              key={i}
              className={cn('min-w-0 flex-1 rounded-t-[2px]', s.count > 0 ? 'bg-lavender/70' : 'bg-lavender/15')}
              style={{ height: `${s.count > 0 ? Math.max(12, Math.round((s.count / peak) * 100)) : 6}%` }}
            />
          ))}
        </span>
      ) : null}
    </span>
  );
}

function TileAction({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden className="inline-flex items-center gap-0.5 t-micro-strong">
      {children}
      <ChevronRightIcon className="size-3.5" />
    </span>
  );
}

function Slot({ slot, tall = false }: { slot: RecordSlot; tall?: boolean }) {
  if (slot.kind === 'record') return <RecordTile record={slot.record} />;
  if (slot.kind === 'invite') return <InviteTile window={slot.window} />;
  return <StatsTile tall={tall} />;
}

/** md: classes by count (Tailwind needs them written out). */
const ROWS = ['md:grid-rows-1', 'md:grid-rows-1', 'md:grid-rows-2', 'md:grid-rows-3'] as const;
const ROW_SPAN = ['md:row-span-1', 'md:row-span-1', 'md:row-span-2', 'md:row-span-3'] as const;

/**
 * Phone: fish's 2×2 — four equal tiles by construction (buildRecordSlots: empty windows never
 * collapse it). From 768 one row of four columns (owner 2026-10-18, «când nu avem recorduri sunt
 * horror cardurile»): only a record is a portrait photo tile, first, one column each; the empty
 * windows' invitations and the statistics tile stack, short, in the next column, sharing the
 * photos' height (any column left stays empty at the row's end — rule 27, never a stretched band).
 * With no record at all the four are one short row (the phone's tile height).
 */
export function RecordsGrid({ records }: { records: CommunityRecordDTO[] }) {
  const slots = buildRecordSlots(records);
  const photos = slots.filter(s => s.kind === 'record').length;
  const rest = slots.length - photos;
  const stacked = photos > 0;
  return (
    <ul className={cn('grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 xl:gap-5', stacked && cn('md:grid-flow-col', ROWS[rest]))} data-testid="records-grid">
      {slots.map(slot => (
        <li
          key={slot.kind === 'stats' ? 'stats' : slot.kind === 'record' ? slot.record.window : slot.window}
          className={cn(
            'flex flex-col *:flex-1',
            stacked && (slot.kind === 'record' ? cn('md:order-first', ROW_SPAN[rest]) : 'md:*:h-auto md:*:min-h-28'),
          )}
        >
          <Slot slot={slot} tall={rest === 1} />
        </li>
      ))}
    </ul>
  );
}
