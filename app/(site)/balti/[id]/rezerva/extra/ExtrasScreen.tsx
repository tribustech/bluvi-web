'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { durationLabel, formatBookingPeriod, rowLabelAddsMeaning, wallHour } from '@/core/booking';
import {
  T4ActionBar,
  T4ActionTotal,
  T4ChoiceCard,
  T4Frame,
  T4Gate,
  T4Header,
  T4Notice,
  T4PriceRows,
  T4Spinner,
  T4Summary,
  T4TotalLine,
  type T4Back,
  type T4Row,
  type T4Total,
} from '@/components/templates/T4';
import { Button, buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { offeredForSelection, selectionStand } from '../_flow/guards';
import { useFlowQuote, useLiveAvailability } from '../_flow/hooks';
import { readFlowParams, stepHref } from '../_flow/params';
import { lei } from '../_grid/model';
import { ExtrasSkeleton } from './ExtrasSkeleton';
import { continueHeld, extraLine, extrasRedirect, keepOffered, quoteView, toggleExtra, tourNights, type QuoteView } from './model';

/*
 * Step 2 of the angler's booking flow — fish app/(app)/book-lake/[lakeId]/extras.tsx + ExtrasStep
 * (parity booking.rezerva-extra). Only reached when the chosen stand can add something to this
 * tour (the grid's nextStepFromGrid, c2).
 *
 * State: the selection and the chosen extras live in the URL (_flow/params.ts) — the selection as
 * the grid wrote it, the extras rewritten on every toggle with history.replaceState (Next's router
 * follows it without re-running the page's session gate, as the grid does), so a reload or a
 * shared link keeps both. Each toggle re-quotes the tour with the sorted list (c6); the query is
 * cached per stand / window / extras, so toggling back shows that answer at once while it is read
 * again. «Continuă» is held until the CURRENT list has a server total (c7).
 *
 * Data: the availability is LIVE (client-only, staleTime 0 — booking.b.live-availability) and gives
 * the stand's extras and the lake's time zone; the lake's name and checkout buffer come from the
 * cached public lake (page.tsx).
 */

export type ExtrasLake = { documentId: string; name: string; checkoutBufferMinutes: number | null };

const TITLE = 'Extra';
const SUBTITLE = 'Poți adăuga la rezervare, dacă vrei.';

type NavigationLike = { currentEntry?: { index: number } | null; entries?: () => { url: string | null }[] };

/** The entry under this one is the grid (the way the angler came): step back onto it. */
function previousIsGrid(gridPath: string): boolean {
  const nav = (window as unknown as { navigation?: NavigationLike }).navigation;
  const i = nav?.currentEntry?.index;
  if (!nav?.entries || i == null || i < 1) return false;
  const prev = nav.entries()[i - 1]?.url;
  return !!prev && new URL(prev).pathname === gridPath;
}

export function ExtrasScreen({ lake }: { lake: ExtrasLake }) {
  const lakeId = lake.documentId;
  const router = useRouter();
  const search = useSearchParams();
  const [initial] = useState(() => readFlowParams(new URLSearchParams(search.toString())));
  const sel = initial.selection;

  const { query, merged, checkoutBufferMinutes } = useLiveAvailability(lakeId);

  // ── Guard (c1, c2) ────────────────────────────────────────────────────────────────────────
  const redirect = extrasRedirect(lakeId, initial, merged);
  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);
  const ready = !!merged && !!sel && !redirect;

  // ── The chosen extras (the URL's, then the cards') ─────────────────────────────────────────
  const offered = useMemo(() => (ready ? offeredForSelection(merged, sel) : []), [ready, merged, sel]);
  const [picked, setPicked] = useState(initial.extras);
  const chosen = useMemo(() => keepOffered(picked, offered), [picked, offered]);
  useEffect(() => {
    if (!ready || !sel) return;
    const url = stepHref(lakeId, 'extras', { selection: sel, extras: chosen });
    if (url === `${window.location.pathname}${window.location.search}`) return;
    window.history.replaceState(null, '', url);
  }, [ready, sel, chosen, lakeId]);

  const quoteQ = useFlowQuote(lakeId, ready ? sel : null, chosen);
  const view = quoteView(quoteQ);
  const held = continueHeld(view);
  // The last priced answer, so the summary keeps its receipt (dimmed) while a toggle re-quotes
  // instead of collapsing and growing back ~300ms later (layout shift on the main interaction).
  const [lastPriced, setLastPriced] = useState<PricedView | null>(null);
  if (view.kind === 'priced' && lastPriced?.quote !== view.quote) setLastPriced(view);

  // ── Ways out ──────────────────────────────────────────────────────────────────────────────
  const gridHref = stepHref(lakeId, 'grid', { selection: sel, extras: [] });
  /** Back to the grid with the selection kept, the extras dropped (c8, fish goBack → clearExtras). */
  const goBack = useCallback(() => {
    if (previousIsGrid(new URL(gridHref, window.location.origin).pathname)) router.back();
    else router.replace(gridHref);
  }, [gridHref, router]);
  const onContinue = useCallback(() => {
    if (!sel) return;
    router.push(stepHref(lakeId, 'review', { selection: sel, extras: chosen }));
  }, [router, lakeId, sel, chosen]);

  const back: T4Back = { label: 'Înapoi la selecție', onClick: goBack };
  const header = <T4Header eyebrow={lake.name || 'Rezervare'} title={TITLE} back={back} />;

  if (!ready || !sel) {
    if (!merged && query.isError && sel) {
      // No availability AND the read failed: a retry, never a skeleton forever (owner rule 4).
      return (
        <T4Frame header={header} pageState>
          <T4Gate
            tone="danger"
            role="alert"
            align="start"
            indent
            icon={<ExclamationTriangleIcon />}
            title="A apărut o eroare la încărcarea disponibilității."
            actions={
              <button
                type="button"
                data-testid="availability-retry"
                aria-disabled={query.isFetching || undefined}
                onClick={query.isFetching ? undefined : () => void query.refetch()}
                className={buttonClass({ disabled: query.isFetching })}
              >
                {query.isFetching ? <T4Spinner /> : null}
                {query.isFetching ? 'Se reîncarcă…' : 'Încearcă din nou'}
              </button>
            }
          />
        </T4Frame>
      );
    }
    // Loading, or on the way back to the grid.
    return <ExtrasSkeleton lakeName={lake.name} back={back} />;
  }

  const stand = selectionStand(merged, sel);
  const nights = tourNights(merged!, sel);
  const buffer = checkoutBufferMinutes ?? lake.checkoutBufferMinutes ?? 0;
  // On the lake's clock, as the nights are (tourNights): a visitor in London sees the lake's 18:00.
  const timeZone = merged!.timezone;
  const period = formatBookingPeriod(sel.start, sel.end, buffer, timeZone);
  const refusedKey = view.kind === 'refused' ? refusalExtraKey(view.message, offered, chosen) : null;

  return (
    <T4Frame
      header={header}
      label={TITLE}
      busy={view.kind === 'quoting' || (view.kind === 'priced' && view.refreshing)}
      aside={
        <ExtrasSummary
          standName={stand?.name ?? null}
          period={period}
          startHour={wallHour(sel.start, timeZone)}
          view={view}
          lastPriced={lastPriced}
        />
      }
      actions={
        <T4ActionBar
          primary={
            // Held, never `disabled`: focus stays on it while the price loads (the T4 HeldButton).
            <button
              type="button"
              data-testid="extras-continue"
              aria-disabled={held || undefined}
              onClick={held ? undefined : onContinue}
              className={buttonClass({ disabled: held })}
            >
              Continuă
            </button>
          }
          back={
            <Button variant="ghost" onClick={goBack}>
              Înapoi
            </Button>
          }
          meta={<BarTotal view={view} />}
          metaBelowXl
        />
      }
    >
      <div className="flex flex-col gap-1">
        <p data-testid="extras-subtitle" className="t-body text-muted">
          {SUBTITLE}
        </p>
        {/* From 1280 the summary column says it; below, one line keeps the tour in view. */}
        <p data-testid="extras-context" className="t-caption text-ink-2 xl:hidden">
          {stand ? `Standul ${stand.name} · ` : ''}
          {period}
        </p>
      </div>

      <fieldset className="min-w-0">
        <legend className="sr-only">{TITLE}</legend>
        {/* One per row on a phone; two across from 768 when there are several, so the price stays
            beside its label. A lone extra (Chita sells only «Cabana») spans the column: half a column
            beside an empty band reads unfinished. */}
        <div data-testid="extras-list" className={cn('grid gap-2.5 md:gap-3', offered.length > 1 && 'md:grid-cols-2')}>
          {offered.map((e) => {
            const { price, note } = extraLine(e, nights);
            return (
              <T4ChoiceCard
                key={e.key}
                type="checkbox"
                name="extra"
                value={e.key}
                checked={chosen.includes(e.key)}
                onChange={(on) => setPicked(toggleExtra(chosen, e.key, on))}
                title={e.label}
                description={note ?? undefined}
                meta={<Price value={price} />}
                invalid={refusedKey === e.key}
              />
            );
          })}
        </div>
      </fieldset>

      {view.kind === 'refused' ? (
        <T4Notice tone="danger" role="alert" title={view.message}>
          {/* With an extra ticked, unticking it is the fix on this screen (the bare tour's price). */}
          {chosen.length > 0 ? 'Debifează extra-ul sau alege alt interval.' : 'Alege alt interval sau alt stand.'}
        </T4Notice>
      ) : null}
      {view.kind === 'failed' ? (
        <T4Notice
          tone="danger"
          role="alert"
          title="Nu am putut calcula prețul pentru acest interval."
          actions={
            <Button variant="secondary" size="compact" onClick={() => void quoteQ.refetch()}>
              Încearcă din nou
            </Button>
          }
        >
          Verifică legătura la internet și încearcă din nou.
        </T4Notice>
      ) : null}
    </T4Frame>
  );
}

