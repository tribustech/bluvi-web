"use client";

import { useCallback, useEffect, useRef } from "react";
import { useChat } from "../ChatController";
import { reportsTyping } from "./model";

/*
 * The composer's side of fish useChatTyping (participant.chat.c32). The writer itself is core
 * createTypingWriter behind `useChat().onTypingChange` (one per room: written at most every 2.5 s,
 * cleared after 5 s idle, cleared when the room or the page goes). Here: a keystroke with text
 * reports «typing» (fish 2026-09-15: emptying the field does NOT report «stopped» — that flipped the
 * other side's «X scrie...» with every keystroke); a send, a blur and the composer leaving (the chat
 * closed under it) report «stopped» — once, only after a «typing».
 */
export function useTypingWriter() {
  const { onTypingChange, activeRoom } = useChat();
  const active = useRef(false);
  const writer = useRef(onTypingChange);
  useEffect(() => {
    writer.current = onTypingChange;
  }, [onTypingChange]);

  // A new room gets a new writer (the old one cleared itself on dispose).
  useEffect(() => {
    active.current = false;
  }, [activeRoom]);

  const typed = useCallback((next: string) => {
    if (!reportsTyping(next)) return;
    active.current = true;
    writer.current(true);
  }, []);

  const stopped = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    writer.current(false);
  }, []);

  useEffect(() => () => stopped(), [stopped]);

  return { typed, stopped };
}
