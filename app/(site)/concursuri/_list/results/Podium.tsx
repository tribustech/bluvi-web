'use client';

import { useId, type CSSProperties } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { valueText } from '../desktop/model';
import { unitWord, type Entry } from './model';
import s from './results.module.css';

/*
 * The podium of an opened result (approved prototype app/dev/hub/Results.tsx): three stepped SVG
 * blocks (lit top face, soft lavender front, medal band), the competitors standing on them in the
 * order 2 · 1 · 3 and rising 3 → 2 → 1. An angler is their photo (initials without one); a team
 * its name over 2–3 members' faces; a club its square initials. A value only when the ranking
 * backs the podium (`pending` draws a bone where it will land).
 */

/** Visual order 2 · 1 · 3 (the list itself reads 1, 2, 3). */
const VISUAL = [1, 0, 2] as const;
const BLOCK_H = ['h-30 md:h-36', 'h-22 md:h-26', 'h-16 md:h-19'] as const;
const MEDAL_VAR = ['var(--color-medal-gold)', 'var(--color-medal-silver)', 'var(--color-medal-bronze)'] as const;
const MEDAL_TEXT = ['text-medal-gold', 'text-medal-silver', 'text-medal-bronze'] as const;
const PLACE = ['Locul 1', 'Locul 2', 'Locul 3'] as const;

export function Podium({ entries, pending }: { entries: Entry[]; pending: boolean }) {
  return (
    // The baseline bar sits on the wrapper (an <ol> holds <li>s only).
    <div className="relative mx-auto w-full max-w-140 pb-1.5">
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-1.5 rounded-full bg-lavender-3" />
      <ol aria-label="Podium" className="grid grid-cols-3 items-end gap-2 md:gap-3">
        {([0, 1, 2] as const).map((i) => {
          const e = entries[i];
          if (!e) return <li key={i} aria-hidden style={{ order: VISUAL[i] }} />;
          const win = i === 0;
          return (
            <li key={e.key} className={cn(s.podium, 'group flex min-w-0 flex-col items-center')} style={{ '--i': 2 - i, order: VISUAL[i] } as CSSProperties}>
              {/* The item's text for screen readers (browse mode ignores aria-label on a listitem); the rest is drawing. */}
              <span className="sr-only">{`${PLACE[i]}: ${e.name}${e.value != null ? `, ${valueText(e.value, e.unit)} ${unitWord(e.unit, e.value)}` : ''}`}</span>
              <Faces entry={e} place={i} />
              <span aria-hidden className={cn('line-clamp-2 w-full px-1 text-center text-ink', win ? 't-body-strong' : 't-label')}>
                {e.name}
              </span>
              <span aria-hidden className="mb-2 flex h-6 items-center justify-center whitespace-nowrap">
                {e.value != null ? (
                  <>
                    <span className={cn('tabular-nums text-ink', win ? 't-num-18' : 't-label')}>{valueText(e.value, e.unit)}</span>
                    <span className="ms-1 t-micro text-muted">{unitWord(e.unit, e.value)}</span>
                  </>
                ) : pending ? (
                  <span className="block h-3 w-12 animate-pulse rounded-full bg-soft-fill" />
                ) : null}
              </span>
              <Block place={i} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** One face in the medal ring; a team's 2–3 members overlap, each ringed. */
function Faces({ entry: e, place }: { entry: Entry; place: number }) {
  const win = place === 0;
  const ring = { boxShadow: `0 0 0 3px ${MEDAL_VAR[place]}` };
  const lift = 'transition-transform duration-(--duration-fast) group-hover:-translate-y-1';
  if (e.faces.length > 1) {
    return (
      <span aria-hidden className={cn('mb-2 flex shrink-0 items-center -space-x-3', lift)}>
        {e.faces.slice(0, 3).map((src, j) => (
          <span key={src + j} className="rounded-full bg-surface p-0.5 shadow-e2" style={ring}>
            <Avatar name={e.name} src={src} size={win ? 48 : 40} />
          </span>
        ))}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn('relative mb-2 grid shrink-0 place-items-center overflow-hidden bg-surface p-0.5 shadow-e2', win ? 'size-16 md:size-20' : 'size-13 md:size-16', e.club ? 'rounded-card' : 'rounded-full', lift)}
      style={ring}
    >
      <Avatar name={e.name} src={e.faces[0]} size={64} shape={e.club ? 'square' : 'round'} className="size-full! rounded-[inherit]" />
    </span>
  );
}

function Block({ place }: { place: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <span aria-hidden className={cn('relative block w-full', BLOCK_H[place])}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
        <defs>
          <linearGradient id={`t${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--color-surface)' }} />
            <stop offset="1" style={{ stopColor: 'var(--color-bento-lavender-2)' }} />
          </linearGradient>
          <linearGradient id={`f${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: place === 0 ? 'var(--color-accent-tint-2)' : 'var(--color-bento-lavender)' }} />
            <stop offset="1" style={{ stopColor: 'var(--color-bento-lavender-2)' }} />
          </linearGradient>
          <linearGradient id={`s${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: 'var(--color-navy)', stopOpacity: 0.1 }} />
            <stop offset="0.12" style={{ stopColor: 'var(--color-navy)', stopOpacity: 0 }} />
            <stop offset="0.88" style={{ stopColor: 'var(--color-navy)', stopOpacity: 0 }} />
            <stop offset="1" style={{ stopColor: 'var(--color-navy)', stopOpacity: 0.12 }} />
          </linearGradient>
        </defs>
        {/* top face (perspective), front, medal band, side shading */}
        <polygon points="5,0 95,0 100,10 0,10" fill={`url(#t${id})`} />
        <rect x="0" y="10" width="100" height="90" fill={`url(#f${id})`} />
        <rect x="0" y="10" width="100" height="2.5" style={{ fill: MEDAL_VAR[place] }} />
        <rect x="0" y="10" width="100" height="90" fill={`url(#s${id})`} />
      </svg>
      <span className={cn('absolute inset-x-0 top-[22%] text-center t-num-40', MEDAL_TEXT[place], s.emboss)}>{place + 1}</span>
    </span>
  );
}
