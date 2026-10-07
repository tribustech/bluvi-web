'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowsPointingOutIcon, ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { PauseIcon, PlayIcon } from '@heroicons/react/24/solid';
import {
  ALL_SECTORS_ID,
  barRatio,
  competitionTimelineSnapshotQuery,
  eventTimestamps,
  formatAxisLabel,
  metricLabel,
  metricRange,
  nextPlayMs,
  PLAY_TICK_MS,
  rankStands,
  standIdentifier,
  standSubtitle,
  standValuesAt,
  timelineRange,
  timelineSectors,
  timelineStandInfo,
  timelineVisibleStands,
  isNcRankingType,
  type CompetitionStatus,
  type CompetitionWithMyStatus,
  type TimelineMetricKey,
  type TimelineSnapshot,
  type TimelineStand,
} from '@/core/competitions';
import type { Transport } from '@/core/transport';
import { IconButton, iconButtonClass } from '@/components/nav/IconButton';
import { formatDecimal, plural } from '@/components/cards/format';
import { sectorColor } from '@/components/ranking/sector';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { ErrorState } from '@/components/surfaces/StateCard';
import { ChoiceChips } from '@/components/templates/T1';
import { DetailSection } from '@/components/templates/T3';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { isOfflineEmpty, OfflineState } from './offline';
import { QueryRetry } from './QueryRetry';
import { formatKg } from './ranking';
import { PAGE_RETRY } from './retry-policy';

/*
 * «Cronologia standurilor» — fish components/competition/StandProgressionChart.tsx (parity
 * competition-page.cronologie): one bar per stand, ranked by its value at the slider's time; sector
 * and metric chips; play / pause scrubs the competition in ~14 s; a stand pressed is focused (the
 * others dimmed) with its readout. Two variants: `card` in Statistici (the top 6, «Vezi toate» and
 * the expand control to the page) and `page` (/statistici/cronologie, every stand).
 *
 * Each bar is drawn in its own sector's colour (the sector token, as every other sector mark on the
 * page: ranking stripes, sector dots, the donut), the accent when the competition has one sector; a
 * stand with no value yet has only a hairline baseline. Rows keep their place in the DOM (stand
 * order, so focus never jumps) and move visually to their rank, like fish's animated rows; each
 * row's name says its place. Weights are «x,xxx kg» (fish formatMetricValue: three decimals, in the
 * card and on the page alike; the Romanian grouping), an unknown value is «—».
 */

const CARD_MAX_STANDS = 6;
/** Past this many sectors the sector chips are one scrolling row at every width (24 → 4 rows). */
const SECTOR_CHIPS_WRAP_MAX = 8;
/** One press of a chip-row arrow: about three chips. */
const CHIPS_SCROLL_STEP = 240;
/** One row: 28px bar row + 4px gap (fish 22 + 4; 28 keeps a comfortable press target). */
const ROW_STEP = 32;

/** fish formatMetricValue: counts as integers, weights «x,xxx kg» (three decimals), «—» unknown. */
function formatValue(metric: TimelineMetricKey, value: number | null | undefined): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  if (metric === 'catchCount' || metric === 'bestOfCount') return formatDecimal(Math.round(value), 0, 0);
  return `${formatKg(value, 3)} kg`;
}

/** The row label: «A1» (the stand name already carries its sector), «A/12» under «Toate», «12» in a sector. */
function rowLabel(stand: TimelineStand, allSectors: boolean): string {
  const name = stand.standName ?? `#${stand.standId}`;
  const sector = stand.sectorName?.trim();
  if (!allSectors || !sector || name.toUpperCase().startsWith(sector.toUpperCase())) return name;
  return `${sector}/${name}`;
}

const HIDDEN_STATUSES = new Set(['draft', 'notStarted', 'cancelled']);

