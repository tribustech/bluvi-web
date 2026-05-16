import type { Competition, OrganizerDashboardStats } from "@/types";
import { getJson, postJson, putJson } from "./_shared";

export async function getOrganizerDashboard(): Promise<OrganizerDashboardStats> {
  return getJson("/competitions/organizer/dashboard");
}

export async function getOrganizerCompetitions(status?: string): Promise<Competition[]> {
  return getJson("/competitions/organizer/me", status ? { status } : undefined);
}

export async function createDraft(body: Partial<Competition>) {
  return postJson<Competition>("/competitions/organizer/draft", body as Record<string, unknown>);
}

export async function updateDraft(draftId: string, body: Partial<Competition>) {
  return putJson<Competition>(
    `/competitions/organizer/draft/${draftId}`,
    body as Record<string, unknown>,
  );
}

export async function publishDraft(draftId: string) {
  return putJson<Competition>(`/competitions/organizer/draft/${draftId}/publish`);
}
