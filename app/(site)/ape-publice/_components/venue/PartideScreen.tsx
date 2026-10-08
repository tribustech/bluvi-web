'use client';

import Link from 'next/link';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Suspense, useMemo, type ReactNode } from 'react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import { AsideSkeleton, FilterColumn, FilterColumnSkeleton, ListEmpty, ListError, ListFooter, ListPage, listGridClass } from '@/components/templates/T1';
import { buttonClass } from '@/components/ui/Button';
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
import { ON_WEB, partidaHref, routes } from '@/lib/routes';
import { LiveCard, LiveCardForViewer, useNow } from '../detail/VenuePartideSection';
import { AnglerAvatar, EmptyIcon, FaceRow, SafePhoto, TitleBone, VenueHeader, WaterPages, WaterTabs, WaterTabsSkeleton } from './bits';
import { dateRange, fmtDuration } from './dates';
import { formatCount, pluralNoun } from '@/core/realtime/chat/format';

/*
 * Partide pe <apă> — fish app/(app)/public-waters/[id]/partide.tsx → VenueSessionsScreen (parity
 * public-waters.partide), on T1. This page answers «now» (its sibling Statistici answers «over a
 * period»):
 *  - c2 back + the water's name («Partide pe apă» under it); c3 the skeleton while either feed is
 *    pending; c4 a failed feed never reads as «never had a partidă» (s4): the empty state needs
 *    BOTH feeds answered; one feed failed and the other empty is the page's error (the retry
 *    refetches both); one failed beside content is an inline error in that block's place;
 *    c5 nothing ever recorded — until the web's start flow ships, «Începe o partidă aici» opens the
 *    app's store listing (parity deviation note);
 *  - c6 the live card (the detail page's, same cache entry) when sessions are live;
 *  - c7/c8 the latest catches rail → /capturi?foto=; c9 the statistics card;
 *  - c10 «Partide încheiate», 10 per page, de-duplicated, the next page near the end;
 *  - c12 «Reîmprospătează» refetches both feeds (it reports a failure when either fails);
 *    c13 the polling lives in the core queries.
 * From 1280 the water's pages in the left column (every sibling's «Pe această apă»), the rail and
 * the statistics card docked in the right column; below it they follow the live card, in the fish
 * order.
 */

const CAPTION = 'Partide pe apă';

