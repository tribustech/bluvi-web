import { describe, expect, it } from 'vitest';
import {
  groupsForRating,
  keepValidTags,
  NEGATIVE_TAGS,
  POSITIVE_TAGS,
  REVIEW_TAG_LABELS,
  reviewTagLabel,
} from './reviewTags';

describe('groupsForRating', () => {
  // Nothing went wrong is what five stars means, so the fault group is noise there.
  it('offers praise alone at five stars', () => {
    const groups = groupsForRating(5);
    expect(groups.map(g => g.polarity)).toEqual(['positive']);
    expect(groups[0].tags).toBe(POSITIVE_TAGS);
  });

  // Four stars is a good stay with one rough edge: the angler did things right
  // too, and offering only faults pushes the operator to invent one.
  it('offers both groups below five stars', () => {
    for (const stars of [4, 3, 2, 1]) {
      expect(groupsForRating(stars).map(g => g.polarity)).toEqual(['positive', 'negative']);
    }
  });

  it('names each group', () => {
    expect(groupsForRating(4).map(g => g.label)).toEqual(['A mers bine', 'Nu a mers']);
  });
});

describe('keepValidTags', () => {
  it('drops fault tags when the rating goes up to five', () => {
    expect(keepValidTags(['clean', 'messy'], 5)).toEqual(['clean']);
  });

  it('keeps everything while both groups are offered', () => {
    expect(keepValidTags(['clean', 'messy'], 4)).toEqual(['clean', 'messy']);
  });
});

describe('REVIEW_TAG_LABELS', () => {
  it('labels every tag in Romanian', () => {
    for (const tag of [...POSITIVE_TAGS, ...NEGATIVE_TAGS]) {
      expect(REVIEW_TAG_LABELS[tag]).toBeTruthy();
    }
  });
});

describe('reviewTagLabel', () => {
  it('renders a known key and drops an unknown one', () => {
    expect(reviewTagLabel('clean')).toBe('A lăsat locul curat');
    // A newer CMS can name a tag this build has never heard of; showing the raw
    // key on a public reputation page would be worse than showing nothing.
    expect(reviewTagLabel('teleported')).toBeNull();
  });
});
