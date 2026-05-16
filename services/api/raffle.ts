import type { RaffleActiveResponse, RaffleParticipation } from "@/types";
import { deleteJson, getJson, postJson } from "./_shared";

export async function fetchActiveRaffle(): Promise<RaffleActiveResponse | null> {
  try {
    const response = await getJson<{ data?: RaffleActiveResponse } | RaffleActiveResponse>(
      "/raffle-sessions/active",
    );
    if ("data" in (response as { data?: RaffleActiveResponse })) {
      return (response as { data?: RaffleActiveResponse }).data ?? null;
    }
    return response as RaffleActiveResponse;
  } catch {
    return null;
  }
}

export async function fetchRaffleParticipation(): Promise<RaffleParticipation | null> {
  try {
    const response = await getJson<{ data?: RaffleParticipation } | RaffleParticipation>(
      "/raffle-sessions/participation",
    );
    if ("data" in (response as { data?: RaffleParticipation })) {
      return (response as { data?: RaffleParticipation }).data ?? null;
    }
    return response as RaffleParticipation;
  } catch {
    return null;
  }
}

export async function joinRaffleSession(sessionDocumentId: string, typeKey: string) {
  return postJson(`/raffle-sessions/${sessionDocumentId}/join`, { typeKey });
}

export async function uploadRaffleReceipt(raffleId: string, file: File) {
  const formData = new FormData();
  formData.append("files", file);

  return postJson(`/raffle-sessions/${raffleId}/receipt`, formData as unknown as Record<string, unknown>);
}

export async function deleteRaffleReceipt(sessionDocumentId: string) {
  return deleteJson(`/raffle-sessions/${sessionDocumentId}/receipt`);
}
