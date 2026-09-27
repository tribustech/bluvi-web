import { describe, expect, it } from 'vitest';
import {
  profilePictureFilename,
  shouldKeepOriginal,
  toJpegFilename,
  uploadImageTarget,
  UPLOAD_JPEG_QUALITY,
} from './imageUpload';
import { applyMutedTypes, groupState, mutedTypesOf, toggleGroup, toggleType } from './notificationPreferences';
import { anglerReviewOverall, anglerReviewSubtitle, anglerReviewTagLabels, noShowLabel, ratingCountLabel } from './reputation';
import { groupsForRating, keepValidTags, NEGATIVE_TAGS, POSITIVE_TAGS, REVIEW_TAG_LABELS, reviewTagLabel } from './reviewTags';
import { dismissSuggestion, formatFollowers, pickTopStats, withoutDismissed } from './suggestedStats';


// ── ported from fish features/anglers/helpers/__tests__/pickTopStats.test.ts ────────────────────────
const base = { competitions: 0, podiums: 0, sessions: 0, catches: 0, recordKg: null as number | null, followers: 0 };

describe('pickTopStats', () => {
  it('returns nothing for a brand-new angler', () => {
    expect(pickTopStats(base)).toEqual([]);
  });
  it('prefers podiums > competitions > record > partide, max two', () => {
    expect(pickTopStats({ ...base, recordKg: 4.25, podiums: 2, competitions: 9, sessions: 30, catches: 100 })).toEqual([
      { value: '2', label: 'podiumuri' },
      { value: '9', label: 'concursuri' },
    ]);
    expect(pickTopStats({ ...base, recordKg: 4.25, sessions: 30 })).toEqual([
      { value: '4,3 kg', label: 'CMMC' },
      { value: '30', label: 'partide' },
    ]);
  });
  it('skips zeros and pluralises RO labels', () => {
    expect(pickTopStats({ ...base, competitions: 1, sessions: 1 })).toEqual([
      { value: '1', label: 'concurs' },
      { value: '1', label: 'partidă' },
    ]);
    expect(pickTopStats({ ...base, podiums: 1 })).toEqual([{ value: '1', label: 'podium' }]);
  });
  it('formats kg with one decimal and a comma', () => {
    expect(pickTopStats({ ...base, recordKg: 12 })).toEqual([{ value: '12,0 kg', label: 'CMMC' }]);
  });
  it('ignores catches without a weight', () => {
    expect(pickTopStats({ ...base, catches: 5, recordKg: 0 })).toEqual([]);
  });
});

describe('formatFollowers', () => {
  it('groups thousands with a dot and pluralises', () => {
    expect(formatFollowers(0)).toBe('fără urmăritori');
    expect(formatFollowers(1)).toBe('1 urmăritor');
    expect(formatFollowers(24)).toBe('24 urmăritori');
    expect(formatFollowers(1284)).toBe('1.284 urmăritori');
  });
});

describe('dismissed suggestions', () => {
  it('adds without mutating and filters the rail', () => {
    const empty: ReadonlySet<string> = new Set();
    const one = dismissSuggestion(empty, 'a');
    expect(empty.size).toBe(0);
    expect(withoutDismissed([{ documentId: 'a' }, { documentId: 'b' }], one)).toEqual([{ documentId: 'b' }]);
    const list = [{ documentId: 'a' }];
    expect(withoutDismissed(list, empty)).toBe(list);
  });
});

// ── ported from fish features/notifications/domain/__tests__/preferenceState.test.ts ────────────────
const group = {
  key: 'weighing',
  label: 'Cântare',
  types: [
    { key: 'a', label: 'A', muted: false },
    { key: 'b', label: 'B', muted: true },
    { key: 'c', label: 'C', muted: false },
  ],
};

describe('preferenceState', () => {
  it('reads muted keys from the dto', () => {
    expect(mutedTypesOf({ groups: [group] })).toEqual(['b']);
  });
  it('reads muted keys plus extraMuted, deduped', () => {
    expect(mutedTypesOf({ groups: [group], extraMuted: ['zzz', 'b'] })).toEqual(['b', 'zzz']);
  });
  it('toggles one type', () => {
    expect(toggleType(['b'], 'a', false)).toEqual(['b', 'a']);
    expect(toggleType(['b', 'a'], 'b', true)).toEqual(['a']);
    expect(toggleType(['b'], 'b', false)).toEqual(['b']);
  });
  it('toggles a whole group and reports its state', () => {
    expect(groupState(['b'], group)).toBe('partial');
    expect(groupState([], group)).toBe('on');
    expect(toggleGroup(['b', 'zzz'], group, false)).toEqual(['b', 'zzz', 'a', 'c']);
    expect(groupState(['a', 'b', 'c'], group)).toBe('off');
    expect(toggleGroup(['a', 'b', 'c', 'zzz'], group, true)).toEqual(['zzz']);
  });
  it('derives extraMuted from the submitted list for the optimistic write', () => {
    const result = applyMutedTypes({ groups: [group], extraMuted: ['old'] }, ['b', 'zzz']);
    expect(result.extraMuted).toEqual(['zzz']);
    const [resultGroup] = result.groups;
    expect(resultGroup.types.find(t => t.key === 'b')?.muted).toBe(true);
    expect(resultGroup.types.find(t => t.key === 'a')?.muted).toBe(false);
    expect(resultGroup.types.find(t => t.key === 'c')?.muted).toBe(false);
  });
});

