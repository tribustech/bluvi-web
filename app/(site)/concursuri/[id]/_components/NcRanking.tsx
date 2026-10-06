'use client';

import { useMemo, type ReactNode } from 'react';
import {
  ncGeneralModel,
  ncSectorRows,
  sortNcClubs,
  type NationalChampionshipStandRanking,
  type NcGeneralSort,
  type NcSectorSort,
} from '@/core/competitions';
import { sectorFill } from '@/components/ranking/sector';
import { CapotChip } from '@/components/cards/parts';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { EmptyState } from '@/components/surfaces/StateCard';
import { ChoiceChips, type Choice } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { roNum } from './FeederRanking';
import { PlaceCell, RANK_PIN, RANK_PIN_EDGE, RANK_TD, RANK_TH, RANK_TH_PIN, RankingCard, RankingFrame, RankingGrid, SeatLabel, pinSurface } from './rankingShell';

/*
 * National Championship / FIPSed — fish components/competition/NationalChampionshipRanking.tsx
 * (sector pills, sector table, sorts) + components/ranking-table/NationalChampionshipTable.tsx (the
 * club table), on core/competitions/domain/nationalChampionship.ts.
 *
 *  - General: one row per team, the club's own columns merged across its teams (rowSpan). Clubs are
 *    told apart by structure — one surface, a stronger rule above each club and its merged cell —
 *    not by fish's six-colour club palette: on the web those are the sector colours A–F, and a
 *    sector colour only ever means a sector (Fundații). Every place is the kit table's plain number;
 *    a winning club / team adds the trophy, not fish's 90% row tint and 🎖️.
 *  - A sector: Stand, Club, Pescari, Kg, Medie, CMMC, Nr. Buc, Puncte sector, Loc sector; a capot
 *    team reads «capot» (the kit chip) in Kg.
 * TODO(kit): a merged-cell ranking table (club rows); composed on the shared shell (./rankingShell.tsx).
 */

export type NcView = 'general' | string;
export type NcSort = NcGeneralSort | NcSectorSort;

/** fish handleSelectSectorView: keep the sort when the new view offers it, else position. */
export function ncSortFor(view: NcView, sort: NcSort): NcSort {
  const options: NcSort[] = view === 'general' ? ['club', 'position'] : ['stand', 'position'];
  return options.includes(sort) ? sort : 'position';
}

export const NC_SORT_LABEL: Record<NcSort, string> = { club: 'Club', stand: 'Stand', position: 'Poziția în clasament' };

/** Stands named with their sector already («A3» in sector A, the FIPSed data): «AA3» → «A3». */
const plainStand = (label: string) => label.replace(/^([A-Za-z])\1(?=\d)/, '$1');

/** The pill row: General plus every sector of the competition, each with its colour dot. */
export function NcSectorPills({
  sectors,
  value,
  onChange,
}: {
  sectors: { documentId: string; name: string }[];
  value: NcView;
  onChange: (v: NcView) => void;
}) {
  const options: Choice<string>[] = [
    { value: 'general', label: 'General' },
    ...sectors.map(s => {
      const fill = sectorFill(s.name, 'var(--color-muted)');
      return {
        value: s.documentId,
        label: `Sector ${s.name}`,
        leading: <span className={cn('size-2 rounded-full', fill.className)} style={fill.style} />,
      };
    }),
  ];
  return <ChoiceChips name="nc-sector" label="Clasament pe" scroll options={options} value={value} onChange={onChange} />;
}

/** From 768 the order is chosen here (the phone keeps «Sortare» in the action bar, as fish). */
export function NcSortControl({ view, value, onChange }: { view: NcView; value: NcSort; onChange: (s: NcSort) => void }) {
  const options = (view === 'general' ? (['club', 'position'] as const) : (['stand', 'position'] as const)).map(v => ({
    value: v as NcSort,
    label: NC_SORT_LABEL[v],
  }));
  return (
    <SegmentedControl<NcSort>
      label="Ordine"
      name="nc-sort"
      value={value}
      onChange={onChange}
      options={options}
      className="w-80 shrink-0 [&_legend]:sr-only"
    />
  );
}

