import type {
  CompetitionCatchesResponse,
  CompetitionCatchesSort,
  RankingResponse,
} from "@/types";
import { getJson } from "./_shared";

export async function getRankings(competitionId: string): Promise<RankingResponse> {
  return getJson(`/rankings/competition/${competitionId}`);
}

export async function getRankingBestN(competitionId: string) {
  return getJson(`/rankings/competition/${competitionId}/best-n`);
}

export async function getCompetitionCatches(
  competitionId: string,
  {
    page = 1,
    pageSize = 20,
    sort = "weight_desc",
  }: {
    page?: number;
    pageSize?: number;
    sort?: CompetitionCatchesSort;
  } = {},
): Promise<CompetitionCatchesResponse> {
  return getJson(`/rankings/competition/${competitionId}/catches`, {
    page,
    pageSize,
    sort,
  });
}

export async function getWeighingStatistics(competitionId: string) {
  return getJson(`/rankings/competition/${competitionId}/statistics`);
}

export async function getCatchThresholdCounts(competitionId: string) {
  return getJson(`/rankings/competition/${competitionId}/thresholds`);
}
