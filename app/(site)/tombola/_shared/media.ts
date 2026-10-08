'use client';

import { useSyncExternalStore } from 'react';
import { compressImage } from '@/lib/client/compress-image';

const COARSE = '(pointer: coarse)';

function subscribe(onChange: () => void) {
  const mq = window.matchMedia?.(COARSE);
  mq?.addEventListener('change', onChange);
  return () => mq?.removeEventListener('change', onChange);
}

/**
 * A touch screen (fish's camera button exists on every phone): the «Fotografiază» file input with
 * capture=environment is offered only there — a desktop browser would open the same file dialog
 * twice under two names. Server snapshot: false (the gallery picker alone, then corrected).
 */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => Boolean(window.matchMedia?.(COARSE).matches),
    () => false,
  );
}

/**
 * fish useCamera returns a JPEG at quality .8; the web re-encodes to an upright JPEG under the
 * proxy's body limit (lib/client/compress-image). A file the browser cannot decode goes as it is
 * (the CMS decides), so a HEIC from an iPhone gallery is not refused here.
 */
export async function prepareReceipt(file: File): Promise<File> {
  try {
    return await compressImage(file);
  } catch {
    return file;
  }
}
