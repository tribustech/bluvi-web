/**
 * fish `features/chat/outbox/worker.ts` as a factory: one worker per app instance instead of a
 * module singleton, with its platform pieces injected (storage, uploader, connectivity, token).
 *
 * Drains the outbox (spec §4 Worker): one message at a time, its photos one after another, then
 * the Firestore write; on success the rows go. Failures back off 2 s / 8 s / 30 s and then stop
 * with `failed` (the bubble offers Reîncearcă / Șterge). `run()` from anywhere is a cheap kick; a
 * run in progress just loops once more.
 */
import { doc, getDoc, serverTimestamp, setDoc, type DocumentReference } from 'firebase/firestore';
import {
  isFirestoreAuthError,
  signInToFirebase,
  waitForAuthReady,
  type ErrorReporter,
  type GetCustomToken,
  type RealtimeContext,
} from '../../firebase';
import { shouldRetryWithoutRole, withoutSenderRole } from '../domain';
import { chatMessagePath, chatMetaPath } from '../paths';
import { toUploadedChatAttachment, type UploadedFile } from '../transforms';
import type { ChatListMessage, ChatMessageWrite, ChatReplyTo, ChatSenderRole } from '../types';
import { afterFailure, afterOfflineFailure, isRunnable, nextWakeMs, outboxRoomMessages } from './state';
import { createOutboxRepo, type OutboxStorage } from './storage';
import type { OutboxEntry } from './types';
import { UploadError, type OutboxUploader } from './uploader';

const CLOSED_MESSAGE = 'Chat-ul s-a închis.';
/** While offline with work waiting, re-check connectivity this often, at most this many times in a row. */
export const OFFLINE_RECHECK_MS = 5000;
export const OFFLINE_RECHECK_LIMIT = 36; // 3 minutes; the next online/foreground event resets it

class FatalOutboxError extends Error {}

export type OutboxWorkerDeps = {
  ctx: RealtimeContext;
  storage: OutboxStorage;
  uploader: OutboxUploader;
  getCustomToken: GetCustomToken;
  /**
   * Connectivity check (fish: NetInfo). Throwing is treated as "online" — we'd rather attempt the
   * send (and let the normal failure/backoff path handle a real network error) than silently
   * strand rows in `queued` because the connectivity check itself broke. Omitted = always online.
   */
  isOffline?: () => boolean | Promise<boolean>;
  /** CMS API URL whose origin prefixes relative upload URLs (fish `EXPO_PUBLIC_API_URL`). */
  apiBase?: string;
  report?: ErrorReporter;
  now?: () => number;
  /**
   * fish `removeOutboxDir` / `removeAllOutboxDirs`: called once a row is gone (delivered, discarded)
   * so the app can free what it holds for it (web: revoke object URLs). `null` = every row.
   */
  releaseFiles?: (messageId: string | null) => void;
};

export type OutboxWorker = ReturnType<typeof createOutboxWorker>;

