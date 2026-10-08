'use client';

import { memo, useEffect, useRef } from 'react';
import { FishIcon } from '@/components/icons/brand';
import { cn } from '@/components/ui/cn';
import { FishHookIcon } from './FishHookIcon';

/*
 * The outcome takeover (fish PartidaRodCard OutcomeTakeover / ScapatScene / BlankScene, parity
 * partide.partida-lansete.c6): after a recorded «Scăpat» / «Fără trăsătură» the card is covered for
 * FLASH_MS by a little scene and a random one-liner, and taps on the card are swallowed meanwhile
 * (the card also ignores activations while `flash` is set — the keyboard included).
 *
 *  - Scăpat: the fish thrashes, darts off to the right, a splash ring and a bubble trail; the joke
 *    takes the stage once the fish has left (780 ms).
 *  - Fără trăsătură: still water — the hook bobs, ripples spread; the joke at 360 ms.
 * Web Animations API, run once per takeover (memo: the card re-renders every second while a rod
 * counts down, which must not restart them). prefers-reduced-motion: no motion at all, the scene
 * and the joke are simply there. Announced once (role="status").
 */

export const FLASH_MS = 2600;

export type FlashKind = 'lost' | 'blank';

export const LOST_JOKES = ['A scăpat... oricum era mic.', 'S-a dus... lasă că vine altul mai mare.', 'Peștele: 1 — Tu: 0', 'A zis că revine cu întăriri.'];
export const BLANK_JOKES = ['Nu îi e foame...', 'Hmm, probabil era în mâl.', 'Azi peștii țin post.', 'Liniște totală pe baltă.'];

export const pickJoke = (kind: FlashKind) => {
  const pool = kind === 'lost' ? LOST_JOKES : BLANK_JOKES;
  return pool[Math.floor(Math.random() * pool.length)];
};

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type Keyframes = Keyframe[];
const play = (el: Element | null, frames: Keyframes, options: KeyframeAnimationOptions) => {
  if (!el || typeof (el as HTMLElement).animate !== 'function') return;
  (el as HTMLElement).animate(frames, { fill: 'both', ...options });
};

export const OutcomeTakeover = memo(function OutcomeTakeover({ kind, joke }: { kind: FlashKind; joke: string }) {
  const lost = kind === 'lost';
  const root = useRef<HTMLDivElement>(null);
  const fish = useRef<HTMLSpanElement>(null);
  const ring = useRef<HTMLSpanElement>(null);
  const bubbles = useRef<(HTMLSpanElement | null)[]>([]);
  const hook = useRef<HTMLSpanElement>(null);
  const ripples = useRef<(HTMLSpanElement | null)[]>([]);
  const text = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion()) return;
    play(root.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    // The fade out in the last 200 ms (fish AnimatePresence exit).
    play(root.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: FLASH_MS - 200, fill: 'forwards' });
    play(text.current, [{ opacity: 0, transform: 'translateY(12px) scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 280, delay: lost ? 780 : 360, easing: 'ease-out' });
    if (lost) {
      play(
        fish.current,
        [
          { transform: 'translateX(0) rotate(0deg)' },
          { transform: 'translateX(0) rotate(-14deg)', offset: 0.13 },
          { transform: 'translateX(0) rotate(12deg)', offset: 0.26 },
          { transform: 'translateX(0) rotate(-10deg)', offset: 0.38 },
          { transform: 'translateX(0) rotate(8deg)', offset: 0.5 },
          { transform: 'translateX(0) rotate(0deg)', offset: 0.64, easing: 'ease-in' },
          { transform: 'translateX(340px) rotate(0deg)' },
        ],
        { duration: 820 },
      );
      play(ring.current, [{ opacity: 0, transform: 'scale(0.3)' }, { opacity: 0.55, transform: 'scale(0.96)', offset: 0.4 }, { opacity: 0, transform: 'scale(1.9)' }], { duration: 450, delay: 480 });
      bubbles.current.forEach((b, i) =>
        play(b, [{ opacity: 0, transform: 'translateY(0)' }, { opacity: 0.85, transform: `translateY(${-(16 + i * 3) * 0.4}px)`, offset: 0.4 }, { opacity: 0, transform: `translateY(${-(16 + i * 3)}px)` }], { duration: 480, delay: 520 + i * 110 }),
      );
    } else {
      play(hook.current, [{ transform: 'translateY(-2px)' }, { transform: 'translateY(3px)' }], { duration: 900, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
      ripples.current.forEach((r, i) =>
        play(r, [{ opacity: 0.45, transform: 'scale(0.45)' }, { opacity: 0, transform: 'scale(2.1)' }], { duration: 1400, delay: i * 440, iterations: Infinity }),
      );
    }
  }, [lost]);

  return (
    <div
      ref={root}
      role="status"
      data-testid="rod-takeover"
      data-kind={kind}
      className={cn('absolute inset-0 z-above flex flex-col items-center justify-center overflow-hidden rounded-card', lost ? 'bg-status-warning-bg text-status-warning-fg' : 'bg-soft-fill text-ink-2')}
    >
      {lost ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center motion-reduce:hidden">
          <span ref={fish} className="flex">
            <FishIcon size={34} />
          </span>
          <span ref={ring} className="absolute size-[34px] rounded-full border-2 border-current opacity-0" />
          {[0, 1, 2, 3].map(i => (
            <span
              key={i}
              ref={el => {
                bubbles.current[i] = el;
              }}
              className="absolute rounded-full bg-current opacity-0"
              style={{ left: `${66 + i * 7}%`, top: '46%', width: 7 - i, height: 7 - i }}
            />
          ))}
        </div>
      ) : (
        <div aria-hidden className="relative flex h-11 w-13 items-center justify-center">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              ref={el => {
                ripples.current[i] = el;
              }}
              className="absolute size-10 rounded-full border-[1.5px] border-current opacity-0"
            />
          ))}
          <span ref={hook} className="flex">
            <FishHookIcon size={26} />
          </span>
        </div>
      )}
      {lost ? (
        // Reduced motion: no thrash, no dart — the fish simply sits above the joke.
        <span aria-hidden className="mb-1 hidden motion-reduce:flex">
          <FishIcon size={30} />
        </span>
      ) : null}
      <div ref={text} className={cn('relative flex flex-col items-center gap-0.5 px-6 text-center', !lost && 'mt-1.5')}>
        <p className="t-label uppercase tracking-[1.5px]">{lost ? 'Scăpat' : 'Fără trăsătură'}</p>
        <p className="t-heading text-ink">{joke}</p>
      </div>
    </div>
  );
});
