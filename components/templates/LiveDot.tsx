import { cn } from '@/components/ui/cn';

/**
 * The on-air dot — the one pulsing element in the system (Fundații §06), used wherever a live state
 * is marked: list tabs and filters (T1), Acasă's rails and «Concursul meu», the competition page's
 * views, stat row and action bar, the T3 lake stats. One component so every live marker is the same
 * light. Reduced motion: the global rule plays the pulse once (globals.css).
 *
 * Shared by every template (T1 re-exports it). TODO(components/ui): move next to StatusPill.
 *
 * `tone`: `live` (rose on a light ground); `on-accent` — the lighter live-dot, for a dot on a filled
 * accent-ink chip, where live is too dark; `inverse` — white, on a filled live / accent banner.
 * `size`: `sm` 6px (default: inline with caption / body text), `md` 8px (beside a heading-sized
 * label on a filled banner).
 */
export function LiveDot({
  label,
  tone = 'live',
  size = 'sm',
  className,
}: {
  /** Speaks the dot (role img) when nothing next to it says «live». */
  label?: string;
  tone?: 'live' | 'on-accent' | 'inverse';
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        'shrink-0 animate-live rounded-full',
        size === 'sm' ? 'size-1.5' : 'size-2',
        tone === 'live' ? 'bg-live' : tone === 'on-accent' ? 'bg-live-dot' : 'bg-on-accent',
        className,
      )}
    />
  );
}
