'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Suspense, useMemo, useState, type ReactNode } from 'react';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { BuildingStorefrontIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { FishingRodIcon, SadStarIcon } from '@/components/icons/brand';
import { Dialog } from '@/components/surfaces/Dialog';
import { signInPath } from '@/components/nav/items';
import { AsideSection, FilterColumn, FilterColumnSkeleton, FOCUS_RING, ListEmpty, ListFooter, ListHeader, ListPage, listGridClass, StickyActions } from '@/components/templates/T1';
import { KpiGrid, KpiTile, LINK_ACTION } from '@/components/templates/T5';
import { cn } from '@/components/ui/cn';
import { Button, buttonClass } from '@/components/ui/Button';
import {
  deleteReviewMutation,
  formatReviewsCount,
  invalidateReviewQueries,
  lakeQuery,
  lakeReviewsInfiniteQuery,
  myLakeReviewQuery,
  type Review,
  type ReviewMeta,
} from '@/core/lakes';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { useSiteToast } from '../../../_shell/Toast';
import { useViewerState, type ViewerState } from '../../../_shell/viewer-context';
import { isUnknownViewer, userOf } from '../../../_shell/viewer-state';
import { lakeHref } from '../_components/availability';
import { ReviewInAppDialog, ReviewsInfoDialog } from '../_components/LakeDialogs';
import { RatingStars } from '../_components/RatingStars';
import { ReviewCard } from '../_components/ReviewCard';
import { focusLandingSpot } from '@/components/templates/T3';
import { FocusAfterRetry } from '../_components/RetryFocus';
import { TitleShimmer } from '../_sub/FallbackHeader';
import { LakePages } from '../_sub/LakePages';
import { firstReadFailed, SUB_TITLE_ID, SubListError, SubRetryFocus } from '../_sub/states';
import { useBack } from '../_sub/useBack';

/*
 * Recenzii — fish app/(app)/lakes/[lakeId]/reviews.tsx → ReviewList + ReviewCard +
 * ReviewListEmptyComponent + AddReviewButton + ReviewsCount (parity lakes.reviews), on T1:
 *  - c1 the lake's name as the title, «Recenzii» under it (as on every lake subpage), the back
 *    control;
 *  - c2 with reviews, the three scores Pescuit / Facilități / Atmosferă (value with one decimal,
 *    stars) then «N recenzii» + «Vezi cum funcționează recenziile» (the lake page's explainer) —
 *    the T5 KPI tiles below 1280 (Statistici's figures), one card of three rows (glyph + label ·
 *    value + stars) in the 360px column from 1280;
 *  - c3 10 a page, the next page as the list's end nears (T1 ListFooter);
 *  - c4 the lake page's ReviewCard; c5 another author opens /pescari/[id] once the web has it;
 *  - c6 the viewer's own card: «Editează» (→ /recenzie?editare=1 once the web has the form; until
 *    then the app) and «Șterge» (red); c7 «Ești sigur că vrei să îți ștergi recenzia?» (Închide /
 *    Șterge) → delete, «Recenzia ta a fost ștearsă cu succes.» or the error's message, then core
 *    invalidateReviewQueries (reviews, the lake — its scores here —, my review, lakes lists,
 *    bookings to review);
 *  - c8 none: the kit empty card (ListEmpty: the sad star, «Momentan nu există recenzii pentru
 *    această baltă», «Fii primul care adaugă una!», the explainer link under it) with the add /
 *    sign-in action inside it — the header and the phone bar drop theirs while it shows;
 *  - c9 the bottom bar: gone once the viewer has reviewed (or while that read is unknown or failed —
 *    never a CTA to a duplicate); signed in «Adaugă o recenzie»; signed out «Autentifică-te pentru
 *    a putea adăuga o recenzie» (outline, → /intra?next= back here). A phone pins it above the
 *    thumb (StickyActions); from 768 it is the header's action;
 *  - c10 the loading view, the error view with retry (and no back of its own); c11 core: 5 min.
 * From 1280 three columns (ROADMAP §4) in every state: the lake's pages · the reviews · the scores
 * (their own skeleton / error in that slot while the lake read is pending / failed, a quiet card
 * while there are none — the centre never moves sideways).
 */

