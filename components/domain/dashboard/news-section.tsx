import { NewsCard } from "@/components/domain/news-card";
import type { NewsArticle } from "@/types";

interface NewsSectionProps {
  articles: NewsArticle[];
}

export function NewsSection({ articles }: NewsSectionProps) {
  if (!articles.length) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-7">Noutati recente</h2>
      {articles.map((article) => (
        <NewsCard key={article.documentId} article={article} />
      ))}
    </section>
  );
}
