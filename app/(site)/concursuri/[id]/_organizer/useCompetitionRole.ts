'use client';

import { useQuery } from '@tanstack/react-query';
import { userStatuteForCompetitionQuery } from '@/core/competitions';
import type { Transport } from '@/core/transport';
import { competitionRoleOf, type CompetitionRole } from './access';

/**
 * The viewer's part in a competition (fish useGetUserStatuteForCompetition, cached 1 h): `role` is
 * undefined while unknown (loading, or the read failed) — callers never print copy for that state
 * (owner rule 4). Signed-in pages only (the statute route is per user).
 */
export function useCompetitionRole(t: Transport, competitionId: string) {
  const statute = useQuery(userStatuteForCompetitionQuery(t, competitionId, { isAuthenticated: true }));
  const role: CompetitionRole | undefined = statute.data ? competitionRoleOf(statute.data) : undefined;
  return { role, statute };
}
