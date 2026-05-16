import { deleteJson, getJson, postJson, putJson } from "./_shared";

export async function createCompetitionRegistration(
  competitionId: string,
  payload: Record<string, unknown>,
) {
  return postJson(`/registrations/competition/${competitionId}`, payload);
}

export async function updateCompetitionRegistration(registrationId: string, payload: Record<string, unknown>) {
  return putJson(`/registrations/${registrationId}`, payload);
}

export async function cancelCompetitionRegistration(registrationId: string) {
  return deleteJson(`/registrations/${registrationId}`);
}

export async function getRegistrationById(registrationId: string) {
  return getJson(`/registrations/${registrationId}`);
}
