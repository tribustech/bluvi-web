'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Suspense, useMemo, useState, useSyncExternalStore } from 'react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { ArrowPathIcon, CalendarDaysIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { CardShell, CardTitle } from '@/components/cards/CardShell';
import { AsideSection, COLUMN_CARD, FilterColumn, FilterColumnSkeleton, FOCUS_RING, ListEmpty, ListFooter, ListHeader, ListPage, listGridClass, pageToolClass } from '@/components/templates/T1';
import { buttonClass } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { cn } from '@/components/ui/cn';
import {
  caughtLabel,
  communityHistoryInfiniteQuery,
  communityVenueCatchesInfiniteQuery,
  communityVenueKey,
  communityVenueSectionQuery,
  dedupeByDocumentId,
  fmtKg,
  initialsOf,
  isWeighed,
  membersLabel,
  standLabel,
  venueRailCatches,
  type CommunityHistorySessionDTO,
  type CommunityVenueRef,
  type LakeCatchDTO,
} from '@/core/partide';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { lakeHref } from '../_components/availability';
import { APP_STORE, PLAY_STORE } from '../_components/LakeDialogs';
import { LiveCard, LiveCardForViewer, useNow } from '../_components/PartideSection';
import { TitleShimmer } from '../_sub/FallbackHeader';
import { LakePages } from '../_sub/LakePages';
import { SUB_TITLE_ID, SubListError, SubRetryFocus } from '../_sub/states';
import { useBack } from '../_sub/useBack';
import { rankKg, StatCell } from '../_sub/stats';
import { AnglerAvatar, dateRange, EmptyIcon, FaceRow, SafePhoto } from '../_sub/venue';
import { formatCount } from '@/core/realtime/chat/format';

/*
 * Partide la baltă — fish app/(app)/lakes/[lakeId]/partide.tsx → VenueSessionsScreen (parity
 * lakes.partide), on T1. This page answers «now» (Statistici answers «over a period»):
 *  - c1 the lake's name as the title («Partide la baltă» under it), the back control;
 *  - c2 the skeleton while either feed is pending; c3 both feeds failed → «Nu am putut încărca
 *    partidele.» + «Încearcă din nou» (refetches both) — never the empty copy; a feed that failed
 *    beside the other's content shows its own inline error in its block's place;
 *  - c4 nothing ever recorded: «Nicio partidă înregistrată la această baltă încă.» + «Începe o
 *    partidă aici» (→ /partide/incepe?balta= once the web has the start flow; until then the app);
 *  - c5 the live card (the lake page's, same cache entry) leads when sessions are live;
 *  - c6 the latest catches rail → /capturi?foto=; c7 the statistics card → /statistici;
 *  - c8 «Partide încheiate», 10 a page, de-duplicated, the next page near the end, each card
 *    ribboned «Încheiată» with «Vezi rezumatul»; c9 a partidă opens once the web has its page
 *    (availability.ts `partida`); c10 the live section polls (core: 60s) and «Reîmprospătează»
 *    reloads both feeds together.
 * From 1280 the lake's pages on the left, the rail and the statistics card docked on the right;
 * below it they follow the live card, in the fish order.
 */

const CAPTION = 'Partide la baltă';
const EMPTY_TITLE = 'Nicio partidă înregistrată la această baltă încă.';

export function PartideScreen({ lakeId, lakeName }: { lakeId: string; lakeName: string }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const venue = useMemo<CommunityVenueRef>(() => ({ kind: 'lake', id: lakeId }), [lakeId]);
  const live = useQuery(communityVenueSectionQuery(t, venue));
  const history = useInfiniteQuery(communityHistoryInfiniteQuery(t, [communityVenueKey(venue)]));
  const back = useBack(routes.lake(lakeId));

  const sessions = useMemo(() => live.data?.activeSessions ?? [], [live.data]);
  const liveIds = useMemo(() => sessions.map(s => s.documentId), [sessions]);
  const rows = useMemo(() => dedupeByDocumentId(history.data?.pages.flatMap(p => p.data) ?? []), [history.data]);
  const total = history.data?.pages[0]?.meta.pagination.total;

  /**
   * c10: both feeds together; true when both answered. The busy look (spin, aria-busy) is only ever
   * for a refresh the user started — never the 60s background poll or a refetch on mount: the HTML
   * is static, and a stale cache refetching while it hydrates must not flip attributes the server
   * rendered (hydration mismatch), nor spin a control nobody pressed.
   */
  const refresh = async () => {
    const [a, b] = await Promise.all([live.refetch(), history.refetch()]);
    return !a.isError && !b.isError;
  };
  const [retrying, setRetrying] = useState(false);
  const retry = async () => {
    setRetrying(true);
    try {
      await refresh();
    } finally {
      setRetrying(false);
    }
  };
  const header = (
    <ListHeader
      titleId={SUB_TITLE_ID}
      title={lakeName || 'Partide'}
      description={CAPTION}
      back={{ label: 'Înapoi', onClick: back }}
      actions={<RefreshTool onRefresh={refresh} />}
    />
  );
  const filters = (
    <FilterColumn title="Partide">
      <LakePages lakeId={lakeId} current="partide" />
    </FilterColumn>
  );

  // A feed counts as failed while it has nothing to show and its last answer was an error — also
  // while that error is retried (TanStack puts a query without data back to «pending» on a refetch).
  const liveFailed = !live.data && (live.isError || live.errorUpdateCount > 0);
  const historyFailed = !history.data && (history.isError || history.errorUpdateCount > 0);

  if ((live.isPending && !liveFailed) || (history.isPending && !historyFailed)) return <PartideFallback lakeName={lakeName} lakeId={lakeId} />;
  const hasLive = sessions.length > 0;
  const hasHistory = rows.length > 0;

  const statsCta = <StatsCta href={routes.lakeStats(lakeId)} />;
  // From 1280 the three tracks stay in every state (the centre never jumps sideways between the
  // skeleton, the data, the empty and the error views): the statistics card keeps the right one.
  const quietAside = { aside: statsCta, asideLabel: 'Statistici', asideInline: false as const };

  // c3: both failed, or one failed and the other has nothing — the page cannot say «empty».
  if ((liveFailed && historyFailed) || (liveFailed && !hasHistory) || (historyFailed && !hasLive)) {
    return (
      <ListPage header={header} filters={filters} filtersLabel="Paginile bălții" {...quietAside}>
        <SubListError
          testId="partide-error"
          title="Nu am putut încărca partidele."
          onRetry={() => void retry()}
          retrying={retrying}
          attempt={Math.max(live.errorUpdateCount, history.errorUpdateCount)}
        />
      </ListPage>
    );
  }

  if (!hasLive && !hasHistory) {
    return (
      <ListPage header={header} filters={filters} filtersLabel="Paginile bălții" {...quietAside}>
        <div data-testid="partide-empty">
          <SubRetryFocus />
          <StartHere lakeId={lakeId} />
        </div>
      </ListPage>
    );
  }

  const rail = <LatestCatchesRail venue={venue} liveIds={liveIds} lakeId={lakeId} />;

  return (
    <ListPage header={header} filters={filters} filtersLabel="Paginile bălții" aside={<>{rail}{statsCta}</>} asideLabel="Capturi și statistici" asideInline={false}>
      <SubRetryFocus />
      {liveFailed ? (
        <section aria-label="Partide active acum" data-testid="live-error">
          <SubListError title="Nu am putut încărca partidele active." onRetry={() => void live.refetch()} retrying={live.isFetching} attempt={live.errorUpdateCount} />
        </section>
      ) : live.data && hasLive ? (
        <section aria-label="Partide active acum" data-testid="live-block">
          <Suspense fallback={<LiveCard data={live.data} viewerUid={null} />}>
            <LiveCardForViewer data={live.data} />
          </Suspense>
        </section>
      ) : null}
      {/* Below 1280: the rail and the card follow the live card (fish order); from 768 side by side. */}
      <div className="flex flex-col gap-4 md:grid md:grid-cols-[3fr_2fr] md:[&>:only-child]:col-span-2 xl:hidden">
        {rail}
        {statsCta}
      </div>
      {historyFailed ? (
        <section aria-labelledby="partide-incheiate" className="flex flex-col gap-3" data-testid="history-error">
          <h2 id="partide-incheiate" className="t-title2 text-ink">
            Partide încheiate
          </h2>
          <SubListError title="Nu am putut încărca partidele încheiate." onRetry={() => void history.refetch()} retrying={history.isFetching} attempt={history.errorUpdateCount} />
        </section>
      ) : hasHistory ? (
        <section aria-labelledby="partide-incheiate" className="flex flex-col gap-3">
          <h2 id="partide-incheiate" className="t-title2 text-ink">
            Partide încheiate
          </h2>
          <ul className={listGridClass('md')} data-testid="history-list">
            {rows.map(r => (
              <li key={r.documentId} className="flex" data-testid="history-card">
                <HistoryCard row={r} />
              </li>
            ))}
          </ul>
          <ListFooter
            hasMore={!!history.hasNextPage}
            loadingMore={history.isFetchingNextPage}
            error={history.isFetchNextPageError}
            onLoadMore={() => {
              if (history.hasNextPage && !history.isFetchingNextPage) void history.fetchNextPage();
            }}
            shown={rows.length}
            total={total}
            noun="partide"
            errorLabel="Nu am putut încărca mai multe partide."
          />
        </section>
      ) : null}
    </ListPage>
  );
}

/**
 * fish IstoricSkeleton (c2), on the loaded page's own geometry so nothing moves when the feeds
 * land: the header, the real «Pe această baltă» column (static — it only needs the lake's id), the
 * rail and the statistics card (docked from 1280, one row above the history below it), then the
 * «Partide încheiate» heading and history cards. No live block: most lakes have no live session,
 * and a grey block that then vanishes would move everything up.
 * TODO(kit): a ListSkeleton `shape` for the history card (avatar, stats band, photo strip) — the
 * kit's card skeleton is the poster card; this unit may only touch the lake pages.
 */
export function PartideFallback({ lakeName, lakeId: id }: { lakeName?: string; lakeId?: string }) {
  const params = useParams<{ id?: string }>();
  const lakeId = id ?? params?.id;
  return (
    <div aria-busy>
      <ListPage
        header={
          <ListHeader
            title={lakeName ?? <TitleShimmer srLabel="Partide" />}
            description={CAPTION}
            back={{ label: 'Înapoi', href: lakeId ? routes.lake(lakeId) : routes.lakes() }}
          />
        }
        filters={
          lakeId ? (
            <FilterColumn title="Partide">
              <LakePages lakeId={lakeId} current="partide" />
            </FilterColumn>
          ) : (
            <FilterColumnSkeleton title="Partide" sections={[5, 4]} />
          )
        }
        filtersLabel="Paginile bălții"
        aside={
          <>
            <RailSkeleton />
            <CtaSkeleton />
          </>
        }
        asideLabel="Capturi și statistici"
        asideInline={false}
        asideBusy
      >
        <div role="status" className="flex flex-col gap-4" data-testid="partide-skeleton">
          <span className="sr-only">Se încarcă partidele…</span>
          <div aria-hidden className="flex flex-col gap-4 md:grid md:grid-cols-[3fr_2fr] xl:hidden">
            <RailSkeleton />
            <CtaSkeleton />
          </div>
          <span aria-hidden className="h-5.5 w-44 animate-shimmer rounded-full md:h-6.5" />
          <ul aria-hidden className={listGridClass('md')}>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <li key={i} className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-e0">
                <span className="flex min-h-11 items-center gap-3">
                  <span className="size-11 animate-shimmer rounded-full" />
                  <span className="flex flex-1 flex-col gap-1.5">
                    <span className="h-3.5 w-32 max-w-full animate-shimmer rounded-full" />
                    <span className="h-3 w-20 animate-shimmer rounded-full" />
                  </span>
                </span>
                <span className="h-16 animate-shimmer rounded-control" />
                <span className="grid grid-cols-3 gap-1.5">
                  {[0, 1, 2].map(j => (
                    <span key={j} className="aspect-square animate-shimmer rounded-control" />
                  ))}
                </span>
                <span className="h-7 w-48 max-w-full animate-shimmer rounded-full" />
              </li>
            ))}
          </ul>
        </div>
      </ListPage>
    </div>
  );
}

