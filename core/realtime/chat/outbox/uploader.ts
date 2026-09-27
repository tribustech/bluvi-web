/**
 * fish `features/chat/outbox/uploader.ts` minus the native upload task: the upload itself is
 * injected (`OutboxUploader`; the web posts the Blob to Strapi `/upload` through its transport,
 * same multipart shape as fish: field `files`, `status: 'published'`). What stays here is the
 * error type the worker branches on and the response parser.
 */
import type { UploadedFile } from '../transforms';
import type { OutboxAttachmentRow } from './types';

export class UploadError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
  }
}

/** Uploads one attachment and resolves the Strapi file. Throw `UploadError` (401/403/413 are fatal). */
export type OutboxUploader = (attachment: OutboxAttachmentRow) => Promise<UploadedFile>;

export function parseUploadResponse(status: number, body: string): UploadedFile {
  if (status === 401 || status === 403) throw new UploadError('Sesiunea a expirat. Intră din nou în cont.', status);
  if (status < 200 || status >= 300) throw new UploadError(`Încărcarea pozei a eșuat (${status}).`, status);
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new UploadError('Răspuns invalid la încărcarea pozei.', status);
  }
  const file = Array.isArray(parsed) ? parsed[0] : null;
  if (!file || typeof file !== 'object' || !('url' in file)) throw new UploadError('Răspuns invalid la încărcarea pozei.', status);
  return file as UploadedFile;
}
