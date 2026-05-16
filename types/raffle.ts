import type { StrapiResponse } from "./strapi";

export interface RaffleType {
  key: string;
  label: string;
  description?: string | null;
  badgeColor?: string | null;
}

export interface RafflePrizeItem {
  label: string;
  description?: string | null;
  image?: { url?: string } | null;
}

export interface RafflePrize {
  title: string;
  description?: string | null;
  priceLei?: number | null;
  count: number;
  typeKey?: string | null;
  image?: { url?: string } | null;
  items?: RafflePrizeItem[] | null;
}

export interface RaffleWinnerEntry extends StrapiResponse {
  username: string | null;
  avatarUrl?: string | null;
}

export interface RaffleSession {
  documentId: string;
  startDate: string;
  endDate: string;
  prizes?: RafflePrize[];
  types?: RaffleType[];
  registrationCutoffMinutesBeforeEnd?: number | null;
  previousWinnerAnnouncement?: string | null;
  headerLogoLeftUrl?: string | null;
  headerLogoRightUrl?: string | null;
  dashboardTitle?: string | null;
  dashboardSubtitle?: string | null;
  regulationTitle?: string | null;
  regulationSections?: Array<{ title: string; body: string }> | null;
}

export interface RaffleActiveResponse {
  session: RaffleSession;
  registrationsByType: Record<string, number>;
  isRegistrationOpen: boolean;
  isEnded?: boolean;
  hasWinners?: boolean;
  winnersByTypeKey?: Record<string, RaffleWinnerEntry[]>;
}

export interface RaffleParticipation {
  joined: boolean;
  entriesCount: number;
  typeKey: string | null;
  receiptUploaded: boolean;
  receiptUnderVerification: boolean;
  canChangeType: boolean;
  sessionDocumentId: string | null;
  receiptImageUrl?: string | null;
}
