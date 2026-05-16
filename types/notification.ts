import type { StrapiResponse } from "./strapi";

export interface Notification extends StrapiResponse {
  title: string;
  body?: string | null;
  read?: boolean;
  href?: string | null;
  type?: string | null;
}
