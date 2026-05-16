import type { Sector } from "@/types";
import { getJson } from "./_shared";

export async function getSectors(competitionId?: string): Promise<Sector[]> {
  if (!competitionId) {
    const response = await getJson<{ data: Sector[] }>("/sectors");
    return response.data ?? [];
  }

  return getJson(`/sectors/competition/${competitionId}`);
}
