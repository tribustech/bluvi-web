import { beforeEach, describe, expect, it, vi } from 'vitest';

// Never a real Firebase app: every SDK entry point the module touches is a fake.
const sdk = vi.hoisted(() => ({
  signInWithCustomToken: vi.fn(),
  signOut: vi.fn(),
  getAuth: vi.fn((app: unknown) => ({ app, currentUser: null })),
  getFirestore: vi.fn((_app: unknown, databaseId?: string) => ({ databaseId: databaseId ?? '(default)' })),
}));
vi.mock('firebase/auth', () => ({
  getAuth: sdk.getAuth,
  signInWithCustomToken: sdk.signInWithCustomToken,
  signOut: sdk.signOut,
}));
vi.mock('firebase/firestore', () => ({ getFirestore: sdk.getFirestore }));

import {
  chatDatabaseId,
  createChatAuth,
  createRealtimeContext,
  currentFirebaseUid,
  ensureSignedIn,
  resolveAppEnv,
  signInToFirebase,
  signOutOfFirebase,
  withAuthRetry,
} from './firebase';

type FakeAuth = { currentUser: { uid: string } | null; authStateReady?: () => Promise<void> };
const ctxOf = (auth: FakeAuth) => ({ auth }) as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('environment scoping (one Firebase project for every env)', () => {
  it('production keeps the default database', () => {
    expect(chatDatabaseId('production')).toBeUndefined();
    const ctx = createRealtimeContext({ name: '[DEFAULT]' } as never, 'production');
    expect(ctx.chatDb).toEqual({ databaseId: '(default)' });
  });

  it('staging uses the `staging` database; Partide always uses (default)', () => {
    expect(chatDatabaseId('staging')).toBe('staging');
    const ctx = createRealtimeContext({ name: '[DEFAULT]' } as never, 'staging');
    expect(ctx.chatDb).toEqual({ databaseId: 'staging' });
    expect(ctx.db).toEqual({ databaseId: '(default)' });
  });

  it('anything unknown is local, never production', () => {
    expect(resolveAppEnv(undefined)).toBe('local');
    expect(resolveAppEnv('prod')).toBe('local');
    expect(chatDatabaseId(undefined)).toBe('local');
  });
});

