'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusIcon } from '@heroicons/react/24/outline';
import { CannotEditDialog } from '@/components/organizer/CannotEditDialog';
import { usePinned } from '@/components/nav/stickyStack';
import { pickSurface } from '@/components/surfaces/rule';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { ListEmpty, ListError, ListFooter, StickyActions, type ListTab } from '@/components/templates/T1';
import { DashboardHeader, DashboardPage, DashboardRefresh } from '@/components/templates/T5';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import {
  cancelOrganizerCompetitionMutation,
  deleteDraftMutation,
  flattenPages,
  organizerCompetitionsInfiniteQuery,
  organizerDashboardQuery,
  organizerKeys,
  type DraftCompetition,
  type OrganizerStatKey,
} from '@/core/organizer';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../_shell/SiteHeader';
import { useSiteToast } from '../../_shell/Toast';
import { StatusTabs } from '../../concursuri/_list/StatusTabs';
import { CardSkeleton, CompetitionTile, DraftCard } from './cards';
import { CancelCompetitionDialog, DeleteDraftDialog } from './dialogs';
import {
  CANCEL_ERROR,
  cancelledToast,
  cancelReason,
  COMPETITIONS_PAGE_SIZE,
  DELETE_DRAFT_ERROR,
  emptyCopy,
  statTiles,
  TABS,
  tabCounts,
  writeErrorMessage,
  type TabKey,
} from './model';
import { BAND, GRID, PANEL_TITLE, PANEL_TRAIL } from './frame';
import { OrganizerArt } from './OrganizerArt';
import { DOCKED_PAGE_PAD, StatDetailPanel } from './StatDetailPanel';
import { StatChips, StatTiles, StatTilesSkeleton } from './stats';

const SWAP_H = 'h-12';
const PANEL_ID = 'organizer-list';

/**
 * /organizator — organizer.panel (T5), fish app/(app)/organizer/index.tsx. Rendered for an Organizer
 * only (the page's requireOrganizer gate), so every read is on (c28); all per user through /api/cms,
 * no polling (organizer.b.no-polling): freshness is the refresh action and the writes' invalidations.
 */