export function NcRankingTable({
  rankings,
  numberOfSectors,
  view,
  sort,
  caption,
  currentUserStandId,
  full = false,
  toolbar,
}: {
  rankings: NationalChampionshipStandRanking[];
  numberOfSectors: number | null | undefined;
  view: NcView;
  sort: NcSort;
  caption: string;
  /** The signed-in viewer's stand: their team's row gets the kit's own-row tint and «Tu · ». */
  currentUserStandId?: string | null;
  /** In «Tot ecranul»: the table scrolls inside the dialog. */
  full?: boolean;
  /** On the page: the card's band of controls (sector pills, Ordine, «Clasament complet»), above the table. */
  toolbar?: ReactNode;
}) {
  const embedded = !!toolbar;
  // A sector without teams has no table: the state instead (under the card on the page).
  const noTeams = useMemo(() => view !== 'general' && ncSectorRows(rankings, view, 'position').length === 0, [rankings, view]);
  const table = noTeams ? null : 
    view === 'general' ? (
      <ClubTable
        rankings={rankings}
        numberOfSectors={numberOfSectors}
        sort={sort === 'club' ? 'club' : 'position'}
        caption={caption}
        me={currentUserStandId ?? null}
        full={full}
        embedded={embedded}
      />
    ) : (
      <SectorTable
        rankings={rankings}
        sectorId={view}
        sort={sort === 'stand' ? 'stand' : 'position'}
        caption={caption}
        me={currentUserStandId ?? null}
        full={full}
        embedded={embedded}
      />
    );
  if (!toolbar) return table ?? <NoTeams />;
  // A sector without teams: the state under the card (the pills stay to pick another one).
  return table ? <RankingCard toolbar={toolbar}>{table}</RankingCard> : <RankingCard toolbar={toolbar} after={<NoTeams />} />;
}

/** fish: a sector with no team. */
function NoTeams() {
  return <EmptyState title="Nu există DUO-uri în acest sector." />;
}

/*
 * Pinned at the left while the numbers scroll sideways: Club + Pescari (General), Stand + Pescari
 * (a sector). Below 768 the pinned block stays near half of a 343px card (club 88 + names 104).
 */
const CLUB_W = 'w-22 min-w-22 max-w-22 md:w-44 md:min-w-44 md:max-w-44';
const NAMES_LEFT = 'left-22 md:left-44';
const NAMES_W = 'max-md:max-w-26 max-md:min-w-26 md:min-w-44 md:max-w-72';
const STAND_W = 'w-16 min-w-16 max-w-16';

