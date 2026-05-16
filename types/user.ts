import type { ImageInfo, StrapiResponse } from "./strapi";

export interface RoleInfo {
  name?: string | null;
}

export interface User extends StrapiResponse {
  username: string;
  email: string;
  provider?: string;
  confirmed?: boolean;
  blocked?: boolean;
  phone?: string | null;
  hasRequestedOrganizerRole?: boolean | null;
  isProfileComplete?: boolean | null;
  role?: RoleInfo | null;
  avatar?: ImageInfo | { url: string } | null;
}

export interface Profile extends User {
  statistics?: UserStatistics;
}

export interface UserStatistics {
  catchesCount?: number;
  competitionsCount?: number;
  podiumsCount?: number;
  biggestCatchKg?: number;
}
