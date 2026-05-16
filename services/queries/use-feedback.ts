"use client";

import { useMutation } from "@tanstack/react-query";
import { submitFeedback } from "@/services/api/feedback";
import type { FeedbackPayload } from "@/types/feedback";

export function useSendFeedback() {
  return useMutation({
    mutationFn: (payload: FeedbackPayload) => submitFeedback(payload),
  });
}
