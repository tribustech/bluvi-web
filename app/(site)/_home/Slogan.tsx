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
  let next = 1;
  try {
    next = (Number(sessionStorage.getItem(KEY) ?? '0') + 1) % SLOGANS.length;
    sessionStorage.setItem(KEY, String(next));
  } catch {
    // Storage blocked: advance per view only.
  }
  current = { at: performance.now(), index: next };
  return next;
}

/**
 * fish: the slogan advances every time Acasă is focused. The web equivalent is every visit of the
 * page in this tab (sessionStorage). The server renders the first one; the next fades in.
 */
export function Slogan({ signedIn, className }: { signedIn: boolean; className?: string }) {
  const list = signedIn ? SLOGANS : SLOGANS_SIGNED_OUT;
  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads storage once after hydration
    setIndex(visitIndex());
  }, []);

  return (
    <>
      {/* React 19 hoists and dedupes a <style> with href + precedence. */}
      <style href="acasa-slogan" precedence="default">
        {'@keyframes acasa-slogan{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}'}
      </style>
      <p
        key={index ?? 'ssr'}
        aria-live="off"
        className={cn('t-body text-muted', index !== null && 'animate-[acasa-slogan_var(--duration-medium)_var(--ease-medium)]', className)}
      >
        {list[index ?? 0]}
      </p>
    </>
  );
}