export function PartideScreen({ code, waterKey, title }: { code: string; waterKey: string; title: string }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const venue = useMemo<CommunityVenueRef>(() => ({ kind: 'water', code }), [code]);
  const venueKey = communityVenueKey(venue);
  const live = useQuery(communityVenueSectionQuery(t, venue));
  const history = useInfiniteQuery(communityHistoryInfiniteQuery(t, [venueKey]));
  const backHref = routes.publicWater(waterKey);

  const sessions = useMemo(() => live.data?.activeSessions ?? [], [live.data]);
  const liveIds = useMemo(() => sessions.map((s) => s.documentId), [sessions]);
  const rows = useMemo(() => dedupeByDocumentId(history.data?.pages.flatMap((p) => p.data) ?? []), [history.data]);
  const total = history.data?.pages[0]?.meta.pagination.total;

  const refresh = async () => {
    const [a, b] = await Promise.all([live.refetch(), history.refetch()]);
    return !(a.isError || b.isError);
  };
  // Below 1280 the water's pages as tabs under the title (from 1280 the left column's list).
  const header = (
    <div>
      <VenueHeader title={title} description={CAPTION} backHref={backHref} onRefresh={refresh} />
      <WaterTabs waterKey={waterKey} current="partide" />
    </div>
  );
  const filters = <PartideColumn waterKey={waterKey} />;

  // Both feeds are retry:false. A feed counts as failed while it has nothing to show and its last
  // answer was an error — also while that error is being retried (TanStack puts a query without
  // data back to «pending» on a refetch), so the retry shows busy on the error card instead of
  // swapping the page for the skeleton (and remounting the header's refresh mid-announcement).
  const liveFailed = !live.data && (live.isError || live.errorUpdateCount > 0);
  const historyFailed = !history.data && (history.isError || history.errorUpdateCount > 0);

  if ((live.isPending && !liveFailed) || (history.isPending && !historyFailed)) return <PartideFallback title={title} backHref={backHref} />;
  const hasLive = sessions.length > 0;
  const hasHistory = rows.length > 0;

  // c4: both failed, or one failed and the other has nothing — the page cannot say «empty».
  if ((liveFailed && historyFailed) || (liveFailed && !hasHistory) || (historyFailed && !hasLive)) {
    return (
      <ListPage header={header} filters={filters} filtersLabel="Paginile apei">
        <div data-testid="partide-error">
          <ListError
            title="Nu am putut încărca partidele."
            onRetry={() => void refresh()}
            retrying={live.isFetching || history.isFetching}
            attempt={Math.max(live.errorUpdateCount, history.errorUpdateCount)}
          />
        </div>
      </ListPage>
    );
  }

  if (!hasLive && !hasHistory) {
    return (
      <ListPage header={header} filters={filters} filtersLabel="Paginile apei">
        <div data-testid="partide-empty">
          <StartHere code={code} />
        </div>
      </ListPage>
    );
  }

  const statsCta = <StatsCta href={routes.publicWaterStats(waterKey)} />;
  const rail = <LatestCatchesRail venue={venue} liveIds={liveIds} waterKey={waterKey} />;

  return (
    <ListPage header={header} filters={filters} filtersLabel="Paginile apei" aside={<>{rail}{statsCta}</>} asideLabel="Capturi și statistici" asideInline={false}>
      {liveFailed ? (
        <section aria-label="Partide active acum" data-testid="live-error">
          <ListError
            title="Nu am putut încărca partidele active."
            onRetry={() => void live.refetch()}
            retrying={live.isFetching}
            attempt={live.errorUpdateCount}
          />
        </section>
      ) : live.data && hasLive ? (
        <section aria-label="Partide active acum" data-testid="live-block">
          <Suspense fallback={<LiveCard data={live.data} viewerUid={null} partidaHref={undefined} />}>
            <LiveCardForViewer data={live.data} partidaHref={ON_WEB.partida ? (id) => routes.partida(id) : undefined} />
          </Suspense>
        </section>
      ) : null}
      <div className="flex flex-col gap-4 xl:hidden">
        {rail}
        {statsCta}
      </div>
      {historyFailed ? (
        <section aria-labelledby="partide-incheiate" className="flex flex-col gap-3" data-testid="history-error">
          <h2 id="partide-incheiate" className="t-title2 text-ink">
            Partide încheiate
          </h2>
          <ListError
            title="Nu am putut încărca partidele încheiate."
            onRetry={() => void history.refetch()}
            retrying={history.isFetching}
            attempt={history.errorUpdateCount}
          />
        </section>
      ) : hasHistory ? (
        <section aria-labelledby="partide-incheiate" className="flex flex-col gap-3">
          <h2 id="partide-incheiate" className="t-title2 text-ink">
            Partide încheiate
          </h2>
          <ul className={listGridClass('md')} data-testid="history-list">
            {rows.map((r) => (
              <li key={r.documentId} className="flex">
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
            formatTotal={(n) => formatCount(n, 'partidă', 'partide')}
            errorLabel="Nu am putut încărca mai multe partide."
          />
        </section>
      ) : null}
    </ListPage>
  );
}

/**
 * fish IstoricSkeleton (c3): the page's frame, the live card, the rail and history cards in grey —
 * under the loaded page's own header (the back square, the caption, the refresh), so nothing moves
 * when the feeds land. `title` omitted (the route fallback, the water not read yet): a title bone.
 */
export function PartideFallback({ title, backHref }: { title?: string; backHref: string }) {
  return (
    <div aria-busy>
      <ListPage
        header={
          <div>
            <VenueHeader title={title ?? <TitleBone label="Partide" />} description={CAPTION} backHref={backHref} />
            <WaterTabsSkeleton />
          </div>
        }
        filters={<FilterColumnSkeleton title="Pe această apă" sections={[4]} />}
        aside={<AsideSkeleton rows={2} blocks={2} />}
        asideInline={false}
        asideBusy
      >
        <div role="status" className="flex flex-col gap-4" data-testid="partide-skeleton">
          <span className="sr-only">Se încarcă partidele…</span>
          <span aria-hidden className="h-36 animate-shimmer rounded-bento" />
          <span aria-hidden className="h-5 w-40 animate-shimmer rounded-full" />
          <ul aria-hidden className={listGridClass('md')}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <li key={i} className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-e0">
                <span className="flex items-center gap-3">
                  <span className="size-11 animate-shimmer rounded-full" />
                  <span className="flex flex-1 flex-col gap-1.5">
                    <span className="h-3.5 w-[60%] animate-shimmer rounded-full" />
                    <span className="h-3 w-[40%] animate-shimmer rounded-full" />
                  </span>
                </span>
                <span className="h-14 animate-shimmer rounded-control" />
                <span className="h-3 w-[50%] animate-shimmer rounded-full" />
              </li>
            ))}
          </ul>
        </div>
      </ListPage>
    </div>
  );
}

/* The venue's latest catches — fish VenueLatestCatchesRail (c7, c8). */