const CARD_TITLE = 'Cronologia standurilor';
const LOADING_DESCRIPTION = 'Evoluția scorului fiecărui stand pe parcursul competiției.';
const LOADED_DESCRIPTION = 'Trage timpul de mai jos pentru a vedea evoluția scorurilor.';
const EMPTY_LIVE = 'Nu există cântăriri înregistrate încă.';
/** A 204 on a competition that ran: no snapshot was kept for it — never «not yet». */
const EMPTY_PAST = 'Cronologia nu este disponibilă pentru acest concurs.';
const emptyCopy = (status: CompetitionStatus) => (status === 'started' ? EMPTY_LIVE : EMPTY_PAST);


type Variant = 'card' | 'page';

/** The statuses with no timeline at all (fish draws nothing): no read, no card. */
export function timelineHidden(status: string | null | undefined): boolean {
  return !status || HIDDEN_STATUSES.has(status);
}

/** The snapshot read (shared with the Statistici grid, which lays the card out by its outcome). */
export function useTimelineSnapshot(t: Transport, competition: Pick<CompetitionWithMyStatus, 'documentId' | 'competitionStatus'>) {
  const status = competition.competitionStatus as CompetitionStatus | undefined;
  return useQuery({
    ...competitionTimelineSnapshotQuery(t, competition.documentId, status, { enabled: !timelineHidden(status) }),
    ...PAGE_RETRY,
  });
}

export function StandTimeline({
  t,
  competition,
  variant,
  emptyClassName,
}: {
  t: Transport;
  competition: Pick<CompetitionWithMyStatus, 'documentId' | 'competitionStatus' | 'registrations'>;
  variant: Variant;
  /** The card's classes when there is no snapshot (the Statistici grid gives it the whole row). */
  emptyClassName?: string;
}) {
  const status = competition.competitionStatus as CompetitionStatus | undefined;
  const hidden = timelineHidden(status);
  const q = useTimelineSnapshot(t, competition);
  if (hidden || !status) return null;
  const href = routes.competitionStandTimeline(competition.documentId);

  // Offline with nothing cached: TanStack pauses the read and leaves it pending (offline.tsx).
  if (isOfflineEmpty(q)) {
    return (
      <Frame variant={variant} description={LOADING_DESCRIPTION}>
        <OfflineState fetching={q.isFetching} onRetry={() => void q.refetch()} />
      </Frame>
    );
  }
  if (q.isPending) {
    return (
      <Frame variant={variant} description={LOADING_DESCRIPTION}>
        <TimelineChartSkeleton rows={variant === 'card' ? CARD_MAX_STANDS : standCount(competition)} />
      </Frame>
    );
  }
  if (q.isError && !q.data) {
    return (
      <Frame variant={variant} description={LOADING_DESCRIPTION}>
        <ErrorState
          title="Nu s-a putut încărca cronologia."
          action={<QueryRetry fetching={q.isFetching} failed onRetry={() => void q.refetch()} size="compact" />}
        />
      </Frame>
    );
  }
  if (!q.data) {
    // 204: no snapshot. Live: no weighing has been closed yet; after the competition: none was kept.
    return (
      <Frame variant={variant} description={LOADING_DESCRIPTION} className={emptyClassName}>
        <p className="t-body text-ink-2">{emptyCopy(status)}</p>
      </Frame>
    );
  }
  return <Chart data={q.data} competition={competition} status={status} variant={variant} href={href} />;
}

/** The stands the page will draw (registered on a stand), for the skeleton's height; 8 when unknown. */
function standCount(competition: Pick<CompetitionWithMyStatus, 'registrations'>): number {
  const n = competition.registrations.filter(r => r.registrationStatus === 'registered' && r.stand).length;
  return n > 0 ? n : 8;
}

/**
 * The chart's shape while it loads (route loading, the session / competition fallbacks, the read):
 * the two chip rows, `rows` bar rows at the chart's row step, the slider and its axis.
 */