// ── ported from fish features/operator/__tests__/reviewTags.test.ts ─────────────────────────────────
describe('review tags', () => {
  it('offers praise alone at five stars, both groups below', () => {
    const groups = groupsForRating(5);
    expect(groups.map(g => g.polarity)).toEqual(['positive']);
    expect(groups[0].tags).toBe(POSITIVE_TAGS);
    for (const stars of [4, 3, 2, 1]) {
      expect(groupsForRating(stars).map(g => g.polarity)).toEqual(['positive', 'negative']);
    }
    expect(groupsForRating(4).map(g => g.label)).toEqual(['A mers bine', 'Nu a mers']);
  });
  it('keepValidTags drops fault tags at five stars only', () => {
    expect(keepValidTags(['clean', 'messy'], 5)).toEqual(['clean']);
    expect(keepValidTags(['clean', 'messy'], 4)).toEqual(['clean', 'messy']);
  });
  it('labels every tag and drops unknown keys', () => {
    for (const tag of [...POSITIVE_TAGS, ...NEGATIVE_TAGS]) expect(REVIEW_TAG_LABELS[tag]).toBeTruthy();
    expect(reviewTagLabel('clean')).toBe('A lăsat locul curat');
    expect(reviewTagLabel('teleported')).toBeNull();
  });
});

// ── ReputationBlock pure bits ──────────────────────────────────────────────────────────────────────
describe('reputation', () => {
  it('uses the exact mean of the retired sub-scores, else stars', () => {
    expect(anglerReviewOverall({ stars: 5, rulesScore: 5, cleanlinessScore: 4, behaviorScore: 5 })).toBeCloseTo(4.667, 3);
    expect(anglerReviewOverall({ stars: 3, rulesScore: 5, cleanlinessScore: null, behaviorScore: 5 })).toBe(3);
  });
  it('labels', () => {
    expect(anglerReviewTagLabels({ tags: ['clean', 'nope'] })).toEqual(['A lăsat locul curat']);
    expect(anglerReviewTagLabels({})).toEqual([]);
    expect(anglerReviewSubtitle({ authorName: 'Op', lakeName: null })).toBe('Op');
    expect(anglerReviewSubtitle({ authorName: 'Op', lakeName: 'Chita' })).toBe('Op · Chita');
    expect(ratingCountLabel(1)).toBe('1 evaluare');
    expect(ratingCountLabel(3)).toBe('3 evaluări');
    expect([noShowLabel(1), noShowLabel(2)]).toEqual(['neprezentare', 'neprezentări']);
  });
});

// ── upload constraints ─────────────────────────────────────────────────────────────────────────────
describe('image upload', () => {
  it('caps the long edge at 1280 keeping the aspect, never upscales', () => {
    expect(uploadImageTarget({ width: 4032, height: 3024 })).toEqual({ width: 1280, height: 960, quality: UPLOAD_JPEG_QUALITY, mime: 'image/jpeg', resized: true });
    expect(uploadImageTarget({ width: 3024, height: 4032 })).toMatchObject({ width: 960, height: 1280 });
    expect(uploadImageTarget({ width: 800, height: 600 })).toMatchObject({ width: 800, height: 600, resized: false });
    expect(uploadImageTarget({ width: 1280, height: 10 })).toMatchObject({ resized: false });
    expect(uploadImageTarget({ width: 100000, height: 1 })).toMatchObject({ width: 1280, height: 1 });
  });
  it('keeps the original when the re-encode is not smaller', () => {
    expect(shouldKeepOriginal(100, 100)).toBe(true);
    expect(shouldKeepOriginal(100, 120)).toBe(true);
    expect(shouldKeepOriginal(100, 60)).toBe(false);
  });
  it('filenames', () => {
    expect(toJpegFilename('IMG_1.HEIC')).toBe('IMG_1.jpg');
    expect(toJpegFilename('photo')).toBe('photo.jpg');
    expect(toJpegFilename('.png')).toBe('image.jpg');
    expect(profilePictureFilename(513, 1700000000000)).toBe('profile_id_513_1700000000000.jpg');
  });
});