const SCORES = [
  { key: 'quality', label: 'Pescuit', icon: <FishingRodIcon aria-hidden size={22} /> },
  { key: 'facilities', label: 'Facilități', icon: <BuildingStorefrontIcon aria-hidden className="size-5.5" /> },
  { key: 'atmosphere', label: 'Atmosferă', icon: <SparklesIcon aria-hidden className="size-5.5" /> },
] as const;

const one = (n: number) => n.toFixed(1).replace('.', ',');
const CAPTION = 'Recenzii';
/* Three across on a phone; the number track hugs the 26px figure (variants, so they win over the
   kit's base tracks) — the stars sit right under it, not 68px down. */
const SCORE_GRID = 'max-md:grid-cols-3 max-md:gap-2 max-md:auto-rows-[auto_auto_auto] md:auto-rows-[auto_auto_auto]';
/** The scores' retry (FocusAfterRetry): focus lands on the scores once they replace the error. */
const SCORES_RETRY = 'reviews-scores';

export function ReviewsScreen({ lakeId, lakeName }: { lakeId: string; lakeName: string }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const back = useBack(routes.lake(lakeId));
  const reviews = useInfiniteQuery(lakeReviewsInfiniteQuery(t, lakeId, 10));
  const lake = useQuery(lakeQuery(t, lakeId));
  const [info, setInfo] = useState(false);

  const rows = useMemo(() => reviews.data?.pages.flatMap(p => p.data) ?? [], [reviews.data]);
  const meta = lake.data?.reviewsMeta ?? null;
  const failed = firstReadFailed(reviews);
  // c8: with no review the empty card carries the add / sign-in action — not the header too.
  const empty = !reviews.isPending && !failed && rows.length === 0;

  const header = (
    <ListHeader
      titleId={SUB_TITLE_ID}
      title={lakeName || 'Recenzii'}
      description={CAPTION}
      back={{ label: 'Înapoi', onClick: back }}
      actions={
        empty ? undefined : (
          <Suspense fallback={null}>
            <AddBar lakeId={lakeId} lakeName={lakeName} placement="header" />
          </Suspense>
        )
      }
    />
  );
  const filters = (
    <FilterColumn title="Recenzii">
      <LakePages lakeId={lakeId} current="recenzii" />
    </FilterColumn>
  );

  if (reviews.isPending && !failed) return <ReviewsFallback lakeName={lakeName} lakeId={lakeId} />;

  // The scores' slot: the scores, or — the lake read still pending / failed — their skeleton / the
  // error in the same place, so the list never moves. `inline` is the phone/tablet copy (above the
  // list), the other the docked column's (from 1280): two copies, so ids and retry focus are per copy.
  const lakeFailed = firstReadFailed(lake);
  const scoresFor = (inline: boolean) =>
    lake.data ? (
      meta && meta.count > 0 ? (
        <Summary meta={meta} onInfo={() => setInfo(true)} variant={inline ? 'tiles' : 'card'} />
      ) : inline ? null : (
        <AsideSection title="Scorurile bălții">
          <p className="t-caption text-muted" data-testid="scores-quiet">
            Scorurile apar după prima recenzie.
          </p>
        </AsideSection>
      )
    ) : lakeFailed ? (
      <SubListError
        testId="scores-error"
        title="Nu am putut încărca scorurile."
        onRetry={() => void lake.refetch()}
        retrying={lake.isFetching}
        attempt={lake.errorUpdateCount}
        retryKey={SCORES_RETRY}
      />
    ) : (
      <ScoresSkeleton variant={inline ? 'tiles' : 'card'} />
    );
  const aside = scoresFor(false);
  const asideBusy = !lake.data && !lakeFailed;

  if (failed) {
    return (
      <ListPage header={header} filters={filters} filtersLabel="Paginile bălții" aside={aside} asideLabel="Scorurile bălții" asideInline={false} asideBusy={asideBusy}>
        <SubListError
          testId="reviews-error"
          title="Nu am putut încărca recenziile."
          onRetry={() => void reviews.refetch()}
          retrying={reviews.isFetching}
          attempt={reviews.errorUpdateCount}
        />
      </ListPage>
    );
  }

  const inlineScores = rows.length ? scoresFor(true) : null;

  return (
    <ListPage
      header={header}
      filters={filters}
      filtersLabel="Paginile bălții"
      aside={aside}
      asideLabel="Scorurile bălții"
      asideInline={false}
      asideBusy={asideBusy}
      actions={
        empty ? undefined : (
          <Suspense fallback={null}>
            <AddBar lakeId={lakeId} lakeName={lakeName} placement="sticky" />
          </Suspense>
        )
      }
    >
      <SubRetryFocus />
      {rows.length ? (
        <>
          {inlineScores ? <div className="xl:hidden">{inlineScores}</div> : null}
          <Suspense fallback={<ReviewRows rows={rows} lakeId={lakeId} lakeName={lakeName} me={null} />}>
            <ReviewRowsForViewer rows={rows} lakeId={lakeId} lakeName={lakeName} />
          </Suspense>
          <ListFooter
            hasMore={!!reviews.hasNextPage}
            loadingMore={reviews.isFetchingNextPage}
            error={reviews.isFetchNextPageError}
            onLoadMore={() => {
              if (reviews.hasNextPage && !reviews.isFetchingNextPage) void reviews.fetchNextPage();
            }}
            shown={rows.length}
            total={reviews.data?.pages[0]?.meta.pagination.total}
            noun="recenzii"
            errorLabel="Nu am putut încărca mai multe recenzii."
          />
        </>
      ) : (
        <Empty
          onInfo={() => setInfo(true)}
          action={
            <Suspense fallback={null}>
              <AddBar lakeId={lakeId} lakeName={lakeName} placement="inline" />
            </Suspense>
          }
        />
      )}
      <ReviewsInfoDialog open={info} onClose={() => setInfo(false)} />
    </ListPage>
  );
}