/** «+150 lei»: the figure, then the unit as its own smaller, muted word (owner rule 10). */
function Price({ value }: { value: number }) {
  return (
    <span className="flex items-baseline whitespace-nowrap">
      <span className="t-heading text-accent-ink tabular-nums">+{lei(value)}</span>
      <span className="t-body-strong ms-1 text-muted">{' '}lei</span>
    </span>
  );
}

const money = (n: number) => `${lei(n)} lei`;

/** The total line's figure and its caption, by quote state (c7). */
function totalOf(view: QuoteView): T4Total {
  switch (view.kind) {
    case 'priced':
      return { label: 'Total', value: money(view.total), ...(view.refreshing ? { sub: 'Calculăm prețul…' } : {}) };
    case 'quoting':
      return { label: 'Total', value: null, sub: 'Calculăm prețul…', busy: true };
    case 'refused':
      // The tour or an extra is unavailable (the notice says which); the lake refused no price.
      return { label: 'Total', value: null, sub: 'Indisponibil', tone: 'danger' };
    case 'failed':
      return { label: 'Total', value: null, sub: 'Prețul nu e disponibil', tone: 'danger' };
  }
}

/** The bar's money line below 1280 (the summary column carries it from 1280). */
function BarTotal({ view }: { view: QuoteView }) {
  const t = totalOf(view);
  // No figure and nothing in flight (refused, failed): the reason is the bar's hint.
  const hint = t.value == null && !t.busy;
  return (
    <div data-testid="extras-bar-total">
      <T4ActionTotal label={hint ? (t.sub ?? t.label) : t.label} value={t.value} sub={hint ? undefined : t.sub} busy={t.busy} live />
    </div>
  );
}

