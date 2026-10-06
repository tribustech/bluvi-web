/*
 * fish helpers/getRosterDocumentIds.ts + helpers/getRegistrationByStandId.ts — who stands behind a
 * ranking row (the angler stats sheet opens on that registration and reads its members' stats).
 */

type RosterRegistration = { participants?: ({ documentId?: string | null } | null)[] | null };

/** fish `getRosterDocumentIds`: the registration's members that have a Bluvi account. */
export function getRosterDocumentIds(registration: RosterRegistration | null | undefined): string[] {
  if (!registration?.participants) return [];
  return registration.participants
    .map(p => p?.documentId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}

/** fish `getRegistrationByStandId`: ranking rows carry the stand's numeric id (as number or string). */
export function getRegistrationByStandId<R extends { stand?: { id?: number | string } | null }>(
  registrations: readonly R[] | undefined | null,
  standId: string | number | null | undefined
): R | null {
  if (!registrations || standId == null) return null;
  const target = String(standId);
  return registrations.find(r => r?.stand && String(r.stand.id) === target) ?? null;
}
