import type { LakeHomeSection, LakesHomeResponse } from "@/types/lake-home";
import { getJson } from "./_shared";

export interface GetLakesHomeParams {
  limit?: number;
  latitude?: number | null;
  longitude?: number | null;
  radiusKm?: number;
}

export async function fetchLakesHome(
  params: GetLakesHomeParams = {},
): Promise<LakeHomeSection[]> {
  const queryParams: Record<string, unknown> = {};

  if (typeof params.limit === "number") queryParams.limit = params.limit;
  if (typeof params.latitude === "number" && Number.isFinite(params.latitude)) {
    queryParams.lat = params.latitude;
  }
  if (typeof params.longitude === "number" && Number.isFinite(params.longitude)) {
    queryParams.lng = params.longitude;
  }
  if (typeof params.radiusKm === "number") queryParams.radiusKm = params.radiusKm;

  try {
    const response = await getJson<LakesHomeResponse>("/lakes/home", queryParams);
    return response.data?.sections ?? [];
  } catch {
    return [];
  }
}