export function TimelineChartSkeleton({ rows = 8, label = 'Se încarcă cronologia standurilor' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-3">
      <div aria-hidden className="flex flex-col gap-4">
        <span className="flex gap-2 overflow-hidden">
          {['w-16', 'w-20', 'w-20', 'w-20'].map((w, i) => (
            <span key={i} className={cn('h-9 shrink-0 animate-shimmer rounded-full', w)} />
          ))}
        </span>
        <span className="flex gap-2">
          {['w-24', 'w-20'].map((w, i) => (
            <span key={i} className={cn('h-9 shrink-0 animate-shimmer rounded-full', w)} />
          ))}
        </span>
      </div>
      <span aria-hidden className="flex flex-col gap-1">
        {Array.from({ length: rows }, (_, i) => (
          <span key={i} className="flex h-7 items-center gap-2">
            <span className="h-3 w-12 shrink-0 animate-shimmer rounded-full" />
            <span className="h-5.5 flex-1 animate-shimmer rounded-control" style={{ maxWidth: `${100 - i * (60 / Math.max(rows, 1))}%` }} />
          </span>
        ))}
      </span>
      <span aria-hidden className="flex items-center gap-2.5">
        <span className="size-12 shrink-0 animate-shimmer rounded-full xl:size-10" />
        <span className="h-1.5 flex-1 animate-shimmer rounded-full" />
      </span>
      <span aria-hidden className="flex justify-between">
        <span className="h-3 w-10 animate-shimmer rounded-full" />
        <span className="h-3 w-10 animate-shimmer rounded-full" />
        <span className="h-3 w-10 animate-shimmer rounded-full" />
      </span>
    </div>
  );
}

