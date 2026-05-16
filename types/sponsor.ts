import type { ImageInfo, StrapiResponse } from "./strapi";

export interface Sponsor extends StrapiResponse {
  name: string;
  website?: string | null;
  description?: string | null;
  logo?: ImageInfo | null;
}
