'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fmtDurationCompact, fmtKg, type SessionDetailDTO } from '@/core/partide';
import { FishIcon } from '@/components/icons/brand';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';

const pluralCapturi = (n: number) => (n === 1 ? 'captură' : 'capturi');

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
function useTimerRods(s: SessionDetailDTO) {
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
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock starts after hydration
    setNow(Date.now());
    if (!rods.some((r) => r.endsAt != null && r.endsAt > Date.now())) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [rods]);
  return rods.map((r) => {
    const remaining = now != null && r.endsAt != null ? r.endsAt - now : null;
    const expired = remaining != null && remaining <= 0;
    return { ...r, expired, text: remaining == null ? '––:––' : expired ? 'expirat' : fmtDurationCompact(remaining) };
  });
}

function RodChips({ session, size }: { session: SessionDetailDTO; size: 'dock' | 'card' }) {
  const rods = useTimerRods(session);
  if (rods.length === 0) return null;
  return (
    <ul aria-label="Lansete" className={cn('flex flex-wrap items-center gap-x-[7px]', size === 'dock' ? 'gap-y-[5px]' : 'gap-y-1.5')}>
      {rods.map((r) => (
        <li
          key={r.index}
          className={cn(
            'flex shrink-0 items-center gap-[5px] rounded-lg px-[7px] py-[3px] tabular-nums',
            size === 'dock' ? 't-nano' : 't-micro-strong',
            r.expired ? 'bg-status-danger-bg text-status-live-bg' : 'bg-soft-fill text-ink'
          )}
        >
          <span aria-hidden className="size-[7px] rounded-full" style={{ backgroundColor: r.color ?? 'currentColor' }} />
          <span className="sr-only">Lanseta {r.index + 1}: </span>
          {r.text}
        </li>
      ))}
    </ul>
  );
}

function ActivePill() {
  return (
    <span className="flex shrink-0 items-center gap-[5px] rounded-full bg-status-live-bg px-[9px] py-[5px] t-nano text-status-live-fg">
      <span aria-hidden className="size-1.5 rounded-full bg-current animate-live" />
      ACTIVĂ
    </span>
  );
}

/**
 * fish features/partide/components/ActivePartidaDock.tsx — the live-partidă bar fused with the tab
 * bar (mobile/tablet): ACTIVĂ, venue + stats, «Captură», per-rod timers. The bar opens the partidă.
 * fish's «Captură» opens the capture flow in place; on the web the capture happens on the partidă
 * page, so it links there.
 */
export function ActivePartidaDock({ session }: { session: SessionDetailDTO }) {
  const href = routes.partida(session.documentId);
  const { label } = statsLabel(session);
  return (
    <section
      aria-label="Partida activă"
      className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 flex flex-col gap-2 rounded-t-[18px] border-t border-accent/20 bg-surface px-3.5 py-2.5 shadow-tabbar md:bottom-0 md:left-[72px] xl:hidden"
    >
      <div className="relative flex items-center gap-2.5">
        <ActivePill />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Link
            href={href}
            className="truncate t-body-strong text-ink outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:outline-accent"
          >
            {venueName(session)}
          </Link>
          <p className="truncate t-micro text-muted">{label}</p>
        </div>
        <Link
          href={href}
          className="relative z-10 flex shrink-0 items-center gap-[5px] rounded-[11px] bg-success px-[13px] py-[9px] t-label text-on-accent shadow-button"
        >
          <FishIcon size={15} />
          Captură
        </Link>
      </div>
      <RodChips session={session} size="dock" />
    </section>
  );
}

/** The partidă as the first card of the desktop right column (design). */
export function ActivePartidaCard({ session }: { session: SessionDetailDTO }) {
  const href = routes.partida(session.documentId);
  const { label, captures } = statsLabel(session, false);
  return (
    <section aria-labelledby="acasa-partida-activa" className="flex flex-col gap-3 rounded-[18px] bg-surface p-3.5 shadow-[inset_0_0_0_1px_var(--color-accent-tint-2)]">
      <div className="flex items-center gap-2.5">
        <ActivePill />
        <p className="min-w-0 flex-1 t-caption text-muted">
          Partida ta · <Since startedAt={session.startedAt} />
        </p>
      </div>
      <div>
        <h2 id="acasa-partida-activa" className="t-heading">
          {venueName(session)}
        </h2>
        <p className="mt-0.5 flex items-baseline gap-1">
          <span className="t-num-40">{captures}</span>
          <span className="t-caption text-muted">{label}</span>
        </p>
      </div>
      <RodChips session={session} size="card" />
      <div className="flex gap-2">
        <Link href={href} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[11px] bg-success t-body-strong text-on-accent">
          <FishIcon size={15} />
          Captură
        </Link>
        <Link href={href} className="flex h-10 flex-1 items-center justify-center rounded-[11px] bg-accent-tint t-body-strong text-accent-ink hover:bg-accent-tint-2">
          Deschide partida
        </Link>
      </div>
    </section>
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
