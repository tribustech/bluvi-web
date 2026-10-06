/** A page's `searchParams`, as Next hands them to a page (awaited). */
export type SearchParams = Record<string, string | string[] | undefined>;

/** One string value of a page's searchParams: the first when repeated, undefined when empty. */
export function param(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v) || undefined;
}
