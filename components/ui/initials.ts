/**
 * Avatar initials — same rule as fish helpers/anglerInitials.ts: two words → first letter of
 * each, one word → its first two letters, nothing → "?". Upper-cased.
 */
export function getInitials(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Stable 32-bit hash (fish hashId), so a given name always gets the same tone. */
export function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++)
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}
