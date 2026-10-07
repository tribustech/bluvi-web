import { describe, expect, it } from 'vitest';
import { COMMENT_MAX, COMMENT_MIN, COMMENT_REQUIRED, commentError, DEFAULT_REVIEW_VALUES, reviewBody, reviewFormSchema, valuesFromReview } from './schema';

const v = (comment: string) => ({ ...DEFAULT_REVIEW_VALUES, comment });

describe('review form schema (fish LakeReviewForms)', () => {
  it('defaults: 5 / 5 / 5, recommended, empty comment', () => {
    expect(DEFAULT_REVIEW_VALUES).toEqual({ quality: 5, facilities: 5, atmosphere: 5, recommendToOthers: true, comment: '' });
  });

  it('comment messages in react-hook-form order: required → max → min (trimmed)', () => {
    expect(commentError(v(''))).toBe(COMMENT_REQUIRED);
    expect(commentError(v('          '))).toBe(COMMENT_MIN);
    expect(commentError(v('   scurt   '))).toBe(COMMENT_MIN);
    expect(commentError(v('x'.repeat(2001)))).toBe(COMMENT_MAX);
    expect(commentError(v('Exact zece'))).toBeUndefined();
    expect(commentError(v('x'.repeat(2000)))).toBeUndefined();
  });

  it('scores are whole stars 1–5', () => {
    expect(reviewFormSchema.safeParse({ ...v('Foarte frumos aici'), quality: 0 }).success).toBe(false);
    expect(reviewFormSchema.safeParse({ ...v('Foarte frumos aici'), quality: 4.5 }).success).toBe(false);
    expect(reviewFormSchema.safeParse({ ...v('Foarte frumos aici'), quality: 1 }).success).toBe(true);
  });

  it('prefill from the viewer review; a 0 / missing score reads 5 (fish value || 5)', () => {
    expect(valuesFromReview({ quality: 3, facilities: 0, atmosphere: 4, recommendToOthers: false, comment: null })).toEqual({
      quality: 3,
      facilities: 5,
      atmosphere: 4,
      recommendToOthers: false,
      comment: '',
    });
  });

  it('the body carries the booking only when there is one (verified review)', () => {
    const values = v('Foarte frumos aici');
    expect(reviewBody(values)).not.toHaveProperty('booking');
    expect(reviewBody(values, 'bk1')).toEqual({ ...values, booking: 'bk1' });
  });
});
