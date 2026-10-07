import * as z from 'zod';
import type { Review, ReviewReqBody } from '@/core/lakes';

/*
 * The review form's values and rules — fish LakeReviewForms.tsx (react-hook-form): three whole-star
 * scores 1–5 (default 5), the comment, «Recomand această baltă» (default on). One message per field,
 * in react-hook-form's order for the comment: `required` (empty) → `maxLength` (over 2000, counted
 * untrimmed) → `validate` (under 10 once trimmed).
 */

export const COMMENT_REQUIRED = 'Pentru o experiență mai bună, te rugăm să lași un comentariu.';
export const COMMENT_MIN = 'Acest câmp trebuie să aibă cel puțin 10 caractere';
export const COMMENT_MAX = 'Acest câmp trebuie să aibă cel mult 2000 de caractere';
export const COMMENT_MAX_LENGTH = 2000;

const score = z.number().int().min(1).max(5);

export const reviewFormSchema = z.object({
  quality: score,
  facilities: score,
  atmosphere: score,
  recommendToOthers: z.boolean(),
  comment: z.string().superRefine((value, ctx) => {
    if (value.length === 0) ctx.addIssue({ code: 'custom', message: COMMENT_REQUIRED });
    else if (value.length > COMMENT_MAX_LENGTH) ctx.addIssue({ code: 'custom', message: COMMENT_MAX });
    else if (value.trim().length < 10) ctx.addIssue({ code: 'custom', message: COMMENT_MIN });
  }),
});

export type ReviewFormValues = z.infer<typeof reviewFormSchema>;

/** fish `defaultValues` (the comment starts empty). */
export const DEFAULT_REVIEW_VALUES: ReviewFormValues = { quality: 5, facilities: 5, atmosphere: 5, recommendToOthers: true, comment: '' };

/** A score from the CMS as the form holds it: a whole star 1–5 (fish `value || DEFAULT_RATING`, min 1). */
const clampScore = (n: number | null | undefined) => (n ? Math.min(5, Math.max(1, Math.round(n))) : 5);

/** Edit mode (c7): every field prefilled from the viewer's review. */
export function valuesFromReview(review: Pick<Review, 'quality' | 'facilities' | 'atmosphere' | 'recommendToOthers' | 'comment'>): ReviewFormValues {
  return {
    quality: clampScore(review.quality),
    facilities: clampScore(review.facilities),
    atmosphere: clampScore(review.atmosphere),
    recommendToOthers: review.recommendToOthers,
    comment: review.comment ?? '',
  };
}

/** The first message, or undefined (the comment is the only field that can fail from the UI). */
export function commentError(values: ReviewFormValues): string | undefined {
  const result = reviewFormSchema.safeParse(values);
  if (result.success) return undefined;
  return result.error.issues.find(i => i.path[0] === 'comment')?.message;
}

/**
 * The request body (fish onSubmit: the form's values, plus `booking` when the form was opened from a
 * completed booking, so the review is marked verified, c6).
 */
export function reviewBody(values: ReviewFormValues, booking?: string): ReviewReqBody {
  return booking ? { ...values, booking } : { ...values };
}