type PricedView = Extract<QuoteView, { kind: 'priced' }>;

const fold = (v: string) => v.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * The ticked extra a refusal names («Cabana nu e disponibilă…» → the «Cabană» card), so that card
 * is marked; null when the sentence names none (the tour itself was refused).
 */
function refusalExtraKey(message: string, offered: { key: string; label: string }[], chosen: string[]): string | null {
  const m = fold(message);
  return offered.find((e) => chosen.includes(e.key) && e.label.trim() && m.includes(fold(e.label.trim())))?.key ?? null;
}

function ExtrasSummary({
  standName,
  period,
  startHour,
  view,
  lastPriced,
}: {
  standName: string | null;
  period: string;
  startHour: number;
  view: QuoteView;
  lastPriced: PricedView | null;
}) {
  const rows: T4Row[] = [
    { label: 'Standul', value: standName },
    {
      label: 'Perioada',
      // Start and end on their own lines (a multi-day period), never wrapped mid-date.
      value: (
        <span className="flex flex-col">
          {period.split(' – ').map((part) => (
            <span key={part}>{part}</span>
          ))}
        </span>
      ),
    },
  ];
  // While re-quoting, the last answer stays in place, dimmed, under «Calculăm prețul…» — the card
  // keeps its height. It is never this list's price: «Continuă» stays held (continueHeld).
  const quoting = view.kind === 'quoting' && !!lastPriced;
  const shown = view.kind === 'priced' ? view : quoting ? lastPriced : null;
  let priceRows: T4Row[] | undefined;
  if (shown) {
    const b = shown.quote.basis;
    priceRows = [
      {
        label: rowLabelAddsMeaning(b.rowLabel, b.durationHours) ? (b.rowLabel as string) : `Tur ${durationLabel(b.durationHours, startHour)}`,
        value: money(b.tourPrice),
      },
      ...b.extras.map((x) => ({ label: x.quantity > 1 ? `${x.label} × ${x.quantity}` : x.label, value: money(x.total) as ReactNode })),
    ];
  }
  const total: T4Total = quoting ? { label: 'Total', value: money(lastPriced!.total), sub: 'Calculăm prețul…' } : totalOf(view);
  return (
    <T4Summary title="Rezumat" rows={rows}>
      {priceRows ? (
        <div data-testid="extras-price-rows" aria-busy={quoting || undefined} className={cn('transition-opacity', quoting && 'opacity-50')}>
          <T4PriceRows rows={priceRows} />
        </div>
      ) : null}
      {/* The line is as tall with or without its caption (an invisible captioned copy in the same
          cell): «Calculăm prețul…» appearing moves nothing under it. */}
      <div className="grid">
        <div aria-hidden className="invisible col-start-1 row-start-1">
          <T4TotalLine total={{ label: '0', value: '0', sub: '0' }} />
        </div>
        <div aria-busy={quoting || undefined} className={cn('col-start-1 row-start-1 grid', quoting && '[&_.t-display]:opacity-50')}>
          <T4TotalLine total={total} live />
        </div>
      </div>
    </T4Summary>
  );
}
