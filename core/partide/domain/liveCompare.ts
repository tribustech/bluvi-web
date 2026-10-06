// Ported from fish `features/partide/components/community/liveCompare.ts` (pure), the row label of
// `LivePartideCard.tsx#rowLabel` and `features/lakes/helpers/lakeDetailLogic.ts#hasPartideActivity`.
import type { CommunityActiveSessionDTO, CommunityLakeSectionDTO, CommunityMemberDTO } from '../schemas';
import { catchesLabel } from './cardModel';
import { firstNameOf, membersLabel } from './communityView';
import { fmtKg } from './format';

/**
 * A total counts as "weighed" only when it's a number greater than zero — the backend's own rule
 * (`isWeighed` in `fishing-session/services/dto/community.ts`). The live aggregate is a bare
 * `sum(weight_kg)`, so a `totalKg` (or `maxKg`) can arrive as exactly `0`; printing «0,0 kg» next
 * to an empty bar would claim a weighing nobody made.
 */
export function isWeighed(kg: number | null | undefined): kg is number {
  return typeof kg === 'number' && kg > 0;
}

/** The live card head's figures: catches summed, kg summed, the single biggest fish. */
export interface LiveHeadStats {
  catches: number;
  totalKg: number | null;
  maxKg: number | null;
}

export function liveHeadStats(sessions: CommunityActiveSessionDTO[]): LiveHeadStats {
  let catches = 0;
  let totalKg: number | null = null;
  let maxKg: number | null = null;
  for (const s of sessions) {
    catches += s.catchCount ?? 0;
    if (s.totalKg != null) totalKg = (totalKg ?? 0) + s.totalKg;
    if (s.maxKg != null && (maxKg == null || s.maxKg > maxKg)) maxKg = s.maxKg;
  }
  return { catches, totalKg, maxKg };
}

/**
 * The row's second line: «Stand 2» apart (the row renders it darker) and the rest — the catches
 * and the biggest fish, or with no catches the time on the water («de 2h 14m la apă»).
 * `elapsed` arrives pre-formatted (`elapsedRo`) so this stays clock-free.
 */
export interface RowMeta {
  stand: string | null;
  rest: string;
}

export function rowMeta({
  standName,
  catchCount,
  totalKg,
  maxKg,
  elapsed,
}: {
  standName: string | null | undefined;
  catchCount: number | null;
  totalKg: number | null | undefined;
  maxKg: number | null;
  elapsed: string;
}): RowMeta {
  const stand = standName && standName.trim() ? `Stand ${standName.trim()}` : null;
  if (!catchCount) return { stand, rest: `${elapsed} la apă` };
  const max = isWeighed(totalKg) && isWeighed(maxKg) ? `max ${fmtKg(maxKg)} kg` : null;
  return { stand, rest: [catchesLabel(catchCount), max].filter(Boolean).join(' · ') };
}

/**
 * fish LivePartideCard `rowLabel`: a solo keeps its full name, a team is reduced to first names
 * («Mario, Iulian și Gilberto»); any member without a usable name falls back to «3 pescari».
 */
export function liveRowLabel(members: CommunityMemberDTO[]): string {
  if (members.length <= 1) return membersLabel(members);
  if (members.some(m => !m.name || !m.name.trim())) return membersLabel(members);
  const firsts = members.map(m => firstNameOf(m.name));
  if (firsts.length === 2) return `${firsts[0]} și ${firsts[1]}`;
  return `${firsts.slice(0, -1).join(', ')} și ${firsts[firsts.length - 1]}`;
}

/**
 * fish lakeDetailLogic `hasPartideActivity` — mirrors VenuePartideSection's own no-activity gate,
 * so the Partide chip, tile badge and section hide together: active now, catches this month, a
 * record, or any monthly count.
 */
export function hasPartideActivity(d: Pick<CommunityLakeSectionDTO, 'stats' | 'monthlyActivity'> | null | undefined): boolean {
  if (!d) return false;
  const { activeNow, catchesThisMonth, recordKg } = d.stats;
  if (activeNow > 0 || catchesThisMonth > 0 || recordKg != null) return true;
  return d.monthlyActivity.some(m => m.count > 0);
}