/** The rail's grey shape: its card, the heading row and the three square tiles. */
function RailSkeleton() {
  return (
    <div aria-hidden className={cn('flex flex-col gap-3', COLUMN_CARD)}>
      <span className="flex min-h-9 items-center">
        <span className="h-4 w-32 animate-shimmer rounded-full" />
      </span>
      <span className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map(i => (
          <span key={i} className="aspect-square animate-shimmer rounded-control" />
        ))}
      </span>
    </div>
  );
}

/** «Statisticile bălții» in grey: the card at its loaded height (title, caption, the button). */
function CtaSkeleton() {
  return (
    <div aria-hidden className="flex min-h-34 flex-col gap-3.5 rounded-card bg-surface p-4 shadow-e0">
      <span className="flex flex-col gap-1.5">
        <span className="h-4.5 w-36 animate-shimmer rounded-full" />
        <span className="h-3 w-44 max-w-[58%] animate-shimmer rounded-full" />
      </span>
      <span className="mt-auto h-9 w-36 animate-shimmer rounded-control" />
    </div>
  );
}

/* The lake's latest catches — fish VenueLatestCatchesRail (c6). */

function LatestCatchesRail({ venue, liveIds, lakeId }: { venue: CommunityVenueRef; liveIds: string[]; lakeId: string }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const { data } = useInfiniteQuery(communityVenueCatchesInfiniteQuery(t, venue));
  const now = useNow();
  const all = useMemo(() => (data?.pages.flatMap(p => p.data) ?? []).filter(railSrc), [data]);
  const { rows, heading } = venueRailCatches(all, liveIds);
  if (!rows.length) return null;
  return (
    <div className="flex" data-testid="catches-rail">
      <AsideSection title={heading} className="w-full">
        <ul className="grid grid-cols-3 gap-2">
          {rows.map(c => (
            <li key={`${c.sessionDocumentId}:${c.clientId}`}>
              <RailTile c={c} now={now} href={routes.lakeCatches(lakeId, c.clientId)} />
            </li>
          ))}
        </ul>
      </AsideSection>
    </div>
  );
}

