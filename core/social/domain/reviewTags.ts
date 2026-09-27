/** fish `features/operator/reviewTags.ts` (verbatim). */
/**
 * The tags an operator can attach to an angler review, and the Romanian labels
 * every surface reads them by.
 *
 * Mirrors the server's closed set (fir-intins-cms/src/api/feed/services/dto/
 * review-tags.ts). Keys are stored, labels are not — so wording can change
 * without touching a single stored review.
 *
 * Which half is offered depends on the rating: five stars asks what went WELL,
 * anything less asks what did NOT. That split is the whole reason the rating is
 * one score now — three separate star rows all moved together, because
 * "respectarea regulilor" is an umbrella over the other two, so they measured
 * the same thing three times. A tag says which specific thing happened without
 * pretending it is a separate score.
 */
export type ReviewTag = 'respectsRules' | 'clean' | 'friendly' | 'quiet' | 'brokeRules' | 'messy' | 'rude' | 'noisy';

export const POSITIVE_TAGS: ReviewTag[] = ['respectsRules', 'clean', 'friendly', 'quiet'];
export const NEGATIVE_TAGS: ReviewTag[] = ['brokeRules', 'messy', 'rude', 'noisy'];

export const REVIEW_TAG_LABELS: Record<ReviewTag, string> = {
  respectsRules: 'A respectat regulile',
  clean: 'A lăsat locul curat',
  friendly: 'Prietenos',
  quiet: 'Liniștit',
  brokeRules: 'Nu a respectat regulile',
  messy: 'A lăsat mizerie',
  rude: 'Comportament nepotrivit',
  noisy: 'Gălăgios',
};

export type ReviewTagGroup = {
  polarity: 'positive' | 'negative';
  label: string;
  tags: ReviewTag[];
};

const POSITIVE_GROUP: ReviewTagGroup = { polarity: 'positive', label: 'A mers bine', tags: POSITIVE_TAGS };
const NEGATIVE_GROUP: ReviewTagGroup = { polarity: 'negative', label: 'Nu a mers', tags: NEGATIVE_TAGS };

/**
 * Which groups of chips a rating offers.
 *
 * Below five stars BOTH are offered, because a four-star stay is not a
 * complaint — the angler did things right and one thing less so, and an
 * operator handed only faults there is pushed to either invent one or tag
 * nothing. Five stars drops the fault group: nothing went wrong is what five
 * stars means, so asking is noise.
 */
export function groupsForRating(stars: number): ReviewTagGroup[] {
  return stars >= 5 ? [POSITIVE_GROUP] : [POSITIVE_GROUP, NEGATIVE_GROUP];
}

/** Tags that survive a rating change — anything the new rating no longer offers
 *  must go, or a five-star review could ship "A lăsat mizerie" attached to it. */
export function keepValidTags(tags: ReviewTag[], stars: number): ReviewTag[] {
  const allowed = new Set(groupsForRating(stars).flatMap(g => g.tags));
  return tags.filter(t => allowed.has(t));
}

/** A stored key rendered for display; unknown keys (a newer CMS, an older app)
 *  are dropped rather than shown raw. */
export function reviewTagLabel(key: string): string | null {
  return (REVIEW_TAG_LABELS as Record<string, string>)[key] ?? null;
}
