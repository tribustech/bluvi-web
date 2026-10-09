import { describe, expect, it } from 'vitest';
import type { ReviewTag } from '@/core/social';
import { GENERIC_ERROR_MESSAGE } from '@/core/transport';
import {
  cleanAvatar,
  cleanText,
  commentRequired,
  DEFAULT_STARS,
  displayName,
  FAILED_MESSAGE,
  FORBIDDEN_MESSAGE,
  friendlyReviewError,
  GONE_MESSAGE,
  isFinalRefusal,
  imageOrigins,
  isValid,
  parseRateParams,
  reviewInput,
  stayLine,
  toggleTag,
  verdict,
  withStars,
} from './model';

const ORIGINS = imageOrigins('http://localhost:1337/api');
const S3 = 'https://fir-intins-strapi.s3.eu-central-1.amazonaws.com/avatar_abc.jpg';

describe('parseRateParams (c1)', () => {
  it('reads every param fish passes', () => {
    expect(
      parseRateParams(
        'b1x',
        {
          anglerName: '  Toni   Pescaru ',
          anglerId: 'u-1',
          anglerAvatar: S3,
          standName: '3',
          startDate: '2026-08-15T03:00:00.000Z',
          endDate: '2026-08-15T15:00:00.000Z',
        },
        ORIGINS,
      ),
    ).toEqual({
      bookingId: 'b1x',
      anglerName: 'Toni Pescaru',
      anglerId: 'u-1',
      anglerAvatar: S3,
      standName: '3',
      startDate: '2026-08-15T03:00:00.000Z',
      endDate: '2026-08-15T15:00:00.000Z',
    });
  });

  it('a direct link with no params is still a screen; a bad booking id is not', () => {
    expect(parseRateParams('abc', {}, ORIGINS)).toEqual({
      bookingId: 'abc',
      anglerName: null,
      anglerId: null,
      anglerAvatar: null,
      standName: null,
      startDate: null,
      endDate: null,
    });
    expect(parseRateParams('a b', {}, ORIGINS)).toBeNull();
    expect(parseRateParams('<script>', {}, ORIGINS)).toBeNull();
    expect(parseRateParams('x'.repeat(65), {}, ORIGINS)).toBeNull();
  });

  it('caps text, strips control characters, takes the first of repeated params', () => {
    const p = parseRateParams('b', { anglerName: ['A\u0000na‮', 'Ion'], standName: 'S'.repeat(100) }, ORIGINS)!;
    expect(p.anglerName).toBe('A na');
    expect(p.standName).toHaveLength(40);
    expect(cleanText('x'.repeat(200), 80)).toHaveLength(80);
    expect(cleanText('   ', 80)).toBeNull();
  });

  it('a half or reversed period is no period', () => {
    expect(parseRateParams('b', { startDate: '2026-08-15T03:00:00Z' }, ORIGINS)!.startDate).toBeNull();
    expect(parseRateParams('b', { startDate: '2026-08-16T03:00:00Z', endDate: '2026-08-15T03:00:00Z' }, ORIGINS)!.endDate).toBeNull();
    expect(parseRateParams('b', { startDate: 'mâine', endDate: '2026-08-15T03:00:00Z' }, ORIGINS)!.startDate).toBeNull();
  });
});

describe('cleanAvatar', () => {
  it('keeps the CMS and its S3 buckets only', () => {
    expect(cleanAvatar(S3, ORIGINS)).toBe(S3);
    expect(cleanAvatar('http://localhost:1337/uploads/a.png', ORIGINS)).toBe('http://localhost:1337/uploads/a.png');
    expect(cleanAvatar('https://evil.example/a.png', ORIGINS)).toBeNull();
    expect(cleanAvatar('http://fir-intins-strapi.s3.eu-central-1.amazonaws.com/a.png', ORIGINS)).toBeNull();
    expect(cleanAvatar('javascript:alert(1)', ORIGINS)).toBeNull();
    expect(cleanAvatar('data:image/png;base64,AAAA', ORIGINS)).toBeNull();
    expect(cleanAvatar('https://u:p@fir-intins-strapi.s3.eu-central-1.amazonaws.com/a.png', ORIGINS)).toBeNull();
    expect(cleanAvatar('/uploads/a.png', ORIGINS)).toBeNull();
    expect(cleanAvatar(`${S3}?${'q'.repeat(2100)}`, ORIGINS)).toBeNull();
  });

  it('without a CMS URL only S3 is accepted', () => {
    expect(imageOrigins(undefined)).not.toContain('http://localhost:1337');
    expect(imageOrigins('not a url')).toHaveLength(2);
  });
});

describe('stay card (c3)', () => {
  const start = '2026-08-15T03:00:00.000Z';
  const end = '2026-08-15T15:00:00.000Z';
  it('names the angler, else «pescarul»', () => {
    expect(displayName({ anglerName: 'Toni' })).toBe('Toni');
    expect(displayName({ anglerName: null })).toBe('pescarul');
  });
  it('joins the known parts and hides the line when none is known', () => {
    expect(stayLine({ standName: '3', startDate: start, endDate: end }, 'Europe/Bucharest')).toBe('Standul 3 · Sâmbătă, 15 aug · 06:00–18:00');
    expect(stayLine({ standName: null, startDate: start, endDate: end }, 'Europe/Bucharest')).toBe('Sâmbătă, 15 aug · 06:00–18:00');
    expect(stayLine({ standName: 'A1', startDate: null, endDate: null })).toBe('Standul A1');
    expect(stayLine({ standName: null, startDate: null, endDate: null })).toBe('');
  });
});

