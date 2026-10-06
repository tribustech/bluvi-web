'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  cardRankingLabel,
  competitionCardsInfiniteQuery,
  competitionRegistrationsListQuery,
  formatCount,
  formatTotalKg,
  rankingsQuery,
  selectCompetitionCards,
  type CompetitionCard,
} from '@/core/competitions';
import type { Transport } from '@/core/transport';
import { routes } from '@/lib/routes';
import { LIVE_POLL_MS, type DesktopViewer } from '../desktop/data';
import { miniRanking, valueText, viewerRow } from '../desktop/model';
import { REGISTERED_PARAMS } from '../place';
import { posterOf } from '../cards/parts';
import type { HeroModel } from './MineHero';
import { myStanding, unitWord } from './model';

/*
 * «Concursul tău» on the Live tab: am I registered in a competition that is live now? The existing
 * per-user list (GET /feed/my-competition-cards?scope=registered&status=started), then that
 * competition's /ranking (re-read every 60s with the Live list, fish LIVE_POLL_MS; TanStack pauses
 * both while the page is hidden) and its /registrations (my own registration → my row by identity,
 * my stand). Signed out, or without a viewer id, nothing is read and nothing is shown.
 */

export const MY_LIVE_PARAMS = { ...REGISTERED_PARAMS, status: 'started' } as const;

export type MyLive =
  | { state: 'none' }
  | { state: 'pending'; competitionId: string }
  | { state: 'ready'; competitionId: string; model: HeroModel };

/** My live registrations (the cards' order puts them first). Signed out: none, nothing read. */
export function useMyLiveCards(t: Transport, signedIn: boolean): CompetitionCard[] {
  const base = competitionCardsInfiniteQuery(t, MY_LIVE_PARAMS, { isAuthenticated: signedIn }, { refetchInterval: LIVE_POLL_MS });
  const list = useInfiniteQuery({ ...base, enabled: signedIn });
  return selectCompetitionCards(list.data, MY_LIVE_PARAMS, { isAuthenticated: signedIn }).competitions;
}

export function useMyLive(t: Transport, viewer: DesktopViewer, isAuthenticated: boolean): MyLive {
  const signedIn = isAuthenticated && !!viewer;
  const mine: CompetitionCard | undefined = useMyLiveCards(t, signedIn)[0];
  const id = mine?.documentId ?? '';
  const ranking = useQuery({ ...rankingsQuery(t, id, 'started'), enabled: signedIn && !!mine, refetchInterval: LIVE_POLL_MS });
  const regs = useQuery({ ...competitionRegistrationsListQuery(t, id), enabled: signedIn && !!mine });

  if (!signedIn || !mine) return { state: 'none' };
  if ((ranking.isPending && !ranking.isError) || (regs.isPending && !regs.isError)) return { state: 'pending', competitionId: id };

  const own = viewer ? regs.data?.find((r) => r.participants?.some((p) => p.id === viewer.id)) : undefined;
  const mini = ranking.data ? miniRanking(ranking.data) : null;
  const row = mini && viewer ? viewerRow(mini.rows, viewer.id, own?.documentId) : null;
  const standing = mini ? myStanding(mini, row) : null;
  const value = standing?.row.value ?? null;

  const model: HeroModel = {
    competitionId: id,
    name: mine.name,
    poster: posterOf(mine).thumb,
    where: [mine.lake?.name, mine.lake?.county?.name, cardRankingLabel(mine)].filter(Boolean).join(' · '),
    stand: own?.stand?.name ?? standing?.row.stand ?? null,
    place: standing && standing.row.catches > 0 ? standing.row.position : null,
    of: standing ? standing.of : null,
    value: mini && value != null && standing && standing.row.catches > 0 ? (mini.unit === 'kg' ? formatTotalKg(value) : valueText(value, mini.unit)) : null,
    unit: mini && value != null ? unitWord(mini.unit, value) : null,
    valueCaption: mini && standing ? `${mini.valueLabel} · ${formatCount(standing.row.catches, 'captură', 'capturi')}` : null,
    sectorLine: standing?.sectorPlace && standing.row.sector && standing.row.catches > 0 ? `Locul ${standing.sectorPlace} în sectorul ${standing.row.sector}` : null,
    gap:
      mini && standing?.gapToLeader != null
        ? { value: valueText(standing.gapToLeader, mini.unit), unit: unitWord(mini.unit, standing.gapToLeader) }
        : null,
    leads: !!standing?.leads && standing.row.catches > 0,
    href: routes.competition(id),
  };
  return { state: 'ready', competitionId: id, model };
}
