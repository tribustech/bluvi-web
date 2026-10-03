'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { AnnouncementListItem } from '@/core/news';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { CardShell, CardTitle } from '@/components/cards';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import { CardSkeleton, HorizontalRail, RailItem } from './HorizontalRail';
import { SeeAllTitle } from './SeeAllTitle';
import { newsDate } from './format';
import { homeNewsQuery } from './queries';

/**
 * fish components/NewsHorizontalList.tsx + NewsCard.tsx: «Noutăți» with 225px cards (pages of 10,
 * more on scroll). Hidden while there is no data at all (fish `if (!news) return null`); empty list:
 * «Momentan nu există noutăți.» Desktop: the first three, the newest wider (design 1.4fr 1fr 1fr).
 * Rendered inside a <Suspense> whose fallback is NewsView from the server's first page.
 */
export function NewsSection({ layout }: { layout: 'rail' | 'grid' }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const q = useInfiniteQuery(homeNewsQuery(t));
  const news = useMemo(() => q.data?.pages.flatMap((p) => p.data), [q.data]);
  if (!q.isLoading && !news) return null;
  return (
    <NewsView
      layout={layout}
      news={q.isLoading ? undefined : news}
      onEndReached={() => {
        if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
      }}
      fetchingNext={q.isFetchingNextPage}
    />
  );
}

/** The markup of the section, from data alone (undefined = loading): also the prerendered fallback. */
export function NewsView({
  layout,
  news,
  onEndReached,
  fetchingNext = false,
}: {
  layout: 'rail' | 'grid';
  news: AnnouncementListItem[] | undefined;
  onEndReached?: () => void;
  fetchingNext?: boolean;
}) {
  const id = `acasa-noutati-${layout}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <SeeAllTitle id={id} title="Noutăți" href={routes.news()} />
      {!news ? (
        <div className="-mx-5 flex gap-2.5 overflow-hidden px-5 pb-4 md:-mx-6 md:px-6" role="status" aria-label="Se încarcă noutățile">
          {[0, 1, 2].map((i) => (
            <CardSkeleton key={i} width={225} height={300} />
          ))}
        </div>
      ) : news.length === 0 ? (
        <p className="t-body text-muted">Momentan nu există noutăți.</p>
      ) : layout === 'grid' ? (
        <ul className="grid grid-cols-[1.4fr_1fr_1fr] gap-3.5" aria-label="Noutăți">
          {news.slice(0, 3).map((n) => (
            <li key={n.documentId} className="min-w-0">
              <NewsCard news={n} variant="grid" />
            </li>
          ))}
        </ul>
      ) : (
        <HorizontalRail
          label="Noutăți"
          onEndReached={onEndReached}
          footer={fetchingNext ? <CardSkeleton width={225} height={300} /> : null}
        >
          {news.map((n) => (
            <RailItem key={n.documentId} width={225}>
              <NewsCard news={n} />
            </RailItem>
          ))}
        </HorizontalRail>
      )}
    </section>
  );
}

/** fish components/NewsCard.tsx — banner, date + category, title (3 lines), description (3 lines). */
function NewsCard({ news, variant = 'rail' }: { news: AnnouncementListItem; variant?: 'rail' | 'grid' }) {
  const banner = news.banner?.[0];
  const src = banner ? (banner.mediumUrl ?? banner.url) : null;
  return (
    <CardShell elevated interactive className="h-full">
      <div className={cn('relative shrink-0 overflow-hidden bg-soft-fill', variant === 'grid' ? 'h-[170px]' : 'h-[200px] rounded-control')}>
        {src ? <Image src={src} alt="" fill sizes="(min-width: 1280px) 320px, 225px" className="object-cover" /> : null}
      </div>
      <div className="flex flex-col gap-1 p-2.5 xl:px-3.5 xl:py-3">
        {/* The date never breaks; when it and the tag do not fit (narrow desktop columns) the tag
            moves to its own line. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="mr-auto whitespace-nowrap t-caption text-muted">
            <time dateTime={news.createdAt}>{newsDate(news.createdAt)}</time>
          </p>
          <Badge color="green">{news.category}</Badge>
        </div>
        <div className="flex min-h-[132px] flex-col gap-0.5">
          <CardTitle href={routes.newsItem(news.documentId)} className="line-clamp-3 t-heading text-ink">
            {news.title}
          </CardTitle>
          {news.shortDescription ? <p className="line-clamp-3 t-body text-muted">{news.shortDescription}</p> : null}
        </div>
      </div>
    </CardShell>
  );
}
