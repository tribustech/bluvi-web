'use client';

import { useMemo, type CSSProperties } from 'react';
import {
  ncGeneralModel,
  ncSectorRows,
  sortNcClubs,
  type NationalChampionshipStandRanking,
  type NcGeneralSort,
  type NcSectorSort,
} from '@/core/competitions';
import { RankingFace } from '@/components/ranking/RankingFace';
import { sectorColorMap, sectorVar } from '@/components/ranking/sector';
import { cn } from '@/components/ui/cn';
import { roNum } from './FeederRanking';
import { FISH_TABLE_BLEED, FishPills, FishTable, type FishColumn, type FishRow } from './FishTable';
import type { NcSort, NcView } from './NcRanking';
import { useRankingFaces, type RankingFaces } from './rankingFaces';

/*
 * The National Championship / FIPSed ranking: fish NationalChampionshipRanking (sectorPillRow) +
 * components/ranking-table/NationalChampionshipTable.tsx (General) + the shared ScrollableTable on
 * fish's sector columns (a sector), as fish draws them (owner 2026-10-10, ROADMAP §4b.25). The
 * tables at every width (owner 2026-10-11): from 768 `wide` — 48px rows, 14px cells, 12px heads,
 * the team's face beside Pescari (§4b.13), in the screen's ranking card (the sector pills and the
 * order on its band, NcRanking.tsx); the pills here are the phone's.
 *
 *  - The pills: General (#3F51B5 when picked) and one per sector (its colour), #f0f0f0 otherwise,
 *    12px, scrolling sideways edge to edge.
 *  - General: one sideways scroll, nothing frozen; Club 120 · Pescari (6px a character + 40, at
 *    least 200) · Stand (7px a character + 24, 80–160) · 80 for every number; the 60px indigo head,
 *    40px rows, the club's own columns merged over its teams; each club in fish's six-colour club
 *    palette (40% under black, a winning club 90% under white), the merged Club cell opened by the
 *    colour's 4px edge, 🎖️ after a winning place.
 *  - A sector: fish's ScrollableTable (FishTable) on Stand · Club · Pescari · Kg · Medie · CMMC ·
 *    Nr. Buc · Puncte sector · Loc sector.
 */

/** fish NationalChampionshipTable widths. */
const CELL_WIDTH = 80;
const CLUB_CELL_WIDTH = 120;
const MIN_PARTICIPANT_CELL_WIDTH = 200;
const PARTICIPANT_CELL_PADDING = 40;
const MIN_STAND_CELL_WIDTH = 80;
const MAX_STAND_CELL_WIDTH = 160;
const STAND_CELL_PADDING = 24;
const STAND_CHAR_WIDTH = 7;

/** Stands named with their sector already («A3» in sector A, the FIPSed data): «AA3» → «A3». */
const plainStand = (label: string) => label.replace(/^([A-Za-z])\1(?=\d)/, '$1');

const CLUB_PALETTE = 'ABCDEF';

export function FishNcPills({
  sectors,
  value,
  onChange,
}: {
  sectors: { documentId: string; name: string }[];
  value: NcView;
  onChange: (v: NcView) => void;
}) {
  const colors = sectorColorMap(sectors.map(s => s.name));
  const options = [
    { value: 'general', label: 'General', active: 'bg-fish-indigo' },
    ...sectors.map(s => ({
      value: s.documentId,
      label: `Sector ${s.name}`,
      active: 'bg-[var(--sector)]',
      style: { '--sector': colors[s.name] } as CSSProperties,
    })),
  ];
  return (
    // fish: marginHorizontal -16 with 16px content padding, 4px top and bottom, 8 under it.
    <div className="-mx-4 mb-2">
      <FishPills
        name="nc-sector"
        label="Clasament pe"
        options={options}
        value={value}
        onChange={onChange}
        size={12}
        className="px-4 py-1"
      />
    </div>
  );
}

export function FishNcTable({
  rankings,
  numberOfSectors,
  view,
  sort,
  caption,
  wide = false,
}: {
  rankings: NationalChampionshipStandRanking[];
  numberOfSectors: number | null | undefined;
  view: NcView;
  sort: NcSort;
  caption: string;
  /** From 768: the desktop proportions, no bleed (the screen's card holds it). */
  wide?: boolean;
}) {
  const faces = useRankingFaces();
  if (view === 'general') {
    const table = (
      <ClubTable
        rankings={rankings}
        numberOfSectors={numberOfSectors}
        sort={sort === 'club' ? 'club' : 'position'}
        caption={caption}
        faces={wide ? faces : null}
      />
    );
    if (wide) return table;
    return (
      <div className={FISH_TABLE_BLEED}>
        <div className="-ml-1 w-full">{table}</div>
      </div>
    );
  }
  return (
    <SectorTable rankings={rankings} sectorId={view} sort={sort === 'stand' ? 'stand' : 'position'} caption={caption} faces={wide ? faces : null} />
  );
}

/** `wide`: the face (32) and its gap (8) beside the names. */
const FACE_ROOM = 40;
const faceOf = (faces: RankingFaces, registrationId: string | null | undefined) =>
  registrationId ? (faces.byRegistration.get(registrationId) ?? null) : null;