export function OrganizerPanel() {
  const t = useMemo(() => createBrowserTransport(), []);
  const qc = useQueryClient();
  const toast = useSiteToast();

  const stats = useQuery(organizerDashboardQuery(t, { isOrganizer: true }));
  const [tab, setTab] = useState<TabKey>('draft');
  const list = useInfiniteQuery(organizerCompetitionsInfiniteQuery(t, { status: tab, isOrganizer: true, pageSize: COMPETITIONS_PAGE_SIZE }));
  const rows = useMemo(() => flattenPages(list.data) ?? [], [list.data]);

  const tiles = useMemo(() => (stats.data ? statTiles(stats.data) : null), [stats.data]);
  const counts = useMemo(() => tabCounts(stats.data), [stats.data]);

  // c6 / c8–c11 — the stat detail.
  const [statKey, setStatKey] = useState<OrganizerStatKey | null>(null);
  const closeStat = useCallback(() => setStatKey(null), []);
  // ≥1280 the stat panel docks at the right edge: the page gives it its width instead of sitting under it.
  const breakpoint = useBreakpoint();
  const docked = statKey !== null && pickSurface('context', breakpoint) === 'panel';

  // c19 / c20 — delete a draft.
  const deleteDraft = useMutation(deleteDraftMutation(t, qc));
  const [confirmDraft, setConfirmDraft] = useState<DraftCompetition | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const onDeleteConfirmed = async () => {
    const draft = confirmDraft;
    setConfirmDraft(null);
    if (!draft || deletingId) return;
    setDeletingId(draft.documentId);
    try {
      // core deleteDraftMutation awaits the refetch of the dashboard and every organizer list.
      await deleteDraft.mutateAsync(draft.documentId);
      toast('Ciorna a fost ștearsă.', 'success');
    } catch (e) {
      toast(writeErrorMessage(e, DELETE_DRAFT_ERROR), 'danger');
    } finally {
      setDeletingId(null);
    }
  };

  // c22–c25 — cancel a notStarted competition.
  const cancel = useMutation(cancelOrganizerCompetitionMutation(t, qc));
  const [pendingCancel, setPendingCancel] = useState<DraftCompetition | null>(null);
  const onCancelConfirmed = async (raw: string) => {
    if (!pendingCancel || cancel.isPending) return;
    try {
      const result = await cancel.mutateAsync({ id: pendingCancel.documentId, reason: cancelReason(raw) });
      toast(cancelledToast(result.failedNotifications), 'success');
      setPendingCancel(null);
    } catch (e) {
      toast(writeErrorMessage(e, CANCEL_ERROR), 'danger');
    }
  };

  const [cannotEdit, setCannotEdit] = useState(false);

  // c26 — the refresh action (fish pull-to-refresh): the stats and the shown list are awaited and their
  // results decide done / failed; everything else the organizer reads (the other tabs, the stat
  // details — an open panel refetches now, a closed one on its next open) is invalidated alongside.
  const refresh = async () => {
    // Separate keys from the two refetches (an invalidation of the same key would cancel and restart them).
    const [s, l] = await Promise.all([stats.refetch(), list.refetch(), qc.invalidateQueries({ queryKey: organizerKeys.statDetailsRoot })]);
    void qc.invalidateQueries({ queryKey: organizerKeys.competitionsRoot, refetchType: 'inactive' });
    return !(s.isError || l.isError);
  };

  // c7 — the tiles collapse into the chip row once the band pins under the top bar.
  const band = useRef<HTMLDivElement>(null);
  const pinned = usePinned(band);
  const collapsed = pinned && tiles !== null;

  // c12–c14 — tabs: a switch loads that status and goes back to the top.
  const onTab = (key: TabKey) => {
    if (key === tab) return;
    setTab(key);
    window.scrollTo({ top: 0 });
  };
  const tabs: ListTab<TabKey>[] = TABS.map(({ key, label }) => {
    const count = counts[key];
    return { key, label, count: count && count > 0 ? count : undefined, accessibleLabel: count && count > 0 ? `${label}, ${count}` : undefined };
  });

  const create = routes.organizerCompetitionNew('detalii', { inapoi: routes.organizer() });

  return (
    <>
      <SetBreadcrumb trail={PANEL_TRAIL} />
      <DashboardPage
        className={cn('max-md:pb-28', docked && DOCKED_PAGE_PAD)}
        header={
          <DashboardHeader
            title={PANEL_TITLE}
            back={{ href: routes.home(), label: 'Înapoi', inApp: true }}
            actions={
              <>
                <OrganizerArt className="size-12 md:size-16" />
                <DashboardRefresh onRefresh={refresh} />
                <ButtonLink href={create} icon={<PlusIcon />} className="max-md:hidden" data-testid="create-competition">
                  Creează competiție
                </ButtonLink>
              </>
            }
          />
        }
      >
        {/* c3–c6 — the KPI tiles (c5: their skeleton while nothing is cached). */}
        <section aria-label="Statistici">
          {tiles ? (
            <StatTiles tiles={tiles} onOpen={setStatKey} />
          ) : stats.isError ? (
            <div className="rounded-bento bg-surface shadow-e0">
              <ListError title="Statisticile nu s-au putut încărca." onRetry={() => void stats.refetch()} retrying={stats.isFetching} attempt={stats.errorUpdateCount} />
            </div>
          ) : (
            <>
              <StatTilesSkeleton />
              <span role="status" className="sr-only">
                Se încarcă statisticile…
              </span>
            </>
          )}
        </section>

        <section aria-labelledby="organizer-list-title" className="flex flex-col">
          {/* Out of the flow (sr-only) once collapsed: it leaves exactly the chips' height. */}
          <div className={collapsed ? 'sr-only' : cn(SWAP_H, 'flex items-end')}>
            <h2 id="organizer-list-title" className="t-title2 text-ink">
              Competițiile tale
            </h2>
          </div>

          {/* c7 / c14 — the pinned band: the chips (once collapsed) and the tabs, attached to the top. */}
          <div ref={band} data-testid="organizer-band" data-collapsed={collapsed || undefined} className={cn(BAND, 'pt-3 pb-3')}>
            {collapsed && tiles ? <StatChips tiles={tiles} onOpen={setStatKey} className={cn(SWAP_H, '-mx-4 items-start px-4 md:mx-0 md:px-0')} /> : null}
            <div className="-mx-4 overflow-hidden md:mx-0">
              <StatusTabs tabs={tabs} active={tab} onSelect={onTab} label="Stare competiții" controls={PANEL_ID} className="px-4 md:px-0" />
            </div>
          </div>

          <div id={PANEL_ID} role="tabpanel" aria-labelledby={`${PANEL_ID}-tab-${tab}`} className="pt-2">
            {list.isPending ? (
              <>
                <span role="status" className="sr-only">
                  Se încarcă competițiile…
                </span>
                <ul aria-hidden data-testid="list-skeleton" className={GRID}>
                  {Array.from({ length: 6 }, (_, i) => (
                    <CardSkeleton key={i} />
                  ))}
                </ul>
              </>
            ) : list.isError && !list.data ? (
              <ListError title="Competițiile nu s-au putut încărca." onRetry={() => void list.refetch()} retrying={list.isFetching} attempt={list.errorUpdateCount} />
            ) : rows.length === 0 ? (
              <ListEmpty title={emptyCopy(tab)} />
            ) : (
              <>
                <ul className={GRID} data-testid="organizer-grid">
                  {rows.map((c) => (
                    <li key={c.documentId} className="min-w-0">
                      {tab === 'draft' ? (
                        <DraftCard draft={c} deleting={deletingId === c.documentId} onDelete={() => setConfirmDraft(c)} />
                      ) : (
                        <CompetitionTile
                          competition={c}
                          cancelling={cancel.isPending && pendingCancel?.documentId === c.documentId}
                          onCancel={() => {
                            if (!cancel.isPending) setPendingCancel(c);
                          }}
                          onCannotEdit={() => setCannotEdit(true)}
                        />
                      )}
                    </li>
                  ))}
                </ul>
                <ListFooter
                  hasMore={Boolean(list.hasNextPage)}
                  loadingMore={list.isFetchingNextPage}
                  onLoadMore={() => void list.fetchNextPage()}
                  error={list.isFetchNextPageError}
                  spinner
                  errorLabel="Nu am putut încărca mai multe competiții."
                />
              </>
            )}
          </div>
        </section>
      </DashboardPage>

      {/* c27 — «Creează competiție», fixed at the bottom on a phone (in the header from 768). */}
      <StickyActions>
        <ButtonLink href={create} icon={<PlusIcon />} block data-testid="create-competition-phone">
          Creează competiție
        </ButtonLink>
      </StickyActions>

      {statKey ? <StatDetailPanel t={t} statKey={statKey} onClose={closeStat} /> : null}
      <DeleteDraftDialog open={confirmDraft !== null} onClose={() => setConfirmDraft(null)} onConfirm={() => void onDeleteConfirmed()} />
      {pendingCancel ? (
        <CancelCompetitionDialog
          name={pendingCancel.name}
          submitting={cancel.isPending}
          onClose={() => setPendingCancel(null)}
          onConfirm={(reason) => void onCancelConfirmed(reason)}
        />
      ) : null}
      <CannotEditDialog open={cannotEdit} onClose={() => setCannotEdit(false)} />
    </>
  );
}