/* c2 — the three scores, the count and the explainer link (fish ListHeaderComponent). */

function Summary({ meta, onInfo, variant }: { meta: ReviewMeta; onInfo: () => void; variant: 'tiles' | 'card' }) {
  const id = variant === 'card' ? 'scorurile-baltii' : 'scorurile-baltii-sus';
  return (
    <section id={id} tabIndex={-1} aria-label="Scorurile bălții" className="flex flex-col gap-4 outline-none" data-testid="reviews-summary">
      <FocusAfterRetry retry={SCORES_RETRY} target={id} />
      {variant === 'tiles' ? (
        // Statistici's figures: the T5 KPI row, compact, three across at every width below 1280.
        <KpiGrid label="Scorurile bălții" columns="quad" compact className={SCORE_GRID}>
          {SCORES.map(s => (
            <KpiTile
              key={s.key}
              label={s.label}
              value={<span data-testid={`score-${s.key}`}>{one(meta[s.key])}</span>}
              detail={<RatingStars value={meta[s.key]} size="xs" />}
              className="max-md:px-3 max-md:py-3.5"
            />
          ))}
        </KpiGrid>
      ) : (
        // The 360px column: one card, a row per score (glyph + label · value + stars).
        <dl className="flex flex-col divide-y divide-hairline rounded-card bg-surface px-4 shadow-e0">
          {SCORES.map(s => (
            <div key={s.key} className="flex items-center justify-between gap-3 py-3.5">
              <dt className="flex min-w-0 items-center gap-2.5 t-body-strong text-ink">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-accent-tint text-accent-ink">{s.icon}</span>
                {s.label}
              </dt>
              <dd className="flex shrink-0 flex-col items-end gap-1">
                <span className="t-stat text-ink tabular-nums" data-testid={`score-${s.key}`}>
                  {one(meta[s.key])}
                </span>
                <RatingStars value={meta[s.key]} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      <ReviewsCount count={meta.count} onInfo={onInfo} />
    </section>
  );
}

/** The scores' grey shape, per copy (the tiles below 1280, the card of rows from 1280). */
function ScoresSkeleton({ variant }: { variant: 'tiles' | 'card' }) {
  return (
    <div role="status" className="flex flex-col gap-4" data-testid="scores-skeleton">
      <span className="sr-only">Se încarcă scorurile…</span>
      {variant === 'tiles' ? (
        <KpiGrid label="Scorurile bălții" columns="quad" compact className={SCORE_GRID}>
          {SCORES.map(s => (
            <KpiTile
              key={s.key}
              label={s.label}
              value={<span aria-hidden className="inline-block h-6 w-10 animate-shimmer rounded-full align-middle" />}
              detail={<span aria-hidden className="inline-block h-3.5 w-19 animate-shimmer rounded-full align-middle" />}
              className="max-md:px-3 max-md:py-3.5"
            />
          ))}
        </KpiGrid>
      ) : (
        <div aria-hidden className="flex flex-col divide-y divide-hairline rounded-card bg-surface px-4 shadow-e0">
          {SCORES.map(s => (
            <span key={s.key} className="flex items-center justify-between gap-3 py-3.5">
              <span className="flex items-center gap-2.5">
                <span className="size-9 animate-shimmer rounded-control" />
                <span className="h-3.5 w-20 animate-shimmer rounded-full" />
              </span>
              <span className="flex flex-col items-end gap-1.5">
                <span className="h-5.5 w-9 animate-shimmer rounded-full" />
                <span className="h-4 w-22 animate-shimmer rounded-full" />
              </span>
            </span>
          ))}
        </div>
      )}
      <span aria-hidden className="flex flex-col gap-1">
        <span className="h-5 w-28 animate-shimmer rounded-full" />
        <span className="h-4 w-52 animate-shimmer rounded-full" />
      </span>
    </div>
  );
}

/** The explainer (the lake page's ReviewsInfoDialog): the pages' accent text action. */
function InfoLink({ onInfo }: { onInfo: () => void }) {
  return (
    <button type="button" onClick={onInfo} aria-haspopup="dialog" className={cn(LINK_ACTION, 'min-h-9 cursor-pointer', FOCUS_RING)} data-testid="reviews-info-link">
      Vezi cum funcționează recenziile
    </button>
  );
}

/** fish ReviewsCount: «N recenzii» (title) and the explainer link under it. */
function ReviewsCount({ count, onInfo }: { count: number; onInfo: () => void }) {
  return (
    <div className="flex flex-col items-start">
      <p className="t-title2 text-ink" data-testid="reviews-count">
        {formatReviewsCount(count)}
      </p>
      <InfoLink onInfo={onInfo} />
    </div>
  );
}

/* c8 — no reviews: the kit empty card, the explainer and the add / sign-in action inside it. */

function Empty({ onInfo, action }: { onInfo: () => void; action: ReactNode }) {
  // fish ReviewListEmptyComponent: ReviewsCount («0 recenzii» + the explainer) leads, then the star.
  return (
    <div className="flex flex-col gap-4" data-testid="reviews-empty">
      <ReviewsCount count={0} onInfo={onInfo} />
      <ListEmpty
        icon={<SadStarIcon aria-hidden size={48} className="text-accent" />}
        title="Momentan nu există recenzii pentru această baltă"
        description="Fii primul care adaugă una!"
        action={action}
      />
    </div>
  );
}

/* The list — the viewer's own card gets Editează / Șterge (c6). */

function ReviewRowsForViewer({ rows, lakeId, lakeName }: { rows: Review[]; lakeId: string; lakeName: string }) {
  const viewer = useViewerState();
  const user = userOf(viewer);
  const t = useMemo(() => createBrowserTransport(), []);
  const mine = useQuery(myLakeReviewQuery(t, lakeId, user?.documentId));
  // fish: editable = my review exists and this card's author is its author.
  const me = mine.data?.author?.documentId ?? null;
  return <ReviewRows rows={rows} lakeId={lakeId} lakeName={lakeName} me={me} />;
}

function ReviewRows({ rows, lakeId, lakeName, me }: { rows: Review[]; lakeId: string; lakeName: string; me: string | null }) {
  return (
    <ul aria-label="Recenzii" className={cn(listGridClass('md'), 'items-start')} data-testid="reviews-list">
      {rows.map(r => (
        <li key={r.documentId}>
          {me && r.author?.documentId === me ? (
            <ReviewCard review={r} className="bg-surface" actions={<OwnActions review={r} lakeId={lakeId} lakeName={lakeName} />} />
          ) : (
            <ReviewCard review={r} className="bg-surface" />
          )}
        </li>
      ))}
    </ul>
  );
}

function OwnActions({ review, lakeId, lakeName }: { review: Review; lakeId: string; lakeName: string }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const qc = useQueryClient();
  const toast = useSiteToast();
  const [confirm, setConfirm] = useState(false);
  const [inApp, setInApp] = useState(false);
  const del = useMutation({
    ...deleteReviewMutation(t),
    onSuccess: (_data, { reviewId }) => {
      // The list is a cached public read whose edge purge is queued: a refetch right now can return
      // the old page and bring the card back (without its actions, next to «Adaugă o recenzie»).
      // Drop the row here, invalidate as usual, and cancel the list's immediate refetch — it stays
      // stale and reloads on the next visit.
      const list = lakeReviewsInfiniteQuery(t, lakeId, 10).queryKey;
      qc.setQueryData(list, d =>
        d
          ? {
              ...d,
              pages: d.pages.map(p => ({
                ...p,
                data: p.data.filter(r => r.documentId !== reviewId),
                meta: { ...p.meta, pagination: { ...p.meta.pagination, total: Math.max(0, p.meta.pagination.total - 1) } },
              })),
            }
          : d,
      );
      qc.setQueryData(myLakeReviewQuery(t, lakeId, null).queryKey, null);
      invalidateReviewQueries(qc, lakeId);
      void qc.cancelQueries({ queryKey: list });
      toast('Recenzia ta a fost ștearsă cu succes.', 'success');
      // The card (and «Șterge», which had focus) is gone: land on the page's h1 (WCAG 2.4.3).
      requestAnimationFrame(() => {
        const h1 = document.getElementById(SUB_TITLE_ID);
        if (h1) focusLandingSpot(h1);
      });
    },
    onError: (e: Error) => {
      toast(e.message, 'danger');
      invalidateReviewQueries(qc, lakeId);
    },
  });
  const edit = lakeHref('reviewForm', routes.lakeReview(lakeId, { editare: true }));
  return (
    <>
      <span className="mr-auto t-micro-strong text-accent-ink">Recenzia ta</span>
      {edit ? (
        <Link href={edit} className={buttonClass({ variant: 'outline', size: 'compact' })} data-testid="review-edit">
          <PencilSquareIcon aria-hidden className="size-4" />
          Editează
        </Link>
      ) : (
        <Button variant="outline" size="compact" icon={<PencilSquareIcon />} onClick={() => setInApp(true)} data-testid="review-edit">
          Editează
        </Button>
      )}
      {/* aria-disabled, not disabled: the dialog hands focus back here, and a disabled button drops it. */}
      <Button
        variant="danger"
        size="compact"
        icon={<TrashIcon />}
        onClick={() => {
          if (!del.isPending) setConfirm(true);
        }}
        aria-disabled={del.isPending || undefined}
        aria-busy={del.isPending || undefined}
        data-testid="review-delete"
      >
        Șterge
      </Button>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        alert
        title="Ești sigur că vrei să îți ștergi recenzia?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Închide
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirm(false);
                del.mutate({ reviewId: review.documentId, lakeId });
              }}
              data-testid="review-delete-confirm"
            >
              Șterge
            </Button>
          </>
        }
      >
        {null}
      </Dialog>
      <ReviewInAppDialog lakeName={lakeName} editing open={inApp} onClose={() => setInApp(false)} />
    </>
  );
}

/* c9 — the add bar. Hidden once the viewer reviewed; unknown session: nothing (never a wrong CTA). */

type AddBarPlacement = 'header' | 'sticky' | 'inline';

function AddBar({ lakeId, lakeName, placement }: { lakeId: string; lakeName: string; placement: AddBarPlacement }) {
  const viewer = useViewerState();
  return <AddBarFor viewer={viewer} lakeId={lakeId} lakeName={lakeName} placement={placement} />;
}

function AddBarFor({ viewer, lakeId, lakeName, placement }: { viewer: ViewerState; lakeId: string; lakeName: string; placement: AddBarPlacement }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const user = userOf(viewer);
  const mine = useQuery(myLakeReviewQuery(t, lakeId, user?.documentId));
  const [inApp, setInApp] = useState(false);
  if (isUnknownViewer(viewer)) return null;
  // Unknown (pending) or failed own-review read: no CTA — offering «Adaugă» could lead to a duplicate.
  if (user && (mine.isPending || mine.isError || mine.data)) return null;
  // Inside the empty card the long sign-in label may wrap on a phone (the kit Button is one line).
  const inline = placement === 'inline' ? 'max-w-full shrink whitespace-normal! h-auto! min-h-12 py-2.5 text-center xl:min-h-10' : undefined;
  const wrap = (node: ReactNode) =>
    placement === 'sticky' ? <StickyActions>{node}</StickyActions> : placement === 'inline' ? node : <div className="hidden md:flex">{node}</div>;
  if (!user) {
    // c9: back to this list after signing in (fish pushes /sign-in over it), where the bar flips.
    return wrap(
      <Link href={signInPath(routes.lakeReviews(lakeId))} className={buttonClass({ variant: 'outline', block: placement === 'sticky', className: inline })} data-testid="review-sign-in">
        Autentifică-te pentru a putea adăuga o recenzie
      </Link>,
    );
  }
  const add = lakeHref('reviewForm', routes.lakeReview(lakeId));
  return (
    <>
      {wrap(
        add ? (
          <Link href={add} className={buttonClass({ block: placement === 'sticky' })} data-testid="review-add">
            Adaugă o recenzie
          </Link>
        ) : (
          <Button block={placement === 'sticky'} onClick={() => setInApp(true)} data-testid="review-add">
            Adaugă o recenzie
          </Button>
        ),
      )}
      <ReviewInAppDialog lakeName={lakeName} editing={false} open={inApp} onClose={() => setInApp(false)} />
    </>
  );
}

/**
 * c10 — the loading view, under the loaded page's own header, on its tracks: the lake's real pages
 * on the left (static: they only need the lake's id), the scores docked on the right from 1280
 * (inline above the list below it), the header's action reserved from 768 — nothing reflows when
 * the reviews land.
 * TODO(kit): a ListSkeleton `shape` for the review card (the kit's card skeleton is the poster
 * card); this unit may only touch the lake pages.
 */
export function ReviewsFallback({ lakeName, lakeId: id }: { lakeName?: string; lakeId?: string }) {
  const params = useParams<{ id?: string }>();
  const lakeId = id ?? params?.id;
  return (
    <ListPage
      header={
        <ListHeader
          title={lakeName ?? <TitleShimmer srLabel="Recenzii" />}
          description={CAPTION}
          back={{ label: 'Înapoi', href: lakeId ? routes.lake(lakeId) : routes.lakes() }}
          actions={<span aria-hidden className="hidden h-12 w-48 animate-shimmer rounded-control md:block xl:h-10" />}
        />
      }
      filters={
        lakeId ? (
          <FilterColumn title="Recenzii">
            <LakePages lakeId={lakeId} current="recenzii" />
          </FilterColumn>
        ) : (
          <FilterColumnSkeleton title="Recenzii" sections={[5, 4]} />
        )
      }
      filtersLabel="Paginile bălții"
      aside={<ScoresSkeleton variant="card" />}
      asideLabel="Scorurile bălții"
      asideInline={false}
      asideBusy
    >
      <div role="status" className="flex flex-col gap-4" data-testid="reviews-skeleton">
        <span className="sr-only">Se încarcă recenziile…</span>
        <div aria-hidden className="xl:hidden">
          <ScoresSkeleton variant="tiles" />
        </div>
        <ul aria-hidden className={listGridClass('md')}>
          {[0, 1, 2, 3].map(i => (
            <li key={i} className="flex flex-col gap-3 rounded-card bg-surface p-3.5 shadow-e0">
              <span className="flex items-center gap-2">
                <span className="size-8 animate-shimmer rounded-full" />
                <span className="flex flex-1 flex-col gap-1.5">
                  <span className="h-3.5 w-28 animate-shimmer rounded-full" />
                  <span className="h-3 w-20 animate-shimmer rounded-full" />
                </span>
              </span>
              {[0, 1, 2].map(j => (
                <span key={j} className="h-3 w-full animate-shimmer rounded-full" />
              ))}
              <span className="h-3 w-40 max-w-full animate-shimmer rounded-full" />
            </li>
          ))}
        </ul>
      </div>
    </ListPage>
  );
}