describe('firebaseAuth', () => {
  it('signs in with the custom token', async () => {
    sdk.signInWithCustomToken.mockResolvedValue({});
    const auth = { currentUser: null };
    await signInToFirebase(ctxOf(auth), 'tok123');
    expect(sdk.signInWithCustomToken).toHaveBeenCalledWith(auth, 'tok123');
  });

  it('no-ops when the token is missing (null/undefined/empty)', async () => {
    await signInToFirebase(ctxOf({ currentUser: null }), null);
    await signInToFirebase(ctxOf({ currentUser: null }), undefined);
    await signInToFirebase(ctxOf({ currentUser: null }), '');
    expect(sdk.signInWithCustomToken).not.toHaveBeenCalled();
  });

  it('swallows sign-in errors (non-fatal) and reports them', async () => {
    const report = vi.fn();
    sdk.signInWithCustomToken.mockRejectedValue(new Error('boom'));
    await expect(signInToFirebase(ctxOf({ currentUser: null }), 'tok', report)).resolves.toBeUndefined();
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('signs out, swallowing errors', async () => {
    const auth = { currentUser: { uid: 'doc-abc' } };
    sdk.signOut.mockResolvedValue(undefined);
    await expect(signOutOfFirebase(ctxOf(auth))).resolves.toBeUndefined();
    expect(sdk.signOut).toHaveBeenCalled();

    sdk.signOut.mockRejectedValue(new Error('x'));
    await expect(signOutOfFirebase(ctxOf(auth))).resolves.toBeUndefined();
  });

  it('does not call signOut when nobody is signed in', async () => {
    // The Firebase bridge is best-effort, so reaching the app-wide sign-out with
    // no Firebase user is normal. Calling through threw [auth/no-current-user]
    // and reported it to Sentry — that is BLUVI-MOBILE-K8.
    await expect(signOutOfFirebase(ctxOf({ currentUser: null }))).resolves.toBeUndefined();
    expect(sdk.signOut).not.toHaveBeenCalled();
  });

  it('returns the current firebase uid, or null', () => {
    expect(currentFirebaseUid(ctxOf({ currentUser: { uid: 'doc-abc' } }))).toBe('doc-abc');
    expect(currentFirebaseUid(ctxOf({ currentUser: null }))).toBeNull();
  });
});

describe('ensureSignedIn (fish useChatAuth#ensureChatFirebaseAuth)', () => {
  it('returns false without a profile', async () => {
    const getToken = vi.fn();
    await expect(ensureSignedIn(ctxOf({ currentUser: null }), undefined, getToken)).resolves.toBe(false);
    expect(getToken).not.toHaveBeenCalled();
  });

  it('re-mints when the Firebase uid differs from the profile documentId', async () => {
    const auth: FakeAuth = { currentUser: null };
    sdk.signInWithCustomToken.mockImplementation(async () => {
      auth.currentUser = { uid: 'doc-1' };
    });
    const getToken = vi.fn().mockResolvedValue('custom-token');
    await expect(ensureSignedIn(ctxOf(auth), 'doc-1', getToken)).resolves.toBe(true);
    expect(getToken).toHaveBeenCalledTimes(1);
  });

  it('does nothing when already signed in as the profile', async () => {
    const getToken = vi.fn();
    await expect(ensureSignedIn(ctxOf({ currentUser: { uid: 'doc-1' } }), 'doc-1', getToken)).resolves.toBe(true);
    expect(getToken).not.toHaveBeenCalled();
  });

  it('waits for the persisted web session before deciding to re-mint', async () => {
    const auth: FakeAuth = { currentUser: null };
    auth.authStateReady = async () => {
      auth.currentUser = { uid: 'doc-1' };
    };
    const getToken = vi.fn();
    await expect(ensureSignedIn(ctxOf(auth), 'doc-1', getToken)).resolves.toBe(true);
    expect(getToken).not.toHaveBeenCalled();
  });

  it('rejects when the re-mint returns no token', async () => {
    await expect(ensureSignedIn(ctxOf({ currentUser: null }), 'doc-1', async () => null)).rejects.toThrow(/no token/);
  });
});

describe('withAuthRetry (fish useChatAuth#withChatAuthRetry)', () => {
  const signedIn = () => ctxOf({ currentUser: { uid: 'doc-1' } });

  it('re-mints and retries once on permission-denied', async () => {
    const getToken = vi.fn().mockResolvedValue('custom-token');
    const op = vi.fn().mockRejectedValueOnce({ code: 'permission-denied' }).mockResolvedValueOnce('ok');
    await expect(withAuthRetry(signedIn(), getToken, op)).resolves.toBe('ok');
    expect(op).toHaveBeenCalledTimes(2);
    expect(getToken).toHaveBeenCalledTimes(1);
  });

  it('accepts the RN-firebase prefixed code too', async () => {
    const getToken = vi.fn().mockResolvedValue('custom-token');
    const op = vi.fn().mockRejectedValueOnce({ code: 'firestore/unauthenticated' }).mockResolvedValueOnce('ok');
    await expect(withAuthRetry(signedIn(), getToken, op)).resolves.toBe('ok');
  });

  it('rethrows non-auth errors without re-minting', async () => {
    const getToken = vi.fn();
    const op = vi.fn().mockRejectedValue(new Error('network'));
    await expect(withAuthRetry(signedIn(), getToken, op)).rejects.toThrow('network');
    expect(op).toHaveBeenCalledTimes(1);
    expect(getToken).not.toHaveBeenCalled();
  });

  it('gives up after the second auth failure', async () => {
    const getToken = vi.fn().mockResolvedValue('custom-token');
    const op = vi.fn().mockRejectedValue({ code: 'permission-denied' });
    await expect(withAuthRetry(signedIn(), getToken, op)).rejects.toEqual({ code: 'permission-denied' });
    expect(op).toHaveBeenCalledTimes(2);
  });

  it('rethrows the ORIGINAL error when the re-mint itself fails', async () => {
    const op = vi.fn().mockRejectedValue({ code: 'permission-denied' });
    await expect(withAuthRetry(signedIn(), async () => null, op)).rejects.toEqual({ code: 'permission-denied' });
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('createChatAuth binds both helpers', async () => {
    const chatAuth = createChatAuth(signedIn(), 'doc-1', vi.fn());
    await expect(chatAuth.ensure()).resolves.toBe(true);
    await expect(chatAuth.withRetry(async () => 7)).resolves.toBe(7);
  });
});
