import type { Review, StrapiPaginatedResponse } from "@/types";
import { getJson } from "./_shared";

export async function getReviewsByLakeId(
  lakeId: string,
  page = 1,
  pageSize = 10,
): Promise<StrapiPaginatedResponse<Review>> {
  return getJson(`/reviews/lake/${lakeId}`, {
    page,
    pageSize,
  });
}

export async function getMyReviewByLakeId(lakeId: string): Promise<Review | null> {
  try {
    return await getJson(`/reviews/lake/${lakeId}/my`);
  } catch {
    return null;
  }
}
