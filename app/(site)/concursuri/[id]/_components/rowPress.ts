'use client';

import { useEffect, type RefObject } from 'react';

/*
 * A ranking row pressed opens its angler's stats (fish CompetitionRanking `onRowPress`, parity
 * competition-page.statistici-pescar.c1). The kit RankingTable / RankingRow draw the rows and take
 * no row action (TODO(kit): an `onRowPress` on both), so the row is made pressable from the outside:
 * every row matching `selector` under `container` becomes focusable (tab stop, Enter / Space) and
 * clickable; `keyOf` reads which row it is from what the kit renders. Re-applied after each render
 * (sorting and filtering re-create rows).
 */
export function useRowPress<E extends HTMLElement>(
  container: RefObject<HTMLElement | null>,
  selector: string,
  keyOf: (row: E, index: number) => string | null,
  onPress: ((key: string) => void) | undefined,
) {
  useEffect(() => {
    const root = container.current;
    if (!root || !onPress) return;
    const rows = () => [...root.querySelectorAll<E>(selector)];
    for (const row of rows()) {
      if (row.tabIndex !== 0) row.tabIndex = 0;
      row.dataset.pressable = '';
    }
    const target = (e: Event): string | null => {
      // The row holding the target (not `closest(selector)`: a `:scope` selector is relative to root).
      const all = rows();
      const el = e.target instanceof Node ? all.find(r => r.contains(e.target as Node)) : undefined;
      if (!el) return null;
      // A control inside the row (a sort header never matches; a link or button would) keeps its own action.
      if (e.target instanceof Element && e.target !== el && e.target.closest('a, button, input, select, textarea')) return null;
      return keyOf(el, all.indexOf(el));
    };
    const click = (e: MouseEvent) => {
      const key = target(e);
      if (key) onPress(key);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (!(e.target instanceof HTMLElement) || !rows().includes(e.target as E)) return;
      const k = target(e);
      if (!k) return;
      e.preventDefault();
      onPress(k);
    };
    root.addEventListener('click', click);
    root.addEventListener('keydown', key);
    return () => {
      root.removeEventListener('click', click);
      root.removeEventListener('keydown', key);
    };
  });
}

/** The classes a pressable row gets (hover / focus), keyed off the `data-pressable` mark. */
export const PRESSABLE_ROWS =
  '[&_[data-pressable]]:cursor-pointer [&_[data-pressable]:hover]:bg-soft-fill [&_[data-pressable]:focus-visible]:outline-2 [&_[data-pressable]:focus-visible]:-outline-offset-2 [&_[data-pressable]:focus-visible]:outline-accent';
