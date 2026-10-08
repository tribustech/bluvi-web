'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { READ_RATIO, READ_VISIBLE_MS } from './model';

/*
 * fish MessageList viewabilityConfig + onViewableItemsChanged (participant.chat c33): a row counts as
 * read once at least 50% of it has been in the list's viewport for 250 ms. Rows carry their message
 * ids in `data-read-ids` (one for a message, every event for a folded group: seeing «12 evenimente»
 * reads them; a pending row carries none until it is delivered). `onSeen` gets the ids of the rows
 * that crossed the bar, and only while `active` (the page visible — the caller's rule); the list is
 * keyed by room, so only the room on screen ever reports. `deps` changes when rows mount or change:
 * new rows are observed, and rows already on screen are counted again (a pending row just delivered;
 * the receipt marker drops what is not newer than its last write).
 */
export function useVisibilityReceipts(
  root: RefObject<HTMLElement | null>,
  { active, onSeen, deps }: { active: boolean; onSeen: (ids: string[]) => void; deps: unknown },
) {
  const onSeenRef = useRef(onSeen);
  const activeRef = useRef(active);
  useEffect(() => {
    onSeenRef.current = onSeen;
    activeRef.current = active;
  });

  const io = useRef<IntersectionObserver | null>(null);
  const timers = useRef(new Map<Element, ReturnType<typeof setTimeout>>());
  const shown = useRef(new Set<Element>());

  const schedule = useRef((row: Element) => {
    const prev = timers.current.get(row);
    if (prev) clearTimeout(prev);
    timers.current.set(
      row,
      setTimeout(() => {
        timers.current.delete(row);
        if (!activeRef.current || !shown.current.has(row) || !row.isConnected) return;
        const ids = (row.getAttribute('data-read-ids') ?? '').split(',').filter(Boolean);
        if (ids.length) onSeenRef.current(ids);
      }, READ_VISIBLE_MS),
    );
  });

  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const pending = timers.current;
    const visible = shown.current;
    const observer = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= READ_RATIO) {
            if (visible.has(e.target)) continue;
            visible.add(e.target);
            schedule.current(e.target);
          } else {
            visible.delete(e.target);
            const t = pending.get(e.target);
            if (t) clearTimeout(t);
            pending.delete(e.target);
          }
        }
      },
      { root: el, threshold: [0, READ_RATIO, 1] },
    );
    io.current = observer;
    el.querySelectorAll('[data-read-ids]').forEach(row => observer.observe(row));
    return () => {
      observer.disconnect();
      io.current = null;
      for (const t of pending.values()) clearTimeout(t);
      pending.clear();
      visible.clear();
    };
  }, [root]);

  useEffect(() => {
    const observer = io.current;
    const el = root.current;
    if (!observer || !el) return;
    el.querySelectorAll('[data-read-ids]').forEach(row => observer.observe(row));
    for (const row of shown.current) {
      if (!row.isConnected) shown.current.delete(row);
      else schedule.current(row);
    }
  }, [root, deps]);

  // Back on the page: what is on screen counts again (its 250 ms start now).
  useEffect(() => {
    if (!active) return;
    for (const row of shown.current) schedule.current(row);
  }, [active]);
}
