import type {
  Competition,
  CompetitionStatus,
  RankingType,
  Registration,
  Sector,
  StrapiPaginatedResponse,
} from "@/types";
import { buildQuery, deleteJson, getJson, PaginationParams, postJson, putJson, unwrapData } from "./_shared";

export interface CompetitionActiveWeighing {
  stand: {
    documentId: string;
    name: string;
    sectors?: Sector[];
  };
  weighingType: "normal" | "extra";
  weighingDocumentId: string;
}

export type AllocatedParticipantsResponse = Record<
  string,
  | {
      participants: { id: string; documentId: string; name: string }[];
      registrationId: string;
      teamName: string | null;
      guestName: string | null;
    }
  | null
>;

export async function getCompetitionsList(
  pagination: PaginationParams = {},
): Promise<StrapiPaginatedResponse<Competition>> {
  return getJson("/competitions", {
    "pagination[page]": pagination.page ?? 1,
    "pagination[pageSize]": pagination.pageSize ?? 12,
    sort: "startDate:asc",
    populate: ["lake", "banner"],
  });
}

export async function getCompetitionsByStatus(
  status: CompetitionStatus,
  pagination: PaginationParams = {},
  lakeId?: string,
): Promise<StrapiPaginatedResponse<Competition>> {
  const params: Record<string, unknown> = {
    "pagination[page]": pagination.page ?? 1,
    "pagination[pageSize]": pagination.pageSize ?? 12,
    "filters[competitionStatus][$eq]": status,
    sort: status === "completed" ? "startDate:desc" : "startDate:asc",
  };

  if (lakeId) {
    params["filters[lake][documentId][$eq]"] = lakeId;
  }

  return getJson("/competitions", params);
}

export async function getCompetition(competitionId: string): Promise<Competition> {
  const response = await getJson<{ data: Competition }>(
    `/competitions/${competitionId}?${buildQuery({
      populate: ["lake", "banner", "sponsors.logo", "sectors.stands", "registrations.participants", "author.avatar"],
    })}`,
  );
  return unwrapData(response);
}

export async function getLiveCompetition(): Promise<Competition | null> {
  try {
    const response = await getJson<{ data: Competition }>("/competitions/live");
    return unwrapData(response);
  } catch {
    return null;
  }
}

export async function getMyCompetitions(): Promise<Competition[]> {
  const response = await getJson<{ data: Competition[] }>("/competitions/me");
  return unwrapData(response);
}

export async function getMyOrganizedCompetitions(): Promise<Competition[]> {
  const response = await getJson<{ data: Competition[] }>("/competitions/organizer/me");
  return unwrapData(response);
}

export async function startCompetition(competitionId: string) {
  return putJson(`/competitions/${competitionId}/start`);
}

export async function endCompetition(competitionId: string) {
  return putJson(`/competitions/${competitionId}/end`);
}

export async function followCompetition(competitionId: string, follow: boolean) {
  return postJson(`/competitions/${competitionId}/follow`, { follow });
}

export async function getCompetitionRegistrations(competitionId: string): Promise<Registration[]> {
  return getJson(`/competitions/${competitionId}/registrations`);
}

export async function getCompetitionActiveWeighing(
  competitionId: string,
): Promise<CompetitionActiveWeighing[]> {
  return getJson(`/competitions/${competitionId}/active-weighing`);
}

export async function getAllocatedParticipants(
  competitionId: string,
): Promise<AllocatedParticipantsResponse> {
  const response = await getJson<{ data: AllocatedParticipantsResponse }>(
    `/competitions/${competitionId}/allocated-participants`,
  );
  return unwrapData(response);
}

export async function getFishSpecies(competitionId: string) {
  const competition = await getCompetition(competitionId);
  return competition.fishSpecies ?? [];
}

export async function getCompetitionRankingType(competitionId: string): Promise<{
  documentId: string;
  rankingType: RankingType;
}> {
  const response = await getJson<{ data: { documentId: string; rankingType: RankingType } }>(
    `/competitions/${competitionId}?${buildQuery({ fields: ["documentId", "rankingType"] })}`,
  );
  return unwrapData(response);
}

export async function getExtraScalesList(competitionId: string) {
  return getJson(`/competitions/${competitionId}/extra-scale`);
}

export async function requestExtraScale(competitionId: string) {
  return postJson(`/competitions/${competitionId}/request-extra`);
}

export async function deleteExtraScaleRequest(competitionId: string) {
  return deleteJson(`/competitions/${competitionId}/request-extra`);
}

export async function allocateStandsToSectors(
  competitionId: string,
  allocations: Record<string, string[]>,
) {
  return postJson(`/competitions/${competitionId}/allocate-stands-to-sectors`, { allocations });
}

export async function allocateStandToRegistration(
  competitionId: string,
  allocations: Record<string, string>,
) {
  return postJson(`/competitions/${competitionId}/allocate-stand-to-registration`, { allocations });
}
