import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cmsUrl } from '@/lib/server/env';
import { parseTokens } from './tokens';

/*
 * What the sheet is drawn from besides the model, read on the server: the design tokens (the light
 * palette and the t-* steps, from app/globals.css) and the sponsor logos as data URLs. Shared by
 * route.tsx (Satori draws them) and ../data/route.ts (the browser draws them: a data URL never
 * taints its canvas, whatever host the CMS serves the logo from).
 */

export const imageTokens = readFile(join(process.cwd(), 'app/globals.css'), 'utf8').then(parseTokens);

const SPONSOR_TIMEOUT_MS = 4000;
const DRAWABLE = /^image\/(png|jpe?g|gif|svg\+xml)$/;

/** A sponsor logo as a data URL; null when it cannot be read or drawn (it is then left out). */
export async function sponsorLogo(url: string): Promise<string | null> {
  try {
    const absolute = /^https?:\/\//.test(url) ? url : new URL(url, cmsUrl()).toString();
    const res = await fetch(absolute, { signal: AbortSignal.timeout(SPONSOR_TIMEOUT_MS) });
    const type = res.headers.get('content-type')?.split(';')[0].trim() ?? '';
    if (!res.ok || !DRAWABLE.test(type)) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

/** The logos that could be read, in order. */
export async function sponsorLogos(urls: readonly string[]): Promise<string[]> {
  return (await Promise.all(urls.map(sponsorLogo))).filter((s): s is string => !!s);
}
