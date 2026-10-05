/*
 * Reading a T1 list's place from a page's searchParams. A module with no 'use client', so a Server
 * Component (a route picking its Suspense fallback from the URL) calls the same functions the
 * client list does — never a client reference.
 */

/** One string value of a page's searchParams (the first, when repeated). */
export function listParam(params: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = params[key];
  return (Array.isArray(v) ? v[0] : v) || undefined;
}

/** A searchParam that must be one of `allowed`, else undefined (a hand-edited URL never breaks the list). */
export function listParamOf<T extends string>(
  params: Record<string, string | string[] | undefined>,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const v = listParam(params, key);
  return v !== undefined && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}
