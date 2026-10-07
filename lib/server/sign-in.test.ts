import { describe, expect, it } from 'vitest';
import { isUsableSessionJwt } from './sign-in';

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (payload: unknown) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.c2lnbmF0dXJl`;
const NOW = Date.UTC(2026, 9, 7);
const LATER = NOW / 1000 + 3600;

describe('isUsableSessionJwt (account.sign-in.c12, fish readSessionToken)', () => {
  it('accepts a three-part JWT with a numeric id and a future exp', () => {
    expect(isUsableSessionJwt(jwt({ id: 7, iat: 1, exp: LATER }), NOW)).toBe(true);
  });
  it.each([
    ['not a string', 42],
    ['empty', ''],
    ['two parts', `${b64({ id: 7, exp: LATER })}.sig`],
    ['four parts', `${jwt({ id: 7, exp: LATER })}.x`],
    ['payload not JSON', `${b64({})}.bm90LWpzb24.sig`],
    ['no id', jwt({ exp: LATER })],
    ['string id', jwt({ id: '7', exp: LATER })],
    ['no exp', jwt({ id: 7 })],
    ['expired', jwt({ id: 7, exp: NOW / 1000 - 1 })],
  ])('refuses %s', (_label, value) => {
    expect(isUsableSessionJwt(value, NOW)).toBe(false);
  });
});
