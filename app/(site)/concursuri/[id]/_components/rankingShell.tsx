'use client';

import { Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { useParams } from 'next/navigation';
import { notifyManager, useQueryClient } from '@tanstack/react-query';
import { ArrowsPointingOutIcon } from '@heroicons/react/24/outline';
import { competitionsKeys, getRegistrationByStandId, type CompetitionWithMyStatus } from '@/core/competitions';
import { IconButton } from '@/components/nav/IconButton';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { isUnknownViewer, useViewerState, type ViewerState } from '../../../_shell/viewer-context';
import { PersonPopover, usePersonPopover, usePersonPopoverEnabled } from './PersonPopover';
import { pageTransport } from './transport';

/*
 * The ranking card's chrome every ranking of the page uses from 768 (RankingView.tsx, the feeder and
 * club cards in CompetitionScreen.tsx): one card, one band of controls at its top, the «Clasament
 * complet» buttons. The tables inside are fish's (FishTable.tsx, FishFeeder.tsx, FishNc.tsx).
 */

/** The ranking card's band of controls (RankingView's toolbar): one row, on the card's surface. */
export const RANKING_TOOLBAR = 'flex min-w-0 items-center gap-3 px-3 py-2.5';

/**
 * A ranking card: the band of controls at its top, then the table. What is not a table goes under
 * the card, `after`.
 */
export function RankingCard({
  toolbar,
  children,
  after,
  className,
  cardClassName,
}: {
  toolbar: ReactNode;
  children?: ReactNode;
  after?: ReactNode;
  /** The column holding the card and `after`. */
  className?: string;
  /** More classes for the card itself. */
  cardClassName?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* The whole column (coordinator 2026-10-11): the table fills it, its name column taking the
          leftover while the numbers keep fixed tracks (FishTable `wide`). Always a card: the
          controls never sit loose on the page (§4b.20). */}
      <div className={cn('w-full overflow-clip rounded-card bg-surface shadow-e0', cardClassName)}>
        <div className={RANKING_TOOLBAR}>{toolbar}</div>
        {children}
      </div>
      {after}
    </div>
  );
}

/**
 * «Clasament complet» in the band (RankingView's pattern): the labelled button from 1280, the
 * full-screen icon 768–1279; none on the phone (the action bar has it).
 */
