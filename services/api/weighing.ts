import type { Weighing, WeighingSummary } from "@/types";
import { getJson, postJson } from "./_shared";

export async function getWeighingsSummary(competitionId: string): Promise<WeighingSummary> {
  return getJson(`/weighings/${competitionId}/summary`);
}

export async function getWeighings(competitionId: string, standId: string): Promise<Weighing[]> {
  return getJson(`/weighings/${competitionId}/stand/${standId}`);
}

export async function getWeighingById(weighingId: string): Promise<Weighing> {
  return getJson(`/weighings/${weighingId}`);
}

export async function getWeighingRevisions(weighingId: string) {
  return getJson(`/weighings/${weighingId}/revisions`);
}

export async function createWeighing(
  competitionId: string,
  payload: { standId: string; weighingType?: "normal" | "extra" },
) {
  return postJson(`/weighings/${competitionId}`, payload);
}

export async function addCatch(
  weighingId: string,
  payload: { weight: number; fishType?: string },
) {
  return postJson(`/weighings/${weighingId}/catch`, payload);
}
