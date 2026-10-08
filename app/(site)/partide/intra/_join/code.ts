/**
 * The join code's input rules (fish app/(app)/partide/join/index.tsx onChange): uppercase, A–Z and
 * 0–9 only, capped at six characters — the button is on at exactly six.
 */
export const CODE_LENGTH = 6;

/** fish onChange: uppercase, strip anything that is not A–Z / 0–9, cap at CODE_LENGTH. */
export function cleanCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, CODE_LENGTH);
}

export const isCompleteCode = (code: string): boolean => code.length === CODE_LENGTH;

/**
 * A paste. A bare code («k7m-2qx», « K7M2QX ») cleans as typing would. A pasted invite (core
 * partidaInviteMessage: «… Folosește codul K7M2QX sau deschide linkul: …/partide/join/K7M2QX»)
 * would clean to its first six letters, so the code is taken from «codul X» or the join link.
 */
export function codeFromPaste(text: string): string {
  const bare = text.replace(/[^A-Za-z0-9]/g, '');
  if (bare.length <= CODE_LENGTH) return cleanCode(bare);
  const named = /\bcodul\s+([A-Za-z0-9]{6})\b/i.exec(text) ?? /\/join\/([A-Za-z0-9]{6})\b/i.exec(text);
  return cleanCode(named ? named[1] : bare);
}
