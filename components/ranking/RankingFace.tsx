'use client';

import { useEffect, useRef, useState } from 'react';
import { Avatar, toneForName, type AvatarTone } from '@/components/ui/Avatar';
import { getInitials } from '@/components/ui/initials';
import { cn } from '@/components/ui/cn';

/** What a ranking row knows about its face: a photo (or none → initials) and whether it is a team. */
export type RankingFaceData = { src: string | null; team: boolean };

// The kit Avatar's tone pairs (components/ui/Avatar.tsx TONE), for the initials drawn below.
const TONE: Record<Exclude<AvatarTone, 'solid'>, string> = {
  indigo: 'bg-accent-tint text-accent-ink',
  tint: 'bg-accent-tint-2 text-accent-ink',
  success: 'bg-status-success-bg text-status-success-fg',
  warning: 'bg-status-warning-bg text-status-warning-fg',
  neutral: 'bg-status-neutral-bg text-status-neutral-fg',
};

/**
 * The avatar beside a person or team name in a ranking table (ROADMAP §4b.13): the photo (the kit
 * Avatar), or the initials on the name's tone; a team square (Fundații §07). Only from 768 — the
 * phone's columns have no room for it. Decorative: the name is printed next to it, so the initials
 * are CSS content (`data-initials`) and never join the cell's text (copy, search, its accessible
 * name). A photo that fails to load (a dead CMS URL) falls back to the initials, also when it failed
 * before hydration. TODO(kit): Avatar could take a `textless` option and its own failed state.
 */
export function RankingFace({ name, face, className }: { name: string; face?: RankingFaceData | null; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const box = useRef<HTMLSpanElement>(null);
  const src = face?.src && face.src !== failed ? face.src : null;
  useEffect(() => {
    const img = box.current?.querySelector('img');
    if (img && img.complete && img.naturalWidth === 0 && face?.src) setFailed(face.src);
  }, [face?.src]);
  const tone = toneForName(name);
  return (
    <span
      ref={box}
      aria-hidden
      data-ranking-face=""
      className={cn('inline-flex shrink-0 max-md:hidden', className)}
      onErrorCapture={() => setFailed(face?.src ?? null)}
    >
      {src ? (
        <Avatar name={name} src={src} size={32} shape={face?.team ? 'square' : 'round'} />
      ) : (
        <span
          data-initials={getInitials(name)}
          className={cn(
            'inline-flex size-8 items-center justify-center text-initials-32 leading-none font-extrabold select-none before:content-[attr(data-initials)]',
            face?.team ? 'rounded-avatar' : 'rounded-full',
            TONE[tone === 'solid' ? 'indigo' : tone],
          )}
        />
      )}
    </span>
  );
}
