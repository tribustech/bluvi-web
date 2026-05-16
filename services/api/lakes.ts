import type { Lake, StrapiPaginatedResponse } from "@/types";
import { buildQuery, getJson, unwrapData } from "./_shared";

export async function getLake(id: string): Promise<Lake> {
  const response = await getJson<{ data: Lake }>(
    `/lakes/${id}?${buildQuery({
      populate: [
        "images",
        "regulation",
        "competitions.banner",
        "fishSpecies.fish",
        "contact",
        "coordinates",
        "depth",
        "price",
        "stands.coordinates",
        "facility",
      ],
    })}`,
  );
  return unwrapData(response);
}

export async function getLakes({
  page = 1,
  pageSize = 12,
  search = "",
}: {
  page?: number;
  pageSize?: number;
  search?: string;
} = {}): Promise<StrapiPaginatedResponse<Lake>> {
  return getJson("/lakes", {
    "pagination[page]": page,
    "pagination[pageSize]": pageSize,
    "filters[$or][0][name][$containsi]": search,
    "filters[$or][1][address][$containsi]": search,
    "filters[$or][2][directions][$containsi]": search,
    populate: ["images", "facility", "coordinates", "fishSpecies.fish"],
    sort: "updatedAt:desc",
  });
}

export async function getFilteredLakes({
  page = 1,
  pageSize = 12,
  facilities = [],
  fishIds = [],
  regimes = [],
}: {
  page?: number;
  pageSize?: number;
  facilities?: string[];
  fishIds?: string[];
  regimes?: string[];
} = {}): Promise<StrapiPaginatedResponse<Lake>> {
  return getJson("/lakes", {
    "pagination[page]": page,
    "pagination[pageSize]": pageSize,
    "filters[facility][documentId][$in]": facilities,
    "filters[fishSpecies][fish][documentId][$in]": fishIds,
    "filters[regime][$in]": regimes,
    populate: ["images", "facility", "coordinates", "fishSpecies.fish"],
    sort: "updatedAt:desc",
  });
}
