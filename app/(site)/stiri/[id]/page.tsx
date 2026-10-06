import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Tag } from '@/components/cards';
import { BreadcrumbBand } from '@/components/nav/Breadcrumbs';
import { DetailBackButton } from '@/components/templates/T3';
import { absoluteUrl, routes } from '@/lib/routes';
import { ArticleFrame, AsideSkeleton } from '../_content/ArticleFrame';
import { bannerImages } from '../_content/content';
import { categoryLabel, newsDate } from '../_content/format';
import { Gallery } from '../_content/Gallery';
import { JsonLd } from '@/components/seo/JsonLd';
import { loadNews, newsIds } from '../_content/load';
import { NEWS_CRUMB } from '../_content/crumbs';
import { NewsBlocks } from '../_content/NewsBlocks';
import { OtherNewsSlot } from '../_content/OtherNews';
import { withSizes } from '../_content/probe';

/*
 * Știre — fish app/(app)/news/[newsId].tsx (parity home.stire), on the T3 tracks (ArticleFrame).
 *
 * Static per article: /feed/announcements/:id is a cached public read (CDN 10 min, tag
 * `announcement-<id>`, purged by the CMS when the announcement changes), the published articles are
 * prerendered (generateStaticParams), a later one renders on first request and is cached the same
 * way. Reached from the news cards (Acasă, Noutăți) and from a NEWS push (home.b.notification-news,
 * routes.newsItem).
 *
 * The breadcrumb band is the page's own, rendered here on the server (SiteHeader OWN_BAND_ROUTES),
 * as are loading.tsx's (pending crumb) and error.tsx's (settled «Eroare»).
 *
 * Loading: loading.tsx (the article in grey) while the read is in flight; a 404 is notFound() →
 * not-found.tsx (soft: the Suspense of loading.tsx has committed the 200; `noindex` from the
 * not-found UI); a network / 5xx / timeout error throws to error.tsx («Încearcă din nou» + back).
 */

type Props = { params: Promise<{ id: string }> };

export const instant = false;

export async function generateStaticParams() {
  const ids = await newsIds();
  return (ids.length ? ids : ['_']).map((id) => ({ id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const load = await loadNews(id);
  if (load.kind === 'missing') return { title: 'Știrea nu a fost găsită' };
  const n = load.data;
  const canonical = routes.newsItem(n.documentId);
  const description = n.shortDescription || `${categoryLabel(n.category)} pe Bluvi, ${newsDate(n.createdAt).toLocaleLowerCase('ro')}.`;
  const images = bannerImages(n.banner).map((b) => ({ url: b.src }));
  return {
    title: n.title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      title: n.title,
      description,
      url: absoluteUrl(canonical),
      siteName: 'Bluvi',
      locale: 'ro_RO',
      publishedTime: n.createdAt,
      section: categoryLabel(n.category),
      ...(images.length ? { images } : {}),
    },
    twitter: { card: images.length ? 'summary_large_image' : 'summary', title: n.title, description },
  };
}

export default async function NewsItemPage({ params }: Props) {
  const { id } = await params;
  // Only the article is awaited: «Alte noutăți» streams in its own slot (OtherNewsSlot).
  const load = await loadNews(id);
  if (load.kind === 'missing') notFound();
  const n = load.data;
  const images = await withSizes(bannerImages(n.banner));
  const url = absoluteUrl(routes.newsItem(n.documentId));
  const titleId = 'stire-titlu';

  return (
    <>
      {/* The page's own band, on the server: the real title in the HTML + BreadcrumbList JSON-LD. */}
      <BreadcrumbBand trail={[NEWS_CRUMB, { label: n.title }]} jsonLd />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'NewsArticle',
          headline: n.title,
          ...(n.shortDescription ? { description: n.shortDescription } : {}),
          datePublished: n.createdAt,
          articleSection: categoryLabel(n.category),
          inLanguage: 'ro-RO',
          url,
          mainEntityOfPage: url,
          ...(images.length ? { image: images.map((i) => i.src) } : {}),
          publisher: { '@type': 'Organization', name: 'Bluvi', url: absoluteUrl(routes.home()) },
        }}
      />
      <ArticleFrame
        titleId={titleId}
        hero={
          <Gallery
            images={images}
            label={`Fotografii: ${n.title}`}
            back={<DetailBackButton fallbackHref={routes.news()} ground={images.length ? 'photo' : 'page'} />}
          />
        }
        aside={
          <Suspense fallback={<AsideSkeleton />}>
            <OtherNewsSlot currentId={n.documentId} />
          </Suspense>
        }
        asideLabel="Alte noutăți"
      >
        {/*
          fish: the date (body, muted, uppercase) and the green category badge on one row, then the
          title. Phone: the badge at the row's end (fish); from 768 right after the date, so it never
          floats mid-card on the centred measure.
        */}
        <header className="flex flex-col gap-1">
          <div className="flex items-center gap-4 md:gap-3">
            <p className="min-w-0 t-body text-muted max-md:flex-1">
              <time dateTime={n.createdAt}>{newsDate(n.createdAt)}</time>
            </p>
            <Tag tone="green">{categoryLabel(n.category)}</Tag>
          </div>
          <h1 id={titleId} className="t-title1 text-pretty text-ink md:t-page-title">
            {n.title}
          </h1>
        </header>
        {/*
          The standfirst: fish's muted semibold summary (body / gray5 / 600), one size step above the
          body so it reads as the intro, not a caption (the weight forced over t-title2's 700 shorthand);
          muted keeps AA on the card (4.6:1+).
        */}
        {n.shortDescription ? <p className="mb-2 t-title2 font-semibold! text-pretty text-muted">{n.shortDescription}</p> : null}
        <NewsBlocks blocks={n.content ?? []} tracking={{ event: 'news_link_clicked', params: { newsId: n.documentId } }} />
      </ArticleFrame>
    </>
  );
}
