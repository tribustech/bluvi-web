'use client';

import { ChevronRightIcon } from '@heroicons/react/24/outline';
import type { chat } from '@/core/realtime';
import { formatTime24 } from '@/core/realtime/chat/format';
import { podiumInfoOf, systemBodyFor } from '@/core/realtime/chat/systemMessages';
import { systemTarget } from './model';
import { StandChip, SystemCard, SystemLink, SystemMessageRow } from './SystemMessageRow';

/*
 * fish SystemMessageRow `leader` (participant.chat c38): the room's newest move to 1st place
 * (core latestLeaderMessageId) is its own highlighted card — 🥇, «LIDER NOU · HH:mm», stand chip +
 * name, «A urcat pe locul 1» and a «Clasament» chip when the event links to the ranking.
 */
export function LeaderCard({ message, competitionId }: { message: chat.ChatListMessage; competitionId: string }) {
  const podium = podiumInfoOf(message);
  if (!podium) return <SystemMessageRow message={message} competitionId={competitionId} />;
  const target = systemTarget(message.link, competitionId);
  const linked = target?.kind === 'href';
  return (
    <div className="mx-auto w-full max-w-180 px-4 py-1.5" data-leader="">
      <SystemLink target={linked ? target : null} label={`Lider nou: ${systemBodyFor(message.text)}, Vezi clasamentul`} className="rounded-card">
        <SystemCard highlighted className="bg-linear-to-br from-accent-tint to-surface">
          <span className="flex items-center gap-3">
            <span aria-hidden className="flex size-11.5 shrink-0 items-center justify-center rounded-full bg-surface t-display shadow-e1">
              🥇
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="t-micro-strong tracking-wide text-accent-ink">LIDER NOU · {formatTime24(message.createdAt?.toDate?.())}</span>
              <span className="flex min-w-0 items-center gap-1.5">
                {podium.stand ? <StandChip label={podium.stand} /> : null}
                <span className="truncate t-heading text-ink">{podium.name}</span>
              </span>
              <span className="t-caption text-muted">A urcat pe locul 1</span>
            </span>
            {linked ? (
              <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-accent-tint-2 py-1.5 pr-1.5 pl-2.5 t-label text-accent-ink">
                Clasament
                <ChevronRightIcon aria-hidden className="size-3.5" />
              </span>
            ) : null}
          </span>
        </SystemCard>
      </SystemLink>
    </div>
  );
}