const railSrc = (c: LakeCatchDTO) => c.photoGridUrl || c.photoThumbUrl || c.photoUrl;

function RailTile({ c, now, href }: { c: LakeCatchDTO; now: number | null; href: string }) {
  const when = now != null ? caughtLabel(now, c.occurredAt) : null;
  const name = c.angler.name ?? 'Pescar';
  const label = [c.species, c.weightKg != null ? `${fmtKg(c.weightKg)} kg` : null, name].filter(Boolean).join(', ');
  return (
    <Link
      href={href}
      aria-label={`Deschide captura: ${label}`}
      className={cn('group relative block aspect-square overflow-hidden rounded-control bg-soft-fill', FOCUS_RING)}
      data-testid="rail-tile"
    >
      <SafePhoto src={railSrc(c) as string} className="size-full object-cover transition-transform duration-(--duration-slow) group-hover:scale-[1.03]" />
      <span aria-hidden className="absolute inset-0 bg-linear-to-t from-photo-scrim to-transparent to-65%" />
      <span aria-hidden className="absolute inset-x-1.75 bottom-1.75 flex flex-col gap-0.75 text-on-photo-scrim">
        {c.weightKg != null ? (
          <span className="flex items-baseline gap-0.75">
            <span className="t-body-strong">{fmtKg(c.weightKg)}</span>
            <span className="t-micro">kg</span>
          </span>
        ) : null}
        <span className="flex min-w-0 items-center gap-1.25">
          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-accent t-nano text-on-accent">{initialsOf(c.angler.name)}</span>
          {when ? <span className="truncate t-micro">{when}</span> : null}
        </span>
      </span>
    </Link>
  );
}

