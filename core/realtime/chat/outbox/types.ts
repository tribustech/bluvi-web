/**
 * fish `features/chat/outbox/types.ts`. fish keeps these rows in SQLite (`chat-outbox.v1.sqlite3`);
 * here they live behind the injected `OutboxStorage` (see `storage.ts`).
 */
export type OutboxStatus = 'queued' | 'uploading' | 'writing' | 'failed';
export type OutboxMessageRow = {
  id: string;
  competitionId: string;
  roomId: 'general' | 'participants';
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  text: string;
  /** JSON of `ChatReplyTo`, as fish stores it. */
  replyTo: string | null;
  senderRole: string | null;
  createdAt: number;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: number;
};
export type OutboxAttachmentRow = {
  id: string;
  messageId: string;
  position: number;
  /** What the pending bubble shows (fish: the copied file URI; web: an object URL the app owns). */
  localUri: string;
  name: string;
  mime: string | null;
  width: number | null;
  height: number | null;
  /** JSON of the Strapi `UploadedFile` once uploaded, so a resumed send never re-uploads. */
  uploaded: string | null;
  /**
   * The bytes to upload, handed back to the injected uploader untouched (web: a Blob/File).
   * fish has no equivalent — it re-reads `localUri` from disk. Must be storable by the chosen
   * `OutboxStorage` (IndexedDB stores Blobs; a JSON store would drop it).
   */
  file?: unknown;
};
export type OutboxEntry = { message: OutboxMessageRow; attachments: OutboxAttachmentRow[] };
