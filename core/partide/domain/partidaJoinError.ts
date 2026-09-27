// Ported from fish `features/partide/helpers/partidaJoinError.ts` (pure).
/**
 * Pure mapping from a join-by-code failure to a Romanian toast message.
 *
 * The axios interceptor rejects a backend `PARTIDA:*` bluCode error as
 * `{ bluCode, message, status, details }` (see services/api/api.ts). This helper
 * reads that `bluCode` and returns the copy to show — kept framework-free and
 * side-effect-free so it is fully unit-testable.
 */

/** Known join bluCodes → Romanian message. */
export const PARTIDA_JOIN_MESSAGES: Record<string, string> = {
  'PARTIDA:CODE_INVALID': 'Cod invalid',
  'PARTIDA:ENDED': 'Partida s-a încheiat',
  'PARTIDA:FULL': 'Partida este plină',
  // Server-side guard (fishing-session.join): you may only be in one live
  // partidă at a time, so the app must explain the refusal rather than fall
  // back to "ceva n-a mers".
  'PARTIDA:ALREADY_ACTIVE': 'Ai deja o partidă în desfășurare. Încheie-o înainte să intri în alta.',
};

/** Fallback for a network error / unknown bluCode. */
export const PARTIDA_JOIN_FALLBACK = 'Ceva n-a mers. Încearcă din nou.';

/** Extract a `bluCode` from an unknown rejection value, if present. */
function bluCodeOf(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'bluCode' in err) {
    const code = (err as { bluCode?: unknown }).bluCode;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

/** Map a join failure to its Romanian message (fallback for unknown codes). */
export function partidaJoinErrorMessage(err: unknown): string {
  const code = bluCodeOf(err);
  if (code && code in PARTIDA_JOIN_MESSAGES) return PARTIDA_JOIN_MESSAGES[code];
  return PARTIDA_JOIN_FALLBACK;
}
