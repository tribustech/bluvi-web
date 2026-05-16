import type { StrapiResponse } from "./strapi";
import type { Stand } from "./stand";

export interface Sector extends StrapiResponse {
  name: string;
  minFishNumber?: number;
  stands?: Stand[];
}
