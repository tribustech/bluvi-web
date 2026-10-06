import type { DetailRegistration } from '@/core/competitions';
import type { ParticipantStats } from '@/core/social';
import { anglerHref } from '@/lib/routes';
import { signInHref } from '../../../_shell/SiteHeader';
import type { PageViewer } from './Follow';

/* Parts shared by the Participanți list's layouts (ParticipantsTab: the phone's cards; ParticipantsRoster from 768) and the person popover (PersonPopover, from 1024). */

export type StatsAccess =
  | { kind: 'pending' }
  | { kind: 'signIn'; href: string }
  | { kind: 'failed'; retry: () => void; retrying: boolean }
  | { kind: 'ok'; map: Record<string, ParticipantStats> };

/** A sector of the list (title null: one ungrouped list). */
export type Group = { key: string; title: string | null; sector: string | null; registrations: DetailRegistration[] };

export const GUEST_MESSAGE = 'Statisticile nu sunt disponibile pentru utilizatorii adăugați manual.';

/** A registration typed in by the organizer: no Bluvi account, so no stats. */
export const isGuest = (r: DetailRegistration) => r.participants.length === 0;

/** The angler's profile (signed out: sign-in, then the profile — it is not public), or null while the web has none. */
export function profileHref(documentId: string, viewer: PageViewer): string | null {
  const href = anglerHref(documentId);
  if (!href) return null;
  return viewer === null ? signInHref(href) : href;
}
