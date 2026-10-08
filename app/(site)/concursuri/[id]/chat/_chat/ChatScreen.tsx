'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lightbox } from '@/components/surfaces/Lightbox';
import { roomFromParam } from '../_live/lastTab';
import { ChatController, useChat, type ChatViewer, type MediaState } from './ChatController';
import { FollowersSurface } from './ChatHeader';
import { ChatFrame } from './ChatFrame';
import type { ChatCompetitionFacts } from './facts';
import { FollowPanel } from './FollowPrompt';
import { MuteDialog } from './MuteDialog';
import { RulesDialog } from './RulesDialog';

/*
 * The chat page's client root (participant.chat; fish features/chat/screens/ChatScreen.tsx): the
 * controller (./ChatController.tsx), the frame (./ChatFrame.tsx) and the page's overlays — the
 * rules (c11), the mute confirmation (c9), the followers list (c3), the follow-notifications panel
 * (c8) and the photo viewer (the banner, c3; the room's photos — slice 2 may swap the kit Lightbox
 * for fish's MediaViewer). Keyed by competition: another competition's chat starts clean (fish c5).
 */
export function ChatScreen({ competitionId, viewer, facts }: { competitionId: string; viewer: ChatViewer; facts: ChatCompetitionFacts | null }) {
  // The link's room: read live, so a new link into this same chat (a notification) re-selects it (c5).
  const linkRoom = roomFromParam(useSearchParams()?.get('tab'));
  return (
    <ChatController key={competitionId} competitionId={competitionId} linkRoom={linkRoom} viewer={viewer} facts={facts}>
      <ChatFrame />
      <RulesDialog />
      <MuteDialog />
      <FollowersSurface />
      <FollowPanel />
      <MediaSlot />
    </ChatController>
  );
}

function MediaSlot() {
  const c = useChat();
  if (!c.media) return null;
  return <MediaLightbox key={`${c.media.label}-${c.media.items[c.media.index]?.key}`} media={c.media} onClose={c.closeMedia} />;
}

function MediaLightbox({ media, onClose }: { media: NonNullable<MediaState>; onClose: () => void }) {
  const [index, setIndex] = useState(media.index);
  return (
    <Lightbox
      items={media.items}
      index={index}
      total={media.items.length}
      label={media.label}
      title={media.items.length === 1 ? () => media.label : undefined}
      onIndex={i => (i === null ? onClose() : setIndex(i))}
      footer={() => null}
    />
  );
}
