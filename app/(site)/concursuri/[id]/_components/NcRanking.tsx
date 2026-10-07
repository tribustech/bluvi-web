'use client';

import { useMemo, type CSSProperties, type ReactNode } from 'react';
import {
  ncGeneralModel,
  ncSectorRows,
  sortNcClubs,
  type NationalChampionshipStandRanking,
  type NcGeneralSort,
  type NcSectorSort,
} from '@/core/competitions';
import { sectorFill, sectorInk, sectorVar } from '@/components/ranking/sector';
import { RankingFace } from '@/components/ranking/RankingFace';
import { RankingTabs, type RankingTab } from '@/components/ranking/RankingTabs';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { EmptyState } from '@/components/surfaces/StateCard';
import { cn } from '@/components/ui/cn';
import { roNum } from './FeederRanking';
import { useRankingFaces, type RankingFaces } from './rankingFaces';
import {
  PlaceCell,
  RANK_PIN,
  RANK_PIN_EDGE,
  RANK_TH_HEAD,
  RANK_TH_PIN,
  RankingFrame,
  RankingGrid,
  SeatLabel,
} from '@/components/ranking/shell';
import { RankingCard } from './rankingShell';

/*
 * National Championship / FIPSed — fish components/competition/NationalChampionshipRanking.tsx
 * (sector pills, sector table, sorts) + components/ranking-table/NationalChampionshipTable.tsx (the
 * club table), on core/competitions/domain/nationalChampionship.ts.
 *
 *  - General: one row per team, the club's own columns merged across its teams (rowSpan), each club
 *    in fish's colours (see «fish's colours» below). Every place is the ranking tables' one idiom
 *    (kit PlaceCell): a winning club adds the trophy, a team in the places 1..S (the sector
 *    winners) the sector trophy, in the cell's own ink (fish: 🎖️).
 *  - A sector: Stand, Club, Pescari, Kg, Medie, CMMC, Nr. Buc, Puncte sector, Loc sector; a team
 *    without a catch reads «–» in Kg (as fish; never «capot», ROADMAP §4b.11).
 *  - Both: fish's indigo header row (kit RANK_TH, §4b.12), fish's grid lines, and from 768 the
 *    team's avatar beside Pescari (§4b.13). Compact (§4b.16): fish's column widths, the table only
 *    as wide as its content.
 * TODO(kit): a merged-cell ranking table (club rows); composed on the kit's shared shell (components/ranking/shell.tsx).
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

/** The tab strip (kit RankingTabs): General plus every sector of the competition, each with its colour dot. */
export function NcSectorPills({
  sectors,
  value,
  onChange,
}: {
  sectors: { documentId: string; name: string }[];
  value: NcView;
  onChange: (v: NcView) => void;
}) {
  const options: RankingTab<string>[] = [
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
  // One segmented strip (ROADMAP §4b.20): the selected view filled accent, the rest on the track.
  return <RankingTabs name="nc-sector" label="Clasament pe" options={options} value={value} onChange={onChange} />;
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

/**
 * A team's anglers, one per line (fish joins them with «, » on one line): a 2-angler team reads as
 * two names in a 48px row instead of one name cut off with «…». A name wraps between its words,
 * never inside one and never behind an ellipsis (the 120px pinned column on a 375 phone). The comma
 * stays for a screen reader.
 */
function TeamNames({ names, mine }: { names: string; mine: boolean }) {
  const list = names.split(', ').filter(Boolean);
  return (
    <span className="flex min-w-0 flex-col [overflow-wrap:normal] break-normal md:whitespace-nowrap">
      {list.map((name, i) => (
        <span key={i} className="block text-balance">
          {mine && i === 0 ? 'Tu · ' : null}
          {name}
          {i < list.length - 1 ? <span className="sr-only">, </span> : null}
        </span>
      ))}
    </span>
  );
}

/** A team's face by its registration (the page's core); unknown → the names' initials. */
const faceOf = (faces: RankingFaces, registrationId: string | null) => (registrationId ? (faces.byRegistration.get(registrationId) ?? null) : null);

/*
 * fish's colours (ROADMAP §4b.15): NationalChampionshipTable — each club in its own colour (fish's
 * six-colour club palette, the sector colours A–F, by the club's row in the shown order): its
 * cells at 40% under black, a winning club (clubPosition ≤ the number of sectors) at 90% under
 * white or black (AA, sectorInk), its merged Club cell opened by the colour's 4px edge, a team in
 * the places 1..S its «Loc Individual» at 90% too. A sector: fish's ScrollableTable — the white
 * Stand cell with the sector's 4px edge, every other cell at the sector's 40%.
 */
const CLUB_PALETTE = 'ABCDEF';
const clubLetter = (index: number) => CLUB_PALETTE[index % CLUB_PALETTE.length];
const TINT = 'rank-sector-tint text-rank-on-light';
const winFill = (letter: string) => cn('rank-sector-win', sectorInk(letter, 'win'));

/** fish's header: the indigo band, titles wrapping on two lines over the narrow number columns. */
const NC_TH = cn(RANK_TH_HEAD, 'h-12 px-2 py-1 align-middle');
const NC_NUM_TH = 'w-21 min-w-21 whitespace-normal text-balance';
/** The name heads stay on one line. */
const NC_NAME_TH = 'whitespace-nowrap';
/** fish's 40px cells (a step taller for the avatar) and grid lines. */
const NC_TD = 'h-12 border-t border-l border-rank-line px-2';

/*
 * Pinned while the numbers scroll sideways. A sector: Stand + Pescari at the left. General: from 768
 * Club + Pescari at the left (fish's widths: club 120, a step wider; names sized to their content).
 * Below 768 the club ranking keeps what decides it on the first screen, as the standard table does
 * (tableFixes useTablePins): the narrow Club (64px, its name in caption type) scrolls away under
 * Pescari, which stays pinned at the left (120px, names wrapping between words, balanced, never
 * mid-word), and «Loc General» (the club's place) and «Loc Individual» (the team's) stay pinned at
 * the right (64px each) — Club, Pescari, Loc General and Loc Individual on a 375 phone's first
 * screen, the club's numbers scrolling between them.
 */
const CLUB_W = 'w-16 min-w-16 max-w-16 md:w-36 md:min-w-36 md:max-w-36';
const CLUB_PIN = 'max-md:relative md:sticky md:left-0';
const NAMES_LEFT = 'left-0 md:left-36';
const NAMES_W = 'max-md:max-w-30 max-md:min-w-30 md:min-w-44 md:max-w-80';
const STAND_W = 'w-16 min-w-16 max-w-16';
/** Below 768: the two places pinned at the right (Loc Individual last, Loc General before it). */
const PLACE_W = 'max-md:w-16 max-md:min-w-16 max-md:max-w-16';
const PIN_LOC_GENERAL = cn(PLACE_W, 'max-md:sticky max-md:right-16');
const PIN_LOC_INDIVIDUAL = cn(PLACE_W, 'max-md:sticky max-md:right-0');

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
  const faces = useRankingFaces();
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
    // Below 768 the places are pinned at the right: no right-edge fade over them.
    <RankingFrame caption={caption} full={full} embedded={embedded} className="max-md:data-[more=true]:[mask-image:none]">
      <RankingGrid caption={caption} className="text-rank-on-light">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={cn(
                  NC_TH,
                  i < 3 ? cn('text-left', NC_NAME_TH) : cn('text-right', NC_NUM_TH),
                  i === 0 && cn(CLUB_W, 'md:left-0 md:z-sticky pl-3 max-md:whitespace-normal'),
                  i === 1 && cn(RANK_TH_PIN, RANK_PIN_EDGE, NAMES_LEFT),
                  i === head.length - 2 && cn(PIN_LOC_GENERAL, 'max-md:z-sticky'),
                  i === head.length - 1 && cn(PIN_LOC_INDIVIDUAL, 'max-md:z-sticky pr-3.5'),
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        {clubs.map((club, ci) => {
          const span = club.teams.length;
          const letter = clubLetter(ci);
          const clubFill = club.winner ? winFill(letter) : TINT;
          return (
            // One row group per club, in the club's colour: its merged cells span the club's teams.
            <tbody key={club.clubId} style={sectorVar(letter) as CSSProperties}>
              {club.teams.map((team, ti) => {
                const first = ti === 0;
                const mine = me != null && team.standId === me;
                const merged = (content: ReactNode, className = 'text-right') =>
                  first ? (
                    <td rowSpan={span} className={cn(NC_TD, clubFill, 'align-middle', className)}>
                      {content}
                    </td>
                  ) : null;
                return (
                  // Pressable from RankingView (CustomRanking): the person's popover from 1024, the angler sheet below.
                  <tr key={team.standId} data-stand-id={team.standId} data-registration={team.registrationId ?? undefined}>
                    {first ? (
                      <th
                        scope="rowgroup"
                        rowSpan={span}
                        className={cn(
                          NC_TD,
                          clubFill,
                          CLUB_PIN,
                          CLUB_W,
                          'border-l-0 py-2 pl-3 text-left align-middle font-bold break-normal whitespace-normal max-md:t-caption max-md:font-bold',
                        )}
                      >
                        {/* fish: the club's colour as the merged cell's 4px left edge. */}
                        <span aria-hidden className="absolute inset-y-0 left-0 w-1 rank-sector-solid" />
                        {club.clubName}
                      </th>
                    ) : null}
                    <td className={cn(NC_TD, clubFill, RANK_PIN, RANK_PIN_EDGE, NAMES_LEFT, NAMES_W, 'py-1.5 pl-3 font-bold whitespace-normal')}>
                      <span className="flex items-center gap-2.5">
                        <RankingFace name={team.participants} face={faceOf(faces, team.registrationId)} />
                        <TeamNames names={team.participants} mine={mine} />
                      </span>
                    </td>
                    <td className={cn(NC_TD, clubFill, 'text-left font-bold')}>
                      <SeatLabel seat={plainStand(team.stand)} dot={false} />
                    </td>
                    <td className={cn(NC_TD, clubFill, 'text-right')}>{roNum(team.quantity)}</td>
                    {merged(roNum(club.totalKg), 'text-right font-extrabold')}
                    {merged(roNum(club.biggestCatch))}
                    {merged(roNum(club.catchCount))}
                    {merged(roNum(club.averageWeight))}
                    <td className={cn(NC_TD, clubFill, 'text-right')}>{roNum(team.sectorPoints)}</td>
                    {merged(roNum(club.points), 'text-right font-bold')}
                    {merged(
                      <span className="inline-flex justify-end">
                        <PlaceCell value={club.position} mark={club.winner ? 'prize' : null} onFill align="end" />
                      </span>,
                      cn('text-right', PIN_LOC_GENERAL),
                    )}
                    <td className={cn(NC_TD, team.individualWinner ? winFill(letter) : clubFill, PIN_LOC_INDIVIDUAL, 'pr-3.5 text-right')}>
                      <span className="inline-flex justify-end">
                        <PlaceCell value={team.generalPosition} mark={team.individualWinner ? 'sector' : null} onFill align="end" />
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
  const faces = useRankingFaces();
  const head = ['Stand', 'Club', 'Pescari', 'Kg', 'Medie', 'CMMC', 'Nr. Buc', 'Puncte sector', 'Loc sector'];
  return (
    <RankingFrame caption={caption} full={full} embedded={embedded}>
      <RankingGrid caption={caption} className="text-rank-on-light">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={cn(
                  NC_TH,
                  i < 3 ? cn('text-left', NC_NAME_TH) : cn('text-right', NC_NUM_TH),
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
              <tr key={r.standId} data-stand-id={r.standId} data-registration={r.registrationId ?? undefined} style={sectorVar(r.sectorName) as CSSProperties}>
                {/* fish: the Stand cell stays white (the viewer's own: its tint), the sector its 4px edge. */}
                <th scope="row" className={cn(NC_TD, 'border-l-0', RANK_PIN, mine ? 'bg-accent-tint' : 'bg-rank-base', STAND_W, 'left-0 pl-3 text-left font-bold')}>
                  <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', fill.className)} style={fill.style} />
                  {plainStand(r.stand)}
                </th>
                <td className={cn(NC_TD, TINT, 'max-w-48 py-1.5 whitespace-normal')}>{r.club}</td>
                <td className={cn(NC_TD, TINT, RANK_PIN, RANK_PIN_EDGE, NAMES_W, 'left-16 py-1.5 font-bold whitespace-normal')}>
                  <span className="flex items-center gap-2.5">
                    <RankingFace name={r.participants} face={faceOf(faces, r.registrationId)} />
                    <TeamNames names={r.participants} mine={mine} />
                  </span>
                </td>
                <td className={cn(NC_TD, TINT, 'text-right font-extrabold')}>
                  {r.capot ? (
                    <>
                      <span aria-hidden>–</span>
                      <span className="sr-only">Fără capturi</span>
                    </>
                  ) : (
                    roNum(r.quantity)
                  )}
                </td>
                <td className={cn(NC_TD, TINT, 'text-right')}>{roNum(r.averageWeight)}</td>
                <td className={cn(NC_TD, TINT, 'text-right')}>{roNum(r.biggestFish)}</td>
                <td className={cn(NC_TD, TINT, 'text-right')}>{r.catchCount}</td>
                <td className={cn(NC_TD, TINT, 'text-right')}>{roNum(r.sectorPoints)}</td>
                <td className={cn(NC_TD, TINT, 'pr-3.5 text-right')}>
                  <span className="inline-flex justify-end">
                    <PlaceCell value={r.sectorPosition} onFill align="end" />
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
