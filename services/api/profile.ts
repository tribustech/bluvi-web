import type { Profile, UserStatistics } from "@/types";
import { deleteJson, getJson, patchJson, postJson } from "./_shared";

export interface UpdateProfileRequest {
  username?: string;
  phone?: string | null;
  avatar?: number;
}

export async function getProfile(): Promise<Profile> {
  return getJson("/user/profile");
}

export async function updateProfile(profile: UpdateProfileRequest): Promise<Profile> {
  return patchJson("/user/profile", profile as Record<string, unknown>);
}

export async function deleteProfile() {
  return deleteJson("/user/profile");
}

export async function requestOrganizerRole() {
  return postJson("/user/organizer-request");
}

export async function getStatistics(): Promise<UserStatistics> {
  const response = await getJson<{ data: UserStatistics }>("/user/statitics");
  return response.data;
}

export async function postUserStatisticsBatch(documentIds: string[]) {
  const response = await postJson<{ data?: Record<string, unknown> }>("/user/statistics/batch", {
    documentIds,
  });
  return response.data ?? response;
}

export async function getUserStatuteForCompetition(competitionId: string) {
  return getJson(`/user/profile/competition/${competitionId}/statute`);
}
