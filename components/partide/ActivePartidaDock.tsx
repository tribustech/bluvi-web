'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fmtDurationCompact, fmtKg, type SessionDetailDTO } from '@/core/partide';
import { Pill } from '@/components/cards';
import { FishIcon } from '@/components/icons/brand';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { useSiteToast } from '@/app/(site)/_shell/Toast';

const pluralCapturi = (n: number) => (n === 1 ? 'captură' : 'capturi');

/**
 * The clock the rod countdowns read. fish uses the server-corrected clock (serverClock.ts) and says
 * «sincronizare…» until it has a sample — never a false «expirat». A page that samples the CMS's
 * clock (core/partide createServerClock, fed from a response's Date header) passes it; without one
 * the device clock is used once mounted (Acasă).
 */
export type DockClock = { now(): number; hasSample(): boolean };
const DEVICE_CLOCK: DockClock = { now: () => Date.now(), hasSample: () => true };

/** fish historyView#sessionVenueName, on the HTTP DTO (same fields). */
const venueName = (s: SessionDetailDTO) => s.lakeName ?? s.publicWaterName ?? s.manualVenueName ?? s.anchorName ?? 'Partidă';

/** «4 capturi · 1 scăpat · 9,4 kg max» — fish ActivePartidaDock statsLabel. */
function statsLabel(s: SessionDetailDTO, withCount = true) {
  const caught = s.events.filter((e) => e.outcome === 'capture');
  const lost = s.events.filter((e) => e.outcome === 'lost').length;
  const recordKg = caught.reduce((max, e) => Math.max(max, e.weightKg ?? 0), 0);
  const parts = [withCount ? `${caught.length} ${pluralCapturi(caught.length)}` : pluralCapturi(caught.length)];
  if (lost > 0) parts.push(`${lost} ${lost === 1 ? 'scăpat' : 'scăpate'}`);
  if (recordKg > 0) parts.push(`${fmtKg(recordKg)} kg max`);
  return { label: parts.join(' · '), captures: caught.length };
}

/**
 * Rods with a live countdown state — fish: phase 'fishing' (counting down) or 'firing' (elapsed,
 * awaiting an outcome). The CMS DTO carries the derived phase (`fishing` / `ready`) and deadline.
 */
function useTimerRods(s: SessionDetailDTO, clock: DockClock) {
  const rods = useMemo(
    () =>
      s.rods
        .filter((r) => r.runtimePhase === 'fishing' || r.runtimePhase === 'ready')
        .map((r) => ({ index: r.index, color: r.color, endsAt: r.runtimeEndsAt ? Date.parse(r.runtimeEndsAt) : null })),
    [s.rods]
  );
  // Second tick only while a countdown is actually running (fish). Null until mounted, so the
  // server and the first browser render agree.
  const [now, setNow] = useState<number | null>(null);
  const sampled = now != null && clock.hasSample();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock starts after hydration
    setNow(clock.now());
    // fish: ticks only while a countdown is running (decided against the clock, not the phase) —
    // or while the clock has no sample yet, so the chips leave «sincronizare…» once it has one.
    if (clock.hasSample() && !rods.some((r) => r.endsAt != null && r.endsAt > clock.now())) return;
    const id = setInterval(() => setNow(clock.now()), 1000);
    return () => clearInterval(id);
  }, [rods, clock, sampled]);
  return rods.map((r) => {
    const remaining = sampled && now != null && r.endsAt != null ? r.endsAt - now : null;
    const expired = remaining != null && remaining <= 0;
    // fish: a countdown from an unsampled clock is a guess — say so instead of a number. A rod
    // that is ready (elapsed, no deadline left to count) reads «expirat» once the clock is known.
    const ready = sampled && r.endsAt == null;
    return {
      ...r,
      expired: expired || ready,
      text: ready || expired ? 'expirat' : remaining == null ? 'sincronizare…' : fmtDurationCompact(remaining),
    };
  });
}

function RodChips({ session, size, clock }: { session: SessionDetailDTO; size: 'dock' | 'card'; clock: DockClock }) {
  const rods = useTimerRods(session, clock);
  if (rods.length === 0) return null;
  return (
    <ul aria-label="Lansete" className={cn('flex flex-wrap items-center gap-x-2', size === 'dock' ? 'gap-y-1' : 'gap-y-1.5')}>
      {rods.map((r) => (
        <li
          key={r.index}
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 tabular-nums',
            size === 'dock' ? 't-nano' : 't-micro-strong',
            // The kit StatusPill pairs (danger / neutral), at the dock's compact size.
            r.expired ? 'bg-status-danger-bg text-status-danger-fg' : 'bg-status-neutral-bg text-status-neutral-fg'
          )}
        >
          <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: r.color ?? 'currentColor' }} />
          <span className="sr-only">Lanseta {r.index + 1}: </span>
          {r.text}
        </li>
      ))}
    </ul>
  );
}

/** The partidă's state: the kit LIVE pill (pulsing dot), worded as fish. */
function ActivePill() {
  return <Pill tone="live">ACTIVĂ</Pill>;
}

