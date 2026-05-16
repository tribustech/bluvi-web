export type FeedbackCategory =
  | "feature"
  | "technical"
  | "content"
  | "account"
  | "ui"
  | "other";

export type FeedbackPayload = {
  rating: number;
  feedback: string;
  category: FeedbackCategory;
  metadata?: Record<string, unknown>;
};