/* «Statisticile bălții» — fish VenueStatsCta (c7): decorative bars behind the copy, the whole card a link. */

const BARS = [
  { h: 'h-8.5', accent: false },
  { h: 'h-14.5', accent: false },
  { h: 'h-10', accent: false },
  { h: 'h-19.5', accent: true },
  { h: 'h-11.5', accent: false },
  { h: 'h-23', accent: true },
];

function StatsCta({ href }: { href: string }) {
  return (
    <div className="flex" data-testid="stats-cta">
      <CardShell interactive className="w-full gap-3.5 p-4">
        <span aria-hidden className="absolute right-4 bottom-4 flex items-end gap-1 md:gap-1.5">
          {BARS.map((b, i) => (
            <span key={i} className={cn('w-4 rounded-badge', b.h, b.accent ? 'bg-accent' : 'bg-indigo-2')} />
          ))}
        </span>
        {/* The title is the card's stretched link (the kit's ring); the copy sits over the bars. */}
        <span className="flex max-w-[58%] flex-col gap-0.75">
          <CardTitle as="h2" href={href} className="t-title2 text-ink">
            Statisticile bălții
          </CardTitle>
          <span className="t-caption text-muted">Top pescari, standuri și recorduri</span>
        </span>
        {/* The look of a button, not a target: a press anywhere on the card goes to the title's link. */}
        <span aria-hidden className={buttonClass({ variant: 'primary', size: 'compact', className: 'pointer-events-none relative self-start' })}>
          Vezi statisticile
        </span>
      </CardShell>
    </div>
  );
}