function ClubTable({
  rankings,
  numberOfSectors,
  sort,
  caption,
  me,
  full,
  embedded,
}: {
  rankings: NationalChampionshipStandRanking[];
  numberOfSectors: number | null | undefined;
  sort: NcGeneralSort;
  caption: string;
  me: string | null;
  full: boolean;
  embedded: boolean;
}) {
  const clubs = useMemo(() => ncGeneralModel(sortNcClubs(rankings, sort), numberOfSectors), [rankings, sort, numberOfSectors]);
  const head = [
    'Club',
    'Pescari',
    'Stand',
    'Cantitate Sector',
    'Total Kg Lot',
    'CMMC Lot',
    'Nr Pesti Lot',
    'Medie Lot',
    'Puncte Sector',
    'Puncte Lot',
    'Loc General',
    'Loc Individual',
  ];
  return (
    <RankingFrame caption={caption} full={full} embedded={embedded}>
      <RankingGrid caption={caption}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={cn(
                  RANK_TH,
                  'h-10',
                  i < 3 ? 'text-left' : 'text-right',
                  i === 0 && cn(RANK_TH_PIN, CLUB_W, 'left-0 pl-3'),
                  i === 1 && cn(RANK_TH_PIN, RANK_PIN_EDGE, NAMES_LEFT),
                  i === head.length - 1 && 'pr-3.5',
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        {clubs.map((club, ci) => {
          const span = club.teams.length;
          // Clubs are told apart by structure, not colour (a sector colour only ever means a sector,
          // and no fill near the page grey reads on the card): every club on the card's surface, a
          // stronger rule above each club and its merged club cell.
          return (
            // One row group per club: its merged cells span the club's teams.
            <tbody key={club.clubId}>
              {club.teams.map((team, ti) => {
                const first = ti === 0;
                const mine = me != null && team.standId === me;
                const rule = first && ci > 0 ? 'border-t-ink/15' : '';
                const merged = (content: ReactNode, className = 'text-right') =>
                  first ? (
                    <td rowSpan={span} className={cn(RANK_TD, rule, 'border-l align-middle', className)}>
                      {content}
                    </td>
                  ) : null;
                return (
                  <tr key={team.standId} className={cn('text-ink', mine && 'bg-accent-tint')}>
                    {first ? (
                      <th
                        scope="rowgroup"
                        rowSpan={span}
                        className={cn(RANK_TD, rule, RANK_PIN, 'bg-surface', CLUB_W, 'left-0 py-2 pl-3 text-left align-middle font-bold break-words whitespace-normal')}
                      >
                        {club.clubName}
                      </th>
                    ) : null}
                    <td className={cn(RANK_TD, rule, RANK_PIN, RANK_PIN_EDGE, pinSurface(mine), NAMES_LEFT, NAMES_W, 'border-l py-2 font-bold whitespace-normal')}>
                      <span className="line-clamp-2 break-words">
                        {mine ? 'Tu · ' : null}
                        {team.participants}
                      </span>
                    </td>
                    <td className={cn(RANK_TD, rule, 'text-left font-bold')}>
                      <SeatLabel seat={plainStand(team.stand)} />
                    </td>
                    <td className={cn(RANK_TD, rule, 'text-right')}>{roNum(team.quantity)}</td>
                    {merged(roNum(club.totalKg), 'text-right t-heading font-extrabold')}
                    {merged(roNum(club.biggestCatch))}
                    {merged(roNum(club.catchCount))}
                    {merged(roNum(club.averageWeight))}
                    <td className={cn(RANK_TD, rule, 'border-l text-right')}>{roNum(team.sectorPoints)}</td>
                    {merged(roNum(club.points), 'text-right font-bold')}
                    {merged(
                      <span className="inline-flex justify-end">
                        <PlaceCell value={club.position} winner={club.winner} />
                      </span>,
                    )}
                    <td className={cn(RANK_TD, rule, 'border-l pr-3.5 text-right')}>
                      <span className="inline-flex justify-end">
                        <PlaceCell value={team.generalPosition} winner={team.individualWinner} onTint={mine} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          );
        })}
      </RankingGrid>
    </RankingFrame>
  );
}

function SectorTable({
  rankings,
  sectorId,
  sort,
  caption,
  me,
  full,
  embedded,
}: {
  rankings: NationalChampionshipStandRanking[];
  sectorId: string;
  sort: NcSectorSort;
  caption: string;
  me: string | null;
  full: boolean;
  embedded: boolean;
}) {
  const rows = useMemo(() => ncSectorRows(rankings, sectorId, sort), [rankings, sectorId, sort]);
  const head = ['Stand', 'Club', 'Pescari', 'Kg', 'Medie', 'CMMC', 'Nr. Buc', 'Puncte sector', 'Loc sector'];
  return (
    <RankingFrame caption={caption} full={full} embedded={embedded}>
      <RankingGrid caption={caption}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={cn(
                  RANK_TH,
                  'h-10',
                  i < 3 ? 'text-left' : 'text-right',
                  i === 0 && cn(RANK_TH_PIN, STAND_W, 'left-0 pl-3'),
                  // Pescari stays once Club has scrolled under it (sticky after Stand's 64px).
                  i === 2 && cn(RANK_TH_PIN, RANK_PIN_EDGE, 'left-16'),
                  i === head.length - 1 && 'pr-3.5',
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const fill = sectorFill(r.sectorName, 'var(--color-muted)');
            const mine = me != null && r.standId === me;
            return (
              <tr key={r.standId} className={cn(r.capot ? 'text-ink-2' : 'text-ink', mine && 'bg-accent-tint')}>
                <th scope="row" className={cn(RANK_TD, RANK_PIN, pinSurface(mine), STAND_W, 'left-0 pl-3 text-left font-bold')}>
                  <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', fill.className)} style={fill.style} />
                  {plainStand(r.stand)}
                </th>
                <td className={cn(RANK_TD, 'max-w-48 py-2 whitespace-normal')}>{r.club}</td>
                <td className={cn(RANK_TD, RANK_PIN, RANK_PIN_EDGE, pinSurface(mine), NAMES_W, 'left-16 py-2 font-bold whitespace-normal')}>
                  <span className="line-clamp-2 break-words">
                    {mine ? 'Tu · ' : null}
                    {r.participants}
                  </span>
                </td>
                <td className={cn(RANK_TD, 'text-right t-heading font-extrabold')}>{r.capot ? <CapotChip size="sm" /> : roNum(r.quantity)}</td>
                <td className={cn(RANK_TD, 'text-right')}>{roNum(r.averageWeight)}</td>
                <td className={cn(RANK_TD, 'text-right')}>{roNum(r.biggestFish)}</td>
                <td className={cn(RANK_TD, 'text-right')}>{r.catchCount}</td>
                <td className={cn(RANK_TD, 'text-right')}>{roNum(r.sectorPoints)}</td>
                <td className={cn(RANK_TD, 'pr-3.5 text-right')}>
                  <span className="inline-flex justify-end">
                    <PlaceCell value={r.sectorPosition} onTint={mine} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </RankingGrid>
    </RankingFrame>
  );
}