const px = (w: number): CSSProperties => ({ width: w, minWidth: w, maxWidth: w });
/** fish TableCell / MergedCell: padding 4, the 1px $gray4 border, 40px. Wide: 14px, 8px sides. */
const BOX = 'box-border border border-fish-rk-line text-center align-middle';
const PHONE_CELL = cn(BOX, 'p-1 t-caption');
const WIDE_CELL = cn(BOX, 'px-2 py-1 t-table');

function ClubTable({
  rankings,
  numberOfSectors,
  sort,
  caption,
  faces,
}: {
  rankings: NationalChampionshipStandRanking[];
  numberOfSectors: number | null | undefined;
  sort: NcGeneralSort;
  caption: string;
  /** `wide`: the faces beside Pescari (null on the phone). */
  faces: RankingFaces | null;
}) {
  const wide = faces !== null;
  const CELL = wide ? WIDE_CELL : PHONE_CELL;
  const clubs = useMemo(() => ncGeneralModel(sortNcClubs(rankings, sort), numberOfSectors), [rankings, sort, numberOfSectors]);
  const { nameW, standW } = useMemo(() => {
    const teams = clubs.flatMap(c => c.teams);
    const longest = Math.max(0, ...teams.map(t => t.participants.length));
    const stand = Math.max('Stand'.length, ...teams.map(t => t.stand.length));
    return {
      nameW: Math.max(longest * (wide ? 7 : 6) + PARTICIPANT_CELL_PADDING, MIN_PARTICIPANT_CELL_WIDTH) + (wide ? FACE_ROOM : 0),
      standW: Math.min(Math.max(stand * STAND_CHAR_WIDTH + STAND_CELL_PADDING, MIN_STAND_CELL_WIDTH), MAX_STAND_CELL_WIDTH),
    };
  }, [clubs, wide]);
  const head: [string, number][] = [
    ['Club', CLUB_CELL_WIDTH],
    ['Pescari', nameW],
    ['Stand', standW],
    ['Cantitate Sector', CELL_WIDTH],
    ['Total Kg Lot', CELL_WIDTH],
    ['CMMC Lot', CELL_WIDTH],
    ['Nr Pesti Lot', CELL_WIDTH],
    ['Medie Lot', CELL_WIDTH],
    ['Puncte Sector', CELL_WIDTH],
    ['Puncte Lot', CELL_WIDTH],
    ['Loc General', CELL_WIDTH],
    ['Loc Individual', CELL_WIDTH],
  ];
  const total = head.reduce((a, [, w]) => a + w, 0);
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      data-fish-colours=""
      className={cn(
        'w-full overflow-x-auto overscroll-x-none bg-rank-base outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent',
        // fish: no scrollbar; wide: the mouse needs it.
        wide ? '[scrollbar-width:thin]' : '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      )}
    >
      {/* Wide: the table fills its card, Pescari takes what the fixed columns leave (never under its width). */}
      <table className="table-fixed border-separate border-spacing-0" style={wide ? { width: '100%', minWidth: total } : { width: total }}>
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          {head.map(([title, w]) => (
            <col key={title} style={wide && title === 'Pescari' ? undefined : { width: w }} />
          ))}
        </colgroup>
        <thead>
          <tr className={wide ? 'h-14' : 'h-15'}>
            {head.map(([title, w]) => (
              <th
                key={title}
                scope="col"
                style={wide && title === 'Pescari' ? { minWidth: w } : px(w)}
                className={cn(BOX, 'bg-fish-rk-head text-fish-rk-head-ink', wide ? 'h-14 px-2 py-1 t-caption' : 'h-15 p-1 t-micro')}
              >
                {title}
              </th>
            ))}
          </tr>
        </thead>
        {clubs.map((club, ci) => {
          const span = club.teams.length;
          const color = `var(--color-sector-${CLUB_PALETTE[ci % CLUB_PALETTE.length].toLowerCase()})`;
          // fish: a winning club at 90% under white, the others at 40% under black.
          const clubFill = club.winner ? 'rank-sector-win text-rank-on-dark' : 'rank-sector-tint text-rank-on-light';
          const merged = (value: string, mark = false) => (
            <td rowSpan={span} className={cn(CELL, clubFill, 'font-medium!')}>
              <span className="block truncate">
                {roNum(value)}
                {mark ? (
                  <span aria-hidden data-mark="prize">
                    {' '}
                    🎖️
                  </span>
                ) : null}
              </span>
            </td>
          );
          return (
            <tbody key={club.clubId} style={sectorVar(CLUB_PALETTE[ci % CLUB_PALETTE.length], color) as CSSProperties}>
              {club.teams.map((team, ti) => {
                const first = ti === 0;
                // fish: a team in the places 1..S has its Loc Individual at 90% under white too.
                const individual = team.individualWinner ? 'rank-sector-win text-rank-on-dark' : clubFill;
                return (
                  // Pressable from RankingView (CustomRanking): the angler sheet.
                  <tr
                    key={team.standId}
                    data-stand-id={team.standId}
                    data-registration={team.registrationId ?? undefined}
                    className={wide ? 'h-12' : 'h-10'}
                  >
                    {first ? (
                      <th scope="rowgroup" rowSpan={span} className={cn(CELL, clubFill, 'border-l-4 border-l-[var(--sector)] font-bold!')}>
                        <span className="line-clamp-3 break-words">{club.clubName}</span>
                      </th>
                    ) : null}
                    <td className={cn(CELL, clubFill, wide && 'text-left')}>
                      {faces ? (
                        <span className="flex min-w-0 items-center gap-2">
                          <RankingFace name={team.participants} face={faceOf(faces, team.registrationId)} />
                          <span className="line-clamp-2 break-words">{team.participants}</span>
                        </span>
                      ) : (
                        <span className="line-clamp-2 break-words">{team.participants}</span>
                      )}
                    </td>
                    <td className={cn(CELL, clubFill)}>{plainStand(team.stand)}</td>
                    <td className={cn(CELL, clubFill)}>{roNum(team.quantity)}</td>
                    {first ? merged(club.totalKg) : null}
                    {first ? merged(club.biggestCatch) : null}
                    {first ? merged(club.catchCount) : null}
                    {first ? merged(club.averageWeight) : null}
                    <td className={cn(CELL, clubFill)}>{roNum(team.sectorPoints)}</td>
                    {first ? merged(club.points) : null}
                    {first ? (
                      <td rowSpan={span} className={cn(CELL, clubFill, 'font-medium!')}>
                        <span className="sr-only">Locul </span>
                        {roNum(club.position)}
                        {club.winner && club.position !== '-' ? (
                          <span aria-hidden data-mark="prize">
                            {' '}
                            🎖️
                          </span>
                        ) : null}
                      </td>
                    ) : null}
                    <td className={cn(CELL, individual)}>
                      <span className="sr-only">Locul </span>
                      {team.generalPosition || '–'}
                      {team.individualWinner && team.generalPosition ? (
                        <span aria-hidden data-mark="sector">
                          {' '}
                          🎖️
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

/** fish NationalChampionshipRanking sectorColumns. */
const SECTOR_COLUMNS: FishColumn[] = [
  { key: 'position', title: 'Stand', dynamicWidth: { min: 80, max: 160 } },
  { key: 'club', title: 'Club', dynamicWidth: { min: 100, max: 200 } },
  { key: 'participant', title: 'Pescari', dynamicWidth: { min: 120, max: 300 } },
  { key: 'quantity', title: 'Kg' },
  { key: 'averageWeight', title: 'Medie' },
  { key: 'biggestFish', title: 'CMMC' },
  { key: 'catchCount', title: 'Nr. Buc' },
  { key: 'sectorPoints', title: 'Puncte sector' },
  { key: 'sectorPosition', title: 'Loc sector' },
];

function SectorTable({
  rankings,
  sectorId,
  sort,
  caption,
  faces,
}: {
  rankings: NationalChampionshipStandRanking[];
  sectorId: string;
  sort: NcSectorSort;
  caption: string;
  /** `wide`: the faces beside Pescari (null on the phone). */
  faces: RankingFaces | null;
}) {
  const rows = useMemo<FishRow[]>(() => {
    const colors = sectorColorMap(rankings.flatMap(c => c.teams.map(t => t.sectorName)));
    return ncSectorRows(rankings, sectorId, sort).map(r => {
      const text = (s: string) => roNum(s);
      return {
        key: r.standId,
        standId: r.standId,
        registrationId: r.registrationId ?? undefined,
        stand: plainStand(r.stand),
        color: colors[r.sectorName] ?? 'var(--color-sector-a)',
        winner: false,
        cells: [
          { measure: r.club, content: r.club },
          {
            measure: r.participants,
            content: r.participants,
            rowHeader: true,
            lead: faces ? <RankingFace name={r.participants} face={faceOf(faces, r.registrationId)} /> : undefined,
          },
          {
            measure: r.quantity,
            content: r.capot ? (
              <>
                <span aria-hidden>–</span>
                <span className="sr-only">Fără capturi</span>
              </>
            ) : (
              text(r.quantity)
            ),
          },
          { measure: r.averageWeight, content: text(r.averageWeight) },
          { measure: r.biggestFish, content: text(r.biggestFish) },
          { measure: String(r.catchCount), content: r.catchCount },
          { measure: r.sectorPoints, content: text(r.sectorPoints) },
          { measure: r.sectorPosition, content: text(r.sectorPosition) },
        ],
      };
    });
  }, [rankings, sectorId, sort, faces]);
  // fish: a sector without teams.
  if (rows.length === 0) return <p className={cn('px-4 t-caption text-muted', faces && 'py-4')}>Nu există DUO-uri în acest sector.</p>;
  if (faces) return <FishTable wide caption={caption} columns={SECTOR_COLUMNS} rows={rows} />;
  return (
    <div className={FISH_TABLE_BLEED}>
      <FishTable caption={caption} columns={SECTOR_COLUMNS} rows={rows} className="-ml-1" />
    </div>
  );
}
