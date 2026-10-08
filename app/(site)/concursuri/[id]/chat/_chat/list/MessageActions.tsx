'use client';

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowPathIcon, ArrowUturnLeftIcon, DocumentDuplicateIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { chat } from '@/core/realtime';
import { Sheet } from '@/components/surfaces/Sheet';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { useModalDialog } from '@/components/surfaces/useModalDialog';
import { cn } from '@/components/ui/cn';
import { menuPlacement, myReaction, REACTION_EMOJIS, type MessageActions as Actions } from './model';
import type { MenuMode } from './MessageBubble';

/*
 * fish MessageActionsOverlay + ReactionBar + ActionCard (participant.chat c23, c24, c27, c31).
 *
 *  - The reaction bar 👍 ❤️ 😂 😮 😢 🙏 (my current one marked: choosing it again removes it, another
 *    one replaces it — the controller's toggleReaction, core toggleReaction) — not on a failed send.
 *  - The actions: «Răspunde», «Copiază» (text messages; toast «Text copiat»), «Editează» (my text
 *    messages), «Șterge» (mine, or any when I am the author) which first turns into «Sigur? Șterge»;
 *    a failed send: only «Reîncearcă» and «Șterge».
 *  - Phone (< 768): fish's bottom overlay as the kit Sheet — the message on top, the bar, the rows;
 *    drag it down, tap the scrim or Escape to close. From 768: a menu anchored under (or above) the
 *    bubble, over a light scrim; a click outside or Escape closes it, focus returns to the opener.
 *  - A real menu: role=menu, the emoji are menuitemradio (aria-checked = mine) in a group, the
 *    actions menuitem; the arrow keys move, Home / End jump, focus starts on the first action.
 */

export type ActionHandlers = {
  react: (emoji: string) => void;
  reply: () => void;
  copy: () => void;
  edit: () => void;
  remove: () => void;
  retry: () => void;
};

type Row = { key: string; label: string; Icon: typeof TrashIcon; destructive?: boolean; run: () => void };

export function MessageActionsMenu({
  message,
  actions,
  mode,
  anchor,
  isMine,
  onClose,
  handlers,
}: {
  message: chat.ChatListMessage;
  actions: Actions;
  mode: MenuMode;
  anchor: HTMLElement | null;
  isMine: boolean;
  onClose: () => void;
  handlers: ActionHandlers;
}) {
  const phone = useBreakpoint() === 'mobile';
  const [confirm, setConfirm] = useState(false);
  // The menu unmounts when it closes (not a dialog close()), so focus goes back to its opener here —
  // read at the first render, before the surface's showModal moves focus inside.
  const [back] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null));
  useEffect(() => {
    return () => {
      const now = document.activeElement;
      if (back?.isConnected && (!now || now === document.body || !now.isConnected)) back.focus({ preventScroll: true });
    };
  }, [back]);
  if (actions.mode === 'none') return null;
  const outbox = actions.mode === 'outbox';
  const showBar = !outbox && actions.react;
  const showRows = !(mode === 'react' && showBar);
  const selected = myReaction(message);

  const deleteRow: Row = {
    key: 'delete',
    label: confirm ? 'Sigur? Șterge' : 'Șterge',
    Icon: TrashIcon,
    destructive: true,
    run: () => (confirm ? handlers.remove() : setConfirm(true)),
  };
  const rows: Row[] = outbox
    ? [{ key: 'retry', label: 'Reîncearcă', Icon: ArrowPathIcon, run: handlers.retry }, deleteRow]
    : [
        ...(actions.reply ? [{ key: 'reply', label: 'Răspunde', Icon: ArrowUturnLeftIcon, run: handlers.reply }] : []),
        ...(actions.copy ? [{ key: 'copy', label: 'Copiază', Icon: DocumentDuplicateIcon, run: handlers.copy }] : []),
        ...(actions.edit ? [{ key: 'edit', label: 'Editează', Icon: PencilIcon, run: handlers.edit }] : []),
        ...(actions.delete ? [deleteRow] : []),
      ];

  const content = (
    <MenuBody label="Acțiuni mesaj" focusFirst={showRows ? 'action' : 'emoji'} phone={phone}>
      {showBar ? <ReactionBar selected={selected} onPick={handlers.react} phone={phone} /> : null}
      {showRows ? (
        <div className={cn('overflow-hidden rounded-card bg-surface', phone ? 'ring-1 ring-hairline' : 'w-56 shadow-e2 ring-1 ring-hairline')}>
          {rows.map((row, i) => (
            <button
              key={row.key}
              type="button"
              role="menuitem"
              data-action={row.key}
              onClick={row.run}
              className={cn(
                'flex h-12 w-full cursor-pointer items-center justify-between gap-3 px-3.5 text-left t-body outline-none hover:bg-soft-fill focus-visible:bg-soft-fill focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent',
                i > 0 && 'border-t border-hairline',
                row.destructive ? 'text-status-danger-fg' : 'text-ink',
                row.destructive && confirm && 't-body-strong',
              )}
            >
              {row.label}
              <row.Icon aria-hidden className={cn('size-4.5', row.destructive ? 'text-status-danger-fg' : 'text-faint')} />
            </button>
          ))}
        </div>
      ) : null}
    </MenuBody>
  );

  if (phone) {
    return (
      <Sheet open onClose={onClose} title="Acțiuni mesaj" titleHidden initialSnap="fit">
        <div className="flex flex-col gap-3 pb-2">
          <MessagePreview message={message} isMine={isMine} />
          {content}
        </div>
      </Sheet>
    );
  }
  return (
    <AnchoredMenu anchor={anchor} isMine={isMine} onClose={onClose}>
      {content}
    </AnchoredMenu>
  );
}

