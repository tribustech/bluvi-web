'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { AnnouncementListItem } from '@/core/news';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { CardShell, CardTitle, Tag } from '@/components/cards';
import { CardSkeleton, HorizontalRail, RailItem, RailRetryItem, useRailRead, HOME_RAIL_BLEED } from './HorizontalRail';
import { HomeGrid, HomeGridSkeleton } from './HomeGrid';
import { RailEmpty, RailSection, RailSkeleton } from './RailSection';
import { newsDate } from './format';
import { NEWS_CARD_HEIGHT } from './newsCard';
import { homeNewsQuery } from './queries';


/**
 * fish components/NewsHorizontalList.tsx + NewsCard.tsx: «Noutăți» with 225px cards (pages of 10,
 * more on scroll). Hidden while there is no data at all (fish `if (!news) return null`); empty list:
 * «Momentan nu există noutăți.» One rail at every width.
 * Rendered inside a <Suspense> whose fallback is NewsView from the server's first page.
 */
export function NewsSection() {
  const t = useMemo(() => createBrowserTransport(), []);
  const q = useInfiniteQuery(homeNewsQuery(t));
  const read = useRailRead(q);
  const news = useMemo(() => read.pages?.flatMap((p) => p.data), [read.pages]);
  if (!q.isLoading && !news) return null;
  return (
    <NewsView
      news={q.isLoading ? undefined : news}
      onEndReached={() => {
        if (q.hasNextPage && !q.isFetchingNextPage && !q.isFetchNextPageError) void q.fetchNextPage();
      }}
      fetchingNext={read.fetchingNext}
      nextError={read.nextError}
      onRetryNext={() => void q.fetchNextPage()}
    />
  );
}

/** The markup of the section, from data alone (undefined = loading): also the prerendered fallback. */
export function NewsView({
  news,
  onEndReached,
  fetchingNext = false,
  nextError = false,
  onRetryNext,
}: {
  news: AnnouncementListItem[] | undefined;
  onEndReached?: () => void;
  fetchingNext?: boolean;
  /** The next page failed: its slot offers the retry. */
  nextError?: boolean;
  onRetryNext?: () => void;
}) {
  return (
    <RailSection title="Noutăți" href={routes.news()}>
      {!news ? (
        <>
          <div className="xl:hidden">
            <RailSkeleton label="Se încarcă noutățile" width={224} heightClass={NEWS_CARD_HEIGHT} />
          </div>
          <HomeGridSkeleton kind="news" heightClass={NEWS_CARD_HEIGHT} className="max-xl:hidden" />
        </>
      ) : news.length === 0 ? (
        <RailEmpty>Momentan nu există noutăți.</RailEmpty>
      ) : (
        <>
          {/* Below 1280 the rail; from 1280 one full row of the grid (HomeGrid). */}
          <div className="xl:hidden">
            <HorizontalRail
              className={HOME_RAIL_BLEED}
              label="Noutăți"
              width={224}
              onEndReached={onEndReached}
              footer={
                // A retry keeps its slot (and the focus) while it runs; a first next page shows a bone.
                nextError && onRetryNext ? (
                  <RailRetryItem width={224} heightClass={NEWS_CARD_HEIGHT} onRetry={onRetryNext} retrying={fetchingNext} />
                ) : fetchingNext ? (
                  <CardSkeleton width={224} heightClass={NEWS_CARD_HEIGHT} />
                ) : null
              }
            >
              {news.map((n) => (
                <RailItem key={n.documentId} width={224}>
                  <NewsCard news={n} />
                </RailItem>
              ))}
            </HorizontalRail>
          </div>
          <HomeGrid kind="news" label="Noutăți" className="max-xl:hidden">
            {news.map((n) => (
              <li key={n.documentId}>
                <NewsCard news={n} />
              </li>
            ))}
          </HomeGrid>
        </>
      )}
    </RailSection>
  );
}

/** The CMS enumeration is stored without diacritics; the badge reads it in Romanian. */
const CATEGORY_LABEL: Record<string, string> = {
  Noutati: 'Noutăți',
  Evenimente: 'Evenimente',
  Interesant: 'Interesant',
  Concursuri: 'Concursuri',
  Tehnici: 'Tehnici',
};


/** fish components/NewsCard.tsx — banner, date + category, title, description (fish: 3 + 3 lines; 2 + 2 here, reserved). */
function NewsCard({ news }: { news: AnnouncementListItem }) {
  const banner = news.banner?.[0];
  const src = banner ? (banner.mediumUrl ?? banner.url) : null;
  return (
    <CardShell elevated interactive className={NEWS_CARD_HEIGHT}>
      <div className="relative h-50 shrink-0 overflow-hidden bg-soft-fill">
        {src ? <Image src={src} alt="" fill sizes="(min-width: 768px) 304px, 224px" className="object-cover" /> : null}
      </div>
      <div className="flex flex-col gap-1 p-2.5">
        {/* The date never breaks; when it and the tag do not fit (narrow desktop columns) the tag
            moves to its own line. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="mr-auto whitespace-nowrap t-caption text-muted">
            <time dateTime={news.createdAt}>{newsDate(news.createdAt)}</time>
          </p>
          {/* The kit attribute badge, the competition cards' own. The CMS category carries no colour,
              so every category is the accent pair (fish's green3 on its tint reads 2.1:1, under AA). */}
          <Tag tone="indigo">{CATEGORY_LABEL[news.category] ?? news.category}</Tag>
        </div>
        {/* Two lines for the title (2 × 22) and two for the summary, reserved: every news card is the same
            height without stretching to the rail's tallest (no white block under a short title). */}
        <CardTitle href={routes.newsItem(news.documentId)} className="line-clamp-2 min-h-11 t-heading text-ink">
          {news.title}
        </CardTitle>
        {/* Two lines of t-body: 2 × 20, 2 × 22 from 1280. */}
        <p className="line-clamp-2 min-h-10 t-body text-muted xl:min-h-11">{news.shortDescription}</p>
      </div>
    </CardShell>
  );
}
