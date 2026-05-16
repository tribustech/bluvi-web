import type { Lake } from "./lake";
import type { RankingType } from "./ranking";
import type { Registration } from "./registration";
import type { Sector } from "./sector";
import type { Sponsor } from "./sponsor";
import type { ImageInfo, RichTextNode, StrapiResponse } from "./strapi";
import type { User } from "./user";

export enum CompetitionType {
  SINGLE = "single",
  TEAM = "team",
}

export type CompetitionStatus = "draft" | "notStarted" | "started" | "completed" | "cancelled";
export type GeneralRankingWinnerMode = "bySectorPosition" | "byPoints" | "bySectorPositionPerisReversed";
export type GridRule = "catchCount" | "average";

export interface DraftMeta {
  sectors: { name: string; minFishNumber: number }[];
  standAllocations: Record<string, string[]>;
  sponsorIds: string[];
  fishSpeciesIds: string[];
  completedSteps: number[];
}

export interface Competition extends StrapiResponse {
  name: string;
  lake?: Lake | null;
  banner?: ImageInfo | null;
  startDate: string;
  endDate: string;
  registerFee: string;
  description?: string | RichTextNode[] | null;
  reward?: RichTextNode[] | string | null;
  regulation?: RichTextNode[] | string | null;
  competitionType: CompetitionType;
  competitionStatus: CompetitionStatus;
  rankingType: RankingType;
  bestOfFishCount?: number;
  numberOfWinners?: number;
  minFishWeight?: string | number;
  registrationDeadline?: string;
  participantsLimit?: number;
  participantsRegistered?: number;
  teamParticipants?: number | null;
  sectors?: Sector[];
  sponsors?: Sponsor[];
  fishSpecies?: Array<{ documentId: string; Name?: string }>;
  registrations?: Registration[];
  author?: User | null;
  referees?: User[];
  userRegistrationStatus?: string;
  isFollowing?: boolean;
  viewers?: number;
  excludeBiggestCatch?: boolean;
  generalRankingWinnerMode?: GeneralRankingWinnerMode;
  gridRule?: GridRule;
  draftMeta?: DraftMeta;
}

export interface OrganizerDashboardStats {
  draftsCount: number;
  pendingRegistrations: number;
  emptySpots: number;
  fillRate: number;
  competitionsByStatus: Record<string, number>;
}
