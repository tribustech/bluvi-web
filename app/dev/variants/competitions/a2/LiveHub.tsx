'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowRightIcon, BoltIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, EyeIcon, FireIcon, ScaleIcon, TrophyIcon } from '@heroicons/react/20/solid';
import { Pill } from '@/components/cards/parts';
import { formatDecimal, formatInt } from '@/components/cards/format';
import { sectorFill } from '@/components/ranking/sector';
import { LiveDot } from '@/components/templates/LiveDot';
import { Avatar } from '@/components/ui/Avatar';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { dateWithHours, formatKg, type CompetitionCard } from '@/core/competitions';
import { routes } from '@/lib/routes';
import { lakeLine, Thumb } from '../shared';
import type { LiveData } from './data';
import { clock, cumulative, momentum, spanLabel, type BigCatch, type Highlight, type LiveExtra, type MiniRow } from './model';
import { Ago, Roll, useLiveRefresh, useNow, useReducedMotion } from './motion';
import s from './a2.module.css';

/*
 * A2 · Live — «the important tab, be crazier» (owner, 2026-10-06). Research it borrows from:
 *  - one featured hero (Polymarket «trending», Apple Sports): the competition with the freshest
 *    weighing leads, on navy with lavender signature numbers;
 *  - a mini timing tower with ▲/▼ position deltas (F1 live timing) — only rows that changed flash;
 *  - a «puls» strip of kg weighed per interval (Sofascore Attack Momentum);
 *  - the chase line «Locul 2 e la 1,3 kg de lider» with a two-tone bar (Strava Live Segments);
 *  - «Momente cheie», a scroll-snap shelf of key moments (YouTube / Twitch clip shelves);
 *  - «Cântăriri recente», a live ticker that slides new weighings in (aria-live, polite);
 *  - rich secondary cards: LIVE + viewers pills on the photo (Twitch), mini tower, sparkline;
 *  - a toast for a new record or a lead change (max one per 20 s, never on a hidden tab).
 * Motion budget: the LIVE dot is the only loop; everything else fires on an event.
 * Auto-refresh: router.refresh() every 45 s while visible (fish polls its live screens).
 */

type Ticker = LiveData['ticker'];

