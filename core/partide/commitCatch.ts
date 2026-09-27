/**
 * Commit a catch: ONE call to the CMS (Postgres is truth), then any follow-up PATCHes — the photo
 * upload+attach and an edit-mode tags correction. fish `features/partide/domain/commitCatch.ts`.
 *
 * fish resolved the session's Strapi documentId from the device's active-session pointer
 * (`firestore/sessionRepo#resolveSessionDocumentId`) and wrote through `writeCatch`, which is
 * exactly `upsertEvent(documentId, eventToUpsertBody(event))`. Here the caller passes the
 * documentId it already holds, and the photo as a `Blob` (fish read it from `photoLocalUri`; keep
 * setting `photoLocalUri` — e.g. to an object URL — because `eventToUpsertBody` reads it to decide
 * whether this is a photo detach).
 *
 * A capture must appear for teammates within ~1-2s, so the catch is NEVER blocked on the photo
 * upload or the tags PATCH:
 *  1. Write the catch immediately (retried on transient failures). This is the ONLY thing the
 *     returned promise tracks; its rejection belongs to the CALLER.
 *  2. If a photo file is attached, upload it in the background, then PATCH ONLY the photo field.
 *  3. If `photoTagUidsPatch` is given (the edit's tag selection actually changed), PATCH ONLY
 *     `photoTagUids` onto the same event. Independent of (2).
 *
 * Follow-up failures go to `onBackgroundError` (fish: Sentry) — no retry. Both follow-up chains
 * observe the write through a `.catch(() => null)`, so a failed write surfaces exactly once
 * (through the returned promise), never also through `onBackgroundError`.
 *
 * The follower catch-ping is server-side (the CMS's event-create handler); `isNew` is kept for
 * parity with fish callers but unused.
 */
import type { Transport } from '../transport';
import { patchEventPhoto, patchEventTags, upsertEvent, uploadSessionPhoto } from './api';
import { retryWrite, type RetryOptions } from './domain/retryWrite';
import type { LocalEvent } from './domain/types';
import { eventToUpsertBody } from './domain/upsertBodies';

export type CommitCatchOptions = {
  isNew: boolean;
  /** The photo to upload for this catch (web: the picked `File`). */
  photoFile?: Blob | null;
  /** Called once the photo is attached server-side — the venue's photo-only surfaces need a refetch. */
  onPhotoAttached?: () => void;
  /** Edit-path only: an explicit tags PATCH (a concrete member list, never `[]`). Omitted = none. */
  photoTagUidsPatch?: string[];
  /** Where background (photo/tags) failures go. fish: `Sentry.captureException`. */
  onBackgroundError?: (error: unknown) => void;
  /** Test seam for the catch write's retry backoff. */
  retry?: RetryOptions;
};

export function commitCatchWithPhoto(
  t: Transport,
  sessionDocumentId: string,
  event: LocalEvent,
  options: CommitCatchOptions
): Promise<void> {
  const report = options.onBackgroundError ?? (() => {});
  // 1. Instant write → the event's documentId.
  const write = retryWrite(() => upsertEvent(t, sessionDocumentId, eventToUpsertBody(event)).then(dto => dto.documentId), options.retry);

  const photoFile = options.photoFile ?? null;
  const needsTagsPatch = options.photoTagUidsPatch !== undefined;

  if (photoFile || needsTagsPatch) {
    // A rejected write is surfaced through the returned promise — swallow it to `null` here so
    // neither follow-up chain reports the same rejection a second time.
    const eventDocumentId = write.catch(() => null);

    // 2. Upload, then PATCH ONLY the photo field — never a second full upsert (that would replay
    // a stale event object and clobber a teammate's concurrent edit).
    if (photoFile) {
      eventDocumentId
        .then(async documentId => {
          if (!documentId) return;
          const { fileId } = await uploadSessionPhoto(t, photoFile);
          await patchEventPhoto(t, sessionDocumentId, documentId, fileId);
          options.onPhotoAttached?.();
        })
        .catch(report);
    }

    // 3. Edit-mode tags correction — PATCH ONLY photoTagUids.
    if (needsTagsPatch) {
      const photoTagUids = options.photoTagUidsPatch!;
      eventDocumentId
        .then(async documentId => {
          if (!documentId) return;
          await patchEventTags(t, sessionDocumentId, documentId, photoTagUids);
        })
        .catch(report);
    }
  }

  return write.then(() => undefined);
}
