import type { StrapiResponse } from "./strapi";

export interface Stand extends StrapiResponse {
  name: string;
  order?: number;
  coordinates?: {
    lat?: string;
    long?: string;
  } | null;
}
