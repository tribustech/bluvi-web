'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/components/ui/cn';

// fish (tabs)/index.tsx — the two lists must keep the same length.
const SLOGANS = [
  'Capturi mari, povești și mai mari. Împărtășește-ți aventura!',
  'Intră în comunitate și prinde amintiri împreună!',
  'Pescuitul e mai frumos când ai cu cine să îți spui poveștile!',
  'Ai tot ce trebuie pentru captura record? Intră în concurs!',
];
const SLOGANS_SIGNED_OUT = [
  'Creează-ți cont pentru a te alătura comunității',
  'Intră în contul tău să te poți înscrie la competiții',
  'Creează-ți cont pentru a primi cele mai noi știri',
  'Intră în contul tău să te poți înscrie la competiții',
];

const KEY = 'bluvi:acasa:slogan';

// One advance per page view, shared by every <Slogan> on it (mobile and desktop both mount one).
let current: { at: number; index: number } | null = null;
function visitIndex(): number {
  if (current && performance.now() - current.at < 1000) return current.index;
  // The tab's first visit keeps index 0 (the server's pick, no swap); later visits rotate.
  let next = 0;
  try {
    const prev = sessionStorage.getItem(KEY);
    next = prev == null ? 0 : (Number(prev) + 1) % SLOGANS.length;
    sessionStorage.setItem(KEY, String(next));
  } catch {
    // Storage blocked: keep the server's pick.
  }
  current = { at: performance.now(), index: next };
  return next;
}

/**
 * fish: the slogan advances every time Acasă is focused. The web equivalent is every visit of the
 * page in this tab (sessionStorage), which only the browser knows. So the server renders the first
 * slogan, VISIBLE — without JS, or before hydration, the line still reads — and when the visit picks
 * another one it replaces it with a fade. The same pick (index 0) keeps the server's node: nothing
 * swaps. Opacity only, on an ease that does not overshoot: the header caption is `truncate`
 * (overflow hidden), where a slide would be clipped. The line box is the same either way.
 */
export function Slogan({ signedIn, as: Tag = 'p', className }: { signedIn: boolean; as?: 'p' | 'span'; className?: string }) {
  const list = signedIn ? SLOGANS : SLOGANS_SIGNED_OUT;
  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads storage once after hydration
    setIndex(visitIndex());
  }, []);

  const shown = index ?? 0;
  return (
    <>
      {/* React 19 hoists and dedupes a <style> with href + precedence. */}
      <style href="acasa-slogan" precedence="default">
        {'@keyframes acasa-slogan{from{opacity:0}to{opacity:1}}'}
      </style>
      <Tag
        key={shown}
        className={cn(
          'text-muted',
          Tag === 'span' && 'block',
          shown !== 0 && 'motion-safe:animate-[acasa-slogan_var(--duration-medium)_var(--ease-slow)]',
          className ?? 't-body',
        )}
      >
        {list[shown]}
      </Tag>
    </>
  );
}