function LatestCatchesRail({ venue, liveIds, waterKey }: { venue: CommunityVenueRef; liveIds: string[]; waterKey: string }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const { data } = useInfiniteQuery(communityVenueCatchesInfiniteQuery(t, venue));
  const now = useNow();
  const all = useMemo(() => (data?.pages.flatMap((p) => p.data) ?? []).filter(railSrc), [data]);
  const { rows, heading } = venueRailCatches(all, liveIds);
  if (!rows.length) return null;
  return (
    <section aria-labelledby="ultimele-capturi" className="flex flex-col gap-2.5 xl:rounded-card xl:bg-surface xl:p-4 xl:shadow-e0" data-testid="catches-rail">
      <h2 id="ultimele-capturi" className="t-heading text-ink">
        {heading}
      </h2>
      <ul className="grid grid-cols-3 gap-2">
        {rows.map((c) => (
          <li key={`${c.sessionDocumentId}:${c.clientId}`}>
            <RailTile c={c} now={now} href={routes.publicWaterCatches(waterKey, c.clientId)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

const railSrc = (c: LakeCatchDTO) => c.photoGridUrl || c.photoThumbUrl || c.photoUrl;

/**
 * useNow ticks on a 30s grid, so a catch made since the last tick lies slightly "in the future" and
 * caughtLabel would read it as clock skew (a date). Within one tick it is simply «acum».
 */
const NOW_TICK_MS = 30_000;
function tickedNow(now: number, iso: string): number {
  const at = Date.parse(iso);
  return at > now && at - now <= NOW_TICK_MS ? at : now;
}

function RailTile({ c, now, href }: { c: LakeCatchDTO; now: number | null; href: string }) {
  const when = now != null ? caughtLabel(tickedNow(now, c.occurredAt), c.occurredAt) : null;
  const name = c.angler.name ?? 'Pescar';
  const label = [c.species, c.weightKg != null ? `${fmtKg(c.weightKg)} kg` : null, name].filter(Boolean).join(', ');
  return (
    <Link
      href={href}
      aria-label={`Deschide captura: ${label}`}
      className="group relative block aspect-square overflow-hidden rounded-control bg-soft-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
          {/* fish: a 16px initials disc on the angler's colour, then when. */}
          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-accent t-nano text-on-accent">{initialsOf(c.angler.name)}</span>
          {when ? <span className="truncate t-micro">{when}</span> : null}
        </span>
      </span>
    </Link>
  );
}

/* «Statisticile apei» — fish VenueStatsCta: decorative bars behind the copy, the whole card a link (c9). */

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
    <Link
      href={href}
      className="group relative flex flex-col gap-3.5 overflow-hidden rounded-card bg-surface p-4 shadow-e0 transition-shadow duration-(--duration-fast) hover:shadow-e1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      data-testid="stats-cta"
    >
      <span aria-hidden className="absolute right-4 bottom-4 flex items-end gap-1 md:gap-1.5">
        {BARS.map((b, i) => (
          <span key={i} className={cn('w-4 rounded-badge md:w-6.5 xl:w-4', b.h, b.accent ? 'bg-accent' : 'bg-indigo-2')} />
        ))}
      </span>
      <span className="relative flex max-w-[58%] flex-col gap-0.75">
        <span className="t-title2 text-ink">Statisticile apei</span>
        {/* Not fish's «Top pescari, standuri și recorduri»: a water's Statistici has no stands (statistici.c11). */}
        <span className="t-caption text-muted">Top pescari, recorduri și specii</span>
      </span>
      <span className={buttonClass({ variant: 'primary', size: 'compact', className: 'relative self-start' })}>Vezi statisticile</span>
    </Link>
  );
}

/* A finished partidă — fish CommunityHistoryCard (card D): angler-titled, catches · kg · duration,
 * the photo strip, the date range. On the water's own page the meta line is the stand alone (the
 * water's name would repeat on every card).
 * TODO(kit): PartidaCard with photos / dateRange / members, or this card as a named kit card with
 * a /dev/kit entry — components/cards is out of this unit's scope. */

/** fish PhotoStrip MAX_TILES (the CMS's PHOTO_STRIP_CAP). */
const PHOTO_TILES = 3;

function HistoryCard({ row }: { row: CommunityHistorySessionDTO }) {
  const tiles = (row.photos ?? []).slice(0, PHOTO_TILES);
  const photoTotal = Math.max(row.photoCount ?? 0, tiles.length);
  const more = photoTotal - tiles.length;
  const weighed = isWeighed(row.totalKg);
  const duration = new Date(row.endedAt).getTime() - new Date(row.startedAt).getTime();
  const title = membersLabel(row.members);
  const stand = standLabel(row.standName);
  const href = partidaHref(row.documentId) ?? undefined;
  return (
    <article className="flex w-full flex-col gap-3 rounded-card bg-surface p-4 shadow-e0" data-testid="history-card">
      <header className="flex items-center gap-3">
        {row.members.length > 1 ? (
          <FaceRow people={row.members.slice(0, 3).map((m) => ({ uid: m.uid, name: m.name || 'Pescar', src: m.avatarUrl }))} />
        ) : row.members[0] ? (
          <AnglerAvatar uid={row.members[0].uid} name={row.members[0].name || 'Pescar'} src={row.members[0].avatarUrl} size={44} />
        ) : null}
        <span className="flex min-w-0 flex-1 flex-col">
          <h3 className="truncate t-body-strong text-ink">{href ? <Link href={href}>{title}</Link> : title}</h3>
          {stand ? (
            <span className="truncate t-caption text-muted" data-testid="history-meta">
              {stand}
            </span>
          ) : null}
        </span>
        {/* No «Încheiată» pill: the section is «Partide încheiate» (every card would repeat it). */}
      </header>
      {/* kg only when something was weighed (rule 4: never a column of «—» on a public water,
          where almost nothing is); then catches · kg · duration, the duration given the most room so
          «123 h 59 min» stays on one line in the narrowest card. */}
      <dl className={cn('grid divide-x divide-hairline rounded-control bg-page py-2.5', weighed ? 'grid-cols-[1fr_1fr_1.4fr]' : 'grid-cols-2')} data-testid="history-stats">
        <Stat value={String(row.catchCount)} label={pluralNoun(row.catchCount, 'captură', 'capturi')} />
        {weighed && row.totalKg != null ? <Stat value={fmtKg(row.totalKg)} label="kg total" accent /> : null}
        <Stat value={fmtDuration(duration)} label="durată" />
      </dl>
      {tiles.length ? (
        // fish PhotoStrip: at most 3 tiles in thirds (the CMS sends at most 3), «+N» over the last
        // one when the partidă holds more photos than the strip shows.
        <ul aria-label={formatCount(photoTotal, 'fotografie', 'fotografii')} className="grid grid-cols-3 gap-1.5" data-testid="history-photos">
          {tiles.map((p, i) => (
            <li key={i} className="relative aspect-square overflow-hidden rounded-control bg-soft-fill">
              <SafePhoto src={p.thumbUrl ?? p.url} className="size-full object-cover" />
              {i === tiles.length - 1 && more > 0 ? (
                <span className="absolute inset-0 flex items-center justify-center bg-photo-scrim t-body-strong text-on-photo-scrim" data-testid="history-photos-more">
                  +{more}
                </span>
              ) : p.weightKg != null ? (
                <span className="absolute bottom-1 left-1 rounded-badge bg-photo-scrim px-1.25 t-micro-strong text-on-photo-scrim">{fmtKg(p.weightKg)} kg</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <footer className="mt-auto flex items-center justify-between gap-3 border-t border-hairline pt-2.5">
        <time dateTime={row.startedAt} className="t-caption text-muted tabular-nums">
          {dateRange(row.startedAt, row.endedAt)}
        </time>
        {href ? (
          <Link href={href} className="inline-flex items-center gap-0.5 t-button-compact text-accent-ink hover:underline">
            Vezi rezumatul
            <ChevronRightIcon aria-hidden className="size-4" />
          </Link>
        ) : null}
      </footer>
    </article>
  );
}

function Stat({ value, label, accent }: { value: ReactNode; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col-reverse items-center gap-0.5">
      <dt className="t-micro text-muted">{label}</dt>
      <dd className={cn('t-heading whitespace-nowrap tabular-nums', accent ? 'text-accent-ink' : 'text-ink')}>{value}</dd>
    </div>
  );
}

/**
 * The left column from 1280: the water's pages alone, so the column is titled with their eyebrow
 * («Pe această apă») and the list drops its own — the page's name is already the selected row.
 */
function PartideColumn({ waterKey }: { waterKey: string }) {
  return (
    <FilterColumn title="Pe această apă">
      <WaterPages waterKey={waterKey} current="partide" eyebrow={false} />
    </FilterColumn>
  );
}

const EMPTY_TITLE = 'Nicio partidă înregistrată pe această apă încă.';
const EMPTY_ICON = (
  <EmptyIcon>
    <CalendarDaysIcon aria-hidden />
  </EmptyIcon>
);

/**
 * fish's green «Începe o partidă aici» (VenueSessionsScreen:155-170) → the web's start flow pre-set
 * to this water, /partide/incepe?apa=<linkCode> (parity public-waters.partide.c5, partide.incepe
 * c15). A guest goes through sign-in and comes back to it (proxy.ts). Without the flow
 * (ON_WEB.startPartida off) the empty copy stands alone — never a dead link.
 */
function StartHere({ code }: { code: string }) {
  return (
    <ListEmpty
      title={EMPTY_TITLE}
      icon={EMPTY_ICON}
      action={
        ON_WEB.startPartida ? (
          <Link href={routes.startPartida({ apa: code })} className={buttonClass({ variant: 'success' })} data-testid="start-here">
            Începe o partidă aici
          </Link>
        ) : undefined
      }
    />
  );
}
