import type { Profile } from '@/core/social';

/*
 * Setări's pure bits (fish app/(app)/settings.tsx), unit-tested in format.test.ts.
 */

/** fish's «-» for a missing value (INFORMAȚII, the profile card's email). */
export const DASH = '-';

/**
 * c15 «Telefon»: fish `phone.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3')` — «0712 345 678» for the
 * 10-digit number the profile form stores. Anything else is shown as stored (fish's regex would split
 * a +40 number mid-prefix), «-» when there is none.
 */
export function formatPhone(phone: string | null | undefined): string {
  const p = phone?.trim();
  if (!p) return DASH;
  return /^\d{10}$/.test(p) ? p.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3') : p;
}

/** date-fns `LLL` in the ro locale (fish), standalone short months: «ian» … «dec». */
const MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'] as const;

/**
 * c15 «Activ de la»: fish `format(createdAt, 'dd LLL yyyy', { locale: ro })` — «05 oct 2026». The
 * day is Romania's (fish formats in the phone's zone; the web's server and visitors may be anywhere).
 */
export function formatActiveSince(createdAt: string | null | undefined): string {
  if (!createdAt) return DASH;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return DASH;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', day: '2-digit', month: 'numeric', year: 'numeric' }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')} ${MONTHS[Number(get('month')) - 1]} ${get('year')}`;
}

/** c15 «Autentificat cu»: the provider capitalised (fish charAt(0).toUpperCase()), «-» without one. */
export function formatProvider(provider: string | null | undefined): string {
  return provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : DASH;
}

/**
 * c5–c7 (fish settings.tsx:127-136): the organizer row's state.
 * - `organizer`: role.name «Organizer»;
 * - `pending`: requested, not (yet) an organizer;
 * - `none`: neither — «Devino organizator».
 */
export type OrganizerState = 'none' | 'pending' | 'organizer';

export function organizerState(profile: Pick<Profile, 'role' | 'hasRequestedOrganizerRole'>): OrganizerState {
  if (profile.role.name === 'Organizer') return 'organizer';
  return profile.hasRequestedOrganizerRole ? 'pending' : 'none';
}

/** The profile card's avatar: the thumbnail derivative (fish getImageFormat 'thumb'), else the original. */
export function avatarThumb(profile: Pick<Profile, 'avatar'>): string | null {
  return profile.avatar?.formats?.thumbnail?.url ?? profile.avatar?.url ?? null;
}
