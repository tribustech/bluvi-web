import { DetailBackButton } from '@/components/templates/T3';
import { routes } from '@/lib/routes';
import { ArticleSkeleton } from '../_content/ArticleSkeleton';
import { NEWS_CRUMB } from '../_content/crumbs';

/** fish news/[newsId].tsx `if (isLoading) return <LoadingScreen />` — the article's own frame in grey. */
export default function NewsItemLoading() {
  return (
    <ArticleSkeleton
      label="Se încarcă știrea…"
      trail={[NEWS_CRUMB]}
      back={<DetailBackButton fallbackHref={routes.news()} ground="photo" />}
    />
  );
}
