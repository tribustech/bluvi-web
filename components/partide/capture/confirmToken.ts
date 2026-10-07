import type { CaptureBucket } from '@/core/partide';

/*
 * A spam confirm given on the screen that opened the capture flow (useCaptureFlow → «Da, adaug»)
 * travels to the capture page in memory, so the page does not ask a second time. One token, valid
 * for a few seconds and cleared once the page has decided — a later visit (Back / Forward, a
 * reload) asks again. Reading is pure (a render may run twice); clearing is the page's effect.
 * fish needs none: its guard sits on the origin screen and the capture route never checks.
 */
const VALID_MS = 10_000;
let token: { documentId: string; bucket: CaptureBucket; at: number } | null = null;

export function rememberCaptureConfirmed(documentId: string, bucket: CaptureBucket, now = Date.now()): void {
  token = { documentId, bucket, at: now };
}

export function isCaptureConfirmed(documentId: string, bucket: CaptureBucket, now = Date.now()): boolean {
  return !!token && token.documentId === documentId && token.bucket === bucket && now - token.at <= VALID_MS;
}

export function clearCaptureConfirmed(): void {
  token = null;
}
