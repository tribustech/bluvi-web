import type { NewsArticle, StrapiPaginatedResponse } from "@/types";
import { buildQuery, getJson, PaginationParams, unwrapData } from "./_shared";

export async function getNews(
  pagination: PaginationParams = {},
): Promise<StrapiPaginatedResponse<NewsArticle>> {
  return getJson("/announcements", {
    "pagination[page]": pagination.page ?? 1,
    "pagination[pageSize]": pagination.pageSize ?? 12,
    sort: "createdAt:desc",
    populate: ["banner"],
  });
}

export async function getNewsById(id: string): Promise<NewsArticle> {
  const response = await getJson<{ data: NewsArticle }>(
    `/announcements/${id}?${buildQuery({
      populate: ["banner", "content"],
    })}`,
  );
  return unwrapData(response);
}
