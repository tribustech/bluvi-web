'use client';

import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { cn } from '@/components/ui/cn';
import type { RecentWeighing } from '@/core/competitions';
import { POSTER_GRID, PosterCard, PosterGridSkeleton, posterItemClass } from '../cards/PosterCard';
import { MineHero, MineHeroSkeleton } from '../live/MineHero';
import { liveOrder, stripItems } from '../live/model';
import { NoLive } from '../live/NoLive';
import { PLACEHOLDER_HERO } from '../live/placeholders';
import { SingleLive } from '../live/SingleLive';
import { useMyLive, useMyLiveCards } from '../live/useMyLive';
import { useRecentWeighings } from '../live/useRecentWeighings';
import { WeighingStrip, WeighingStripSkeleton } from '../live/WeighingStrip';
import s from '../live/live.module.css';
import { PLACEHOLDER_RECENT_WEIGHINGS } from '../placeholders';
import { SignedOutGate } from '../SignedOutGate';
import { WeighingDetail, type WeighingDetailTarget } from '../weighing/WeighingDetail';
import type { TabModule, TabViewProps } from './types';

/*
 * Live (/concursuri/live) — the tab's content (contract: ./types.ts), the owner-approved prototype
 * app/dev/hub Live.tsx (2026-10-06):
 *  - Top: «Cântăriri recente», one strip across every live competition (GET /feed/recent-weighings,
 *    30s; hidden when the read fails — a CMS without the endpoint answers 404), each item opening
 *    the weighing's detail (popover ≥768, sheet below); then «Concursul tău» when the signed-in
 *    viewer is registered in a live competition (../live/useMyLive). Signed out, both are drawn
 *    BLURRED over fake data with one sign-in call to action (../SignedOutGate) — the real ones are
 *    never read.
 *  - Body: fish's poster cards in a STABLE order — mine first, then by start time (never by
 *    activity: the owner «didn't understand why the cards keep changing»); a card whose competition
 *    just got a weighing washes indigo in place. 1 · 2 · 3 (≥1280) · 4 (≥1800) columns.
 *  - One live competition: the grid collapses into one rich view (../live/SingleLive) with its own
 *    weighings; no strip. «Concursul tău» still leads it when the viewer is registered in it (owner
 *    decision: the hero shows whenever I am in a live competition — my place, value, sector, gap).
 *  - Nothing live: «Niciun concurs live acum» with the next start (../live/NoLive).
 * Every live read polls only while the page is visible (TanStack pauses intervals in background
 * tabs) and stops with the tab (its observers unmount). No «Momente cheie», no toast.
 */

function useWeighingDetail() {
  const [target, setTarget] = useState<WeighingDetailTarget | null>(null);
  const open = useCallback((item: RecentWeighing, el: HTMLElement) => setTarget({ item, anchorId: el.id }), []);
  const close = useCallback(() => setTarget(null), []);
  return { target, open, close };
}

const single = (p: TabViewProps) => p.cards.length === 1;

function Top(p: TabViewProps) {
  // Nothing to say before the list answers, with nothing live (the empty card) or with one (its view).
  if (p.loading || p.cards.length === 0 || single(p)) return null;
  if (!p.isAuthenticated) {
    return (
      <SignedOutGate hint="Cântăririle și locul tău în concurs, pe măsură ce se întâmplă.">
        <div className="flex flex-col gap-8 p-1">
          <WeighingStrip items={PLACEHOLDER_RECENT_WEIGHINGS} headingId="cantariri-recente-exemplu" />
          {/* The first thing a guest sees on Live: its poster is the page's LCP (M8-B4). */}
          <MineHero m={PLACEHOLDER_HERO} priority />
        </div>
      </SignedOutGate>
    );
  }
  return <SignedInTop {...p} />;
}

function SignedInTop({ t, viewer, isAuthenticated, cards, scope }: TabViewProps) {
  const recent = useRecentWeighings(t, true);
  const my = useMyLive(t, viewer, isAuthenticated);
  const detail = useWeighingDetail();
  const only = useMemo(() => (scope === 'followed' ? new Set(cards.map((c) => c.documentId)) : null), [scope, cards]);
  const items = stripItems(recent.items, only);
  return (
    <div className="flex flex-col gap-8 xl:gap-10">
      {recent.state === 'pending' ? (
        <WeighingStripSkeleton />
      ) : recent.state === 'ready' && items.length > 0 ? (
        <WeighingStrip items={items} fresh={recent.fresh} onOpen={detail.open} />
      ) : null}
      {my.state === 'ready' ? <MineHero m={my.model} /> : my.state === 'pending' ? <MineHeroSkeleton /> : null}
      <WeighingDetail t={t} target={detail.target} onClose={detail.close} />
    </div>
  );
}

function Body(p: TabViewProps) {
  const signedIn = p.isAuthenticated && !!p.viewer;
  const mine = useMyLiveCards(p.t, signedIn);
  const mineIds = useMemo(() => new Set(mine.map((c) => c.documentId)), [mine]);
  const recent = useRecentWeighings(p.t, p.isAuthenticated);
  const detail = useWeighingDetail();
  const ordered = useMemo(() => liveOrder(p.cards, mineIds), [p.cards, mineIds]);

  if (single(p)) {
    const c = p.cards[0];
    return (
      <div className="flex flex-col gap-8 xl:gap-10">
        {signedIn ? <SingleMine {...p} competitionId={c.documentId} /> : null}
        <SingleLive
          c={c}
          t={p.t}
          signedIn={p.isAuthenticated}
          mine={mineIds.has(c.documentId)}
          priority={p.priorityCount > 0}
          weighings={recent.state === 'ready' ? stripItems(recent.items, new Set([c.documentId]), 10) : null}
          onOpenWeighing={detail.open}
        />
        <WeighingDetail t={p.t} target={detail.target} onClose={detail.close} />
      </div>
    );
  }

  return (
    <ul aria-labelledby={p.labelledBy} className={POSTER_GRID}>
      {ordered.map((c, i) => {
        const flash = recent.flash[c.documentId];
        return (
          <li key={c.documentId} data-live-card={c.documentId} className={cn(posterItemClass(true), s.rise, 'relative')} style={{ '--i': i } as CSSProperties}>
            <PosterCard competition={c} priority={i < p.priorityCount} />
            {flash ? <span key={flash} aria-hidden data-flash="" className={cn('pointer-events-none absolute inset-0 rounded-card', s.wash)} /> : null}
          </li>
        );
      })}
    </ul>
  );
}

/** «Concursul tău» over the single view, only when that one competition is mine (else nothing). */
function SingleMine({ t, viewer, isAuthenticated, competitionId }: TabViewProps & { competitionId: string }) {
  const my = useMyLive(t, viewer, isAuthenticated);
  if (my.state === 'none' || my.competitionId !== competitionId) return null;
  return my.state === 'ready' ? <MineHero m={my.model} /> : <MineHeroSkeleton />;
}

/**
 * Eager posters (LCP, §5): signed out, the blurred strip + hero sit above the list (none); signed in,
 * only the ~100px strip (the hero shows for a few) — the first poster still sits above the fold on a
 * phone; one live competition: its view's poster.
 */
function priorityCount(p: Omit<TabViewProps, 'priorityCount'>): number {
  if (p.cards.length === 1) return 1;
  return p.isAuthenticated ? 1 : 0;
}

function Empty({ t, isAuthenticated }: TabViewProps) {
  return <NoLive t={t} isAuthenticated={isAuthenticated} />;
}

export const liveTab: TabModule = { Top, Body, Empty, priorityCount, Skeleton: () => <PosterGridSkeleton /> };
