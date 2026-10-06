/*
 * The wide views' stand order (Cântare's table, Participanți from 768): sectors by name, stands by
 * name inside each, compared naturally («A2» before «A10», «9» before «17») — the comparison core
 * approvedRegistrationsByStand sorts the registrations with, so the two views list a competition's
 * stands the same way. The phone keeps fish's order (the CMS's) wherever fish shows it.
 */

/** Natural, Romanian-collated comparison of two stand or sector names. */
export const compareNames = (a: string, b: string) => a.localeCompare(b, 'ro', { numeric: true });

/** The sectors by name, each one's stands by name (new arrays; the input is left as it is). */
export function sortedSectors<S extends { name: string; stands: { name: string }[] }>(sectors: readonly S[]): S[] {
  return [...sectors].sort((a, b) => compareNames(a.name, b.name)).map(s => ({ ...s, stands: [...s.stands].sort((a, b) => compareNames(a.name, b.name)) }));
}