export function FullViewButtons({ onPress, disabled = false }: { onPress: () => void; disabled?: boolean }) {
  return (
    <>
      <Button variant="secondary" icon={<ArrowsPointingOutIcon />} onClick={onPress} disabled={disabled} className="shrink-0 max-xl:hidden">
        Clasament complet
      </Button>
      <IconButton
        aria-label="Clasament complet"
        title="Clasament complet"
        onClick={onPress}
        disabled={disabled}
        size="size-11"
        className="shrink-0 max-md:hidden xl:hidden"
      >
        <ArrowsPointingOutIcon aria-hidden />
      </IconButton>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Pressing a ranking row (ROADMAP §4b.17, parity statistici-pescar.c1) */
/* ------------------------------------------------------------------ */

/**
 * The competition this page shows, read from the query cache the screen fills (as useRankingFaces):
 * no request and no observer of its own. Undefined outside a competition page or before it lands.
 */
function usePageCompetition(): CompetitionWithMyStatus | undefined {
  const params = useParams<{ id?: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
  const qc = useQueryClient();
  // Batched like TanStack's own hooks: the cache notifies synchronously when another component's
  // query is built during ITS render (a dialog's search key), and a direct setState here would be
  // «Cannot update a component while rendering a different component».
  const subscribe = useCallback((onChange: () => void) => qc.getQueryCache().subscribe(notifyManager.batchCalls(onChange)), [qc]);
  const read = useCallback(() => (id ? qc.getQueryData<CompetitionWithMyStatus>(competitionsKeys.byId(id)) : undefined), [qc, id]);
  return useSyncExternalStore(subscribe, read, read);
}

/** Reads the session (it suspends until it answers) and hands it up; behind its own <Suspense>. */
function ViewerProbe({ onViewer }: { onViewer: (v: ViewerState | undefined) => void }) {
  const viewer = useViewerState();
  useEffect(() => onViewer(isUnknownViewer(viewer) ? undefined : viewer), [viewer, onViewer]);
  return null;
}

/**
 * The session for a ranking part, without suspending it: undefined while unknown (never «signed
 * out»), then the user or null. Render `probe` somewhere in the part.
 */
function usePageViewer(): { viewer: ViewerState | undefined; probe: ReactNode } {
  const [viewer, setViewer] = useState<ViewerState | undefined>(undefined);
  const probe = (
    <Suspense fallback={null}>
      <ViewerProbe onViewer={setViewer} />
    </Suspense>
  );
  return { viewer, probe };
}

/**
 * A ranking row's person, owner rule 17: from 1024 a pressed row opens PersonPopover anchored to it
 * (avatar, names, club, sector and stand, key stats, «Vezi profilul»); below, the caller keeps the
 * phone's angler sheet. `open` finds the row's registration (by registration, else by its stand: the
 * registered entry first) and answers whether it opened; render `popover` once in the part.
 */
export function useRankingPerson(): {
  enabled: boolean;
  open: (anchor: HTMLElement, ids: { registrationId?: string | null; standId?: string | null }) => boolean;
  popover: ReactNode;
} {
  const enabled = usePersonPopoverEnabled();
  const person = usePersonPopover();
  const competition = usePageCompetition();
  const { viewer, probe } = usePageViewer();
  const t = useMemo(() => pageTransport(), []);
  const { open: openPerson } = person;
  const open = useCallback(
    (anchor: HTMLElement, { registrationId, standId }: { registrationId?: string | null; standId?: string | null }) => {
      if (!enabled || !competition) return false;
      const regs = competition.registrations;
      const byId = registrationId ? regs.find(r => r.documentId === registrationId) : undefined;
      const byStand = !byId && standId ? (getRegistrationByStandId(regs.filter(r => r.registrationStatus === 'registered'), standId) ?? getRegistrationByStandId(regs, standId)) : null;
      const registration = byId ?? byStand;
      if (!registration) return false;
      openPerson(registration.documentId, anchor);
      return true;
    },
    [enabled, competition, openPerson],
  );
  const popover =
    competition ? (
      <>
        {probe}
        <PersonPopover
          t={t}
          competition={competition}
          signedIn={viewer === undefined ? undefined : !!viewer}
          target={enabled ? person.target : null}
          onClose={person.close}
        />
      </>
    ) : null;
  return { enabled, open, popover };
}

/**
 * Makes the rows matching `selector` under `container` pressable (tab stop, Enter / Space, click;
 * PRESSABLE_ROWS styles them) and hands the pressed row to `onPress`. It listens in the capture
 * phase: when `onPress` answers true the press is the ranking's own (the popover) and goes no
 * further — the screen's row handler further down (the feeder section's angler sheet) never sees it;
 * false lets it through. A control inside a row, and a cell merged over several rows (the club
 * ranking's club cells), keep their own meaning. Re-applied after each render (sorting re-creates rows).
 */
export function useRankingRowPress(
  container: RefObject<HTMLElement | null>,
  selector: string,
  onPress: (row: HTMLElement) => boolean,
) {
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const rows = () => [...root.querySelectorAll<HTMLElement>(selector)];
    for (const row of rows()) {
      if (row.tabIndex !== 0) row.tabIndex = 0;
      row.dataset.pressable = '';
    }
    const rowOf = (e: Event): HTMLElement | null => {
      if (!(e.target instanceof Element)) return null;
      const row = rows().find(r => r.contains(e.target as Node));
      if (!row) return null;
      if (e.target !== row && e.target.closest('a, button, input, select, textarea')) return null;
      const cell = e.target.closest('td, th');
      if (cell instanceof HTMLTableCellElement && cell.rowSpan > 1) return null;
      return row;
    };
    const click = (e: MouseEvent) => {
      const row = rowOf(e);
      if (row && onPress(row)) e.stopPropagation();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const row = rowOf(e);
      if (!row || e.target !== row) return;
      if (onPress(row)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    root.addEventListener('click', click, true);
    root.addEventListener('keydown', key, true);
    return () => {
      root.removeEventListener('click', click, true);
      root.removeEventListener('keydown', key, true);
    };
  });
}