export interface ActivePartidaProps {
  session: SessionDetailDTO;
  /**
   * The partidă page — the caller passes the gated href (lib/partide-pages `partideHrefs.partida`,
   * lib/routes `partidaHref`): null while that page is not on the web. Then the venue is plain text
   * (no stretched link), «Deschide partida» is left out, and so is «Captură» unless `captureHref`
   * has its own target — never a dead link.
   */
  href: string | null;
  /**
   * Where «Captură» goes: the capture flow for a free (no-rod) capture once the web has it
   * (lib/partide-pages `capture`), else the partidă page (`href`).
   */
  captureHref?: string | null;
  /** The countdowns' clock (DockClock); the device clock by default. */
  clock?: DockClock;
}

export type ActivePartidaCardProps = ActivePartidaProps & {
  /** The card heading's id (one card per page): Acasă's by default. */
  headingId?: string;
};

/**
 * fish features/partide/components/ActivePartidaDock.tsx — the live-partidă bar fused with the tab
 * bar (mobile/tablet): ACTIVĂ, venue + stats, «Captură», per-rod timers. The bar opens the partidă.
 * fish's «Captură» opens the capture flow in place; on the web it opens `captureHref` (offline it
 * is blocked with fish's toast — a capture is a write). Used by Acasă and the Partide hub
 * (parity partide.b.active-dock-global).
 */
export function ActivePartidaDock({ session, href, captureHref, clock = DEVICE_CLOCK }: ActivePartidaProps) {
  const { label } = statsLabel(session);
  const capture = captureHref ?? href;
  return (
    <section
      aria-label="Partida activă"
      data-testid="partida-activa-dock"
      className="sticky bottom-0 z-sticky -mx-4 -mb-8 flex flex-col gap-2 rounded-t-bento md:-mx-6 md:-mb-10 border-t border-accent/20 bg-surface px-3.5 pt-2.5 pb-[max(--spacing(2.5),env(safe-area-inset-bottom))] shadow-tabbar xl:hidden"
    >
      <div className="relative flex items-center gap-2.5">
        <ActivePill />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {href ? (
            <Link
              href={href}
              className="truncate t-body-strong text-ink outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:outline-accent"
            >
              {venueName(session)}
            </Link>
          ) : (
            <p className="truncate t-body-strong text-ink">{venueName(session)}</p>
          )}
          <p className="truncate t-micro text-muted">{label}</p>
        </div>
        {capture ? <CaptureLink href={capture} className="relative z-above" /> : null}
      </div>
      <RodChips session={session} size="dock" clock={clock} />
    </section>
  );
}

/** The partidă as the first card of the desktop right column (design). */
export function ActivePartidaCard({ session, href, captureHref, clock = DEVICE_CLOCK, headingId = 'acasa-partida-activa' }: ActivePartidaCardProps) {
  const { label, captures } = statsLabel(session, false);
  const capture = captureHref ?? href;
  return (
    <section aria-labelledby={headingId} data-testid="partida-activa-card" className="flex flex-col gap-3 rounded-card border border-accent-tint-2 bg-surface p-4.5">
      <div className="flex items-center gap-2.5">
        <ActivePill />
        <p className="min-w-0 flex-1 t-caption text-muted">
          Partida ta · <Since startedAt={session.startedAt} />
        </p>
      </div>
      <div>
        <h2 id={headingId} className="t-heading">
          {venueName(session)}
        </h2>
        <p className="mt-0.5 flex items-baseline gap-1">
          <span className="t-num-40">{captures}</span>
          <span className="t-caption text-muted">{label}</span>
        </p>
      </div>
      <RodChips session={session} size="card" clock={clock} />
      {/* Side by side when both labels fit, stacked in a narrow aside (labels never truncate). */}
      {capture || href ? (
        <div className="flex flex-wrap gap-2">
          {capture ? <CaptureLink href={capture} className="grow" /> : null}
          {href ? (
            <ButtonLink href={href} variant="secondary" className="grow">
              Deschide partida
            </ButtonLink>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** fish onPartidaCapture: offline → «Fără conexiune. Reconectare…», nothing opens. */
function CaptureLink({ href, className }: { href: string; className?: string }) {
  const toast = useSiteToast();
  return (
    <ButtonLink
      href={href}
      variant="success"
      className={className}
      icon={<FishIcon size={20} />}
      onClick={(e) => {
        if (navigator.onLine) return;
        e.preventDefault();
        toast('Fără conexiune. Reconectare…', 'danger');
      }}
    >
      Captură
    </ButtonLink>
  );
}

/** «de 14h 20min» since the start; rendered after hydration (it depends on the clock). */
function Since({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock starts after hydration
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  if (now == null) return <span>în desfășurare</span>;
  const minutes = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 60_000));
  const h = Math.floor(minutes / 60);
  return <span>{h > 0 ? `de ${h}h ${minutes % 60}min` : `de ${minutes} min`}</span>;
}
