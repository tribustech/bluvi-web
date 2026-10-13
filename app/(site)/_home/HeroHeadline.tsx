'use client';

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { cn } from '@/components/ui/cn';

/**
 * A guest's hero title from 768 (owner 2026-10-13: «Aplicația pentru {rezervări}, {partide},
 * {cronometre}… cu culori diferite», then «typing animation»): «Aplicația pentru» over a word that
 * types itself letter by letter behind a blinking caret, holds, erases and gives way to the next —
 * each word in its own hue (the shortcuts' colours, which the category row lights up with). The
 * line keeps one text height while empty, so nothing below moves. Reduced motion: the first word,
 * still, no caret.
 *
 * The h1's accessible name is the whole sentence (GUEST_TITLE); the typed line is aria-hidden, so a
 * screen reader never hears letters change.
 */
const WORDS: { text: string; hue: string }[] = [
  { text: 'concursuri live', hue: 'var(--color-live)' },
  { text: 'rezervări', hue: 'var(--color-shortcut-plum-solid)' },
  { text: 'partide', hue: 'var(--color-shortcut-teal-solid)' },
  { text: 'cronometre', hue: 'var(--color-shortcut-blue-solid)' },
  { text: 'clasamente', hue: 'var(--color-shortcut-violet-solid)' },
  { text: 'bălți', hue: 'var(--color-shortcut-cyan-solid)' },
];

/** Typing feels human a little uneven; erasing is quicker. */
const TYPE_MS = 85;
const ERASE_MS = 40;
const HOLD_MS = 1800;
const GAP_MS = 350;

const REDUCED = () => window.matchMedia('(prefers-reduced-motion: reduce)');
function subscribeMotion(onChange: () => void) {
  const mq = REDUCED();
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

export function HeroHeadline({ label }: { label: string }) {
  const [word, setWord] = useState(0);
  // Letters shown; starts full so the server paint (and reduced motion) shows the whole first word.
  const [shown, setShown] = useState(WORDS[0].text.length);
  const [phase, setPhase] = useState<'typing' | 'holding' | 'erasing'>('holding');
  // Off on the server and during hydration (the whole first word, no caret), then the viewer's setting.
  const animate = useSyncExternalStore(subscribeMotion, () => !REDUCED().matches, () => false);

  useEffect(() => {
    if (!animate) return;
    const text = WORDS[word].text;
    let id: number;
    if (phase === 'holding') {
      id = window.setTimeout(() => setPhase('erasing'), HOLD_MS);
    } else if (phase === 'erasing') {
      id =
        shown > 0
          ? window.setTimeout(() => setShown((n) => n - 1), ERASE_MS)
          : window.setTimeout(() => {
              setWord((w) => (w + 1) % WORDS.length);
              setPhase('typing');
            }, GAP_MS);
    } else {
      id =
        shown < text.length
          ? window.setTimeout(() => setShown((n) => n + 1), TYPE_MS + (shown % 3) * 25)
          : window.setTimeout(() => setPhase('holding'), 0);
    }
    return () => window.clearTimeout(id);
  }, [animate, phase, shown, word]);

  const { text, hue } = WORDS[word];
  return (
    <>
      <span className="sr-only">{label}</span>
      <span aria-hidden className="flex flex-col items-center">
        <span>Aplicația pentru</span>
        <span className="inline-flex items-center pb-1" style={{ '--hue': hue } as CSSProperties}>
          {/* A zero-width space keeps the line's height while no letter is shown. */}
          <span className="bg-[linear-gradient(100deg,var(--hue),color-mix(in_oklab,var(--hue)_62%,var(--color-accent)))] bg-clip-text whitespace-pre text-transparent">
            {'​'}
            {text.slice(0, shown)}
          </span>
          {animate ? (
            <span
              className={cn('ml-1 h-[0.9em] w-[0.07em] min-w-[3px] rounded-full bg-(--hue)', phase === 'typing' || phase === 'erasing' ? 'opacity-100' : 'animate-caret')}
            />
          ) : null}
        </span>
      </span>
    </>
  );
}
