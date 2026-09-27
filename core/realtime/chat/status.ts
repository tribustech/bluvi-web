/**
 * fish `features/chat/hooks/useChatStatus.ts` + `useChatRulesConsent.ts` without React.
 */
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, type Timestamp, type Unsubscribe } from 'firebase/firestore';
import type { ChatAuth, RealtimeContext } from '../firebase';
import type { ChatMeta } from './domain';
import { chatMetaPath, chatRulesConsentPath } from './paths';

/**
 * §3: listens to `competitions/{id}/meta/chat`. Feed the result to `resolveChatClosing` (with the
 * competition's status/endDate fallback) and flip the UI at `closesAt` via `closingTimerDelayMs`.
 * `onMeta` is called with `loaded = true` once the answer is known (doc, no doc, or given up).
 */
export function subscribeChatMeta(
  ctx: RealtimeContext,
  auth: ChatAuth,
  competitionId: string,
  onMeta: (meta: ChatMeta, loaded: boolean) => void
): Unsubscribe {
  let cancelled = false;
  let unsub: Unsubscribe | undefined;
  // The Strapi documentId is known long before the Firebase custom-token sign-in that
  // `meta/chat`'s rules require — subscribing immediately used to permission-deny once and never
  // retry. Wait for Firebase auth first, and if the subscription itself errors out (token expired
  // mid-session, temporary rules hiccup), retry the auth + resubscribe exactly once before giving up.
  const subscribe = (isRetry: boolean) => {
    unsub = onSnapshot(
      doc(ctx.chatDb, chatMetaPath(competitionId)),
      snapshot => {
        const data = snapshot.data() as { closesAt?: Timestamp; reason?: string } | undefined;
        onMeta(data?.closesAt ? { closesAtMs: data.closesAt.toMillis(), reason: data.reason ?? 'completed' } : null, true);
      },
      () => {
        if (cancelled) return;
        if (isRetry) {
          // Already retried once: behave like "no meta doc" so the client gate still applies.
          onMeta(null, true);
          return;
        }
        unsub?.();
        unsub = undefined;
        void auth.ensure().then(ok => {
          if (cancelled) return;
          if (!ok) {
            onMeta(null, true);
            return;
          }
          subscribe(true);
        });
      }
    );
  };

  void auth.ensure().then(ok => {
    if (cancelled) return;
    if (!ok) {
      onMeta(null, true);
      return;
    }
    subscribe(false);
  });

  return () => {
    cancelled = true;
    unsub?.();
  };
}

// ── rules consent (fish useChatRulesConsent) ─────────────────────────────────

/** Accounts that already acknowledged in this app session — no second read when reopening a chat. */
const acknowledged = new Set<string>();

export const RULES_CONSENT_ERROR = 'Nu am putut salva confirmarea. Te rugăm să încerci din nou.';

/**
 * The chat rules sheet is shown once per account, on the first chat the user opens, on any
 * device: the acknowledgement lives in Firestore next to the user's chat preferences. Resolves
 * true only when the doc was read and is missing — unreadable (offline, rules) resolves false: do
 * not block the chat behind a sheet we cannot record.
 */
export async function needsRulesAcknowledgement(ctx: RealtimeContext, auth: ChatAuth, currentUserId: string): Promise<boolean> {
  if (!currentUserId || acknowledged.has(currentUserId)) return false;
  try {
    if (!(await auth.ensure())) return false;
    const snapshot = await getDoc(doc(ctx.chatDb, chatRulesConsentPath(currentUserId)));
    if (snapshot.exists()) {
      acknowledged.add(currentUserId);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Records the acknowledgement. Rejects on failure (the UI shows `RULES_CONSENT_ERROR`). */
export async function acknowledgeRules(ctx: RealtimeContext, currentUserId: string): Promise<void> {
  await setDoc(doc(ctx.chatDb, chatRulesConsentPath(currentUserId)), { acceptedAt: serverTimestamp() });
  acknowledged.add(currentUserId);
}

/** Whether this account acknowledged in this session (sync read for the UI's derived flag). */
export function hasAcknowledgedRules(currentUserId: string): boolean {
  return acknowledged.has(currentUserId);
}
