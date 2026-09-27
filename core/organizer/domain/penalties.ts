import { z } from 'zod';
import type { PenaltyAction, RankingType } from '../../competitions/schemas';

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
    reason: z
      .string()
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
