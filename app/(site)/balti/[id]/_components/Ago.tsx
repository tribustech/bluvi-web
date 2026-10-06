'use client';

import { useSyncExternalStore } from 'react';

/*
 * fish `acum ${formatDistanceToNowStrict(date, { locale: ro })}` — «acum 3 luni». The server (and a
 * static page) cannot know «now», so it prints the date; the browser swaps in the relative form
 * after hydration (no mismatch: the server snapshot is the absolute date).
 */

const DATE = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Bucharest' });

const UNITS: [limitSeconds: number, seconds: number, one: string, few: string][] = [
  [60, 1, 'secundă', 'secunde'],
  [3600, 60, 'minut', 'minute'],
  [86_400, 3600, 'oră', 'ore'],
  [2_592_000, 86_400, 'zi', 'zile'],
  [31_536_000, 2_592_000, 'lună', 'luni'],
  [Infinity, 31_536_000, 'an', 'ani'],
];

/** Romanian plural with «de» from 20 (fish date-fns ro: «21 de zile»). */
function count(n: number, one: string, few: string): string {
  if (n === 1) return `1 ${one}`;
  const rest = n % 100;
  return rest === 0 || rest >= 20 ? `${n} de ${few}` : `${n} ${few}`;
}

export function agoRo(iso: string, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 1000));
  for (const [limit, unit, one, few] of UNITS) {
    if (s < limit) return `acum ${count(Math.max(1, Math.round(s / unit)), one, few)}`;
  }
  return '';
}

const subscribe = () => () => {};

export function Ago({ iso }: { iso: string }) {
  const label = useSyncExternalStore(
    subscribe,
    () => agoRo(iso, Date.now()),
    () => DATE.format(new Date(iso)),
  );
  return <time dateTime={iso}>{label}</time>;
}