describe('the score (c4, c5, c7)', () => {
  it('opens at five', () => expect(DEFAULT_STARS).toBe(5));
  it('says the score in words', () => {
    expect([5, 4, 3, 2, 1].map((s) => verdict(s))).toEqual([
      { label: 'Excelent', tone: 'success' },
      { label: 'Bine', tone: 'success' },
      { label: 'Acceptabil', tone: 'neutral' },
      { label: 'Slab', tone: 'danger' },
      { label: 'Foarte slab', tone: 'danger' },
    ]);
  });
  it('the same score changes nothing; raising to five drops faults and keeps praise', () => {
    const state = { stars: 4, tags: ['clean', 'noisy'] as ReviewTag[] };
    expect(withStars(state, 4)).toBe(state);
    expect(withStars(state, 5)).toEqual({ stars: 5, tags: ['clean'] });
    expect(withStars(state, 2)).toEqual({ stars: 2, tags: ['clean', 'noisy'] });
    expect(withStars(state, 0).stars).toBe(1);
  });
  it('toggles a chip', () => {
    expect(toggleTag([], 'quiet')).toEqual(['quiet']);
    expect(toggleTag(['quiet', 'rude'], 'quiet')).toEqual(['rude']);
  });
});

describe('the comment (c8, c9)', () => {
  it('is required under three stars, whitespace is empty', () => {
    expect(commentRequired(2)).toBe(true);
    expect(commentRequired(3)).toBe(false);
    expect(isValid(2, '   ')).toBe(false);
    expect(isValid(2, 'a')).toBe(true);
    expect(isValid(5, '')).toBe(true);
  });
});

describe('submit (c10, c11)', () => {
  it('trims the comment and omits it when empty', () => {
    expect(reviewInput('b1', 4, '  ok  ', ['clean'])).toEqual({ booking: 'b1', stars: 4, comment: 'ok', tags: ['clean'] });
    expect(reviewInput('b1', 5, '   ', [])).toEqual({ booking: 'b1', stars: 5, tags: [] });
  });
  it('maps refusals by code (bluCode or an old CMS message), else the message, else the line', () => {
    expect(friendlyReviewError({ bluCode: 'ANGLER_DID_NOT_SHOW', message: 'Pescarul nu s-a prezentat…' })).toBe(
      'Pescarul e marcat ca neprezentat — neprezentarea ține deja loc de evaluare.',
    );
    expect(friendlyReviewError({ message: 'ALREADY_REVIEWED' })).toBe('Ai evaluat deja această rezervare.');
    expect(friendlyReviewError({ bluCode: 'INVALID_STATUS' })).toBe('Poți evalua doar după ce se încheie rezervarea.');
    expect(friendlyReviewError({ bluCode: 'COMMENT_REQUIRED' })).toBe('La un punctaj mic, comentariul este obligatoriu.');
    expect(friendlyReviewError({ bluCode: 'INVALID_STARS', message: 'Nota trebuie să fie între 1 și 5.' })).toBe('Nota trebuie să fie între 1 și 5.');
    expect(friendlyReviewError({ message: GENERIC_ERROR_MESSAGE })).toBe(FAILED_MESSAGE);
    expect(friendlyReviewError(undefined)).toBe(FAILED_MESSAGE);
  });
  it('reads the code-less refusals off the status: 403 «Nu ai acces», 404 gone', () => {
    expect(friendlyReviewError({ status: 403, message: GENERIC_ERROR_MESSAGE })).toBe(FORBIDDEN_MESSAGE);
    expect(friendlyReviewError({ status: 404, message: GENERIC_ERROR_MESSAGE })).toBe(GONE_MESSAGE);
    // A code wins over the status (a 400 with a code is the code's sentence).
    expect(friendlyReviewError({ status: 400, bluCode: 'ALREADY_REVIEWED' })).toBe('Ai evaluat deja această rezervare.');
    expect(friendlyReviewError({ status: 500, message: GENERIC_ERROR_MESSAGE })).toBe(FAILED_MESSAGE);
  });
  it('final refusals keep the CTA off; retryable ones do not', () => {
    for (const e of [{ status: 403 }, { status: 404 }, { status: 400, bluCode: 'ALREADY_REVIEWED' }, { status: 400, bluCode: 'ANGLER_DID_NOT_SHOW' }]) {
      expect(isFinalRefusal(e)).toBe(true);
    }
    for (const e of [{ status: 400, bluCode: 'INVALID_STATUS' }, { status: 400, bluCode: 'COMMENT_REQUIRED' }, { status: 500 }, undefined]) {
      expect(isFinalRefusal(e)).toBe(false);
    }
  });
});
