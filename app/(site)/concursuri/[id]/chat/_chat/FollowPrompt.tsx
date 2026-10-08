'use client';

import { BellIcon } from '@heroicons/react/24/outline';
import { PreferencesPanel } from '@/components/account/notification-preferences';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { useChat } from './ChatController';

/*
 * fish ChatFollowPrompt (participant.chat.c8): in General, for someone who reads the chat without
 * following the competition (not a follower, not registered, not a referee, not the organizer — the
 * my-status definition). They get no chat or event notifications until they follow. «Urmărește»
 * follows (busy while it runs), then opens the follow-notifications panel (fish
 * FollowNotificationsSheet, celebrate); the card goes once the competition reports isFollowing.
 * A state card, not a floating banner: it sits in the flow under the room switcher.
 */
export function FollowPrompt({ className }: { className?: string }) {
  const c = useChat();
  if (!c.followPrompt.show) return null;
  return (
    <section aria-labelledby="chat-follow-title" className={cn('flex items-center gap-3 rounded-card bg-accent-tint p-3', className)}>
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-tint-2 text-accent-ink">
        <BellIcon className="size-5 stroke-2" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="chat-follow-title" className="t-body-strong text-accent-ink">
          Nu urmărești concursul
        </h2>
        <p className="t-caption text-ink-2">Urmărește-l ca să primești mesajele și evenimentele.</p>
      </div>
      <Button
        size="compact"
        aria-label="Urmărește concursul"
        aria-busy={c.followPrompt.pending || undefined}
        aria-disabled={c.followPrompt.pending || undefined}
        onClick={c.followPrompt.follow}
        className={cn('rounded-full', c.followPrompt.pending && 'cursor-progress opacity-60')}
      >
        Urmărește
      </Button>
    </section>
  );
}

/** After a follow from the prompt: which notifications this competition sends (fish celebrate sheet). */
export function FollowPanel() {
  const c = useChat();
  return (
    <PreferencesPanel
      key={c.competitionId}
      mode="celebrate"
      open={c.followPanelOpen}
      onClose={c.closeFollowPanel}
      competitionId={c.competitionId}
      competitionName={c.competition?.name ?? c.facts?.name}
    />
  );
}
