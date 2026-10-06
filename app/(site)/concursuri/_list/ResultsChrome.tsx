'use client';

import type { ReactNode } from 'react';
import { AdjustmentsHorizontalIcon, ArrowLeftIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { RESULTS_BACK, RESULTS_LABEL, RESULTS_ROW, resultsCircleClass, resultsPillClass } from './resultsChromeStyles';

/*
 * competitions-list.results.c3 / c4 — fish CompetitionResultsChrome: in results mode the title, the
 * eye, the search row and the status tabs give way to a square back button and a pill carrying what
 * was asked (the search label, else «Concursuri filtrate») with the filters circle inside it. The
 * pill is the search field's own shape (SEARCH_SHELL), the back square the page tools' look
 * (./resultsChromeStyles, shared with the page's Suspense frame).
 *
 * Two placements (CompetitionsScreen): below 1280 a sticky band over the list, with the filters
 * circle; from 1280 in the centre column, where the search row sits on the index — the docked
 * filter column is on screen there, so no circle (as ListToolbar's FilterButton).
 */
export function ResultsChrome({
  label,
  filterCount,
  onBack,
  onPressLabel,
  labelOpensDialog = true,
  onOpenFilters,
  filtersExpanded,
  trailing,
}: {
  label: string;
  filterCount: number;
  onBack: () => void;
  /** Reopens the search when one is committed, else the filters (c4) — or, docked, focuses the column. */
  onPressLabel: () => void;
  /** The label opens a dialog (search / filters) — false when it moves focus to the docked column. */
  labelOpensDialog?: boolean;
  /** The filters circle; omitted where the docked column is on screen. */
  onOpenFilters?: () => void;
  filtersExpanded?: boolean;
  /** After the pill: «Reîmprospătează» (results.c14, the index's pull-to-refresh stand-in). */
  trailing?: ReactNode;
}) {
  const active = filterCount > 0;
  return (
    <div className={RESULTS_ROW}>
      <button type="button" onClick={onBack} aria-label="Înapoi la concursuri" className={RESULTS_BACK}>
        <ArrowLeftIcon aria-hidden />
      </button>
      <div className={resultsPillClass(Boolean(onOpenFilters))}>
        <button
          type="button"
          onClick={onPressLabel}
          aria-haspopup={labelOpensDialog ? 'dialog' : undefined}
          aria-label={`${label}. Schimbă căutarea`}
          className={RESULTS_LABEL}
        >
          <MagnifyingGlassIcon aria-hidden className="size-5 shrink-0 text-muted" />
          <span className="truncate t-body text-ink">{label}</span>
        </button>
        {onOpenFilters ? (
          <button
            type="button"
            onClick={onOpenFilters}
            aria-haspopup="dialog"
            aria-expanded={filtersExpanded}
            aria-label={active ? `Filtre, ${filterCount} active` : 'Filtre'}
            className={resultsCircleClass(active)}
          >
            <AdjustmentsHorizontalIcon aria-hidden />
          </button>
        ) : null}
      </div>
      {trailing}
    </div>
  );
}
