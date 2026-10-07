import { describe, expect, it } from 'vitest';
import { GENERIC_ERROR, LOCAL_ERROR, MISSING_EMAIL_ERROR, messageFor, RATE_LIMIT_ERROR, safeNext, SERVER_ERROR, visibleProviders } from './logic';

describe('visibleProviders (account.sign-in.c2 c3)', () => {
  it('orders Apple, Google, Facebook', () => {
    expect(visibleProviders({ appleServicesId: 'a', googleClientId: 'g', facebookAppId: 'f', localAuth: false })).toEqual([
      'apple',
      'google',
      'facebook',
    ]);
  });
  it('leaves Apple out (absent, not disabled) without a Services ID', () => {
    expect(visibleProviders({ googleClientId: 'g', facebookAppId: 'f', localAuth: false })).toEqual(['google', 'facebook']);
    expect(visibleProviders({ appleServicesId: '', googleClientId: 'g', facebookAppId: 'f', localAuth: true })).toEqual(['google', 'facebook']);
  });
});

describe('safeNext (account.sign-in.c17, account.b.sign-in-redirect)', () => {
  it.each(['/', '/balti/abc', '/concursuri/x/clasament?tab=1', '/pescari/1#capturi', '/intrare'])('keeps %s', (p) => {
    expect(safeNext(p)).toBe(p);
  });
  it.each([
    null,
    '',
    'balti',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/balti\\x',
    '/balti x',
    '/balti\tx',
    '/balti\nx',
    '/intra',
    '/intra?next=%2F',
    '/intra/',
  ])('refuses %s', (p) => {
    expect(safeNext(p)).toBeNull();
  });
});

describe('messageFor (account.sign-in.c7 c8 c11)', () => {
  it('recognises AUTH:EMAIL_REQUIRED', () => {
    expect(messageFor('facebook', 400, { error: { name: 'ApplicationError', details: { bluCode: 'AUTH:EMAIL_REQUIRED' } } })).toBe(MISSING_EMAIL_ERROR);
  });
  it('any other bluCode or unknown failure is generic', () => {
    expect(messageFor('google', 400, { error: { name: 'ApplicationError', message: 'Bad', details: { bluCode: 'AUTH:X' } } })).toBe(GENERIC_ERROR);
    expect(messageFor('google', 502, { error: { details: { bluCode: 'WEB:INVALID_SESSION' } } })).toBe(GENERIC_ERROR);
    expect(messageFor('google', 401, null)).toBe(GENERIC_ERROR);
    expect(messageFor('google', 500, null)).toBe(GENERIC_ERROR);
  });
  it("our route's own Romanian 400s are generic too (fish GENERIC_ERROR)", () => {
    expect(messageFor('google', 400, { error: { status: 400, message: 'Codul de autorizare Google nu este valid.' } })).toBe(GENERIC_ERROR);
    expect(messageFor('facebook', 400, { error: { status: 400, message: 'Tokenul Facebook nu este valid.' } })).toBe(GENERIC_ERROR);
    expect(messageFor('google', 400, { error: { message: 'Google nu a întors tokenurile așteptate.' } })).toBe(GENERIC_ERROR);
  });
  it('web-only copies: CMS unreachable, rate limit, QA wrong password', () => {
    expect(messageFor('google', 503, null)).toBe(SERVER_ERROR);
    expect(messageFor('google', 429, null)).toBe(RATE_LIMIT_ERROR);
    expect(messageFor('local', 400, { error: { name: 'ValidationError', message: 'Invalid identifier or password' } })).toBe(LOCAL_ERROR);
  });
});
