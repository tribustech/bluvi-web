/** Joins class names, skipping falsy parts. No merging: variants own disjoint utilities. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