export function LiveHub({ cards, live }: { cards: CompetitionCard[]; live: LiveData }) {
  const refreshedAt = useLiveRefresh(45_000);
  const { changed, toast, dismiss } = useLiveDiff(cards, live);
  const hero = cards.find((c) => c.documentId === live.heroId) ?? cards[0];
  const others = cards.filter((c) => c !== hero);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-2 t-caption text-muted">
        <LiveDot />
        <span>
          {cards.length === 1 ? 'Un concurs live' : `${cards.length} concursuri live`} · se actualizează singur la 45 s
          {refreshedAt ? (
            <>
              {' · ultima dată '}
              <Ago iso={new Date(refreshedAt).toISOString()} />
            </>
          ) : null}
        </span>
      </div>

      <div className={cn('grid gap-5', live.ticker.length ? 'xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]' : '')}>
        {hero ? <Hero card={hero} extra={live.extras[hero.documentId]} changed={changed} /> : null}
        {live.ticker.length ? <TickerPanel items={live.ticker} heaviest={heaviest(cards, live)} /> : null}
      </div>

      {live.highlights.length ? <Highlights items={live.highlights} cards={cards} /> : null}

      {others.length ? (
        <section className="flex flex-col gap-4" aria-labelledby="a2-more-live">
          <h2 id="a2-more-live" className="flex items-baseline gap-2 t-title2 text-ink">
            Tot live acum <span className="t-body text-muted">{others.length}</span>
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(400px,1fr))] gap-5">
            {others.map((c, i) => (
              <LiveCard key={c.documentId} card={c} extra={live.extras[c.documentId]} changed={changed} index={i} />
            ))}
          </div>
        </section>
      ) : null}

      {toast ? <Toast toast={toast} onClose={dismiss} /> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- diffing across refreshes */

type ToastData = { id: number; title: string; body: string; href: string; name: string };

/**
 * What changed since the last refresh: row values (flash those rows only — F1's lesson) and the
 * big moments (new record, new leader) that earn a toast. Stored the React way: the previous
 * snapshot lives in state and is compared while rendering the new one.
 */
function useLiveDiff(cards: CompetitionCard[], live: LiveData) {
  const [snap, setSnap] = useState<{ live: LiveData; changed: Set<string>; events: ToastData[] }>({ live, changed: new Set(), events: [] });
  if (snap.live !== live) {
    const changed = new Set<string>();
    const events: ToastData[] = [];
    for (const [id, e] of Object.entries(live.extras)) {
      const before = snap.live.extras[id];
      if (!before?.ranking || !e.ranking) continue;
      const prev = new Map(before.ranking.rows.map((r) => [r.key, r]));
      for (const r of e.ranking.rows) {
        const p = prev.get(r.key);
        if (p && (p.value !== r.value || p.position !== r.position)) changed.add(`${id}|${r.key}`);
      }
      const compName = cards.find((c) => c.documentId === id)?.name ?? '';
      const lead = e.ranking.rows[0];
      if (lead && before.ranking.rows[0] && lead.key !== before.ranking.rows[0].key) {
        events.push({ id: Date.parse(live.ticker[0]?.at ?? '') || events.length + 1, title: 'Lider nou', body: `${lead.name} trece pe primul loc · ${compName}`, href: routes.competition(id), name: lead.name });
      }
      const bc = e.ranking.biggestCatch;
      if (bc && (before.ranking.biggestCatch?.weight ?? 0) < bc.weight) {
        events.push({ id: Math.round(bc.weight * 1000), title: 'Cea mai mare captură', body: `${formatKg(bc.weight)} kg · ${bc.name} · ${compName}`, href: routes.competition(id), name: bc.name });
      }
    }
    setSnap({ live, changed, events });
  }

  const [toast, setToast] = useState<ToastData | null>(null);
  const [lastToastAt, setLastToastAt] = useState(0);
  useEffect(() => {
    const next = snap.events[0];
    if (!next || document.visibilityState !== 'visible') return;
    const now = Date.now();
    if (now - lastToastAt < 20_000) return;
    const show = setTimeout(() => {
      setToast(next);
      setLastToastAt(now);
    }, 0);
    return () => clearTimeout(show);
    // Only a new snapshot can raise a toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  return { changed: snap.changed, toast, dismiss: () => setToast(null) };
}

/* ---------------------------------------------------------------- hero */

function Hero({ card: c, extra, changed }: { card: CompetitionCard; extra?: LiveExtra; changed: Set<string> }) {
  const now = useNow(60_000);
  const r = extra?.ranking;
  const top = r?.rows.slice(0, 3) ?? [];
  const chasers = r?.rows.slice(3, 5).filter((x) => x.catches > 0) ?? [];
  const totalKg = r?.totalKg ?? c.results?.totalKg ?? null;
  const catches = r?.totalCatches ?? c.results?.catchCount ?? 0;
  const biggest = r?.biggestCatch?.weight ?? c.results?.biggestFishKg ?? null;
  const end = c.endDate ? new Date(c.endDate).getTime() : null;
  const href = routes.competition(c.documentId);

  return (
    <article className={cn('relative isolate flex flex-col overflow-hidden rounded-bento bg-navy', s.rise)}>
      <Thumb card={c} big sizes="(min-width: 1280px) 900px, 100vw" className="absolute inset-0 z-backdrop opacity-25" />
      <div className="absolute inset-0 z-behind bg-linear-to-r from-navy via-navy/95 to-navy/70" aria-hidden />
      <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)] xl:gap-8 xl:p-8">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="live">LIVE</Pill>
            <span className="inline-flex h-6 items-center gap-1 rounded-full bg-lavender/15 px-2 t-micro-strong text-lavender">
              <EyeIcon aria-hidden className="size-3.5" />
              {formatInt(c.viewers)} urmăresc
            </span>
            <span className="t-caption text-lavender-2">{dateWithHours(c)}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="t-eyebrow text-lavender-2 uppercase">În prim-plan</p>
            <h2 className="line-clamp-2 t-display text-lavender">
              <Link href={href} className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-lavender">
                {c.name}
              </Link>
            </h2>
            <p className="t-label text-lavender-2">{lakeLine(c)}</p>
          </div>
          <dl className="grid grid-cols-3 gap-4 border-y border-lavender/15 py-4">
            <HeroStat label="kg cântărite" value={totalKg} format={(n) => formatDecimal(n, 1, 1)} unit="kg" />
            <HeroStat label="capturi" value={catches} format={formatInt} />
            <HeroStat label="cea mai mare" value={biggest} format={(n) => formatDecimal(n, 2, 3)} unit="kg" />
          </dl>
          <p className="t-caption text-lavender-2">
            {end != null && now != null
              ? now < end
                ? `Se încheie în ${spanLabel(end - now)} · ${clock(c.endDate!)}`
                : `Program încheiat la ${clock(c.endDate!)} · cântărirea e încă deschisă`
              : `${formatInt(c.joinedCount)} ${c.format.unit} în concurs`}
          </p>
          <div className="mt-auto flex flex-wrap gap-2">
            <Link href={routes.competitionRanking(c.documentId)} className={buttonClass({ variant: 'primary', size: 'compact', className: 'relative z-above' })}>
              Clasament live
            </Link>
            <Link href={routes.competitionWeighings(c.documentId)} className={cn(buttonClass({ variant: 'ghost', size: 'compact' }), 'relative z-above text-lavender hover:bg-lavender/10')}>
              Cântare
            </Link>
          </div>
        </div>

        <div className="relative z-above flex min-w-0 flex-col gap-3 rounded-card bg-lavender/[0.06] p-4">
          <p className="flex items-center justify-between t-eyebrow text-lavender-2 uppercase">
            <span>Clasament acum</span>
            {r ? <span className="normal-case">{r.valueLabel}</span> : null}
          </p>
          {top.length && top[0].catches > 0 ? (
            <>
              <ol className="flex flex-col gap-1">
                {top.map((row, i) => (
                  <TowerRow key={`${row.key}-${row.value}`} row={row} lead={i === 0} flash={changed.has(`${c.documentId}|${row.key}`)} />
                ))}
              </ol>
              {chasers.length ? (
                <ol className="flex flex-col border-t border-lavender/10 pt-1">
                  {chasers.map((row) => (
                    <li key={`${row.key}-${row.value}`} className={cn('flex items-center gap-3 rounded-control px-2 py-1.5', changed.has(`${c.documentId}|${row.key}`) && s.flashOnNavy)}>
                      <span className="w-6 text-center t-num-16 text-lavender-2">{row.position}</span>
                      <Delta delta={row.delta} />
                      <Avatar name={row.name} src={row.avatar} size={24} />
                      <span className="min-w-0 flex-1 truncate t-label text-lavender">{row.name}</span>
                      <span className="t-label text-lavender-2 tabular-nums">{row.value == null ? '–' : `${formatDecimal(row.value, 1, 3)} kg`}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
              <Chase rows={top} />
            </>
          ) : (
            <p className="py-6 text-center t-body text-lavender-2">Încă nu s-a cântărit nimic.</p>
          )}
        </div>
      </div>
      {extra && extra.weighings.length ? <Momentum card={c} extra={extra} /> : null}
    </article>
  );
}

function HeroStat({ label, value, format, unit }: { label: string; value: number | null; format: (n: number) => string; unit?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="order-2 t-caption text-lavender-2">{label}</dt>
      <dd className="order-1 flex items-baseline gap-1 text-lavender">
        <span className="t-num-26 2xl:t-num-40">{value == null ? '–' : <Roll value={value} format={format} />}</span>
        {unit && value != null ? <span className="t-body-strong text-lavender-2">{unit}</span> : null}
      </dd>
    </div>
  );
}

/** A tower row on navy: place, delta, face, name + seat, value (rolls on change). */
function TowerRow({ row, lead, flash }: { row: MiniRow; lead: boolean; flash: boolean }) {
  return (
    <li className={cn('flex items-center gap-3 rounded-control px-2 py-2', flash && s.flashOnNavy, lead && 'bg-lavender/10')}>
      <span className={cn('w-6 text-center t-num-26', lead ? 'text-lavender' : 'text-lavender-2')}>{row.position}</span>
      <Delta delta={row.delta} />
      <span className="relative">
        <Avatar name={row.name} src={row.avatar} size={40} />
        {row.fresh ? <span className="absolute -inset-0.5 rounded-full border-2 border-live-dot" aria-hidden /> : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate t-body-strong text-lavender">{row.name}</span>
        <Seat row={row} className="text-lavender-2" />
      </span>
      <span className="flex items-baseline gap-1 text-lavender">
        <span className="t-num-18">{row.value == null ? '–' : <Roll value={row.value} format={(n) => formatDecimal(n, 1, 3)} fromZero={false} />}</span>
        <span className="t-caption text-lavender-2">kg</span>
      </span>
    </li>
  );
}

/** Strava's «you vs the one ahead»: the gap to the leader and a two-tone bar. */
function Chase({ rows }: { rows: MiniRow[] }) {
  const [a, b] = rows;
  if (!a || !b || a.value == null || b.value == null || a.value <= 0) return null;
  const gap = a.value - b.value;
  const pct = Math.max(4, Math.min(100, (b.value / a.value) * 100));
  const close = gap / a.value < 0.1;
  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <p className="t-caption text-lavender-2">
        {gap === 0 ? (
          'Egalitate în frunte'
        ) : (
          <>
            Locul 2 e la <strong className="t-label text-lavender">{formatKg(gap)} kg</strong> de lider{close ? ' · luptă strânsă' : ''}
          </>
        )}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-lavender/15" aria-hidden>
        <div className={cn('h-full rounded-full transition-[width] duration-(--duration-slow) ease-medium', close ? 'bg-live-dot' : 'bg-lavender-2')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Sofascore-style momentum: kg weighed per interval across the competition window. */
function Momentum({ card: c, extra }: { card: CompetitionCard; extra: LiveExtra }) {
  const first = new Date(extra.weighings[0].at).getTime();
  const last = new Date(extra.weighings[extra.weighings.length - 1].at).getTime();
  const from = Math.min(c.startDate ? new Date(c.startDate).getTime() : first, first);
  const to = Math.max(c.endDate ? new Date(c.endDate).getTime() : last, last);
  const bars = momentum(extra.weighings, from, to, 32);
  const max = Math.max(...bars, 1);
  const lastIdx = bars.reduce((acc, v, i) => (v > 0 ? i : acc), 0);
  return (
    <div className="relative z-above border-t border-lavender/15 px-6 pt-4 pb-5 xl:px-8">
      <p className="mb-2 flex items-center justify-between t-eyebrow text-lavender-2 uppercase">
        <span>Ritmul cântăririlor · kg pe interval</span>
        <span className="normal-case">
          {extra.weighings.length} {extra.weighings.length === 1 ? 'cântărire' : 'cântăriri'}
        </span>
      </p>
      <div className="flex h-14 items-end gap-1" role="img" aria-label={`Kg cântărite pe intervale, între ${clock(new Date(from).toISOString())} și ${clock(new Date(to).toISOString())}`}>
        {bars.map((v, i) => (
          <span
            key={i}
            className={cn('flex-1 rounded-t-[3px]', s.bar, v === 0 ? 'bg-lavender/10' : i === lastIdx ? 'bg-lavender' : 'bg-lavender-2/70')}
            style={{ height: `${v === 0 ? 6 : Math.max(14, (v / max) * 100)}%`, '--i': i } as CSSProperties}
          />
        ))}
      </div>
      <p className="mt-1.5 flex justify-between t-micro text-lavender-2 tabular-nums">
        <span>{clock(new Date(from).toISOString())}</span>
        <span>{clock(new Date(to).toISOString())}</span>
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- ticker */

type Heavy = BigCatch & { compId: string; compName: string };

/** The heaviest fish across every live competition (catches API, weight desc). */
function heaviest(cards: CompetitionCard[], live: LiveData): Heavy[] {
  return cards
    .flatMap((c) => (live.extras[c.documentId]?.topCatches ?? []).map((x) => ({ ...x, compId: c.documentId, compName: c.name })))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);
}

function TickerPanel({ items, heaviest }: { items: Ticker; heaviest: Heavy[] }) {
  const [paused, setPaused] = useState(false);
  const [shown, setShown] = useState(items);
  if (!paused && shown !== items) setShown(items);
  const latest = shown[0];
  return (
    <section
      aria-labelledby="a2-ticker"
      className={cn('flex min-h-0 flex-col rounded-bento bg-surface shadow-e0', s.rise)}
      style={{ '--i': 2 } as CSSProperties}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <header className="flex items-center justify-between gap-2 border-b border-hairline px-5 py-4">
        <h2 id="a2-ticker" className="flex items-center gap-2 t-heading text-ink">
          <ScaleIcon aria-hidden className="size-4 text-accent" />
          Cântăriri recente
        </h2>
        <span className="t-caption text-muted">{paused ? 'pauză' : 'în direct'}</span>
      </header>
      {/* One polite summary per refresh, never one announcement per row. */}
      <p className="sr-only" aria-live="polite">
        {latest ? `Ultima cântărire: ${latest.name ?? `standul ${latest.stand}`}, ${formatKg(latest.kg)} kilograme, ${latest.compName}` : ''}
      </p>
      <ol className="flex flex-col divide-y divide-hairline overflow-y-auto">
        {shown.map((w, i) => (
          <li key={w.id} className={cn('relative flex items-center gap-3 px-5 py-3 transition-colors duration-(--duration-fast) hover:bg-soft-fill', i === 0 && s.slideIn)}>
            <Avatar name={w.name ?? `Stand ${w.stand ?? ''}`} size={32} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate t-body-strong text-ink">
                <Link href={routes.competitionWeighings(w.compId)} className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent">
                  {w.name ?? `Standul ${w.stand}`}
                </Link>
              </span>
              <span className="truncate t-caption text-muted">
                {w.sector && w.stand ? `Stand ${w.stand} · ` : ''}
                {w.compName}
              </span>
            </span>
            <span className="flex flex-col items-end">
              <span className="flex items-baseline gap-0.5 text-ink">
                <span className="t-num-18">{formatKg(w.kg)}</span>
                <span className="t-caption text-muted">kg</span>
              </span>
              <Ago iso={w.at} className="t-micro text-muted" />
            </span>
          </li>
        ))}
      </ol>
      {heaviest.length ? (
        <div className="mt-auto flex flex-col gap-2 border-t border-hairline px-5 pt-4 pb-5">
          <h3 className="flex items-center gap-1.5 t-eyebrow text-muted uppercase">
            <TrophyIcon aria-hidden className="size-3.5 text-medal-gold" />
            Cei mai grei pești acum
          </h3>
          <ol className="flex flex-col gap-2">
            {heaviest.map((x, i) => (
              <li key={`${x.compId}-${x.name}-${x.weight}-${i}`} className="flex items-center gap-2.5">
                <span className="w-4 text-center t-label text-muted tabular-nums">{i + 1}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate t-label text-ink">{x.name}</span>
                  <span className="truncate t-micro text-muted">{x.compName}</span>
                </span>
                <span className="flex items-baseline gap-0.5">
                  <span className="t-num-16 text-ink">{formatKg(x.weight)}</span>
                  <span className="t-caption text-muted">kg</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

/* ---------------------------------------------------------------- highlights */

function Highlights({ items, cards }: { items: Highlight[]; cards: CompetitionCard[] }) {
  const reduced = useReducedMotion();
  const rail = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ prev: false, next: false });
  const measure = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    const prev = el.scrollLeft > 4;
    const next = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges((e) => (e.prev === prev && e.next === next ? e : { prev, next }));
  }, []);
  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);
  const page = (dir: 1 | -1) => rail.current?.scrollBy({ left: dir * rail.current.clientWidth * 0.85, behavior: reduced ? 'auto' : 'smooth' });

  return (
    <section className="flex flex-col gap-4" aria-labelledby="a2-moments">
      <div className="flex items-center justify-between gap-4">
        <h2 id="a2-moments" className="flex items-center gap-2 t-title2 text-ink">
          <FireIcon aria-hidden className="size-5 text-live" />
          Momente cheie
          <span className="t-body text-muted">{items.length}</span>
        </h2>
        {edges.prev || edges.next ? (
          <div className="flex gap-1.5">
            <RailButton label="Momentele anterioare" disabled={!edges.prev} onClick={() => page(-1)}>
              <ChevronLeftIcon aria-hidden className="size-5" />
            </RailButton>
            <RailButton label="Următoarele momente" disabled={!edges.next} onClick={() => page(1)}>
              <ChevronRightIcon aria-hidden className="size-5" />
            </RailButton>
          </div>
        ) : null}
      </div>
      <ul ref={rail} onScroll={measure} data-prev={edges.prev} data-next={edges.next} className={cn('-mx-1 flex gap-4 overflow-x-auto px-1 pt-1 pb-3', s.rail)}>
        {items.map((h, i) => (
          <li key={h.id} className={cn('w-64 shrink-0 2xl:w-72', s.rise)} style={{ '--i': i } as CSSProperties}>
            <Moment h={h} card={cards.find((c) => c.documentId === h.compId)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function RailButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full bg-surface text-ink shadow-e0 transition-[background-color,opacity] duration-(--duration-fast) hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-40 disabled:hover:bg-surface"
    >
      {children}
    </button>
  );
}

function MomentShell({ href, tone = 'surface', icon, label, comp, children }: { href: string; tone?: 'surface' | 'navy'; icon: ReactNode; label: string; comp: string; children: ReactNode }) {
  const navy = tone === 'navy';
  return (
    <Link
      href={href}
      className={cn(
        'group flex h-full min-h-56 flex-col gap-3 rounded-card p-4 outline-none transition-[translate,box-shadow] duration-(--duration-fast) ease-fast hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-accent',
        navy ? 'bg-navy hover:shadow-e2' : 'bg-surface shadow-e0 hover:shadow-[var(--shadow-e2),var(--shadow-e0)]',
      )}
    >
      <span className={cn('flex items-center gap-1.5 t-eyebrow uppercase', navy ? 'text-lavender-2' : 'text-accent-ink')}>
        {icon}
        {label}
      </span>
      <div className="flex flex-1 flex-col gap-3">{children}</div>
      <span className={cn('flex items-center justify-between gap-2 t-caption', navy ? 'text-lavender-2' : 'text-muted')}>
        <span className="truncate">{comp}</span>
        <ArrowRightIcon aria-hidden className="size-4 shrink-0 transition-transform duration-(--duration-fast) ease-fast group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

function Moment({ h }: { h: Highlight; card?: CompetitionCard }) {
  const href = routes.competition(h.compId);
  if (h.kind === 'record') {
    return (
      <MomentShell href={href} tone="navy" icon={<TrophyIcon aria-hidden className="size-3.5 text-medal-gold" />} label="Cea mai mare captură" comp={h.compName}>
        <p className="flex items-baseline gap-1 text-lavender">
          <span className="t-num-64">{formatDecimal(h.catch.weight, 1, 3)}</span>
          <span className="t-heading text-lavender-2">kg</span>
        </p>
        <Person c={h.catch} onNavy />
      </MomentShell>
    );
  }
  if (h.kind === 'leader') {
    return (
      <MomentShell href={href} icon={<BoltIcon aria-hidden className="size-3.5" />} label="Lider" comp={h.compName}>
        <span className="flex items-center gap-3">
          <Avatar name={h.row.name} src={h.row.avatar} size={48} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate t-heading text-ink">{h.row.name}</span>
            <Seat row={h.row} className="text-muted" />
          </span>
        </span>
        <p className="mt-auto flex items-baseline gap-1">
          <span className="t-num-40 text-ink">{h.row.value == null ? '–' : formatDecimal(h.row.value, 1, 3)}</span>
          <span className="t-body-strong text-muted">kg</span>
        </p>
        <p className="t-caption text-muted">{h.gap != null && h.gap > 0 ? `+${formatKg(h.gap)} kg față de locul 2` : h.valueLabel}</p>
      </MomentShell>
    );
  }
  if (h.kind === 'battle') {
    return (
      <MomentShell href={href} icon={<FireIcon aria-hidden className="size-3.5 text-live" />} label="Luptă strânsă" comp={h.compName}>
        <span className="flex items-center justify-center gap-2 py-1">
          <Avatar name={h.first.name} src={h.first.avatar} size={48} ring />
          <span className="t-label text-muted">vs</span>
          <Avatar name={h.second.name} src={h.second.avatar} size={48} ring />
        </span>
        <p className="text-center t-caption text-muted">
          <span className="t-label text-ink">{h.first.name}</span> și <span className="t-label text-ink">{h.second.name}</span>
        </p>
        <p className="mt-auto flex items-baseline justify-center gap-1">
          <span className="t-num-40 text-ink">{formatKg(h.gap)}</span>
          <span className="t-body-strong text-muted">kg între ei</span>
        </p>
      </MomentShell>
    );
  }
  if (h.kind === 'weighing') {
    const w = h.weighing;
    return (
      <MomentShell href={routes.competitionWeighings(h.compId)} icon={<ScaleIcon aria-hidden className="size-3.5" />} label="Ultima cântărire" comp={h.compName}>
        <span className="flex items-center gap-3">
          <Avatar name={w.name ?? `Stand ${w.stand ?? ''}`} size={48} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate t-heading text-ink">{w.name ?? `Standul ${w.stand}`}</span>
            <Ago iso={w.at} className="t-caption text-muted" />
          </span>
        </span>
        <p className="mt-auto flex items-baseline gap-1">
          <span className="t-num-40 text-ink">{formatKg(w.kg)}</span>
          <span className="t-body-strong text-muted">kg</span>
        </p>
        <p className="t-caption text-muted">
          {w.catches} {w.catches === 1 ? 'captură' : 'capturi'}
          {w.stand ? ` · stand ${w.stand}` : ''}
        </p>
      </MomentShell>
    );
  }
  const max = Math.max(...h.catches.map((x) => x.weight), 1);
  return (
    <MomentShell href={routes.competitionCatches(h.compId)} icon={<TrophyIcon aria-hidden className="size-3.5" />} label="Cei mai mari pești" comp={h.compName}>
      <ol className="flex flex-col gap-2.5">
        {h.catches.map((x, i) => (
          <li key={`${x.name}-${x.weight}-${i}`} className="flex flex-col gap-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate t-label text-ink">{x.name}</span>
              <span className="t-label text-ink tabular-nums">{formatKg(x.weight)} kg</span>
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-soft-fill" aria-hidden>
              <span className={cn('block h-full rounded-full', i === 0 ? 'bg-accent' : 'bg-indigo-4')} style={{ width: `${(x.weight / max) * 100}%` }} />
            </span>
          </li>
        ))}
      </ol>
    </MomentShell>
  );
}

function Person({ c, onNavy }: { c: BigCatch; onNavy?: boolean }) {
  return (
    <span className="mt-auto flex items-center gap-2.5">
      <Avatar name={c.name} size={32} />
      <span className="flex min-w-0 flex-col">
        <span className={cn('truncate t-label', onNavy ? 'text-lavender' : 'text-ink')}>{c.name}</span>
        {c.stand ? <span className={cn('t-caption', onNavy ? 'text-lavender-2' : 'text-muted')}>Stand {c.stand}</span> : null}
      </span>
    </span>
  );
}

/* ---------------------------------------------------------------- secondary cards */

function LiveCard({ card: c, extra, changed, index }: { card: CompetitionCard; extra?: LiveExtra; changed: Set<string>; index: number }) {
  const r = extra?.ranking;
  const top = r?.rows.filter((x) => x.catches > 0).slice(0, 3) ?? [];
  const spark = extra ? cumulative(extra.weighings) : [];
  const fresh = r?.rows.filter((x) => x.fresh) ?? [];
  const href = routes.competition(c.documentId);
  const catches = r?.totalCatches ?? c.results?.catchCount ?? 0;
  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-bento bg-surface shadow-[var(--shadow-e1),var(--shadow-e0)] transition-[translate,box-shadow] duration-(--duration-fast) ease-fast hover:-translate-y-0.5 hover:shadow-[var(--shadow-e2),var(--shadow-e0)]',
        s.rise,
      )}
      style={{ '--i': index + 3 } as CSSProperties}
    >
      <Thumb card={c} big sizes="(min-width: 1280px) 600px, 100vw" className="h-36">
        <div className="absolute inset-x-0 top-0 flex justify-between p-3">
          <Pill tone="live">LIVE</Pill>
          <Pill tone="scrim">
            <EyeIcon aria-hidden className="size-3.5" />
            {formatInt(c.viewers)}
          </Pill>
        </div>
      </Thumb>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <p className="t-eyebrow text-muted uppercase">{dateWithHours(c)}</p>
          <h3 className="line-clamp-2 t-title2 text-ink">
            <Link href={href} className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent">
              {c.name}
            </Link>
          </h3>
          <p className="truncate t-label text-accent-ink">{lakeLine(c)}</p>
        </div>

        <dl className="grid grid-cols-3 gap-3 rounded-card bg-page px-4 py-3">
          <MiniStat label="capturi" value={formatInt(catches)} />
          <MiniStat label="cea mai mare" value={r?.biggestCatch ? formatKg(r.biggestCatch.weight) : c.results?.biggestFishKg != null ? formatKg(c.results.biggestFishKg) : '–'} unit="kg" />
          <MiniStat label={c.format.unit} value={formatInt(c.joinedCount)} />
        </dl>

        {top.length ? (
          <ol className="flex flex-col">
            {top.map((row) => (
              <li
                key={`${row.key}-${row.value}`}
                className={cn('flex items-center gap-2.5 rounded-control px-1.5 py-1.5', changed.has(`${c.documentId}|${row.key}`) && s.flash)}
              >
                <span className="w-4 text-center t-num-16 text-ink">{row.position}</span>
                <Delta delta={row.delta} />
                <Avatar name={row.name} src={row.avatar} size={32} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate t-label text-ink">{row.name}</span>
                  <Seat row={row} className="text-muted" />
                </span>
                <span className="t-body-strong text-ink tabular-nums">
                  {row.value == null ? '–' : formatDecimal(row.value, 1, 3)}
                  <span className="ms-0.5 t-caption text-muted">kg</span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-card border border-dashed border-hairline px-4 py-5 text-center t-body text-muted">Încă nicio captură cântărită</p>
        )}

        <div className="mt-auto flex items-end justify-between gap-4">
          {spark.length >= 2 ? (
            <Sparkline points={spark} />
          ) : fresh.length ? (
            <FreshFaces rows={fresh} />
          ) : (
            <span />
          )}
          <span className="flex items-center gap-1 t-label text-accent-ink">
            Urmărește live
            <ArrowRightIcon aria-hidden className="size-4 transition-transform duration-(--duration-fast) ease-fast group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </article>
  );
}

function MiniStat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="order-2 truncate t-caption text-muted">{label}</dt>
      <dd className="order-1 flex items-baseline gap-0.5 text-ink">
        <span className="t-num-18">{value}</span>
        {unit && value !== '–' ? <span className="t-caption text-muted">{unit}</span> : null}
      </dd>
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const w = 160;
  const h = 40;
  const max = Math.max(...points);
  const step = w / (points.length - 1);
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(h - 2 - (v / max) * (h - 6)).toFixed(1)}`).join(' ');
  return (
    <span className="flex flex-col gap-0.5">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-40 overflow-visible text-accent" role="img" aria-label={`Kg cântărite cumulat: ${formatDecimal(max, 1, 1)} kg`}>
        <path d={`${d} L${w},${h} L0,${h} Z`} className="fill-accent-tint" />
        <path d={d} pathLength={1} className={cn('fill-none stroke-current', s.draw)} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={w} cy={h - 2 - (h - 6)} r={3} className="fill-accent" />
      </svg>
      <span className="t-micro text-muted">kg cântărite, cumulat</span>
    </span>
  );
}

/** Instagram-stories cue: the anglers who weighed most recently, ringed. */
function FreshFaces({ rows }: { rows: MiniRow[] }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex *:not-first:-ml-2">
        {rows.slice(0, 5).map((r) => (
          <span key={r.key} className="rounded-full border-2 border-live-dot">
            <Avatar name={r.name} src={r.avatar} size={24} ring />
          </span>
        ))}
      </span>
      <span className="t-caption text-muted">au cântărit recent</span>
    </span>
  );
}

/* ---------------------------------------------------------------- small parts */

function Delta({ delta }: { delta: number | null }) {
  if (delta == null || delta === 0) {
    return <span className="w-7 text-center t-micro text-faint" aria-hidden>{delta === 0 ? '–' : ''}</span>;
  }
  const up = delta > 0;
  return (
    <span
      className={cn(
        'inline-flex w-7 items-center justify-center rounded-full t-micro-strong tabular-nums',
        up ? 'bg-status-success-bg text-status-success-fg' : 'bg-status-live-bg text-status-live-fg',
      )}
      title={up ? `a urcat ${delta} ${delta === 1 ? 'loc' : 'locuri'}` : `a coborât ${-delta} ${delta === -1 ? 'loc' : 'locuri'}`}
    >
      {up ? <ChevronUpIcon aria-hidden className="size-3" /> : <ChevronDownIcon aria-hidden className="size-3" />}
      {Math.abs(delta)}
      <span className="sr-only">{up ? ' locuri urcate' : ' locuri coborâte'}</span>
    </span>
  );
}

function Seat({ row, className }: { row: MiniRow; className?: string }) {
  if (!row.sector && !row.stand) return null;
  const fill = row.sector ? sectorFill(row.sector, 'var(--color-muted)') : null;
  return (
    <span className={cn('flex items-center gap-1 t-caption', className)}>
      {fill ? <span className={cn('size-1.5 rounded-full', fill.className)} style={fill.style} aria-hidden /> : null}
      {row.sector ? `Sector ${row.sector}` : ''}
      {row.stand ? ` · stand ${row.stand}` : ''}
    </span>
  );
}

/* ---------------------------------------------------------------- toast */

function Toast({ toast, onClose }: { toast: ToastData; onClose: () => void }) {
  const reduced = useReducedMotion();
  return (
    <div role="status" className={cn('fixed right-6 bottom-6 z-toast flex w-80 items-center gap-3 rounded-card bg-navy p-4 shadow-e2', !reduced && s.toast)}>
      <Avatar name={toast.name} size={40} />
      <Link href={toast.href} className="flex min-w-0 flex-1 flex-col outline-none focus-visible:outline-2 focus-visible:outline-lavender">
        <span className="t-eyebrow text-lavender-2 uppercase">{toast.title}</span>
        <span className="line-clamp-2 t-label text-lavender">{toast.body}</span>
      </Link>
      <button type="button" onClick={onClose} className="rounded-control px-2 py-1 t-caption text-lavender-2 hover:bg-lavender/10">
        Închide
      </button>
    </div>
  );
}
