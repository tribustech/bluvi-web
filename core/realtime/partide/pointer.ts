/**
 * fish `features/partide/domain/firestore/activeSessionPointer.ts` + `sessionDocumentIds.ts`.
 *
 * The active-session pointer — a persisted record of the two ids the app needs to re-subscribe
 * AND finish a live session after a restart:
 *  - `sessionId` === firestoreId === clientId (the Firestore `sessions/{id}` doc)
 *  - `documentId` — the Strapi documentId (the finish HTTP route; absent from the
 *    Firestore doc).
 * The session DATA is never persisted; it is re-fetched live from Firestore.
 * Persistence is injected (fish: AsyncStorage; web: localStorage/IndexedDB); the value is the
 * same JSON string fish writes.
 */
import type { KeyValueStorage } from '../storage';

export const ACTIVE_SESSION_KEY = '@bluvi/partide/activeSessionId';

export interface ActiveSession {
  sessionId: string; // === firestoreId === clientId (Firestore doc + subscribe)
  documentId: string; // Strapi documentId (finish route)
}

export async function setActiveSession(storage: KeyValueStorage, active: ActiveSession): Promise<void> {
  await storage.set(ACTIVE_SESSION_KEY, JSON.stringify(active));
}

export async function getActiveSession(storage: KeyValueStorage): Promise<ActiveSession | null> {
  const raw = await storage.get(ACTIVE_SESSION_KEY);
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ActiveSession>;
    if (typeof parsed?.sessionId === 'string' && typeof parsed?.documentId === 'string') {
      return { sessionId: parsed.sessionId, documentId: parsed.documentId };
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearActiveSession(storage: KeyValueStorage): Promise<void> {
  await storage.remove(ACTIVE_SESSION_KEY);
}

// ── sessionDocumentIds.ts ────────────────────────────────────────────────────

/**
 * Session clientId → Strapi documentId, for sessions this device did NOT
 * create or join itself.
 *
 * The active-session pointer is written only by `createSession` / `joinSession`, so it answers
 * "which documentId do I write to?" for exactly one session on exactly the device that started
 * it. Every other case — the same account on a second device, a cleared storage, a
 * sign-out/in — leaves a device that can READ a live partidă (the detail route carries its
 * documentId) but had no way to resolve that id when writing, so every catch failed with
 * "Nu am putut salva captura".
 *
 * This registry closes that gap: whatever screen already knows a session's
 * documentId records it here, and the repo's write paths fall back to it.
 * Deliberately in-memory — it is a cache of something the server re-supplies on
 * every list/detail fetch, not a second source of truth to keep in sync with
 * the persisted pointer. (Module state: browser-only, like everything in core/realtime.)
 */
const known = new Map<string, string>();

/** Record a mapping the app just learned (list row, detail fetch). Idempotent. */
export function rememberSessionDocumentId(sessionClientId: string, documentId: string): void {
  if (!sessionClientId || !documentId) return;
  known.set(sessionClientId, documentId);
}

/** The documentId for a session clientId, or null if this device never saw it. */
export function knownSessionDocumentId(sessionClientId: string): string | null {
  return known.get(sessionClientId) ?? null;
}

/** Sign-out: the next account must not inherit the previous one's mappings. */
export function forgetSessionDocumentIds(): void {
  known.clear();
}
