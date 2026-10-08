'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { anglerFlow, pathOf, type FlowConfig } from './config';
import { stepHref, type FlowParams, type FlowStep } from './params';

/*
 * Leaving a step of the booking flow — fish BookingFlowProvider.exitFlow / useBookingGridFlow
 * goBack + backToGrid (parity booking.b.flow-state, rezerva-confirmare.c2/c20/c23).
 *
 * fish's flow is a nested stack: Back pops one step, `dismissTo(grid)` pops to the grid, `exitFlow`
 * pops the whole flow from its parent — the angler lands where the flow was entered (the lake page,
 * a booking, Setări). The web's steps are history entries, so the same moves are history
 * traversals, found with the Navigation API (this tab's same-origin entries only):
 *  - stepBack: the nearest earlier entry of the previous step, walking back through the flow's own
 *    entries only — a pop, never a pushed copy (the grid's pushed selection entry keeps the bare
 *    grid under it, B1's contract);
 *  - backToGrid: the nearest earlier bare grid (no selection) — fish dismissTo + clearSelection;
 *  - exitFlow: the first entry before the flow's run (skipping /intra, which a signed-out entry
 *    passed through) — fish navigation.goBack() from the flow's layout.
 * An entry in another document (reached by a full page load) is opened in place instead of
 * traversed to, so the app — and its toast — survive.
 * When the entry is not in this tab's history (a shared link, a reload in a new tab, a browser
 * without the API), the target is opened in place of the current entry instead: the previous step,
 * the bare grid, or the lake page.
 *
 * backToGrid and exitFlow are one-way (fish dismisses the steps: there is no way back into a review
 * that was submitted or whose stand is gone). A traversal leaves the step's entry in forward
 * history, so before it the entry is sealed: rewritten to the bare grid, marked so that Next's
 * router does not own it (no `__NA`). Forward onto it reloads the bare grid — never a priced review
 * with the form filled and a live CTA (a resubmit would hit the angler's own booking).
 */

type Entry = { url: string | null };

/** The lake's booking flow: /balti/[id]/rezerva and its steps (or the walk-in's, per `config`). */
export function isFlowUrl(url: URL, lakeId: string, config: FlowConfig = anglerFlow(lakeId)): boolean {
  const base = config.paths.grid;
  return url.pathname === base || url.pathname.startsWith(`${base}/`);
}

/** The pathname a step lives at. */
export function stepPath(lakeId: string, step: FlowStep, config: FlowConfig = anglerFlow(lakeId)): string {
  if (step === 'grid') return config.paths.grid;
  // Any selection: only the pathname is kept.
  const sel = { stand: '-', start: '-', end: '-' };
  return pathOf(step === 'extras' ? config.paths.extras(sel) : config.paths.review(sel));
}

/**
 * The distance (≤ -1) from `current` back to the nearest earlier entry `target` accepts, walking back
 * only through entries `through` accepts (and of `origin`); null when the walk leaves them first or
 * finds nothing. Pure: the hook below reads the entries from the Navigation API.
 */
export function historyDelta(
  entries: Entry[],
  current: number,
  origin: string,
  target: (url: URL) => boolean,
  through: (url: URL) => boolean
): number | null {
  for (let i = current - 1; i >= 0; i--) {
    let url: URL;
    try {
      url = new URL(entries[i]?.url ?? '');
    } catch {
      return null;
    }
    if (url.origin !== origin) return null;
    if (target(url)) return i - current;
    if (!through(url)) return null;
  }
  return null;
}

const isSignIn = (url: URL) => url.pathname === '/intra' || url.pathname.startsWith('/intra/');

/** Where the flow goes on a way out (pure, for the hook and the tests). */
export function flowTargets(lakeId: string, config: FlowConfig = anglerFlow(lakeId)) {
  const inFlow = (u: URL) => isFlowUrl(u, lakeId, config);
  return {
    step: (step: FlowStep) => ({
      target: (u: URL) => u.pathname === stepPath(lakeId, step, config),
      through: inFlow,
    }),
    bareGrid: {
      target: (u: URL) => u.pathname === stepPath(lakeId, 'grid', config) && !u.searchParams.has('stand'),
      through: inFlow,
    },
    exit: {
      target: (u: URL) => !inFlow(u) && !isSignIn(u),
      through: (u: URL) => inFlow(u) || isSignIn(u),
    },
  };
}

type NavEntry = Entry & { sameDocument?: boolean };
type NavigationLike = {
  entries?: () => NavEntry[];
  currentEntry?: { index: number } | null;
};

/** The entry found, its distance, and whether reaching it stays in this document. */
function find(target: (u: URL) => boolean, through: (u: URL) => boolean): { delta: number; href: string; sameDocument: boolean } | null {
  const nav = (window as unknown as { navigation?: NavigationLike }).navigation;
  const current = nav?.currentEntry?.index;
  if (!nav?.entries || current === undefined || current < 0) return null;
  const entries = nav.entries();
  const delta = historyDelta(entries, current, window.location.origin, target, through);
  if (delta === null) return null;
  const entry = entries[current + delta];
  const url = new URL(entry.url as string);
  return {
    delta,
    href: url.pathname + url.search,
    sameDocument: entry.sameDocument !== false,
  };
}

/**
 * The state a sealed entry carries: `_N` makes Next's patched replaceState pass it through untouched
 * (no copy of the review's tree, the router's URL unchanged), and its popstate handler reloads an
 * entry without `__NA` — the bare grid, read fresh.
 */
export const SEALED_STATE = { _N: true, bluviFlowSealed: true } as const;

export function useFlowNav(lakeId: string, config?: FlowConfig) {
  const router = useRouter();
  // Pass a stable config (built once per mount): a new object every render re-creates the callbacks.
  const cfg = useMemo(() => config ?? anglerFlow(lakeId), [config, lakeId]);
  const travel = useCallback(
    (to: { target: (u: URL) => boolean; through: (u: URL) => boolean }, fallback: string, seal = false) => {
      const found = find(to.target, to.through);
      // A traversal into another document (the entry was a full page load) would reload the app and
      // drop the toast that announces the outcome: open that page in place instead.
      if (found?.sameDocument) {
        if (seal) window.history.replaceState({ ...SEALED_STATE }, '', stepPath(lakeId, 'grid', cfg));
        window.history.go(found.delta);
      } else router.replace(found?.href ?? fallback);
    },
    [router, lakeId, cfg]
  );
  return {
    /** Back one step (fish goBack): the extras step when this tour has one, else the grid, keeping the selection. */
    stepBack: useCallback(
      (previous: Exclude<FlowStep, 'review'>, params: FlowParams) =>
        // The grid never carries extras (params.ts stepHref).
        travel(flowTargets(lakeId, cfg).step(previous), stepHref(lakeId, previous, params, cfg)),
      [travel, lakeId, cfg]
    ),
    /** Back to the grid without a selection (fish backToGrid + clearSelection). */
    backToGrid: useCallback(
      () => travel(flowTargets(lakeId, cfg).bareGrid, stepHref(lakeId, 'grid', { selection: null, extras: [] }, cfg), true),
      [travel, lakeId, cfg]
    ),
    /** Leave the whole flow (fish exitFlow): where it was entered, else the lake page. */
    exitFlow: useCallback(() => travel(flowTargets(lakeId, cfg).exit, cfg.paths.exit, true), [travel, lakeId, cfg]),
  };
}
