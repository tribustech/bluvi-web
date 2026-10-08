import * as z from 'zod';
import type { Penalty, PenaltyAction, RankingType } from '../../competitions/schemas';

/** fish `models/penalty.type.ts#PENALTY_SUPPORTED_RANKING_TYPES` */
export const PENALTY_SUPPORTED_RANKING_TYPES: RankingType[] = ['quantity', 'quantityQuality'];

export const supportsPenalties = (rankingType?: RankingType | string | null): boolean =>
  !!rankingType && (PENALTY_SUPPORTED_RANKING_TYPES as string[]).includes(rankingType);

export const PENALTY_REASON_MIN = 5;
export const PENALTY_REASON_MAX = 255;

/** Accepts "1,5" as well as "1.5" (Romanian keyboards). */
function parsePenaltyValue(value: string | undefined): number {
  return parseFloat((value ?? '').trim().replace(',', '.'));
}

/** fish `app/(app)/penalties/[competitionId]/apply.tsx` form schema. */
export const penaltyFormSchema = z
  .object({
    action: z.enum(['WARNING', 'DEDUCT_TOTAL_WEIGHT', 'ELIMINATE']),
    value: z.string().optional(),
    // Checked trimmed: the trimmed reason is what toCreatePenaltyParams sends and the CMS measures.
    reason: z
      .string()
      .trim()
      .min(PENALTY_REASON_MIN, { message: `Motivul trebuie să aibă cel puțin ${PENALTY_REASON_MIN} caractere` })
      .max(PENALTY_REASON_MAX, { message: `Motivul nu poate depăși ${PENALTY_REASON_MAX} caractere` }),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'DEDUCT_TOTAL_WEIGHT') {
      const parsed = parsePenaltyValue(data.value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Valoare obligatorie (kg) — trebuie să fie un număr mai mare ca 0',
          path: ['value'],
        });
      }
    }
  });
export type PenaltyFormValues = z.infer<typeof penaltyFormSchema>;

/** fish apply.tsx `onSubmit`: form values → `createPenalty` params (value only for deductions). */
export function toCreatePenaltyParams(
  values: PenaltyFormValues,
  ids: { competitionId: string; registrationId: string }
): { competitionId: string; registrationId: string; action: PenaltyAction; value?: number; reason: string } {
  return {
    ...ids,
    action: values.action,
    value: values.action === 'DEDUCT_TOTAL_WEIGHT' ? parsePenaltyValue(values.value) : undefined,
    reason: values.reason.trim(),
  };
}

/** fish apply.tsx `findSectorForStand` */
export const findSectorForStand = <S extends { stands: { id: string | number; documentId?: string }[] }>(
  sectors: S[],
  standId: string | number | undefined
): S | undefined => sectors.find(s => s.stands.some(st => st.id === standId || st.documentId === standId));

/* ------------------------------------------------------------------ */
/* Penalties hub — fish app/(app)/penalties/[competitionId]/index.tsx  */
/* ------------------------------------------------------------------ */

/** fish index.tsx `ACTION_LABELS` (an action the CMS adds later reads as itself). */
export const PENALTY_ACTION_LABELS: Record<PenaltyAction, string> = {
  WARNING: 'Avertisment',
  DEDUCT_TOTAL_WEIGHT: 'Penalizare greutate',
  ELIMINATE: 'Eliminare',
};
export const penaltyActionLabel = (action: string): string =>
  (PENALTY_ACTION_LABELS as Record<string, string>)[action] ?? action;

type PenaltyRow = {
  teamName?: string | null;
  guestName?: string | null;
  participant?: { username?: string } | null;
  standName?: string | null;
  penalties?: Penalty[];
};

/**
 * fish index.tsx `labelForRankingRow`: «Stand N · echipă / invitat / utilizator» (no stand → the
 * name alone). fish chains with `??`, so the CMS's empty `teamName: ""` on an individual row wins
 * and the label ends in «Stand 9 · »; here a blank name falls through to the next one.
 */
export function penaltyTeamLabel(row: Omit<PenaltyRow, 'penalties'>): string {
  const name = [row.teamName, row.guestName, row.participant?.username].find(n => typeof n === 'string' && n.trim() !== '');
  const team = name?.trim() ?? '—';
  return row.standName ? `Stand ${row.standName} · ${team}` : team;
}

export type GatheredPenalty = Penalty & { teamLabel: string };

/**
 * fish index.tsx `flattened`: every penalty of every ranking row — and of every team inside a row
 * (National Championship / FIPSed clubs) — with its competitor's label, newest first. No ranking
 * yet (not started: the read is disabled) → none.
 */
export function gatherPenalties(ranking: { rankings?: unknown } | null | undefined): GatheredPenalty[] {
  const rows = (Array.isArray(ranking?.rankings) ? ranking.rankings : []) as (PenaltyRow & { teams?: PenaltyRow[] })[];
  const label = (r: PenaltyRow) => (r.penalties ?? []).map(p => ({ ...p, teamLabel: penaltyTeamLabel(r) }));
  return rows
    .flatMap(r => (Array.isArray(r.teams) ? r.teams.flatMap(label) : label(r)))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** fish `toLocaleString('ro-RO', dd.mm.yyyy, hh:mm)`, in Romania's time whatever the viewer's zone. */
export function formatPenaltyTimestamp(iso: string): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return iso;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Bucharest',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map(x => [x.type, x.value]),
  );
  return `${p.day}.${p.month}.${p.year}, ${p.hour}:${p.minute}`;
}

/** fish index.tsx:71-76 — who may apply / revoke on the hub. */
export function penaltyPermissions(
  isAuthorOrReferee: boolean,
  competition: { competitionStatus?: string | null; rankingType?: string | null } | null | undefined,
): { canApply: boolean; canRevoke: boolean; rankingSupportsPenalties: boolean } {
  const started = competition?.competitionStatus === 'started';
  const rankingSupportsPenalties = supportsPenalties(competition?.rankingType);
  return { canApply: isAuthorOrReferee && started && rankingSupportsPenalties, canRevoke: isAuthorOrReferee && started, rankingSupportsPenalties };
}

/** fish index.tsx:131-136 — the empty state's line, one of three. */
export function emptyPenaltiesLine({ canApply, rankingSupportsPenalties }: { canApply: boolean; rankingSupportsPenalties: boolean }): string {
  if (!rankingSupportsPenalties) return 'Penalizările nu se aplică pentru acest tip de clasament.';
  if (canApply) return 'Aplică o penalizare pentru a o vedea aici.';
  return 'Organizatorul nu a aplicat încă nicio penalizare în această competiție.';
}
