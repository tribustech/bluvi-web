'use client';

import { useCallback } from 'react';
import { RankingTable, type RankingTableProps, type RankingTableSort } from '@/components/ranking/RankingTable';
import type { RankingRowData } from '@/components/ranking/model';
import { useRankingFaces, type RankingFaces } from './rankingFaces';

/*
 * The competition's ranking table: the kit RankingTable (components/ranking/RankingTable.tsx — fish
 * components/ranking-table/RankingTable.tsx in the page's table language, the table /dev/kit shows)
 * with the faces of this competition's registrations beside each name (ROADMAP §4b.13).
 */

export type RankingInitialSort = RankingTableSort;

export type CompetitionRankingTableProps = Omit<RankingTableProps, 'faceOf'> & {
  /** The rows' faces; by default read from the competition's registrations (useRankingFaces). */
  faces?: RankingFaces;
};

export function CompetitionRankingTable({ faces: facesProp, ...props }: CompetitionRankingTableProps) {
  const pageFaces = useRankingFaces();
  const faces = facesProp ?? pageFaces;
  const faceOf = useCallback((row: RankingRowData) => faces.byStand.get(String(row.standId)), [faces]);
  return <RankingTable {...props} faceOf={faceOf} />;
}

export { PenaltyMarker } from '@/components/ranking/shell';
