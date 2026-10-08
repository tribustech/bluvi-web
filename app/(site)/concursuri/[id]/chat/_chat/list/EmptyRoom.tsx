import type { chat } from '@/core/realtime';
import { EMPTY_ROOM_SUBTITLE } from './model';

/*
 * fish ChatEmptyRoom (participant.chat c14): «Niciun mesaj încă» and the room's line; when the
 * viewer can write, the waving hand «Trimite un salut» sends «👋👋👋» through the normal send path
 * (the controller's send: the outbox, the pending bubble). The wave is CSS (it rests for users who
 * ask for reduced motion). The button is named by what it says («Apasă ca să saluți 👋👋👋», label in
 * name); fish's «Trimite un salut» is its tooltip — a name containing «Trimite» would also answer to
 * the composer's «Trimite».
 */
export function EmptyRoom({ roomId, canSend, onGreet }: { roomId: chat.ChatRoomId; canSend: boolean; onGreet: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 px-8 py-10 text-center">
      <p className="t-heading text-ink">Niciun mesaj încă</p>
      <p className="t-body text-muted">{EMPTY_ROOM_SUBTITLE[roomId]}</p>
      {canSend ? (
        <button
          type="button"
          onClick={onGreet}
          title="Trimite un salut"
          className="group mt-3 flex cursor-pointer flex-col items-center gap-2.5 rounded-card p-1 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent"
        >
          <span className="flex size-32 items-center justify-center rounded-full bg-soft-fill transition-colors group-hover:bg-accent-tint">
            <span aria-hidden className="inline-block origin-[70%_80%] t-count animate-wave">
              👋
            </span>
          </span>
          <span className="t-caption text-accent-ink">Apasă ca să saluți 👋👋👋</span>
        </button>
      ) : null}
    </div>
  );
}
