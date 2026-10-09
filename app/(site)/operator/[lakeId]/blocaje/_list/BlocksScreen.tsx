'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowPathIcon, CalendarDaysIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useNowTick } from '@/components/account/angler/SessionHistoryCard';
import { FOCUS_RING, ListEmpty, pageToolClass } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { bookingKeys, deleteBlockMutation, lakeBlocksQuery, type AvailabilityBlockDTO, type BlockRow as BlockRowModel } from '@/core/booking';
import { routes } from '@/lib/routes';
import { useSiteToast } from '../../../../_shell/Toast';
import { OperatorErrorState } from '../../../_shared/OperatorErrorState';
import { OperatorFrame, OperatorTitleSkeleton, operatorTrail } from '../../../_shared/OperatorFrame';
import { useOperatorTransport } from '../../../_shared/useOperatorTransport';
import { useOwnedLakeName } from '../../../_shared/useOwnedLakeName';
import { BlockRow } from './BlockRow';
import { DeleteBlockDialog } from './DeleteBlockDialog';
import { BlocksSkeleton, SECTION_CAPTION, SECTION_CARD, sectionsGrid } from './frame';
import { BLOCKS_TITLE, blocksList, deletedToast, deletePartialFailureMessage } from './model';

/**
 * /operator/[lakeId]/blocaje — operator.blocaje «Blocaje și închideri» (T1), fish
 * app/(app)/operator/[lakeId]/blocks.tsx.
 *
 *  - c1 header: back (the panel when there is no in-app history), the title over the lake's name,
 *    the refresh control (c12) and the round indigo «+» «Adaugă blocaj» → operator.blocaj-nou.
 *  - c2 GET /feed/availability-blocks?lakeId= through /api/cms (per owner, never cached); first load
 *    is the skeleton, a failure with nothing to show the shared OperatorErrorState with a retry.
 *  - c3 c4 month cards of grouped rows; c5 the past behind «Afișează trecutul ({n})».
 *  - c9 c10 trash → confirm → one DELETE after another, the row's spinner, the toasts (a group that
 *    fails part-way says how many were deleted).
 *  - c11 empty; c12 refresh control + refetch on window focus (staleTime 0).
 */