/** role=menu with roving arrow-key focus over its items (emoji and actions, in reading order). */
function MenuBody({ label, focusFirst, phone, children }: { label: string; focusFirst: 'action' | 'emoji'; phone: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const items = ref.current?.querySelectorAll<HTMLElement>(focusFirst === 'action' ? '[role="menuitem"]' : '[role="menuitemradio"]');
    // After the surface's own focus handling (showModal focuses its first focusable).
    const id = requestAnimationFrame(() => items?.[0]?.focus());
    return () => cancelAnimationFrame(id);
  }, [focusFirst]);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]') ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = at < 0 ? 0 : (at + 1) % items.length;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = at <= 0 ? items.length - 1 : at - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    items[next]?.focus();
  };
  return (
    <div ref={ref} role="menu" aria-label={label} aria-orientation="vertical" onKeyDown={onKeyDown} className={cn('flex flex-col', phone ? 'items-stretch gap-3' : 'gap-2')}>
      {children}
    </div>
  );
}

/** fish ReactionBar: the six emoji in a round pill, mine on the accent tint. */
export function ReactionBar({ selected, onPick, phone = false }: { selected: string | undefined; onPick: (emoji: string) => void; phone?: boolean }) {
  return (
    <div role="group" aria-label="Reacții" className={cn('flex items-center justify-between gap-0.5 rounded-full bg-surface px-1.5 py-1 ring-1 ring-hairline', phone ? 'self-center' : 'w-fit shadow-e2')}>
      {REACTION_EMOJIS.map(emoji => (
        <button
          key={emoji}
          type="button"
          role="menuitemradio"
          aria-checked={emoji === selected}
          aria-label={`Reacționează cu ${emoji}`}
          onClick={() => onPick(emoji)}
          className={cn(
            'flex size-10 cursor-pointer items-center justify-center rounded-full t-display transition-transform outline-none hover:scale-110 hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-solid focus-visible:outline-accent motion-reduce:hover:scale-100',
            emoji === selected && 'bg-accent-tint-2 hover:bg-accent-tint-2',
          )}
        >
          <span aria-hidden>{emoji}</span>
        </button>
      ))}
    </div>
  );
}

/** The phone sheet's head: the message the menu is about (fish's bubble clone, compact). */
function MessagePreview({ message, isMine }: { message: chat.ChatListMessage; isMine: boolean }) {
  const photos = message.attachments?.length ?? 0;
  const text = message.text || (photos ? (photos === 1 ? 'Imagine' : `${photos} imagini`) : 'Mesaj');
  return (
    <div className={cn('max-w-[85%] rounded-card px-3 py-2', isMine ? 'self-end bg-accent text-on-accent' : 'self-start bg-soft-fill text-ink')}>
      {isMine ? null : <p className="t-label text-accent-ink">{message.senderName}</p>}
      <p className="line-clamp-3 t-body break-words whitespace-pre-wrap">{text}</p>
    </div>
  );
}

/**
 * From 768: a modal <dialog> placed beside the bubble (model menuPlacement: under it when it fits,
 * else above, aligned with its outer edge). The light scrim dims the room; a click on it closes.
 */
function AnchoredMenu({ anchor, isMine, onClose, children }: { anchor: HTMLElement | null; isMine: boolean; onClose: () => void; children: ReactNode }) {
  const dialog = useModalDialog(true, onClose);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    const d = dialog.ref.current;
    if (!d) return;
    const place = () => {
      const r = anchor?.getBoundingClientRect();
      const box = { width: d.offsetWidth, height: d.offsetHeight };
      const vp = { width: window.innerWidth, height: window.innerHeight };
      const a = r && r.width ? { top: r.top, left: r.left, width: r.width, height: r.height } : { top: vp.height / 2 - 40, left: (vp.width - box.width) / 2, width: box.width, height: 80 };
      setPos(menuPlacement(a, box, vp, isMine));
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor, isMine, dialog.ref]);
  return (
    <dialog
      {...dialog}
      aria-label="Acțiuni mesaj"
      className={cn(
        'fixed m-0 max-h-none max-w-none overflow-visible bg-transparent p-0 text-left text-ink backdrop:bg-scrim/25',
        'opacity-100 transition-[opacity,scale] duration-(--duration-fast) ease-fast starting:scale-95 starting:opacity-0',
        isMine ? 'origin-top-right' : 'origin-top-left',
        !pos && 'invisible',
      )}
      style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0 }}
    >
      {children}
    </dialog>
  );
}
