import { NewsListFrame, NewsSkeleton } from './_list/NewsList';

/** fish news/index.tsx `if (isLoading) return <LoadingScreen />` — here the page's own frame in grey. */
export default function NewsLoading() {
  return (
    <div aria-busy>
      <NewsListFrame>
        <NewsSkeleton />
      </NewsListFrame>
    </div>
  );
}
