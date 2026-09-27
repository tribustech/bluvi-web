// Ported from fish `features/partide/helpers/standLabel.ts` (pure).
/**
 * Display label for a stand. A `standName` exists only when the angler picked a
 * stand from the catalog picker (free text goes to `anchorName`), so whenever we
 * have one it should read as a stand — the CMS stores names bare ("6", "A9",
 * "Ponton A") and rendering the raw value gives a naked token with no idea what
 * it counts.
 *
 * The only exception is a name that already carries the noun ("Stand 3"), which
 * would otherwise render as "Stand Stand 3".
 */
export function standLabel(standName: string | null | undefined): string | null {
  const s = standName?.trim();
  if (!s) return null;
  return /^stand\b/i.test(s) ? s : `Stand ${s}`;
}

/** " · Stand 7" for an angler-titled card's meta line; "" when there is no stand. */
export function standSuffix(standName: string | null): string {
  const label = standLabel(standName);
  return label ? ` · ${label}` : '';
}