function Frame({
  variant,
  description,
  action,
  className,
  children,
}: {
  variant: Variant;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  if (variant === 'page') return <div className="flex flex-col gap-4">{children}</div>;
  return (
    <DetailSection
      id="cronologie"
      title={CARD_TITLE}
      description={description}
      action={action}
      className={cn('max-md:rounded-card max-md:shadow-e0', className)}
    >
      {children}
    </DetailSection>
  );
}

function Chart({
  data,
  competition,
  status,
  variant,
  href,
}: {
  data: TimelineSnapshot;
  competition: Pick<CompetitionWithMyStatus, 'registrations'>;
  status: CompetitionStatus;
  variant: Variant;
  href: string;
}) {
  const scroll = useBreakpoint() === 'mobile';
  const card = variant === 'card';
  const info = useMemo(() => timelineStandInfo(competition.registrations), [competition.registrations]);
  const sectors = useMemo(() => timelineSectors(data.stands), [data.stands]);
  const [sectorId, setSectorId] = useState(ALL_SECTORS_ID);
  const [metric, setMetric] = useState<TimelineMetricKey>(data.defaultMetric);
  const [focused, setFocused] = useState<number | null>(null);

  const visible = useMemo(() => timelineVisibleStands(data.stands, sectorId), [data.stands, sectorId]);
  // A focus on a stand the chosen sector does not hold would grey every bar with no readout.
  const focusVisible = focused !== null && visible.some(s => s.standId === focused);
  const range = useMemo(() => timelineRange(data, status), [data, status]);
  const { startMs, endMs, isMultiDay } = range;
  const [sliderMs, setSliderMs] = useState(range.initialMs);
  const [playing, setPlaying] = useState(false);
  // A re-read (live: refresh on return, the view switch) grows the range: a slider that was at the
  // latest moment follows it to the new latest one; one the reader moved stays, kept inside the range.
  const [rangeSeen, setRangeSeen] = useState(range);
  if (range !== rangeSeen) {
    const wasLatest = sliderMs >= rangeSeen.initialMs || sliderMs >= rangeSeen.endMs - 1;
    setRangeSeen(range);
    setSliderMs(wasLatest && !playing ? range.initialMs : Math.min(Math.max(sliderMs, range.startMs), range.endMs));
  }
  // One sector: the accent for every bar (the sector colour would only repeat the same hue).
  const singleSector = sectors.length <= 2;
  const barColor = (stand: TimelineStand) => (singleSector || !stand.sectorName ? 'var(--color-accent)' : sectorColor(stand.sectorName));
  const events = useMemo(() => eventTimestamps(visible), [visible]);

  // fish's play loop: one step every 33 ms until the end (then play rewinds first).
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setSliderMs(prev => {
        const next = nextPlayMs(prev, { startMs, endMs, events });
        if (next.done) setPlaying(false);
        return next.ms;
      });
    }, PLAY_TICK_MS);
    return () => clearInterval(id);
  }, [playing, startMs, endMs, events]);

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (sliderMs >= endMs - 1) setSliderMs(startMs);
    setPlaying(true);
  };

  const yRange = useMemo(() => metricRange(visible, metric), [visible, metric]);
  const values = useMemo(() => standValuesAt(visible, metric, sliderMs), [visible, metric, sliderMs]);
  const ranks = useMemo(() => rankStands(values), [values]);
  const hiddenCount = card ? Math.max(0, visible.length - CARD_MAX_STANDS) : 0;
  const shownCount = card ? Math.min(visible.length, CARD_MAX_STANDS) : visible.length;
  const allSectors = sectorId === ALL_SECTORS_ID;

  const readout = useMemo(() => {
    if (focused === null) return null;
    const entry = values.find(v => v.stand.standId === focused);
    if (!entry) return null;
    const standInfo = info.get(entry.stand.standId);
    return {
      color: barColor(entry.stand),
      identifier: standIdentifier(entry.stand),
      subtitle: standSubtitle(standInfo, entry.stand.teamName, entry.stand.guestName, data.rankingType),
      club: isNcRankingType(data.rankingType) ? standInfo?.clubName?.trim() || null : null,
      value: entry.value,
      time: entry.event?.t ?? null,
    };
    // barColor reads only `singleSector`, derived from the same data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, values, info, data.rankingType, singleSector]);

  const expand = (
    <Link href={href} aria-label="Deschide cronologia standurilor pe toată pagina" className={iconButtonClass({ className: '-my-2 -mr-2' })}>
      <ArrowsPointingOutIcon aria-hidden />
    </Link>
  );

  const body = (
    <div className="flex flex-col gap-3">
      {/* Two controls, set apart: the sector filter (one scrolling row past 8 sectors) and the metric. */}
      <div className="flex flex-col gap-4">
        <ScrollingChips active={scroll || sectors.length > SECTOR_CHIPS_WRAP_MAX}>
          <ChoiceChips
            name="cronologie-sector"
            label="Sector"
            scroll={scroll || sectors.length > SECTOR_CHIPS_WRAP_MAX}
            options={sectors.map(s => ({ value: s.sectorId, label: s.label }))}
            value={sectorId}
            onChange={id => {
              setSectorId(id);
              setFocused(null);
            }}
          />
        </ScrollingChips>
        <ChoiceChips
          name="cronologie-metrica"
          label="Indicator"
          scroll={scroll}
          options={data.availableMetrics.map(m => ({ value: m, label: metricLabel(m) }))}
          value={metric}
          onChange={setMetric}
        />
      </div>

      {visible.length === 0 ? (
        <p className="t-body text-ink-2">{emptyCopy(status)}</p>
      ) : (
        <>
          <ol
            aria-label={`Standurile după ${metricLabel(metric).toLowerCase()}`}
            className="relative overflow-hidden"
            style={{ height: shownCount * ROW_STEP - 4 } as CSSProperties}
          >
            {values.map(({ stand, value }) => {
              const rank = ranks.get(stand.standId) ?? 0;
              if (card && rank >= CARD_MAX_STANDS) return null;
              const isFocused = focused === stand.standId;
              const dimmed = focusVisible && !isFocused;
              const label = rowLabel(stand, allSectors);
              const formatted = formatValue(metric, value);
              const known = value !== null;
              return (
                <li
                  key={stand.standId}
                  className="absolute inset-x-0 top-0 h-7 transition-transform duration-(--duration-medium) ease-medium motion-reduce:transition-none"
                  style={{ transform: `translateY(${rank * ROW_STEP}px)` }}
                >
                  <button
                    type="button"
                    aria-pressed={isFocused}
                    aria-label={`Locul ${rank + 1}: ${allSectors ? `Sector ${stand.sectorName}, standul ${stand.standName}` : `Standul ${stand.standName}`}, ${known ? formatted : 'fără valoare'}`}
                    onClick={() => setFocused(f => (f === stand.standId ? null : stand.standId))}
                    className="flex h-7 w-full cursor-pointer items-center gap-2 rounded-control text-left hover:bg-soft-fill"
                  >
                    <span aria-hidden className={cn('w-14 shrink-0 truncate pl-1 t-micro-strong', dimmed || !known ? 'text-muted' : 'text-ink')}>
                      {label}
                    </span>
                    {known ? (
                      <span aria-hidden className="h-5.5 min-w-0 flex-1 overflow-hidden rounded-control bg-accent-tint">
                        <span
                          className={cn(
                            'block h-full rounded-control transition-[width] duration-(--duration-fast) ease-fast motion-reduce:transition-none',
                            dimmed && 'bg-faint',
                          )}
                          style={{
                            width: `${barRatio(value, yRange) * 100}%`,
                            ...(dimmed ? {} : { background: barColor(stand) }),
                          }}
                        />
                      </span>
                    ) : (
                      // No value yet: a baseline, not a pale pill that reads as loading.
                      <span aria-hidden className="h-px min-w-0 flex-1 bg-hairline" />
                    )}
                    <span aria-hidden className={cn('w-20 shrink-0 pr-1 text-right t-micro tabular-nums', dimmed || !known ? 'text-muted' : 'text-ink')}>
                      {formatted}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {hiddenCount > 0 ? (
            <Link href={href} className="self-end rounded-control t-label text-accent-ink hover:underline">
              Vezi toate ({plural(visible.length, 'stand', 'standuri')}) →
            </Link>
          ) : null}

          {/* On the phone page the scrubber stays at the bottom of the screen while the bars are in
              view, so dragging it shows the ranking move. */}
          <div
            className={cn(
              'flex flex-col gap-1',
              !card && 'max-md:sticky max-md:bottom-0 max-md:z-sticky max-md:-mx-4 max-md:border-t max-md:border-hairline max-md:bg-surface max-md:px-4 max-md:pt-2 max-md:pb-[max(--spacing(2),env(safe-area-inset-bottom))]',
            )}
          >
            <div className="flex items-center gap-2.5">
              {/* The kit filled button, icon only (48 / 40). */}
              <Button
                onClick={togglePlay}
                icon={playing ? <PauseIcon /> : <PlayIcon />}
                className="w-12 px-0 xl:w-10"
              >
                <span className="sr-only">{playing ? 'Pauză' : 'Redă evoluția'}</span>
              </Button>
              <input
                type="range"
                aria-label="Momentul din concurs"
                aria-valuetext={formatAxisLabel(sliderMs, isMultiDay)}
                min={startMs}
                max={endMs}
                step={1000}
                value={sliderMs}
                onChange={e => {
                  // Dragging (or the arrow keys) pauses playback (fish Scrubber).
                  setPlaying(false);
                  setSliderMs(Number(e.target.value));
                }}
                className="h-9 min-w-0 flex-1 cursor-pointer accent-accent"
              />
            </div>
            <div className="flex justify-between t-micro tabular-nums">
              <span className="text-muted">{formatAxisLabel(startMs, isMultiDay)}</span>
              <span className="t-micro-strong text-accent-ink" aria-live={playing ? 'off' : 'polite'}>
                {formatAxisLabel(sliderMs, isMultiDay)}
              </span>
              <span className="text-muted">{formatAxisLabel(endMs, isMultiDay)}</span>
            </div>
          </div>

          {readout ? (
            <div className="flex overflow-hidden rounded-card border border-hairline bg-surface">
              <span aria-hidden className="w-1 shrink-0" style={{ background: readout.color }} />
              <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    {readout.club ? <p className="t-eyebrow text-muted uppercase">{readout.club}</p> : null}
                    <p className="t-body-strong text-ink">{readout.identifier}</p>
                    {readout.subtitle ? <p className="t-caption text-muted">{readout.subtitle}</p> : null}
                  </div>
                  <IconButton aria-label="Închide" onClick={() => setFocused(null)} className="-mt-2 -mr-2">
                    <XMarkIcon aria-hidden />
                  </IconButton>
                </div>
                <dl className="flex gap-4 border-t border-hairline pt-2">
                  <div className="flex flex-1 flex-col gap-0.5">
                    <dt className="t-eyebrow text-muted uppercase">{metricLabel(metric)}</dt>
                    <dd className="t-body text-ink tabular-nums">{formatValue(metric, readout.value)}</dd>
                  </div>
                  {readout.time ? (
                    <div className="flex flex-1 flex-col items-end gap-0.5">
                      <dt className="t-eyebrow text-muted">ULTIMA CÂNTĂRIRE</dt>
                      <dd className="t-body-strong text-ink tabular-nums">{formatAxisLabel(new Date(readout.time).getTime(), isMultiDay)}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );

  return (
    <Frame variant={variant} description={LOADED_DESCRIPTION} action={card ? expand : undefined}>
      {body}
    </Frame>
  );
}

/**
 * A chip row that scrolls (24 sectors): its clipped edge fades where more chips wait, and from 768
 * two arrows scroll it by about three chips, so the overflow reads as more, never as a cut-off chip.
 */
function ScrollingChips({ active, children }: { active: boolean; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  useEffect(() => {
    const row = active ? box.current?.querySelector<HTMLElement>('[role="radiogroup"]') : null;
    if (!row) return;
    const read = () =>
      setEdges({ start: row.scrollLeft <= 1, end: row.scrollLeft + row.clientWidth >= row.scrollWidth - 1 });
    read();
    row.addEventListener('scroll', read, { passive: true });
    const ro = new ResizeObserver(read);
    ro.observe(row);
    return () => {
      row.removeEventListener('scroll', read);
      ro.disconnect();
    };
  }, [active]);
  if (!active) return <>{children}</>;
  const by = (dx: number) => box.current?.querySelector<HTMLElement>('[role="radiogroup"]')?.scrollBy({ left: dx, behavior: 'smooth' });
  const fade = !edges.start && !edges.end
    ? 'linear-gradient(to right, transparent, black calc(var(--spacing) * 6), black calc(100% - var(--spacing) * 6), transparent)'
    : !edges.end
      ? 'linear-gradient(to left, transparent, black calc(var(--spacing) * 6))'
      : !edges.start
        ? 'linear-gradient(to right, transparent, black calc(var(--spacing) * 6))'
        : undefined;
  return (
    <div className="flex items-center gap-1">
      <IconButton
        aria-label="Sectoarele anterioare"
        aria-disabled={edges.start || undefined}
        onClick={() => {
          if (!edges.start) by(-CHIPS_SCROLL_STEP);
        }}
        className={cn('-ml-2 shrink-0 max-md:hidden', edges.start && 'cursor-default opacity-40')}
      >
        <ChevronLeftIcon aria-hidden />
      </IconButton>
      <div ref={box} className="min-w-0 flex-1 overflow-hidden" style={fade ? { maskImage: fade, WebkitMaskImage: fade } : undefined}>
        {children}
      </div>
      <IconButton
        aria-label="Sectoarele următoare"
        aria-disabled={edges.end || undefined}
        onClick={() => {
          if (!edges.end) by(CHIPS_SCROLL_STEP);
        }}
        className={cn('-mr-2 shrink-0 max-md:hidden', edges.end && 'cursor-default opacity-40')}
      >
        <ChevronRightIcon aria-hidden />
      </IconButton>
    </div>
  );
}
