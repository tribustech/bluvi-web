/**
 * The Strapi JWT lives only in this httpOnly cookie — never in JS-readable storage.
 * Max-Age matches the CMS `users-permissions.jwt.expiresIn: '1y'`.
 */
export const SESSION_COOKIE = 'bluvi_session';
export const SESSION_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/** Secure everywhere except plain-http localhost dev. */
export function isSecureRequest(url: string): boolean {
  return new URL(url).protocol === 'https:';
}
