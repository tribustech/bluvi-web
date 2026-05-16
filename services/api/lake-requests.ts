import type { LakeRequestPayload } from "@/types/lake-request";
import { postJson } from "./_shared";

export async function submitLakeRequest(payload: LakeRequestPayload) {
  return postJson("/lake-suggestions", { data: payload });
}
