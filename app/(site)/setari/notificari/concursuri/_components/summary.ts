import { getInitials } from '@/components/ui/initials';
import { formatCount } from '@/core/realtime/chat/format';

/** fish: the initials of the name's letters only («[AUDIT27] Start maine» → «AS»), the raw name when none. */
export function competitionInitials(name: string): string {
  return getInitials(name.replace(/[^\p{L}\s]/gu, '').trim() || name);
}

/** fish: «Toate notificările pornite», or «{n} tip oprit / {n} tipuri oprite» (formatCount). */
export function mutedSummary(mutedCount: number): string {
  return mutedCount ? formatCount(mutedCount, 'tip oprit', 'tipuri oprite') : 'Toate notificările pornite';
}
