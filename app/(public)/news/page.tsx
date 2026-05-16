import type { Metadata } from "next";
import { NewsCard } from "@/components/domain/news-card";
import { Pagination } from "@/components/ui/pagination";
import { Typography } from "@/components/ui/typography";
import { safeStrapiGet } from "@/lib/strapi";
import type { NewsArticle, StrapiPaginatedResponse } from "@/types";

export const metadata: Metadata = {
  title: "Noutati",
  description: "Articolele si anunturile Bluvi.",
};

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const page = Number(params.page || 1);
  const news =
    (await safeStrapiGet<StrapiPaginatedResponse<NewsArticle>>(
      "/announcements",
      {
        "pagination[page]": page,
        "pagination[pageSize]": 8,
        sort: "createdAt:desc",
        populate: ["banner"],
      },
      { tags: ["news"], revalidate: 300 },
    )) ??
    ({
      data: [],
      meta: { pagination: { page: 1, pageSize: 8, total: 0, pageCount: 0 } },
    } satisfies StrapiPaginatedResponse<NewsArticle>);

  const totalPages = Math.max(1, news.meta.pagination.pageCount ?? Math.ceil(news.meta.pagination.total / news.meta.pagination.pageSize));

  return (
    <div className="space-y-8">
      <div>
        <Typography preset="heading1">Noutati Bluvi</Typography>
        <p className="mt-2 text-sm text-gray-5">Articole optimizate pentru partajare, metadata si indexare.</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {news.data.map((article) => (
          <NewsCard key={article.documentId} article={article} />
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} createHref={(targetPage) => `/news?page=${targetPage}`} />
    </div>
  );
}
