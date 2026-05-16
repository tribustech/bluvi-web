"use client";

import { useMutation } from "@tanstack/react-query";
import { submitLakeRequest } from "@/services/api/lake-requests";
import type { LakeRequestPayload } from "@/types/lake-request";

export function useSendLakeRequest() {
  return useMutation({
    mutationFn: (payload: LakeRequestPayload) => submitLakeRequest(payload),
  });
}
