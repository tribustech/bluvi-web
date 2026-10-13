'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { cn } from '@/components/ui/cn';

/**
 * A guest's hero title from 768 (owner 2026-10-13: «Aplicația pentru {rezervări}, {partide},
 * {cronometre}… cu culori diferite»): «Aplicația pentru» over one word that changes every 2.4s,
 * each in its own hue (the shortcuts' — the same colours the category row lights up with). The new
 * word rises in as the old one rises out; the line holds the widest word's box, so nothing around it
 * moves. Reduced motion: the first word, still.
 *
 * The h1's accessible name is the whole sentence (GUEST_TITLE); the rotating line is aria-hidden, so
 * a screen reader never hears a word change.
 */
const WORDS: { text: string; hue: string }[] = [
  { text: 'concursuri live', hue: 'var(--color-live)' },
  { text: 'rezervări', hue: 'var(--color-shortcut-plum-solid)' },
  { text: 'partide', hue: 'var(--color-shortcut-teal-solid)' },
  { text: 'cronometre', hue: 'var(--color-shortcut-blue-solid)' },
  { text: 'clasamente', hue: 'var(--color-shortcut-violet-solid)' },
  { text: 'bălți', hue: 'var(--color-shortcut-cyan-solid)' },
];

const STEP_MS = 2400;

export function HeroHeadline({ label }: { label: string }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % WORDS.length), STEP_MS);
    return () => window.clearInterval(id);
  }, []);
  return (
    <>
      <span className="sr-only">{label}</span>
      <span aria-hidden className="flex flex-col items-center">
        <span>Aplicația pentru</span>
        {/* Every word in one grid cell: the cell is the widest word's box. */}
        <span className="grid overflow-hidden pb-1">
          {WORDS.map((w, i) => {
            const state = i === index ? 'current' : i === (index - 1 + WORDS.length) % WORDS.length ? 'leaving' : 'waiting';
            return (
              <span
                key={w.text}
                data-state={state}
                style={{ '--hue': w.hue } as CSSProperties}
                className={cn(
                  '[grid-area:1/1] bg-[linear-gradient(100deg,var(--hue),color-mix(in_oklab,var(--hue)_62%,var(--color-accent)))] bg-clip-text text-transparent',
                  'transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                  'data-[state=current]:translate-y-0 data-[state=current]:opacity-100',
                  'data-[state=leaving]:-translate-y-[0.7em] data-[state=leaving]:opacity-0',
                  'data-[state=waiting]:translate-y-[0.7em] data-[state=waiting]:opacity-0 data-[state=waiting]:transition-none',
                )}
              >
                {w.text}
              </span>
            );
          })}
        </span>
      </span>
    </>
  );
}
