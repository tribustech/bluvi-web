import type { Sponsor } from "@/types";
import { getJson } from "./_shared";

export async function getSponsors(): Promise<Sponsor[]> {
  const response = await getJson<{ data: Sponsor[] }>("/sponsors");
  return response.data ?? [];
}
