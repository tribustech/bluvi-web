/*
 * The catch photo, same-origin, for the share card (public-waters.detaliu.c24): the card is drawn
 * on a canvas and exported as a PNG, and a canvas that drew a cross-origin photo without CORS
 * headers (the CMS buckets send none) cannot be exported. The proxy only ever fetches from the
 * CMS's own photo hosts (the next.config `images.remotePatterns` buckets and the CMS origin) and
 * only passes images back.
 */

/** The buckets next.config lets <Image> read; the CMS origin joins them at runtime (local uploads). */
export const PHOTO_HOSTS = ['fir-intins-strapi.s3.eu-central-1.amazonaws.com', 'bluvi-staging.s3.eu-central-1.amazonaws.com'];

/** Biggest photo passed through (a full-size catch is ~1–4 MB). */
export const PHOTO_MAX_BYTES = 15 * 1024 * 1024;

/**
 * The URL to fetch for `?src=`, or null when it is not one of the CMS's photos: https on a
 * bucket, or the CMS's own origin (http allowed there, it is the local CMS in dev), never
 * credentials in the URL.
 */
export function photoProxyTarget(raw: string | null | undefined, cmsOrigin: string | null): URL | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (url.protocol === 'https:' && PHOTO_HOSTS.includes(url.hostname)) return url;
  if (cmsOrigin && (url.protocol === 'https:' || url.protocol === 'http:') && url.origin === cmsOrigin) return url;
  return null;
}

/** The CMS origin of a `CMS_URL` (`http://localhost:1337/api` → `http://localhost:1337`). */
export function originOf(base: string | null | undefined): string | null {
  if (!base) return null;
  try {
    return new URL(base).origin;
  } catch {
    return null;
  }
}
