export enum RankingType {
  QUANTITY = "quantity",
  QUALITY = "quality",
  QUANTITY_QUALITY = "quantityQuality",
  QUALITY_QUANTITY = "qualityQuantity",
  BEST_OF = "bestOf",
  NATIONAL_CHAMPIONSHIP = "nationalChampionship",
  CALITATE_CALITATE = "calitateCalitate",
}

export interface BaseStandRanking {
  sectorId: string;
  sectorName: string;
  standId: string | number;
  standName: string;
  teamName: string | null;
  guestName: string | null;
  participant: {
    username: string;
  } | null;
  biggestFish: number;
  catchCount: number;
  sectorPosition: number;
  generalPosition: number;
}

export interface QuantityStandRanking extends BaseStandRanking {
  quantity: number;
  quantityPoints: number;
}

export interface QualityStandRanking extends BaseStandRanking {
  sectorMinNumberOfFish: number;
  quality: number;
  qualityPoints: number;
  catches: number[];
}

export interface QualityQuantityStandRanking extends BaseStandRanking {
  sectorMinNumberOfFish: number;
  quality: number;
  quantity: number;
  qualityPoints: number;
  quantityPoints: number;
  catches: number[];
}

export interface BestOfStandRanking extends BaseStandRanking {
  bestOfCount: number;
  topNCatchesAvarage: number;
  catches: { weight: number; isSplit: boolean }[];
}

export interface NationalChampionshipStandRanking {
  clubId: string;
  clubName: string;
  clubPoints: number;
  clubPosition: number;
  clubAverageWeight: number;
  clubTotalQuantity: number;
  clubTotalCatchCount: number;
  clubBiggestCatch: number;
  teams: Array<
    BaseStandRanking & {
      participants: { username: string }[] | null;
      quantity: number;
      avarageWeight: number;
      sectorPoints: number;
    }
  >;
}

export interface CalitateCalitateStandRanking extends BaseStandRanking {
  sectorMinNumberOfFish: number;
  quality1: number;
  quality1Points: number;
  quality2: number;
  quality2Points: number;
  totalPoints: number;
  catches: number[];
  hasGrid: boolean;
}

export interface RankingMetadata {
  rankingType: RankingType | string;
  totalQuantity?: number;
  totalCatchesCount?: number;
  biggestFish?: number;
  numberOfSectors?: number;
  bestOfFishCount?: number;
  numberOfWinners?: number;
  maxBestOfFishCount?: number;
}

export interface RankingResponse {
  rankings:
    | QuantityStandRanking[]
    | QualityStandRanking[]
    | QualityQuantityStandRanking[]
    | BestOfStandRanking[]
    | NationalChampionshipStandRanking[]
    | CalitateCalitateStandRanking[];
  metadata: RankingMetadata;
}

export interface CompetitionCatch {
  id: string;
  weight: number;
  standId?: number | string | null;
  standName?: string;
  sectorId?: string | null;
  sectorName?: string | null;
  teamName?: string | null;
  guestName?: string | null;
  participantUsername?: string | null;
  fishName?: string | null;
}

export type CompetitionCatchesSort = "weight_asc" | "weight_desc" | "stand" | "sector";

export interface CompetitionCatchesResponse {
  data: CompetitionCatch[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
}