/*
 * A finished partidă — fish CommunityHistoryCard (c8), on the kit card (CardShell + CardTitle: the
 * stretched link and its focus ring once the card opens something). The header is one height for a
 * solo angler (44 avatar) and a group (FaceRow: the kit FaceStack's look with a photo fallback), so every card of a row starts its stats
 * and photos on one line; the members' names get two lines, the «Încheiată» state sits in the
 * footer before the date. The figures are the lake pages' one stat cell (t-stat, unit beside).
 * TODO(kit): PartidaCard has no photo strip / three-figure band variant (this unit may only touch
 * the lake pages).
 */

function HistoryCard({ row }: { row: CommunityHistorySessionDTO }) {
  const photos = row.photos ?? [];
  const photoTotal = Math.max(row.photoCount ?? 0, photos.length);
  // fish PhotoStrip: at most three tiles; the last one turns into «+N» when there are more.
  const shown = photos.slice(0, PHOTO_TILES);
  const hidden = photoTotal - shown.length;
  const duration = durationParts(new Date(row.endedAt).getTime() - new Date(row.startedAt).getTime());
  const title = membersLabel(row.members);
  const stand = standLabel(row.standName);
  const weighed = isWeighed(row.totalKg);
  // c9: fish useOpenPartida opens your own partidă as yours, anyone else's as the spectator view —
  // both live on the web's partidă page (M4); until then the card is not a link.
  const href = lakeHref('partida', routes.partida(row.documentId));
  return (
    <CardShell interactive={!!href} className="w-full gap-3 p-4">
      <header className="flex min-h-11 items-center gap-3">
        {row.members.length > 1 ? (
          <FaceRow people={row.members.slice(0, 3).map(m => ({ name: m.name || 'Pescar', src: m.avatarUrl }))} />
        ) : row.members[0] ? (
          <AnglerAvatar name={row.members[0].name || 'Pescar'} src={row.members[0].avatarUrl} size={44} />
        ) : null}
        <span className="flex min-w-0 flex-1 flex-col">
          <CardTitle href={href} className="line-clamp-2 t-body-strong text-ink">
            {title}
          </CardTitle>
          {stand ? (
            <span className="truncate t-caption text-muted" data-testid="history-meta">
              {stand}
            </span>
          ) : null}
        </span>
      </header>
      <dl className="grid grid-cols-3 divide-x divide-hairline rounded-control bg-page py-2.5">
        <StatCell centered label={row.catchCount === 1 ? 'Captură' : 'Capturi'} value={String(row.catchCount)} />
        <StatCell centered label="Total" value={weighed && row.totalKg != null ? rankKg(row.totalKg) : '—'} unit={weighed ? 'kg' : undefined} muted={!weighed} />
        <StatCell centered label="Durată" value={duration.value} unit={duration.unit} />
      </dl>
      {shown.length ? (
        <ul aria-label={formatCount(photoTotal, 'fotografie', 'fotografii')} className="grid grid-cols-3 gap-1.5" data-testid="history-photos">
          {shown.map((p, i) => {
            const more = hidden > 0 && i === shown.length - 1;
            return (
              <li key={i} className="relative flex aspect-square items-center justify-center overflow-hidden rounded-control bg-soft-fill">
                {/* Under the photo: what shows when it is missing or fails (never a flat grey square). */}
                <PhotoIcon aria-hidden className="size-6 text-faint" />
                {p.thumbUrl || p.url ? <SafePhoto src={(p.thumbUrl ?? p.url) as string} className="absolute inset-0 size-full object-cover" /> : null}
                {more ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-photo-scrim t-heading text-on-photo-scrim" data-testid="history-photos-more">
                    +{hidden}
                  </span>
                ) : p.weightKg != null ? (
                  <span className="absolute bottom-1 left-1 rounded-badge bg-photo-scrim px-1.25 t-micro-strong text-on-photo-scrim">{fmtKg(p.weightKg)} kg</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <footer className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-hairline pt-2.5">
        <span data-testid="history-ribbon">
          <StatusPill tone="neutral">Încheiată</StatusPill>
        </span>
        <time dateTime={row.startedAt} className="t-caption text-muted tabular-nums">
          {dateRange(row.startedAt, row.endedAt)}
        </time>
        {href ? (
          <span aria-hidden className="ml-auto inline-flex items-center gap-0.5 t-button-compact text-accent-ink">
            Vezi rezumatul
            <ChevronRightIcon className="size-4" />
          </span>
        ) : null}
      </footer>
    </CardShell>
  );
}

const PHOTO_TILES = 3;

/**
 * A partidă's length — fish fmtSpan («73h 24m», «45 min»), never a clock-like «73:24». Split for
 * the stats band's one cell: the hours at the stat step, the minutes as its unit, so it fits a
 * third of a 280px card.
 */
function durationParts(ms: number): { value: string; unit: string } {
  const total = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? { value: `${h}h`, unit: `${String(m).padStart(2, '0')}m` } : { value: String(m), unit: 'min' };
}

/**
 * c10 «Reîmprospătează» — the T1 header tool (pageToolClass: a 48 icon square below 768, labelled
 * from 768, so the lake's name keeps the phone's row). Busy only for the press itself: aria-busy +
 * aria-disabled (it keeps focus), the glyph turning; the outcome is said in a polite live region.
 */
function RefreshTool({ onRefresh }: { onRefresh: () => Promise<boolean> }) {
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const run = async () => {
    if (busy) return;
    setBusy(true);
    setSaid('Se actualizează…');
    const ok = await onRefresh().catch(() => false);
    setBusy(false);
    setSaid(ok ? 'Partidele sunt actualizate.' : 'Nu s-a putut actualiza.');
  };
  return (
    <>
      <button type="button" onClick={() => void run()} aria-busy={busy || undefined} aria-disabled={busy || undefined} className={pageToolClass()} data-testid="partide-refresh">
        <ArrowPathIcon aria-hidden className={cn(busy && 'animate-spin motion-reduce:animate-none')} />
        <span className="sr-only md:not-sr-only">Reîmprospătează</span>
      </button>
      <span role="status" className="sr-only">
        {said}
      </span>
    </>
  );
}

/* c4 — never had a partidă. */

const noSubscribe = () => () => {};
/** An Apple device (the App Store first), read in the browser; the server answers no. */
const useApple = () => useSyncExternalStore(noSubscribe, () => /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent), () => false);

const EMPTY_ICON = (
  <EmptyIcon>
    <CalendarDaysIcon aria-hidden />
  </EmptyIcon>
);

/**
 * fish's green «Începe o partidă aici» → /partide/start?lakeId=. The web's start flow is M4
 * (availability.ts `startPartida`): until then the same button opens the app's store listing — the
 * visitor's platform first, the other beside it — never a dead link.
 */
function StartHere({ lakeId }: { lakeId: string }) {
  const apple = useApple();
  const start = lakeHref('startPartida', routes.startPartida({ balta: lakeId }));
  if (start) {
    return (
      <ListEmpty
        title={EMPTY_TITLE}
        icon={EMPTY_ICON}
        action={
          <Link href={start} className={buttonClass({ variant: 'success' })} data-testid="start-here">
            Începe o partidă aici
          </Link>
        }
      />
    );
  }
  const first = apple ? { href: APP_STORE, store: 'App Store' } : { href: PLAY_STORE, store: 'Google Play' };
  const other = apple ? { href: PLAY_STORE, store: 'Google Play' } : { href: APP_STORE, store: 'App Store' };
  return (
    <ListEmpty
      title={EMPTY_TITLE}
      icon={EMPTY_ICON}
      description={`Pornirea unei partide de pe web vine în curând; până atunci, din aplicația Bluvi (${first.store}).`}
      action={
        <>
          <a href={first.href} rel="noopener" className={buttonClass({ variant: 'success' })} data-testid="start-here">
            Începe o partidă aici
          </a>
          <a href={other.href} rel="noopener" className={buttonClass({ variant: 'secondary' })}>
            {other.store}
          </a>
        </>
      }
    />
  );
}
