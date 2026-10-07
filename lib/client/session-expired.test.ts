import { describe, expect, it, vi } from 'vitest';
import {
  announceSessionExpired,
  claimSessionDead,
  onSessionExpired,
  rearmSessionGuard,
  SESSION_EXPIRED_MESSAGE,
  SESSION_GUARD_MS,
} from './session-expired';

describe('session-expired guard (global.b.session-expired)', () => {
  it('lets the first dead session of a burst through, swallows the rest for 60 s', () => {
    rearmSessionGuard();
    expect(claimSessionDead(1_000)).toBe(true);
    expect(claimSessionDead(1_001)).toBe(false);
    expect(claimSessionDead(1_000 + SESSION_GUARD_MS - 1)).toBe(false);
    expect(claimSessionDead(1_000 + SESSION_GUARD_MS)).toBe(true);
  });

  it('a successful sign-in re-arms it at once', () => {
    rearmSessionGuard();
    expect(claimSessionDead(5_000)).toBe(true);
    rearmSessionGuard();
    expect(claimSessionDead(5_001)).toBe(true);
  });

  it('delivers the toast to the host, also when it was announced before the host mounted', () => {
    announceSessionExpired();
    const show = vi.fn();
    const off = onSessionExpired(show);
    expect(show).toHaveBeenCalledWith(SESSION_EXPIRED_MESSAGE);
    announceSessionExpired();
    expect(show).toHaveBeenCalledTimes(2);
    off();
    announceSessionExpired();
    expect(show).toHaveBeenCalledTimes(2);
    // Drain the mailbox for the next test.
    onSessionExpired(() => undefined)();
  });
});