export function BlocksScreen({ lakeId }: { lakeId: string }) {
  const t = useOperatorTransport();
  const qc = useQueryClient();
  const toast = useSiteToast();
  const lakeName = useOwnedLakeName(lakeId);
  const now = useNowTick();
  const titleId = useId();

  // c2, c12 — stale at once: the list revalidates whenever the window regains focus.
  const blocks = useQuery({ ...lakeBlocksQuery(t, lakeId), staleTime: 0 });
  const del = useMutation(deleteBlockMutation(t, qc));

  const [showPast, setShowPast] = useState(false);
  const list = useMemo(() => (blocks.data && now !== null ? blocksList(blocks.data, now, showPast) : null), [blocks.data, now, showPast]);

  // c12 — the refresh control (fish pull-to-refresh). A failed refetch keeps the rows and says so.
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    const r = await blocks.refetch();
    setRefreshing(false);
    if (r.isError && r.data) toast('Nu am putut încărca blocajele.', 'danger');
  }, [blocks, refreshing, toast]);

  // c9, c10 — the row being confirmed, then the row whose blocks are being deleted.
  const [confirming, setConfirming] = useState<BlockRowModel | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const focusTitle = useRef(false);
  const remove = useCallback(
    async (row: BlockRowModel) => {
      setConfirming(null);
      setDeletingKey(row.key);
      let done = 0;
      try {
        // A grouped row (multi-stand save) deletes every block it stands for, in order. Each block
        // leaves the cache as soon as its DELETE succeeds: the mutation's invalidation is not awaited,
        // so without this the row would come back (with a live trash) until the list GET returns.
        for (const id of row.documentIds) {
          await del.mutateAsync(id);
          done += 1;
          qc.setQueryData<AvailabilityBlockDTO[]>(bookingKeys.blocks(lakeId), (old) => old?.filter((b) => b.documentId !== id));
        }
        toast(deletedToast(row.documentIds.length), 'success');
        // The row (and its focused trash) is gone: focus goes back to the page's heading.
        focusTitle.current = true;
      } catch (e) {
        // Part of a group may already be unblocked: say so («1 din 3 blocaje șterse. …»).
        toast(deletePartialFailureMessage(done, row.documentIds.length, e), 'danger');
      } finally {
        setDeletingKey(null);
      }
    },
    [del, qc, lakeId, toast],
  );
  useEffect(() => {
    if (!focusTitle.current || deletingKey) return;
    const h = document.getElementById(titleId);
    if (!h) return;
    focusTitle.current = false;
    h.tabIndex = -1;
    h.classList.add('outline-none');
    h.focus({ preventScroll: true });
  });

  // c5 — revealing the past moves focus to its section, so a keyboard user lands on what appeared.
  const pastRef = useRef<HTMLHeadingElement>(null);
  const revealPast = () => {
    setShowPast(true);
    requestAnimationFrame(() => pastRef.current?.focus({ preventScroll: false }));
  };

  const next = routes.operatorBlocks(lakeId);
  let body;
  if (blocks.isPending || now === null) {
    body = <BlocksSkeleton />;
  } else if (!list) {
    body = (
      <OperatorErrorState
        error={blocks.error}
        onRetry={() => void blocks.refetch()}
        retrying={blocks.isFetching}
        attempt={blocks.errorUpdateCount}
        next={next}
      />
    );
  } else {
    body = (
      <div data-testid="blocks-list" className="flex flex-col gap-2">
        {list.empty ? (
          <div data-testid="blocks-empty">
            <ListEmpty
              title="Niciun blocaj."
              description="Apasă + pentru a închide lacul sau standuri într-o perioadă."
              icon={<CalendarDaysIcon aria-hidden className="size-12 text-muted" strokeWidth={1.5} />}
            />
          </div>
        ) : (
          <div className={sectionsGrid(list.sections.length)}>
            {list.sections.map((s) => {
              const headingId = `blocks-${s.past ? 'past' : s.title.replace(/\s+/g, '-')}`;
              return (
                <section key={s.title} aria-labelledby={headingId} data-testid="blocks-section" data-past={s.past || undefined} className="min-w-0">
                  <h2
                    id={headingId}
                    ref={s.past ? pastRef : undefined}
                    tabIndex={s.past ? -1 : undefined}
                    className={cn(SECTION_CAPTION, 'outline-none')}
                  >
                    {s.title}
                  </h2>
                  <ul className={SECTION_CARD}>
                    {s.data.map((row, i) => (
                      <li key={row.key} className="relative">
                        {/* fish: the hairline starts under the text, not under the tint square. */}
                        {i > 0 ? <span aria-hidden className="absolute top-0 right-0 left-[62px] h-px bg-hairline" /> : null}
                        <BlockRow
                          row={row}
                          past={s.past}
                          deleting={deletingKey === row.key}
                          locked={deletingKey !== null && deletingKey !== row.key}
                          onDelete={setConfirming}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
        {list.pastCount > 0 && !showPast ? (
          <div className="flex justify-center py-3">
            <button
              type="button"
              onClick={revealPast}
              data-testid="blocks-show-past"
              className={cn('t-caption min-h-11 cursor-pointer rounded-control px-3 font-semibold text-accent-ink hover:bg-soft-fill', FOCUS_RING)}
            >
              Afișează trecutul ({list.pastCount})
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <OperatorFrame
      title={BLOCKS_TITLE}
      titleId={titleId}
      caption={lakeName ?? <OperatorTitleSkeleton className="h-3 w-28" />}
      back={{ fallbackHref: routes.operator(lakeId) }}
      trail={operatorTrail({ label: lakeName ?? 'Balta', href: routes.operator(lakeId) }, { label: 'Blocaje' })}
      busy={refreshing}
      trailing={
        <>
          <button type="button" onClick={() => void refresh()} aria-busy={refreshing || undefined} data-testid="blocks-refresh" className={pageToolClass()}>
            <ArrowPathIcon aria-hidden className={cn(refreshing && 'animate-spin motion-reduce:animate-none')} />
            <span className="sr-only md:not-sr-only">Reîmprospătează</span>
          </button>
          {/* fish: the round indigo «+» (blocks.tsx:123-139) — the add form is its own page here. */}
          <Link
            href={routes.operatorBlockNew(lakeId)}
            aria-label="Adaugă blocaj"
            title="Adaugă blocaj"
            data-testid="block-add"
            className={cn(
              'flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent shadow-button transition-[filter] duration-(--duration-fast) ease-fast hover:brightness-95 active:opacity-80 xl:size-10',
              FOCUS_RING,
            )}
          >
            <PlusIcon aria-hidden className="size-5" strokeWidth={2.2} />
          </Link>
        </>
      }
    >
      {body}
      <DeleteBlockDialog row={confirming} onClose={() => setConfirming(null)} onConfirm={(row) => void remove(row)} />
    </OperatorFrame>
  );
}
