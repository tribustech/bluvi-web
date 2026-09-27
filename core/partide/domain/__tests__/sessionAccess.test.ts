import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../transport';
import {
  accessConfirmationFromError,
  bluCodeOf,
  decorateLeaveError,
  isAmbiguousLeaveError,
  isRevoked,
} from '../sessionAccess';

const http = (status: number, bluCode?: string) =>
  new ApiError({ message: 'x', status, code: 'HTTP', bluCode });

describe('sessionAccess', () => {
  it('requires the CMS bluCode for a revoked verdict — a bare 403/404 stays unknown', () => {
    expect(accessConfirmationFromError(http(403, 'PARTIDA:NOT_MEMBER'))).toBe('kicked');
    expect(accessConfirmationFromError(http(404, 'PARTIDA:NOT_FOUND'))).toBe('deleted');
    expect(accessConfirmationFromError(http(403))).toBe('unknown');
    expect(accessConfirmationFromError(http(404))).toBe('unknown');
    expect(accessConfirmationFromError(new Error('boom'))).toBe('unknown');
    expect(isRevoked('kicked')).toBe(true);
    expect(isRevoked('deleted')).toBe(true);
    expect(isRevoked('valid')).toBe(false);
    expect(isRevoked('unknown')).toBe(false);
  });

  it('reads nested legacy bluCode shapes', () => {
    expect(bluCodeOf({ response: { data: { error: { details: { bluCode: 'PARTIDA:NOT_MEMBER' } } } } })).toBe('PARTIDA:NOT_MEMBER');
    expect(bluCodeOf(null)).toBeUndefined();
  });

  it('treats network and 5xx leave failures as ambiguous, 4xx as definite', () => {
    expect(isAmbiguousLeaveError(new ApiError({ message: 'x', status: 0, code: 'NETWORK' }))).toBe(true);
    expect(isAmbiguousLeaveError(http(502))).toBe(true);
    expect(isAmbiguousLeaveError(http(403))).toBe(false);
    expect(isAmbiguousLeaveError(new Error('PARTIDA_ACTIVE_POINTER_MISSING'))).toBe(false);
    expect(isAmbiguousLeaveError({ code: 'ETIMEDOUT' })).toBe(true);
  });

  it('decorates a leave error as retryable, keeping the ApiError fields', () => {
    expect(decorateLeaveError(http(502, 'X'), 'unknown')).toEqual({
      message: 'x',
      status: 502,
      bluCode: 'X',
      code: 'HTTP',
      retryable: true,
      accessConfirmation: 'unknown',
    });
  });
});
