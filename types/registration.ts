import type { Stand } from "./stand";
import type { StrapiResponse } from "./strapi";
import type { User } from "./user";

export type RegistrationStatus = "pending" | "registered" | "rejected" | "cancelled";

export interface Club extends StrapiResponse {
  name: string;
}

export interface Registration extends StrapiResponse {
  registrationStatus: RegistrationStatus;
  teamName?: string | null;
  guestName?: string | null;
  participants?: User[];
  stand?: Stand | null;
  author?: User | null;
  club?: Club | null;
}
