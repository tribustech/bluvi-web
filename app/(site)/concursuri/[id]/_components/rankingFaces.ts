'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { competitionsKeys, type CompetitionWithMyStatus, type DetailRegistration } from '@/core/competitions';
import type { RankingFaceData } from '@/components/ranking/RankingFace';

/*
 * The faces of the ranking rows (ROADMAP §4b.13). The ranking endpoints carry no avatar (only the
 * participant's username); the competition core the page already holds does: each registration's
 * participants with their `avatar.url`. A row finds its registration by stand (the shared tables:
 * `standId` is the stand's numeric id) or by registration (feeder, the club rankings).
 *
 *  - one angler: their photo (or their initials), round;
 *  - a team (a team name, or several anglers): the team's initials, square (Fundații §07);
 *  - a guest / no registration: the row's initials, round.
 */

export type RankingFaces = {
  byStand: ReadonlyMap<string, RankingFaceData>;
  byRegistration: ReadonlyMap<string, RankingFaceData>;
};

const EMPTY: RankingFaces = { byStand: new Map(), byRegistration: new Map() };

export function faceOfRegistration(r: Pick<DetailRegistration, 'teamName' | 'participants'>): RankingFaceData {
  const team = !!r.teamName?.trim() || r.participants.length > 1;
  return { src: team ? null : (r.participants[0]?.avatar?.url ?? null), team };
}

export function rankingFaces(registrations: ReadonlyArray<DetailRegistration> | undefined): RankingFaces {
  if (!registrations?.length) return EMPTY;
  const byStand = new Map<string, RankingFaceData>();
  const byRegistration = new Map<string, RankingFaceData>();
  for (const r of registrations) {
    const face = faceOfRegistration(r);
    byRegistration.set(r.documentId, face);
    // A stand can carry a cancelled registration too: the active one wins.
    if (r.stand && (r.registrationStatus === 'registered' || !byStand.has(String(r.stand.id)))) byStand.set(String(r.stand.id), face);
  }
  return { byStand, byRegistration };
}

/**
 * The faces of the competition this page shows, read from the query cache the screen fills
 * (competitionsKeys.byId) — no request of its own, and no observer that could change that query's
 * options. Outside a competition page (or before the core lands): none, every row gets its initials.
 */
export function useRankingFaces(): RankingFaces {
  const params = useParams<{ id?: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
  const qc = useQueryClient();
  const subscribe = useCallback((onChange: () => void) => qc.getQueryCache().subscribe(onChange), [qc]);
  const read = useCallback(() => (id ? qc.getQueryData<CompetitionWithMyStatus>(competitionsKeys.byId(id)) : undefined), [qc, id]);
  const competition = useSyncExternalStore(subscribe, read, read);
  const registrations = competition?.registrations;
  return useMemo(() => rankingFaces(registrations), [registrations]);
}
