'use client';

import type { chat } from '@/core/realtime';
import { cn } from '@/components/ui/cn';

/*
 * fish MessageBubble ReactionPills (participant.chat c22): one white pill hanging under the bubble —
 * each emoji with its count, the one I chose on the accent tint. A button: it opens «Reacții» (who
 * reacted with what).
 */
export function ReactionPill({ reactions, mine, onOpen }: { reactions: chat.ChatReactionSummary[]; mine: boolean; onOpen?: () => void }) {
  if (!reactions.length) return null;
  const summary = reactions.map(r => `${r.emoji} ${r.count}${r.reactedByMe ? ' (inclusiv tu)' : ''}`).join(', ');
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      aria-label={`Vezi cine a reacționat: ${summary}`}
      aria-haspopup="dialog"
      className={cn(
        'relative -mt-2.5 flex cursor-pointer gap-1 rounded-full bg-surface px-1.5 py-0.5 shadow-e1 ring-1 ring-hairline outline-none hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent',
        mine ? 'mr-2 self-end' : 'ml-2 self-start',
      )}
    >
      {reactions.map(r => (
        <span key={r.emoji} data-mine={r.reactedByMe || undefined} className={cn('flex items-center gap-0.5 rounded-full px-1 t-caption', r.reactedByMe ? 'bg-accent-tint-2 text-accent-ink' : 'text-ink-2')}>
          <span aria-hidden>{r.emoji}</span>
          <span>{r.count}</span>
        </span>
      ))}
    </button>
  );
}
