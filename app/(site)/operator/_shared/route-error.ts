/**
 * An operator route error that came from the server part — it reaches the browser with a `digest`
 * (its message redacted in production) — or from the session read (SessionUnknownError), as
 * /profil/error.tsx tells them; anything else crashed while rendering in the browser.
 */
export function isServerFailure(error: Error & { digest?: string }): boolean {
  return !!error.digest || error.name === 'SessionUnknownError';
}
