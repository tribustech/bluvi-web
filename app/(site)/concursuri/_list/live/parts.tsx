import Image from 'next/image';
import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

/*
 * The Live tab's small shared pieces (prototype app/dev/hub parts.tsx): fish's elevated card surface,
 * the section heading, the poster thumbnail.
 */

/** fish CardShell elevated: radius 16, e1 + hairline. */
export const LIVE_CARD = 'rounded-card bg-surface shadow-[var(--shadow-e1),var(--shadow-e0)]';

/** Section heading: title, optional count, optional trailing note. */
export function SectionHead({ title, count, children, id }: { title: string; count?: number; children?: ReactNode; id?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h2 id={id} className="flex items-baseline gap-2 t-title2 text-ink">
        {title}
        {count !== undefined ? <span className="t-label text-muted tabular-nums">{count}</span> : null}
      </h2>
      {children}
    </div>
  );
}

const THUMB = {
  md: 'size-14 rounded-avatar',
  xl: 'size-20 rounded-card xl:size-24',
} as const;

/** The poster: the competition's main identifier (a soft fill when it has none). */
export function PosterThumb({ src, size = 'xl', priority = false, className }: { src: string | null; size?: keyof typeof THUMB; priority?: boolean; className?: string }) {
  return (
    <span className={cn('relative block shrink-0 overflow-hidden bg-soft-fill', THUMB[size], className)}>
      {src ? <Image src={src} alt="" fill sizes="96px" className="object-cover" {...(priority ? { loading: 'eager' as const, fetchPriority: 'high' as const } : {})} /> : null}
    </span>
  );
}
