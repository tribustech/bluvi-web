import { LockClosedIcon } from '@heroicons/react/24/outline';
import { formatDayLabel } from '@/core/realtime/chat/format';
import { cn } from '@/components/ui/cn';

/*
 * fish ChatClosedNotice (participant.chat.c40): replaces the composer once the chat is read-only.
 * «Chat-ul s-a închis astăzi.» / «… ieri.» / «… pe {zi}.», or «Chat-ul s-a închis.» without a time.
 */
export function closedNoticeText(closesAtMs: number | null, now = new Date()): string {
  if (!closesAtMs) return 'Chat-ul s-a închis.';
  const when = formatDayLabel(new Date(closesAtMs), now);
  const label = when === 'Astăzi' || when === 'Ieri' ? when.toLowerCase() : `pe ${when}`;
  // «… pe sâmbătă, 3 oct.» — the month's own abbreviation dot ends the sentence (fish printed «oct..»).
  return `Chat-ul s-a închis ${label.replace(/\.$/, '')}.`;
}

export function ClosedNotice({ closesAtMs, className }: { closesAtMs: number | null; className?: string }) {
  return (
    <div role="status" className={cn('flex items-center justify-center gap-2 border-t border-hairline bg-surface px-4 pt-3.5 pb-[calc(--spacing(3.5)+env(safe-area-inset-bottom))]', className)}>
      <LockClosedIcon aria-hidden className="size-4 shrink-0 text-muted" />
      <p className="t-caption text-ink-2">{closedNoticeText(closesAtMs)}</p>
    </div>
  );
}
