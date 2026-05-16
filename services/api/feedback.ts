import type { FeedbackPayload } from "@/types/feedback";
import { postJson } from "./_shared";

export async function submitFeedback(payload: FeedbackPayload) {
  return postJson("/feedbacks", { data: payload });
}
