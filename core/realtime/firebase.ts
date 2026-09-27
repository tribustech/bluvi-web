import type { FirebaseApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signOut, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Everything `core/realtime` needs from Firebase, handed in by the app. Core never initializes a
 * Firebase app and never reads env: the web creates the app (browser only) and passes it here.
 *
 * Two Firestore handles, on purpose (fish `features/chat/domain/chatPaths.ts`):
 * - `db`     — the `(default)` database: Partide `sessions/{id}` (shared by EVERY environment,
 *              live in production — see docs/domain/lakes-and-social.md §6).
 * - `chatDb` — the environment's chat database: `(default)` in production, a database named
 *              after the environment otherwise. Chat reads/writes only ever go through this one.
 */
export type RealtimeContext = {
  db: Firestore;
  chatDb: Firestore;
  auth: Auth;
};

export type AppEnv = 'local' | 'staging' | 'production';

const KNOWN_ENVS: AppEnv[] = ['local', 'staging', 'production'];

/** fish `analytics/appEnv.ts#resolveAppEnv`: anything unrecognised is `local` — never accidentally production. */
export function resolveAppEnv(rawEnv: string | undefined | null): AppEnv {
  return KNOWN_ENVS.includes(rawEnv as AppEnv) ? (rawEnv as AppEnv) : 'local';
}

/**
 * ONE Firebase project serves local, staging and production, and staging's DB is a prod
 * dump (same competition documentIds). Competition chat therefore lives in a Firestore
 * database NAMED AFTER THE ENVIRONMENT: production uses `(default)`, staging uses the
 * `staging` database, local uses `local`. Same paths, same rules, physically separate
 * data — nothing to filter. The CMS mirrors this from NODE_ENV
 * (src/services/firebase-chat.ts). Partide sessions and consents keep
 * using the default database and are NOT affected.
 *
 * fish `CHAT_DATABASE_ID` — `undefined` means the default database.
 */
export function chatDatabaseId(env: string | undefined | null): string | undefined {
  const appEnv = resolveAppEnv(env);
  return appEnv === 'production' ? undefined : appEnv;
}

/**
 * Builds the context from an app the caller already initialized. `env` is the web's own
 * environment name (passed in, never read here); unknown values resolve to `local`, so a
 * misconfigured build can never write chat into the production database.
 */
export function createRealtimeContext(app: FirebaseApp, env: string | undefined | null): RealtimeContext {
  const chatDbId = chatDatabaseId(env);
  return {
    db: getFirestore(app),
    chatDb: chatDbId ? getFirestore(app, chatDbId) : getFirestore(app),
    auth: getAuth(app),
  };
}

/** Optional error sink (fish reported these to Sentry). */
export type ErrorReporter = (error: unknown) => void;

/** Mints a Firebase custom token for the signed-in Bluvi user (web: `/api/firebase-token`). */
export type GetCustomToken = () => Promise<string | null | undefined>;

/**
 * fish `useChatAuth#isFirestoreAuthError`. RN-firebase prefixes codes (`firestore/permission-denied`),
 * the JS SDK does not (`permission-denied`); both shapes are accepted.
 */
export const isFirestoreAuthError = (error: unknown) =>
  ['firestore/permission-denied', 'firestore/unauthenticated', 'permission-denied', 'unauthenticated'].includes(
    (error as { code?: unknown } | null)?.code as string
  );

/**
 * fish `firebase/firebaseAuth.ts#signInToFirebase`.
 * Sign into Firebase Auth with a CMS-minted custom token (uid = Strapi documentId).
 * Non-fatal on failure — Firestore simply stays unauthenticated and the rest of the
 * app keeps working; co-op live sessions just won't connect until a later re-mint.
 */
export async function signInToFirebase(
  ctx: Pick<RealtimeContext, 'auth'>,
  customToken: string | null | undefined,
  report?: ErrorReporter
): Promise<void> {
  if (!customToken) return;
  try {
    await signInWithCustomToken(ctx.auth, customToken);
  } catch (err) {
    report?.(err);
  }
}

/** fish `firebase/firebaseAuth.ts#signOutOfFirebase`. Non-fatal — bundled into the app-wide sign-out teardown. */
export async function signOutOfFirebase(ctx: Pick<RealtimeContext, 'auth'>, report?: ErrorReporter): Promise<void> {
  // Signing out when nobody is signed in is a no-op, not a failure — and it is
  // the COMMON case in the app-wide teardown, because the Firebase bridge is
  // best-effort: `signInToFirebase` swallows its own errors, so any session that
  // never got a custom token minted reaches sign-out with no Firebase user.
  // Calling through anyway threw `[auth/no-current-user]` and reported it, which
  // is BLUVI-MOBILE-K8 in production. Reproduced on device 2026-08-10.
  if (!ctx.auth.currentUser) return;
  try {
    await signOut(ctx.auth);
  } catch (err) {
    report?.(err);
  }
}

/** fish `firebase/firebaseAuth.ts#currentFirebaseUid`: the current Firebase uid (= Strapi documentId), or null. */
export function currentFirebaseUid(ctx: Pick<RealtimeContext, 'auth'>): string | null {
  return ctx.auth.currentUser?.uid ?? null;
}

/**
 * On the web `auth.currentUser` is null until the persisted session has been restored from
 * IndexedDB; asking before that would re-mint a token for a user who is in fact signed in.
 * (RN-firebase restores synchronously enough that fish never needed this.) Tolerates auth
 * objects without `authStateReady` (test fakes, older SDKs).
 */
export async function waitForAuthReady(auth: Auth): Promise<void> {
  const ready = (auth as Partial<Pick<Auth, 'authStateReady'>>).authStateReady;
  if (typeof ready === 'function') await ready.call(auth);
}

/** fish `useChatAuth#refreshFirebaseAuth`: re-mint the custom token and sign in with it. */
export async function refreshFirebaseAuth(
  ctx: Pick<RealtimeContext, 'auth'>,
  getCustomToken: GetCustomToken,
  report?: ErrorReporter
): Promise<void> {
  const token = await getCustomToken();
  if (!token) throw new Error('Firebase token re-mint returned no token.');
  await signInToFirebase(ctx, token, report);
}

/**
 * fish `useChatAuth#ensureChatFirebaseAuth`. Auth for Firestore reads/writes: mints a Firebase
 * custom token via the shared bridge (uid = documentId) when the signed-in Firebase user is not
 * this profile. Moderation rights come from the Firestore organizers mirror, so there is no
 * claim to keep fresh. Resolves true when Firebase is signed in as `profileDocumentId`.
 */
export async function ensureSignedIn(
  ctx: Pick<RealtimeContext, 'auth'>,
  profileDocumentId: string | null | undefined,
  getCustomToken: GetCustomToken,
  report?: ErrorReporter
): Promise<boolean> {
  if (!profileDocumentId) return false;
  await waitForAuthReady(ctx.auth);
  if (ctx.auth.currentUser?.uid !== profileDocumentId) {
    await refreshFirebaseAuth(ctx, getCustomToken, report);
  }
  return ctx.auth.currentUser?.uid === profileDocumentId;
}

/**
 * fish `useChatAuth#withChatAuthRetry`: runs `op`; on permission-denied / unauthenticated
 * re-mints the token and retries once.
 */
export async function withAuthRetry<T>(
  ctx: Pick<RealtimeContext, 'auth'>,
  getCustomToken: GetCustomToken,
  op: () => Promise<T>,
  report?: ErrorReporter
): Promise<T> {
  try {
    return await op();
  } catch (error) {
    if (!isFirestoreAuthError(error)) throw error;
    try {
      await refreshFirebaseAuth(ctx, getCustomToken, report);
    } catch {
      throw error;
    }
    return await op();
  }
}

/** The pair every chat function receives: fish's `ensureChatFirebaseAuth` + `withChatAuthRetry`, bound. */
export type ChatAuth = {
  ensure: () => Promise<boolean>;
  withRetry: <T>(op: () => Promise<T>) => Promise<T>;
};

/** fish `useChatAuth(profileDocumentId)` as a plain factory. */
export function createChatAuth(
  ctx: Pick<RealtimeContext, 'auth'>,
  profileDocumentId: string | null | undefined,
  getCustomToken: GetCustomToken,
  report?: ErrorReporter
): ChatAuth {
  return {
    ensure: () => ensureSignedIn(ctx, profileDocumentId, getCustomToken, report),
    withRetry: op => withAuthRetry(ctx, getCustomToken, op, report),
  };
}
