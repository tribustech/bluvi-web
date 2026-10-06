import 'server-only';
import { cacheLife } from 'next/cache';
import { readImageSize, type ImageSize } from './imageSize';

/** The head of the file holds the size (PNG IHDR, the JPEG SOF after its EXIF / ICC segments). */
const HEAD_BYTES = 128 * 1024;
const PROBE_TIMEOUT_MS = 3000;

/**
 * The pixel size of a remote picture, read from the head of its file (a Range request, the stream
 * cut at HEAD_BYTES). A media URL never changes content (Strapi names files by hash), so a size is
 * cached for good; a failed read lives a minute, and the page falls back to its default box.
 */
export async function probeImageSize(url: string): Promise<ImageSize | null> {
  'use cache';
  let size: ImageSize | null = null;
  try {
    size = readImageSize(await readHead(url));
  } catch {
    // Unreadable now (timeout, 4xx / 5xx): the default box, and another try in a minute.
  }
  if (size) cacheLife('max');
  else cacheLife('minutes');
  return size;
}

async function readHead(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { range: `bytes=0-${HEAD_BYTES - 1}` }, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
  if (!res.ok || !res.body) throw new Error(`probe ${res.status}`);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < HEAD_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
  } finally {
    void reader.cancel().catch(() => {});
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** Each picture with its size (when the probe could read it), in order. */
export async function withSizes<T extends { src: string }>(images: T[]): Promise<(T & Partial<ImageSize>)[]> {
  const sizes = await Promise.all(images.map((i) => probeImageSize(i.src)));
  return images.map((img, i) => ({ ...img, ...(sizes[i] ?? {}) }));
}
