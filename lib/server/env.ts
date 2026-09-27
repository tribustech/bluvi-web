import 'server-only';

/** CMS base URL including `/api`, no trailing slash. */
export function cmsUrl(): string {
  const url = process.env.CMS_URL ?? process.env.NEXT_PUBLIC_CMS_URL;
  if (!url) throw new Error('CMS_URL is not set');
  return url.replace(/\/$/, '');
}

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';
