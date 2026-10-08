'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRightIcon, MapPinIcon, TrophyIcon } from '@heroicons/react/20/solid';
import { CalendarDaysIcon, ChartBarIcon, SunIcon } from '@heroicons/react/24/outline';
import { buildRecordSlots, fmtKg, gridSource, type CommunityRecordDTO, type RecordSlot } from '@/core/partide';
import { BentoArt, bentoSurface, type BentoTone } from '@/components/ui/BentoTile';
import { cn } from '@/components/ui/cn';
import { appLinks } from '@/lib/app-links';
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
    <TileFrame href={href} label={label} className={cn(TILE, 'bg-soft-fill shadow-e1')} testId={`record-${record.window}`}>
      <span className="absolute inset-0 z-behind">
        <Photo src={gridSource(record)} className="transition-transform duration-(--duration-slow) group-hover:scale-[1.03]" />
      </span>
      <span aria-hidden className="absolute inset-x-0 bottom-0 z-behind h-[55%] bg-linear-to-t from-photo-scrim to-transparent" />
      <span className="p-2.25">
        <WindowBadge window={record.window} />
      </span>
      <span className="mt-auto flex items-end justify-between gap-1.5 px-2.5 pb-2.25 text-on-photo-scrim">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-baseline gap-1">
            <span className="shrink-0 t-heading">{fmtKg(record.weightKg)}</span>
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
      <span className="t-body-strong">{inv.copy}</span>
      <TileAction>Începe în aplicație</TileAction>
    </a>
  );
}

function StatsTile() {
  const href = partideHrefs.stats();
  return (
    <TileFrame href={href} label="Statistici comunitate" className={cn(TILE, bentoSurface('signature'), 'justify-between gap-2 p-3.5')} testId="record-stats">
      <BentoArt>
        <ChartBarIcon />
      </BentoArt>
      <span aria-hidden className="flex size-9.5 items-center justify-center rounded-control bg-lavender/15 text-lavender [&>svg]:size-5">
        <ChartBarIcon />
      </span>
      <span className="t-body-strong text-lavender">Statistici comunitate</span>
      {href ? <TileAction>Vezi cifrele</TileAction> : <span aria-hidden className="h-4" />}
    </TileFrame>
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

function Slot({ slot }: { slot: RecordSlot }) {
  if (slot.kind === 'record') return <RecordTile record={slot.record} />;
  if (slot.kind === 'invite') return <InviteTile window={slot.window} />;
  return <StatsTile />;
}

/** The 2×2 — four equal tiles by construction (fish buildRecordSlots: empty windows never collapse it). */
export function RecordsGrid({ records }: { records: CommunityRecordDTO[] }) {
  const slots = buildRecordSlots(records);
  return (
    <ul className="grid grid-cols-2 gap-3" data-testid="records-grid">
      {slots.map(slot => (
        <li key={slot.kind === 'stats' ? 'stats' : slot.kind === 'record' ? slot.record.window : slot.window} className="flex flex-col *:flex-1">
          <Slot slot={slot} />
        </li>
      ))}
    </ul>
  );
}
