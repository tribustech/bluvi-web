import type { StrapiResponse } from "./strapi";
import type { User } from "./user";

export interface ReviewMeta {
  averageRating?: number;
  totalReviews?: number;
}

export interface Review extends StrapiResponse {
  rating: number;
  comment?: string | null;
  author?: User | null;
}
