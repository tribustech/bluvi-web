'use client';

import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';
import { cn } from '@/components/ui/cn';
import { useChat } from './ChatController';

/*
 * STUB — slice 3 («composer») replaces this file wholesale with fish ChatComposer
 * (participant.chat.c25–c29: reply / edit banners, the photo tray, camera, the action slot).
 * Contract with the frame: it sits at the bottom of the conversation column and sends with
 * `useChat().send(text)` (the outbox pipeline, c30–c31: the bubble shows at once, retries 2 / 8 /
 * 30 s); typing calls `onTypingChange`; `canWrite` false → disabled. Until then: a text field and
 * «Trimite».
 */

const MAX = 1000;

export function Composer({ className }: { className?: string }) {
  const c = useChat();
  const [text, setText] = useState('');
  const canSend = c.canWrite && text.trim().length > 0;

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSend) return;
    const value = text;
    setText('');
    c.onTypingChange(false);
    await c.send(value);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <form onSubmit={e => void submit(e)} className={cn('flex items-end gap-2 border-t border-hairline bg-surface px-3 pt-2.5 pb-[calc(--spacing(2.5)+env(safe-area-inset-bottom))]', className)}>
      <label htmlFor="chat-mesaj" className="sr-only">
        Mesaj
      </label>
      <textarea
        id="chat-mesaj"
        rows={1}
        maxLength={MAX}
        value={text}
        disabled={!c.canWrite}
        placeholder="Mesaj"
        onChange={e => {
          setText(e.target.value);
          c.onTypingChange(e.target.value.length > 0);
        }}
        onBlur={() => c.onTypingChange(false)}
        onKeyDown={onKeyDown}
        className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-control border border-handle bg-surface px-3 py-2.5 t-field text-ink placeholder:text-muted focus-visible:border-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-soft-fill"
      />
      <button
        type="submit"
        aria-label="Trimite"
        disabled={!canSend}
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent text-on-accent shadow-button transition-opacity duration-(--duration-fast) hover:brightness-95 active:opacity-80 disabled:cursor-not-allowed disabled:bg-accent-disabled disabled:text-on-accent-disabled disabled:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent"
      >
        <PaperAirplaneIcon aria-hidden className="size-5" />
      </button>
    </form>
  );
}
