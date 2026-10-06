'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ArrowRightIcon, ChevronRightIcon, PhotoIcon, TrophyIcon } from '@heroicons/react/20/solid';
import { formatDecimal, formatInt } from '@/components/cards/format';
import { sectorFill } from '@/components/ranking/sector';
import { Avatar } from '@/components/ui/Avatar';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { StatusPill } from '@/components/ui/StatusPill';
import { cardRankingLabel, formatKg, formatTotalKg, type CompetitionCard } from '@/core/competitions';
import { routes } from '@/lib/routes';
import type { ResultDetail } from './data';
import { pointsText, resultsPodium, unitShort, valueText, type MiniRanking, type MiniRow } from './model';
import { Roll } from './motion';
import { DateBlock, dayParts, formatLabel, lakeLine, MONTHS_FULL, ROW_LIST, unitFor, ValueBone } from './parts';
import s from './desktop.module.css';

/*
 * Rezultate on desktop (≥1024) — compact rows with only the winner (owner: «nu afișăm tot podiumul»).
 * A points ranking (core resultHeadline: feeder, Cantitate+Calitate, Cal/Cal, CMMC, CN, FIPSed — the
 * fewest win) reads points («p») in its winner, podium and places, never kg.
 * References: Linear / Vercel lists (whole-row target, metadata right, actions revealed on hover in
 * a reserved slot — no layout shift), Material 3 hover state layer, GitHub Actions' expand-to-
 * detail, Stripe's tabular numerals. Hover: indigo wash, a 2px accent bar grows on the left, the
 * winner's face gets a gold ring and nudges, the chevron slides, «Clasament» fades in.
 * Click / Enter / Space: the row expands inline (grid 0fr→1fr, 260 ms) — podium 2·1·3 rising in
 * order, the stats, places 4–8, the viewer's own place. One row open at a time. ↑/↓ move between
 * rows (roving tabindex), Home/End jump. Months are sticky headers pinned under the top bar.
 */

const NONE: ResultDetail = { state: 'none' };

/** Month headers pin under the top bar AND the list's own sticky chrome (tabs), never behind it. */
const LIST_CHROME_TOP = 'top-[calc(--spacing(16)_+_var(--shell-banner-h,0px)_+_var(--list-chrome-h,0px))]';

const COLS =
  'grid-cols-[48px_minmax(0,1fr)_minmax(0,240px)_112px_120px_20px] xl:grid-cols-[48px_minmax(0,1fr)_minmax(0,300px)_128px_96px_120px_20px] 2xl:grid-cols-[48px_minmax(0,1fr)_minmax(0,340px)_140px_110px_132px_20px]';

