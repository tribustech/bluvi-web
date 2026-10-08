import { formatNationalStand, type CompetitionDetail } from '@/core/competitions';
import type { AllocatedParticipantsResponse } from '@/core/organizer';
import { paletteLetter, sectorColorMap } from '@/components/ranking/sector';

/*
 * The stand occupant model behind StandOccupantList (fish app/(app)/scale/[competitionId]/index.tsx
 * :58-113, the row every stand picker shares: scale, penalties «Alege standul», allocation). Pure.
 *
 * - Sectors in the competition's own order (fish maps `competition.sectors` as-is), stands in the
 *   sector's order.
 * - The stand label: «Stand N»; national championship «Stand A1(10)» (fish formatNationalStand with
 *   the registration's draw position).
 * - The occupant: team competitions «<echipă>: <participanți>» (fish `${teamName || 'Echipa'}: `
 *   bold — «Echipă» with its diacritic here), the participants joined «, », or the guest's name. A
 *   guest entry on a team competition usually repeats the team as its name: the same name is not
 *   printed twice.
 * - The club (national championship: the organizer navigates weigh-ins by club).
 * - Unallocated stands (null in /allocated-participants): no occupant, inert in the list.
 */

const NC = 'nationalChampionship';

export type StandOccupant = {
  standId: string;
  standName: string;
  sectorName: string;
  /** «Stand 7» / NC «Stand A1(7)». */
  label: string;
  /** National championship: the registration's club. */
  club: string | null;
  /** Team competitions: the team's name (fish falls back to «Echipa»). */
  team: string | null;
  /** The participants joined «, », or the guest's name; null when nobody (or only the team) is shown. */
  people: string | null;
  allocated: boolean;
  registrationId: string | null;
  /** Lowercase, no diacritics: stand, seat («A7»), club, team and people — for find-as-you-type. */
  search: string;
};

export type StandSectorGroup = {
  sectorId: string;
  name: string;
  /** The sector's colour (fish getColorsBySector by index → --color-sector-*). */
  color: string;
  /** The palette letter of `color`, for the token classes (dot, edge); null when off-palette. */
  paletteLetter: string | null;
  stands: StandOccupant[];
  allocated: number;
  unallocated: number;
};

type CompetitionShape = Pick<CompetitionDetail, 'sectors' | 'rankingType' | 'competitionType'>;

/** Lowercase, no diacritics: «Ștefan» matches «stefan». */
export const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export const isNationalChampionship = (c: Pick<CompetitionDetail, 'rankingType'>) => c.rankingType === NC;

export function standOccupantGroups(
  competition: CompetitionShape,
  allocations: AllocatedParticipantsResponse | null | undefined,
): StandSectorGroup[] {
  const isNc = isNationalChampionship(competition);
  const isTeam = competition.competitionType === 'team';
  const colors = sectorColorMap(competition.sectors.map((s) => s.name));
  return competition.sectors.map((sector) => {
    const stands = sector.stands.map((stand): StandOccupant => {
      const alloc = allocations?.[stand.documentId] ?? null;
      const label = isNc
        ? `Stand ${formatNationalStand(sector.name, alloc?.sectorDrawPosition ?? null, stand.name)}`
        : `Stand ${stand.name}`;
      const club = isNc && alloc?.clubName ? alloc.clubName : null;
      const team = alloc && isTeam ? alloc.teamName || 'Echipă' : null;
      const names = alloc ? (alloc.guestName ? alloc.guestName : alloc.participants.map((p) => p.name).join(', ')) : '';
      const people = names && !(team && fold(names.trim()) === fold(team.trim())) ? names : null;
      return {
        standId: stand.documentId,
        standName: stand.name,
        sectorName: sector.name,
        label,
        club,
        team,
        people,
        allocated: Boolean(alloc),
        registrationId: alloc?.registrationId ?? null,
        search: fold([label, `${sector.name}${stand.name}`, club ?? '', team ?? '', names].join(' ')),
      };
    });
    const allocated = stands.filter((s) => s.allocated).length;
    const color = colors[sector.name] ?? 'var(--color-muted)';
    return {
      sectorId: sector.documentId,
      name: sector.name,
      color,
      paletteLetter: paletteLetter(color),
      stands,
      allocated,
      unallocated: stands.length - allocated,
    };
  });
}

/** The groups narrowed to the stands matching `query` (empty sectors dropped); all of them for a blank query. */
export function filterStandGroups(groups: StandSectorGroup[], query: string): StandSectorGroup[] {
  const q = fold(query.trim());
  if (!q) return groups;
  return groups
    .map((g) => ({ ...g, stands: g.stands.filter((s) => s.search.includes(q)) }))
    .filter((g) => g.stands.length > 0);
}

export const countStands = (groups: StandSectorGroup[]) => groups.reduce((n, g) => n + g.stands.length, 0);

/** The id of a sector's heading in StandOccupantList («cantar-sector» + «A» → «cantar-sector-a»): a jump target. */
export const sectorAnchorId = (prefix: string, sectorName: string) =>
  `${prefix}-${sectorName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'x'}`;
