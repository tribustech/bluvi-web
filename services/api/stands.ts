import type { Stand } from "@/types";
import { getJson } from "./_shared";

export async function getStands(lakeId?: string): Promise<Stand[]> {
  if (!lakeId) {
    const response = await getJson<{ data: Stand[] }>("/stands");
    return response.data ?? [];
  }
  return getJson(`/stands/lake/${lakeId}`);
}

export async function getStandStatsByLakeId(lakeId: string) {
  return getJson(`/stands/lake/${lakeId}/stats`);
}