export function Results({ cards, details, onWant }: { cards: CompetitionCard[]; details: Record<string, ResultDetail>; onWant: (id: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(cards[0]?.documentId ?? null);
  const refs = useRef(new Map<string, HTMLButtonElement>());

  const groups: Array<{ key: string; label: string; cards: CompetitionCard[] }> = [];
  for (const c of cards) {
    const d = c.startDate ? dayParts(c.startDate) : null;
    const key = d ? `${d.year}-${d.month}` : 'tbd';
    const label = d ? `${MONTHS_FULL[d.month]} ${d.year}` : 'Fără dată';
    const g = groups.at(-1);
    if (g && g.key === key) g.cards.push(c);
    else groups.push({ key, label, cards: [c] });
  }
  const order = cards.map((c) => c.documentId);
  // The roving tab stop: the focused row while it is still in the list, else the first row — a
  // filter, a search or a refetch that drops it never leaves the list without a tab stop.
  const current = focusId && order.includes(focusId) ? focusId : (order[0] ?? null);

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
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`rezultate-${g.key}`} className="flex flex-col">
          <h3 id={`rezultate-${g.key}`} className={cn('sticky z-sticky -mx-1 flex items-baseline gap-2 bg-page px-1 py-2 t-title2 text-ink', LIST_CHROME_TOP)}>
            {g.label}
            <span className="t-body text-muted">
              {g.cards.length} {g.cards.length === 1 ? 'concurs' : 'concursuri'}
            </span>
          </h3>
          <ul className={ROW_LIST}>
            {g.cards.map((c) => (
              <ResultRow
                key={c.documentId}
                card={c}
                detail={details[c.documentId] ?? NONE}
                open={open === c.documentId}
                tabbable={current === c.documentId}
                onWant={() => onWant(c.documentId)}
                onToggle={() => {
                  onWant(c.documentId);
                  setFocusId(c.documentId);
                  setOpen((o) => (o === c.documentId ? null : c.documentId));
                }}
                onKey={(e) => move(e, c.documentId)}
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

function ResultRow({
  card: c,
  detail,
  open,
  tabbable,
  onWant,
  onToggle,
  onKey,
  buttonRef,
}: {
  card: CompetitionCard;
  detail: ResultDetail;
  open: boolean;
  tabbable: boolean;
  /** Hover / focus: the ranking is about to be wanted — read it now. */
  onWant: () => void;
  onToggle: () => void;
  onKey: (e: KeyboardEvent<HTMLButtonElement>) => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
}) {
  const r = c.results;
  const ranking = detail.state === 'ready' ? detail.ranking : null;
  const mine = detail.state === 'ready' ? detail.mine : null;
  // One source for the row AND its panel: the ranking when it crowns the card's winner, else the
  // card's podium without values — never «X · Câștigător» here and someone else on the podium.
  const podium = usePodium(c, ranking);
  const winner = podium.rows[0] ?? null;
  const winnerName = winner?.name ?? null;
  const winnerAvatar = winner?.avatar ?? null;
  const panelId = `rezultate-panel-${c.documentId}`;
  // Keep the panel mounted after the first open, so closing animates too.
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  return (
    <li className={cn('group/row relative', open && 'bg-accent-tint/60')} onPointerEnter={onWant} onFocus={onWant}>
      {/* The left accent bar: grows on hover / focus / open. */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 w-0.5 origin-center bg-accent transition-transform duration-(--duration-fast) ease-fast',
          open ? 'scale-y-100' : 'scale-y-0 group-hover/row:scale-y-100 group-has-[button:focus-visible]/row:scale-y-100',
        )}
      />
      <div className={cn('relative grid min-h-16 items-center gap-5 px-5 py-3 transition-colors duration-(--duration-fast) group-hover/row:bg-accent-tint/50', COLS)}>
        <DateBlock card={c} size="sm" />

        <div className="flex min-w-0 flex-col gap-0.5">
          <h4 className="min-w-0">
            <button
              ref={buttonRef}
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              tabIndex={tabbable ? 0 : -1}
              onClick={onToggle}
              onKeyDown={onKey}
              className="block w-full cursor-pointer truncate text-left t-heading text-ink outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent"
            >
              {c.name}
            </button>
          </h4>
          <p className="flex min-w-0 items-center gap-1.5 t-caption text-muted">
            <span className="truncate">{lakeLine(c)}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0">{formatLabel(c)}</span>
            {mine ? (
              <StatusPill tone="info" className="ms-1">
                Locul tău: {mine.position}
              </StatusPill>
            ) : null}
          </p>
        </div>

        {/* The winner only. */}
        {winnerName ? (
          <span className="flex min-w-0 items-center gap-3">
            <span className="relative shrink-0 rounded-full transition-[translate,box-shadow] duration-(--duration-fast) ease-fast group-hover/row:-translate-y-0.5 group-hover/row:shadow-[0_0_0_2px_var(--color-medal-gold)]">
              <Avatar name={winnerName} src={winnerAvatar} size={40} />
              <span className="absolute -right-1 -bottom-1 inline-flex size-4.5 items-center justify-center rounded-full border-2 border-surface bg-medal-gold t-micro-strong text-on-medal">1</span>
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate t-body-strong text-ink">{winnerName}</span>
              {detail.state === 'pending' ? (
                <ValueBone className="mt-1 w-20" />
              ) : (
                <span className="t-caption text-muted tabular-nums">{winner && ranking && podium.fromRanking ? winnerValue(winner, ranking) : 'Câștigător'}</span>
              )}
            </span>
          </span>
        ) : (
          <span className="t-caption text-muted">{r?.hasCatches ? 'Clasament în lucru' : 'Fără capturi'}</span>
        )}

        <span className="flex flex-col items-end">
          <span className="flex items-baseline gap-0.5 text-ink">
            <span className="t-num-18">{r?.biggestFishKg != null ? formatKg(r.biggestFishKg) : '–'}</span>
            {r?.biggestFishKg != null ? <span className="t-caption text-muted">kg</span> : null}
          </span>
          <span className="t-caption text-muted">cea mai mare</span>
        </span>

        <span className="hidden flex-col items-end xl:flex">
          <span className="t-num-18 text-ink">{formatInt(c.joinedCount)}</span>
          <span className="t-caption text-muted">{unitFor(c.joinedCount, c.format.unit)}</span>
        </span>

        {/* Reserved slot: the action fades in, nothing shifts. */}
        <span className="flex justify-end">
          <Link
            href={routes.competitionRanking(c.documentId)}
            tabIndex={tabbable || open ? 0 : -1}
            className={cn(
              buttonClass({ variant: 'secondary', size: 'compact' }),
              // Hidden = not clickable either: a tap in the reserved slot expands the row, never opens
              // a control nobody sees. On a screen without hover (iPad landscape) it is always shown.
              'pointer-events-none relative z-above opacity-0 transition-opacity duration-(--duration-fast) group-hover/row:pointer-events-auto group-hover/row:opacity-100 group-has-[:focus-visible]/row:pointer-events-auto group-has-[:focus-visible]/row:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100',
              open && 'pointer-events-auto opacity-100',
            )}
          >
            Clasament
          </Link>
        </span>

        <ChevronRightIcon
          aria-hidden
          className={cn('size-5 text-muted transition-transform duration-(--duration-fast) ease-fast', open ? 'rotate-90 text-accent' : 'group-hover/row:translate-x-0.5')}
        />
      </div>

      <div id={panelId} role="region" aria-label={`Rezultate ${c.name}`} className={s.collapse} data-open={open} inert={!open}>
        <div>{mounted ? <Panel card={c} detail={detail} podium={podium} /> : null}</div>
      </div>
    </li>
  );
}

type Podium = ReturnType<typeof resultsPodium>;

/** The row's podium source; a ranking that crowns someone else than the card is logged once. */
function usePodium(c: CompetitionCard, ranking: MiniRanking | null): Podium {
  const podium = resultsPodium(c.results?.podium ?? [], ranking);
  const logged = useRef(false);
  useEffect(() => {
    if (podium.agrees || logged.current) return;
    logged.current = true;
    console.warn(`[rezultate] ${c.documentId}: the ranking's first («${ranking?.rows[0]?.name}») is not the card's winner («${c.results?.podium[0]?.displayName}»); showing the card's podium.`);
  }, [podium.agrees, c, ranking]);
  return podium;
}

/** The winner's figure: «12,345 kg total», «8,1 kg · medie», a points ranking «3 puncte». */
function winnerValue(row: MiniRow, r: MiniRanking): string {
  if (row.value == null || row.catches === 0) return 'Câștigător';
  if (r.unit === 'puncte') return pointsText(row.value);
  return `${valueText(row.value, 'kg')} kg${r.valueLabel === 'kg total' ? ' total' : ` · ${r.valueLabel}`}`;
}

/* ---------------------------------------------------------------- expanded panel */

function Panel({ card: c, detail, podium: source }: { card: CompetitionCard; detail: ResultDetail; podium: Podium }) {
  const r = c.results;
  const ranking = detail.state === 'ready' ? detail.ranking : null;
  // Places 4–8 only from a ranking that agrees with the card's podium.
  const rows = source.fromRanking ? (ranking?.rows ?? []) : [];
  const podium = source.rows;
  const rest = rows.slice(3, 8);
  const mine = detail.state === 'ready' ? detail.mine : null;
  const unit = ranking?.unit ?? 'kg';

  if (!r?.hasCatches) {
    return (
      <div className="flex items-center justify-between gap-4 border-t border-hairline px-5 py-6 ps-[92px]">
        <p className="t-body text-muted">Concursul s-a încheiat fără capturi cântărite.</p>
        <Link href={routes.competition(c.documentId)} className={buttonClass({ variant: 'ghost', size: 'compact' })}>
          Vezi concursul
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 border-t border-hairline px-5 pt-5 pb-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] xl:ps-[92px]">
      {/* Podium 2 · 1 · 3, equal-width blocks at 0.8 / 1 / 0.65 height, rising 3 → 2 → 1. */}
      <div className="flex flex-col gap-3">
        <p className="t-eyebrow text-muted uppercase">Podium · {cardRankingLabel(c)}</p>
        <ol className="grid h-56 grid-cols-3 items-end gap-2">
          {[1, 0, 2].map((idx) => {
            const p = podium[idx];
            if (!p) return <li key={idx} />;
            const h = idx === 0 ? 100 : idx === 1 ? 80 : 65;
            const medal = idx === 0 ? 'bg-medal-gold' : idx === 1 ? 'bg-medal-silver' : 'bg-medal-bronze';
            return (
              <li key={p.key} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
                <Avatar name={p.name} src={p.avatar} size={40} />
                <span className="line-clamp-2 min-h-[2lh] w-full text-center t-label text-ink" title={p.name}>
                  {p.name}
                </span>
                <span
                  className={cn('flex w-full flex-col items-center justify-start gap-0.5 rounded-t-control pt-2', idx === 0 ? 'bg-navy' : 'bg-accent-tint-2', s.podium)}
                  style={{ height: `${h * 0.5}%`, '--i': 2 - idx } as CSSProperties}
                >
                  <span className={cn('inline-flex size-6 items-center justify-center rounded-full t-micro-strong text-on-medal', medal)}>{idx + 1}</span>
                  {p.value != null && p.catches > 0 ? (
                    <span className={cn('t-label tabular-nums', idx === 0 ? 'text-lavender' : 'text-accent-ink')}>
                      {valueText(p.value, unit)} {unitShort(unit)}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Stat bento. */}
      <div className="flex flex-col gap-3">
        <p className="t-eyebrow text-muted uppercase">În cifre</p>
        <dl className="grid grid-cols-2 gap-2">
          <Stat label="capturi" value={r.catchCount} format={formatInt} />
          <Stat label="kg total" value={r.totalKg} format={(n) => formatTotalKg(n)} unit="kg" />
          <Stat label={unitFor(c.joinedCount, c.format.unit)} value={c.joinedCount} format={formatInt} />
          <Stat
            label={ranking?.biggestCatch ? `cea mai mare · ${ranking.biggestCatch.name}` : 'cea mai mare'}
            value={r.biggestFishKg}
            format={(n) => formatDecimal(n, 1, 3)}
            unit="kg"
            accent
          />
        </dl>
      </div>

      {/* Places 4–8 + the viewer + links. */}
      <div className="flex flex-col gap-3">
        <p className="t-eyebrow text-muted uppercase">{rest.length ? `Locurile 4–${3 + rest.length}` : 'Clasament'}</p>
        {detail.state === 'pending' ? (
          <div aria-hidden className="flex flex-col gap-2 rounded-card bg-surface p-3 shadow-e0">
            {[0, 1, 2, 3].map((i) => (
              <ValueBone key={i} className="h-4" />
            ))}
          </div>
        ) : rest.length ? (
          <ol className="flex flex-col divide-y divide-hairline rounded-card bg-surface shadow-e0">
            {rest.map((row, i) => (
              <li
                key={row.key}
                className={cn('flex items-center gap-2.5 px-3 py-2', s.rise, mine?.position === row.position && 'bg-accent-tint')}
                style={{ '--i': i } as CSSProperties}
                aria-current={mine?.position === row.position ? 'true' : undefined}
              >
                <span className="w-5 text-center t-num-16 text-ink-2">{row.position}</span>
                {row.sector ? (
                  <span className={cn('size-1.5 shrink-0 rounded-full', sectorFill(row.sector, 'var(--color-muted)').className)} aria-hidden />
                ) : null}
                <Avatar name={row.name} src={row.avatar} size={24} />
                <span className="min-w-0 flex-1 truncate t-label text-ink">
                  {row.name}
                  {mine?.position === row.position ? <span className="ms-1.5 t-micro-strong text-accent-ink">· tu</span> : null}
                </span>
                <span className="t-label text-ink tabular-nums">{row.value != null && row.catches > 0 ? `${valueText(row.value, unit)} ${unitShort(unit)}` : '–'}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="t-caption text-muted">Toate locurile sunt în clasamentul complet.</p>
        )}
        {mine && mine.position > 3 + rest.length ? (
          <p className="flex items-center justify-between rounded-control bg-accent-tint px-3 py-2 t-label text-accent-ink">
            <span>Tu · locul {mine.position}</span>
            <span className="tabular-nums">{mine.value != null ? `${valueText(mine.value, unit)} ${unitShort(unit)}` : ''}</span>
          </p>
        ) : null}
      </div>

      <div className="flex flex-row-reverse flex-wrap items-center justify-start gap-2 border-t border-hairline pt-4 xl:col-span-full">
        <Link href={routes.competitionRanking(c.documentId)} className={buttonClass({ variant: 'primary', size: 'compact', className: 'gap-1' })}>
          Clasamentul complet
          <ArrowRightIcon aria-hidden className="size-4" />
        </Link>
        <Link href={routes.competitionStatistics(c.documentId)} className={buttonClass({ variant: 'ghost', size: 'compact' })}>
          <TrophyIcon aria-hidden className="me-1 size-4" />
          Statistici
        </Link>
        <Link href={routes.competitionCatches(c.documentId)} className={buttonClass({ variant: 'ghost', size: 'compact' })}>
          <PhotoIcon aria-hidden className="me-1 size-4" />
          Toți peștii
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value, format, unit, accent }: { label: string; value: number | null; format: (n: number) => string; unit?: string; accent?: boolean }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5 rounded-card px-4 py-3', accent ? 'bg-navy' : 'bg-page')}>
      <dt className={cn('order-2 truncate t-caption', accent ? 'text-lavender-2' : 'text-muted')} title={label}>
        {label}
      </dt>
      <dd className={cn('order-1 flex items-baseline gap-1', accent ? 'text-lavender' : 'text-ink')}>
        <span className="t-num-26">{value == null ? '–' : <Roll value={value} format={format} />}</span>
        {unit && value != null ? <span className={cn('t-body-strong', accent ? 'text-lavender-2' : 'text-muted')}>{unit}</span> : null}
      </dd>
    </div>
  );
}
