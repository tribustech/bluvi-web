'use client';

import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { getInitials } from '@/components/ui/initials';
import { cn } from '@/components/ui/cn';

/** What a ranking row knows about its face: a photo (or none → initials) and whether it is a team. */
export type RankingFaceData = { src: string | null; team: boolean };

/*
 * The kit Avatar's `solid` tone (components/ui/Avatar.tsx TONE: fish's filled indigo placeholder
 * disc), for every row: ROADMAP §4b.13 «initials on the solid tone». The pastel tones vanished on
 * fish's 40% / 90% sector fills and the feeder zebra; the filled disc reads on all of them.
 */
const SOLID = 'bg-accent text-on-accent';

/**
 * The avatar beside a person or team name in a ranking table (ROADMAP §4b.13): the photo (the kit
 * Avatar), or the initials on the solid indigo disc; a team square (Fundații §07). Only from 768 — the
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
            SOLID,
          )}
        />
      )}
    </span>
  );
}