export function createOutboxWorker(deps: OutboxWorkerDeps) {
  const { ctx, uploader, getCustomToken, apiBase = '', report, releaseFiles } = deps;
  const now = deps.now ?? Date.now;
  const repo = createOutboxRepo(deps.storage);
  const listeners = new Set<() => void>();
  let running = false;
  let runAgain = false;
  let wakeTimer: ReturnType<typeof setTimeout> | null = null;
  let offlineRechecks = 0;
  let lastRun: Promise<void> = Promise.resolve();

  function notify() {
    listeners.forEach(listener => listener());
  }

  async function isOffline(): Promise<boolean> {
    if (!deps.isOffline) return false;
    try {
      return await deps.isOffline();
    } catch {
      return false;
    }
  }

  /** External kick: a fresh reason to try (enqueue, tab focus, network back online, a manual
   * retry). Resets the offline re-check budget — see I2 — so a burst of these after 3 minutes
   * offline doesn't stay silent just because the internal timer chain already spent it. */
  function run(): void {
    offlineRechecks = 0;
    runInternal();
  }

  /** Continuation of an already-armed wait (the backoff wake timer and the offline re-check timer
   * in `drain()`): must NOT reset `offlineRechecks`, or the budget it's enforcing would never run out. */
  function runInternal(): void {
    if (running) {
      runAgain = true;
      return;
    }
    running = true;
    lastRun = drain()
      .catch(error => report?.(error))
      .finally(() => {
        running = false;
        if (runAgain) {
          runAgain = false;
          runInternal();
        }
      });
  }

  async function drain(): Promise<void> {
    if (wakeTimer) {
      clearTimeout(wakeTimer);
      wakeTimer = null;
    }
    const entries = await repo.listAll();
    const nowMs = now();
    // Offline: don't touch any row. The app's online-event listener is the primary wake, but a
    // connectivity flag can flip before reachability settles, so that wake can land while we
    // still read as offline — re-check on a short timer while something is waiting.
    if (await isOffline()) {
      const waiting = entries.some(entry => isRunnable(entry.message, nowMs));
      if (waiting && offlineRechecks < OFFLINE_RECHECK_LIMIT) {
        offlineRechecks += 1;
        wakeTimer = setTimeout(runInternal, OFFLINE_RECHECK_MS);
      }
      return;
    }
    offlineRechecks = 0;
    for (const entry of entries) {
      if (!isRunnable(entry.message, nowMs)) continue;
      await processEntry(entry);
    }
    const wake = nextWakeMs((await repo.listAll()).map(e => e.message), now());
    if (wake !== null) wakeTimer = setTimeout(runInternal, wake + 50);
  }

  async function docAlreadyDelivered(ref: DocumentReference): Promise<boolean> {
    try {
      return (await getDoc(ref)).exists();
    } catch {
      return false;
    }
  }

  /** Signs in as `senderId` if needed and confirms the resulting Firebase uid is actually theirs —
   * see C1: a stale queued row must never be sent (or its files uploaded) under whoever is signed
   * in now. A mismatch is fatal, not retryable: no re-mint will ever make auth report a
   * different account than the one the app is currently signed into. */
  async function ensureFirebaseUser(senderId: string): Promise<string> {
    await waitForAuthReady(ctx.auth);
    if (ctx.auth.currentUser?.uid !== senderId) {
      await signInToFirebase(ctx, await getCustomToken(), report);
    }
    const uid = ctx.auth.currentUser?.uid;
    if (!uid) throw new Error('Nu am putut autentifica chat-ul.');
    if (uid !== senderId) throw new FatalOutboxError('Mesajul aparține altui cont.');
    return uid;
  }

  /** The meta doc is gated `allow read: if signedIn()` by the security rules, so this can only be
   * called after `ensureFirebaseUser` has run. On a genuine read failure (transient error, a token
   * not fully propagated yet) we don't know whether the chat is closed — treat it as open and let
   * the write proceed; a chat that really is closed is still enforced by the rules at write time,
   * and that rejection follows the normal retry/backoff ladder instead of being misreported here. */
  async function isChatClosed(competitionId: string): Promise<boolean> {
    try {
      const snap = await getDoc(doc(ctx.chatDb, chatMetaPath(competitionId)));
      const closesAt = (snap.data() as { closesAt?: { toMillis: () => number } } | undefined)?.closesAt;
      return !!closesAt && closesAt.toMillis() <= now();
    } catch {
      return false;
    }
  }

  async function processEntry(entry: OutboxEntry): Promise<void> {
    const { message } = entry;
    // Captured before any status update below: true only when THIS row was already at `writing`
    // when loaded — i.e. a previous run got as far as the Firestore write and was killed before it
    // could record that (see I3). Not true for a row this same pass is writing for the first time.
    const wasWriting = message.status === 'writing';
    // Checked again here (not just in `drain`): connectivity can drop between the drain-wide check
    // and this row's turn, or between rows in the same pass. Before ANY network — including
    // Firebase auth — so a row that never had a chance to send is left exactly as is: no attempt
    // burned, no error surfaced.
    if (await isOffline()) return;
    try {
      // Auth first: `isChatClosed`'s meta read (and the eventual Firestore write) both require a
      // signed-in Firebase user, and the app drains the outbox at shell mount — before any chat
      // screen has run its sign-in and before the persisted auth session is restored.
      const uid = await ensureFirebaseUser(message.senderId);
      if (await isChatClosed(message.competitionId)) throw new FatalOutboxError(CLOSED_MESSAGE);

      await repo.updateMessage(message.id, { status: 'uploading' });
      notify();
      const uploaded: UploadedFile[] = [];
      for (const attachment of entry.attachments.slice().sort((a, b) => a.position - b.position)) {
        if (attachment.uploaded) {
          uploaded.push(JSON.parse(attachment.uploaded) as UploadedFile);
          continue;
        }
        const file = await uploader(attachment);
        await repo.setAttachmentUploaded(attachment.id, JSON.stringify(file));
        uploaded.push(file);
      }

      await repo.updateMessage(message.id, { status: 'writing' });
      notify();
      const ref = doc(ctx.chatDb, chatMessagePath(message.competitionId, message.roomId, message.id));
      // Resuming a row that was already `writing`: the previous attempt may have been killed AFTER
      // the server acked the write but BEFORE the row could be deleted. `setDoc` would replace the
      // doc — a fresh `createdAt`, and any edit/delete/reaction recorded since silently discarded
      // (I3). The doc id is stable, so an existence check settles it: if it's there, the earlier
      // attempt delivered — finish cleanup and stop, never re-date a message that already sent.
      // Any earlier attempt could have reached the server (a kill after the ack demotes the row to
      // `queued`/`failed` on the next pass, not just `writing`), so the check runs for every row
      // that is not on its very first try; a failed read never blocks the write.
      if ((wasWriting || message.attempts > 0) && (await docAlreadyDelivered(ref))) {
        await repo.delete(message.id);
        releaseFiles?.(message.id);
        return;
      }
      const payload: ChatMessageWrite = {
        senderId: uid,
        senderName: message.senderName,
        senderAvatar: message.senderAvatar,
        text: message.text,
        ...(uploaded.length ? { attachments: uploaded.map(file => toUploadedChatAttachment(file, apiBase)) } : {}),
        ...(message.replyTo ? { replyTo: JSON.parse(message.replyTo) as ChatReplyTo } : {}),
        ...(message.senderRole ? { senderRole: message.senderRole as ChatSenderRole } : {}),
        createdAt: serverTimestamp(),
        type: 'text',
      };
      await writeWithFallbacks(ref, payload, message.senderId);

      await repo.delete(message.id);
      releaseFiles?.(message.id);
    } catch (error) {
      const fatal =
        error instanceof FatalOutboxError ||
        (error instanceof UploadError && (error.status === 401 || error.status === 403 || error.status === 413));
      // Curated messages (FatalOutboxError / UploadError) are already Romanian and safe to show
      // verbatim; everything else (network errors, raw Firestore SDK errors, ...) gets a fixed
      // Romanian fallback so the bubble never surfaces raw/English text to the user.
      const text =
        error instanceof FatalOutboxError || error instanceof UploadError ? error.message : 'Mesajul nu a putut fi trimis.';
      const current = await repo.get(message.id);
      if (!current) return; // discarded meanwhile
      // A failure that turns out to be us going offline mid-attempt doesn't count against the
      // retry budget either — same reasoning as the up-front check above, just discovered late.
      if (!fatal && (await isOffline())) {
        await repo.updateMessage(message.id, afterOfflineFailure(current.message, now()));
      } else {
        await repo.updateMessage(message.id, afterFailure(current.message, text, now(), fatal));
      }
    } finally {
      notify();
    }
  }

  /**
   * Same ladder as the edit path (`withAuthRetry` in ../../firebase.ts): plain write first; on an
   * auth error (permission-denied/unauthenticated), a single re-mint + retry; only if THAT retry
   * still fails do we consider stripping the role chip (a permission-denied with a `senderRole` on
   * the payload means the membership mirror hasn't caught up yet); anything else left over after
   * the retry is a fatal auth failure — retrying again with backoff would not help.
   */
  async function writeWithFallbacks(ref: DocumentReference, payload: ChatMessageWrite, senderId: string): Promise<void> {
    try {
      await setDoc(ref, payload);
      return;
    } catch (error) {
      // `shouldRetryWithoutRole` only ever returns true for a permission-denied code, which
      // `isFirestoreAuthError` already classifies as an auth error, so it's only ever worth
      // checking below, after an auth-retry attempt — a non-auth error rethrows immediately.
      if (!isFirestoreAuthError(error)) throw error;
      await signInToFirebase(ctx, await getCustomToken(), report);
      const uid = ctx.auth.currentUser?.uid;
      if (uid !== senderId) throw error;
      try {
        await setDoc(ref, payload);
      } catch (again) {
        if (shouldRetryWithoutRole(again, payload)) {
          await setDoc(ref, withoutSenderRole(payload));
          return;
        }
        if (isFirestoreAuthError(again)) throw new FatalOutboxError('Nu ai voie să scrii în acest chat.');
        throw again;
      }
    }
  }

  return {
    run,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /** Fire the row-change signal right after an enqueue, before the worker's first event, so the
     * pending bubble appears immediately. */
    notifyChanged: notify,
    /** fish `insertOutboxEntry` + `notifyOutboxChanged` + `runOutbox`. */
    async enqueue(entry: OutboxEntry): Promise<void> {
      await repo.insert(entry);
      notify();
      run();
    },
    /** fish `useOutbox`'s read: the room's pending bubbles, newest first. */
    async roomMessages(competitionId: string, roomId: string, currentUserId?: string): Promise<ChatListMessage[]> {
      return outboxRoomMessages(await repo.listRoom(competitionId, roomId), currentUserId);
    },
    async retry(id: string): Promise<void> {
      await repo.updateMessage(id, { status: 'queued', attempts: 0, lastError: null, nextAttemptAt: 0 });
      notify();
      run();
    },
    /** Drops the row (the app revokes any object URL / removes any file it owns for it). */
    async discard(id: string): Promise<void> {
      await repo.delete(id);
      releaseFiles?.(id);
      notify();
    },
    /** Sign-out (see C1): drop every outbox row, regardless of account — whatever is left belongs
     * to the account that just signed out, and none of it should be uploaded, written, or even
     * shown once someone else signs in on this device. */
    async discardAll(): Promise<void> {
      await repo.clear();
      releaseFiles?.(null);
      notify();
    },
    /** Stops the wake timer (page teardown / tests) and resets the offline re-check budget. */
    dispose(): void {
      if (wakeTimer) {
        clearTimeout(wakeTimer);
        wakeTimer = null;
      }
      offlineRechecks = 0;
    },
    /** Resolves when the current run (and any queued re-run) finished. */
    async flush(): Promise<void> {
      await lastRun;
      if (running) await this.flush();
    },
    repo,
  };
}
