import { ROOM_AUDIENCE } from './model';
import type { chat } from '@/core/realtime';

/** fish MessageList ConversationStart (participant.chat c12): the top of a fully loaded room. */
export function ConversationStart({ roomId }: { roomId: chat.ChatRoomId }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-8 pt-2 pb-4 text-center t-caption text-muted">
      <p>Acesta este începutul conversației.</p>
      <p>{ROOM_AUDIENCE[roomId]}</p>
    </div>
  );
}
